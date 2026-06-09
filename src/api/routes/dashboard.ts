import { Router, Request, Response } from 'express';
import trackingService from '../../track/service';
import producer from '../../queue/producer';
import notificationQueue from '../../queue';
import { getStats as getDbStats } from '../../db/notification.db';
import logger from '../../utils/logger';

const router = Router();

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const dbStats = await getDbStats();
    const queueStats = await producer.getQueueStats();

    const stats = {
      total_notifications: dbStats.total,
      by_status: dbStats.byStatus,
      by_channel: dbStats.byChannel,
      queue: {
        waiting: queueStats.waiting,
        active: queueStats.active,
        completed: queueStats.completed,
        failed: queueStats.failed,
        delayed: queueStats.delayed,
        dead_letter: queueStats.deadLetter,
      },
    };

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    logger.error('Dashboard stats failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/outbox', async (req: Request, res: Response) => {
  try {
    const { status, limit = '50', offset = '0' } = req.query;

    const notifications = await trackingService.list(
      undefined,
      undefined,
      undefined,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const result = notifications.map(n => {
      let snapshot = null;
      try { snapshot = JSON.parse(n.template_snapshot); } catch { snapshot = null; }
      return {
        id: n.id,
        user_id: n.user_id,
        channel: n.channel,
        category: n.category,
        status: n.status,
        attempts: n.attempts,
        created_at: n.created_at,
        sent_at: n.sent_at,
        error: n.error,
        subject: snapshot?.rendered_subject,
      };
    });

    res.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    logger.error('Dashboard outbox failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/dead-letter', async (req: Request, res: Response) => {
  try {
    const { limit = '100' } = req.query;

    const deadLetters = await notificationQueue.getDeadLetterJobs(parseInt(limit as string));

    res.json({
      success: true,
      data: deadLetters,
      count: deadLetters.length,
    });
  } catch (error) {
    logger.error('Dashboard dead letter failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/dead-letter/:jobId/retry', async (req: Request, res: Response) => {
  try {
    const { jobId } = req.params;

    const result = await producer.retryDeadLetter(jobId);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Dead letter job not found',
      });
    }

    res.json({
      success: true,
      message: 'Notification requeued successfully',
    });
  } catch (error) {
    logger.error('Retry dead letter failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/dead-letter/retry-all', async (req: Request, res: Response) => {
  try {
    const count = await producer.retryAllDeadLetters();

    res.json({
      success: true,
      retried_count: count,
    });
  } catch (error) {
    logger.error('Retry all dead letters failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
