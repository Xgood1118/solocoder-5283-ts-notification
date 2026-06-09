import notificationQueue from './index';
import { SendNotificationRequest } from '../types';
import notificationProcessor from '../services/notification.service';
import silentHoursService from '../services/silentHours.service';
import logger from '../utils/logger';

class NotificationProducer {
  async sendNotification(request: SendNotificationRequest): Promise<{
    notificationIds: string[];
    skipped: { channel: string; reason: string }[];
  }> {
    const result = await notificationProcessor.processNotification(request);
    const notificationIds: string[] = [];

    for (const log of result.notificationLogs) {
      const silentResult = await silentHoursService.checkSilentHours(
        log.user_id,
        log.category as any,
        request.is_urgent
      );

      let delay = 0;
      if (silentResult.shouldDelay && silentResult.delayUntil) {
        delay = silentResult.delayUntil.getTime() - Date.now();
        if (delay < 0) delay = 0;
      }

      await notificationQueue.enqueueNotification(log.id, delay);
      notificationIds.push(log.id);
    }

    return {
      notificationIds,
      skipped: result.skipped,
    };
  }

  async sendBatch(notifications: SendNotificationRequest[]): Promise<{
    batchId: string;
    chunkCount: number;
    totalCount: number;
  }> {
    const result = await notificationQueue.enqueueBatch(notifications);
    return {
      batchId: result.batchId,
      chunkCount: result.chunkCount,
      totalCount: notifications.length,
    };
  }

  async retryDeadLetter(jobId: string): Promise<boolean> {
    return notificationQueue.retryDeadLetterJob(jobId);
  }

  async retryAllDeadLetters(): Promise<number> {
    return notificationQueue.retryAllDeadLetters();
  }

  async getQueueStats(): Promise<{
    waiting: number;
    active: number;
    completed: number;
    failed: number;
    delayed: number;
    deadLetter: number;
  }> {
    return notificationQueue.getQueueStats();
  }
}

const producer = new NotificationProducer();

export default producer;
export { NotificationProducer };
