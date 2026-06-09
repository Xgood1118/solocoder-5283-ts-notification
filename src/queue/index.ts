import { Queue, Worker, QueueEvents, Job } from 'bullmq';
import Redis from 'ioredis';
import { config } from '../config';
import { QueueJobData, BatchQueueJobData, SendNotificationRequest } from '../types';
import notificationProcessor from '../services/notification.service';
import trackingService from '../track/service';
import { generateSnowflakeId } from '../utils/snowflake';
import logger from '../utils/logger';

const NOTIFICATION_QUEUE_NAME = 'notifications';
const BATCH_QUEUE_NAME = 'notification_batches';
const DLQ_NAME = config.queue.deadLetterQueueName;

class NotificationQueue {
  private connection: Redis;
  private notificationQueue: Queue;
  private batchQueue: Queue;
  private dlq: Queue;
  private notificationWorker: Worker;
  private batchWorker: Worker;
  private queueEvents: QueueEvents;

  constructor() {
    this.connection = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
      maxRetriesPerRequest: null,
    });

    const connectionOpts = { connection: this.connection as any };

    this.notificationQueue = new Queue(NOTIFICATION_QUEUE_NAME, {
      ...connectionOpts,
      defaultJobOptions: {
        attempts: config.queue.defaultAttempts,
        backoff: config.queue.backoff,
        removeOnComplete: 1000,
        removeOnFail: 5000,
      },
    });

    this.batchQueue = new Queue(BATCH_QUEUE_NAME, {
      ...connectionOpts,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 2000 },
        removeOnComplete: 100,
        removeOnFail: 100,
      },
    });

    this.dlq = new Queue(DLQ_NAME, connectionOpts);

    this.notificationWorker = new Worker(
      NOTIFICATION_QUEUE_NAME,
      this.processNotificationJob.bind(this),
      {
        ...connectionOpts,
        concurrency: config.queue.concurrency,
      }
    );

    this.batchWorker = new Worker(
      BATCH_QUEUE_NAME,
      this.processBatchJob.bind(this),
      {
        ...connectionOpts,
        concurrency: 5,
      }
    );

    this.queueEvents = new QueueEvents(NOTIFICATION_QUEUE_NAME, connectionOpts);

    this.setupEventListeners();

    logger.info('Notification queue initialized');
  }

  private setupEventListeners(): void {
    this.notificationWorker.on('completed', (job) => {
      logger.debug(`Job ${job.id} completed`);
    });

    this.notificationWorker.on('failed', async (job, err) => {
      if (job) {
        logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts`, { error: err.message });
        if (job.attemptsMade >= config.queue.defaultAttempts) {
          await this.moveToDeadLetter(job);
        }
      }
    });

    this.queueEvents.on('completed', ({ jobId }) => {
      logger.debug(`Job ${jobId} completed event`);
    });

    this.queueEvents.on('failed', ({ jobId, failedReason }) => {
      logger.warn(`Job ${jobId} failed: ${failedReason}`);
    });
  }

  private async processNotificationJob(job: Job): Promise<void> {
    const data = job.data as QueueJobData;
    const { notificationId } = data;

    logger.debug(`Processing notification job: ${notificationId}`);

    const result = await notificationProcessor.sendNotificationImmediately(notificationId);

    if (!result.success) {
      throw new Error(result.error || 'Unknown error');
    }
  }

  private async processBatchJob(job: Job): Promise<void> {
    const data = job.data as BatchQueueJobData;
    const { notifications, batchId, chunkIndex } = data;

    logger.info(`Processing batch chunk ${chunkIndex} of batch ${batchId}, count: ${notifications.length}`);

    for (const notification of notifications) {
      try {
        const result = await notificationProcessor.processNotification(notification);
        for (const log of result.notificationLogs) {
          if (log.status === 'pending') {
            await this.enqueueNotification(log.id);
          }
        }
      } catch (error) {
        logger.error(`Batch notification failed`, { error, batchId, chunkIndex });
      }
    }
  }

  private async moveToDeadLetter(job: Job): Promise<void> {
    try {
      const data = job.data as QueueJobData;
      await this.dlq.add('dead_letter', {
        originalJobId: job.id,
        data: job.data,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        timestamp: new Date().toISOString(),
      });

      if (data.notificationId) {
        await trackingService.updateStatus(
          data.notificationId,
          'dead_letter',
          job.failedReason || undefined
        );
      }

      logger.error(`Job ${job.id} moved to dead letter queue`, {
        notificationId: data.notificationId,
        attempts: job.attemptsMade,
      });
    } catch (error) {
      logger.error('Failed to move job to DLQ', { error });
    }
  }

  async enqueueNotification(notificationId: string, delay?: number): Promise<string> {
    const job = await this.notificationQueue.add(
      'send_notification',
      { notificationId } as QueueJobData,
      {
        delay: delay || 0,
        jobId: `notif_${notificationId}`,
      }
    );

    await trackingService.updateStatus(notificationId, 'queued');
    logger.debug(`Notification ${notificationId} enqueued as job ${job.id}`);

    return job.id as string;
  }

  async enqueueBatch(notifications: SendNotificationRequest[]): Promise<{ batchId: string; chunkCount: number }> {
    const batchId = generateSnowflakeId();
    const chunkSize = config.queue.batchChunkSize;
    const chunks: SendNotificationRequest[][] = [];

    for (let i = 0; i < notifications.length; i += chunkSize) {
      chunks.push(notifications.slice(i, i + chunkSize));
    }

    for (let i = 0; i < chunks.length; i++) {
      await this.batchQueue.add(
        `batch_${batchId}_${i}`,
        {
          notifications: chunks[i],
          batchId,
          chunkIndex: i,
        } as BatchQueueJobData,
        {
          jobId: `batch_${batchId}_${i}`,
        }
      );
    }

    logger.info(`Batch ${batchId} enqueued with ${chunks.length} chunks, total ${notifications.length} notifications`);

    return { batchId, chunkCount: chunks.length };
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    deadLetter: number;
  }> {
    const [notifCounts, dlqCounts] = await Promise.all([
      this.notificationQueue.getJobCounts(),
      this.dlq.getJobCounts(),
    ]);

    return {
      waiting: notifCounts.waiting || 0,
      active: notifCounts.active || 0,
      completed: notifCounts.completed || 0,
      failed: notifCounts.failed || 0,
      delayed: notifCounts.delayed || 0,
      deadLetter: dlqCounts.waiting || 0,
    };
  }

  async getDeadLetterJobs(limit: number = 100): Promise<any[]> {
    const jobs = await this.dlq.getJobs(['waiting'], 0, limit - 1);
    return jobs.map(job => ({
      id: job.id,
      data: job.data,
      timestamp: job.timestamp,
      failedReason: (job as any).failedReason,
    }));
  }

  async retryDeadLetterJob(jobId: string): Promise<boolean> {
    const jobs = await this.dlq.getJobs(['waiting']);
    const job = jobs.find(j => j.id === jobId);

    if (!job) {
      return false;
    }

    const data = job.data as any;
    if (data && data.data && data.data.notificationId) {
      await this.enqueueNotification(data.data.notificationId);
      await job.remove();
      return true;
    }

    return false;
  }

  async retryAllDeadLetters(): Promise<number> {
    const jobs = await this.dlq.getJobs(['waiting']);
    let retried = 0;

    for (const job of jobs) {
      const data = job.data as any;
      if (data && data.data && data.data.notificationId) {
        await this.enqueueNotification(data.data.notificationId);
        await job.remove();
        retried++;
      }
    }

    logger.info(`Retried ${retried} dead letter jobs`);
    return retried;
  }

  async close(): Promise<void> {
    await this.notificationWorker.close();
    await this.batchWorker.close();
    await this.notificationQueue.close();
    await this.batchQueue.close();
    await this.dlq.close();
    await this.queueEvents.close();
    await this.connection.quit();
    logger.info('Notification queue closed');
  }

  getNotificationQueue(): Queue {
    return this.notificationQueue;
  }

  getBatchQueue(): Queue {
    return this.batchQueue;
  }

  getDeadLetterQueue(): Queue {
    return this.dlq;
  }
}

const notificationQueue = new NotificationQueue();

export default notificationQueue;
export { NotificationQueue };
