import { Router, Request, Response } from 'express';
import producer from '../../queue/producer';
import { SendNotificationRequest } from '../../types';
import logger from '../../utils/logger';
import { generateSnowflakeId } from '../../utils/snowflake';

const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  try {
    const { notifications } = req.body;

    if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
      return res.status(400).json({
        error: 'notifications must be a non-empty array',
      });
    }

    for (const notif of notifications) {
      if (!notif.user_id || !notif.category || !notif.template_id || !notif.template_data) {
        return res.status(400).json({
          error: 'Each notification must have user_id, category, template_id, template_data',
        });
      }
    }

    const result = await producer.sendBatch(notifications as SendNotificationRequest[]);

    res.json({
      success: true,
      batch_id: result.batchId,
      chunk_count: result.chunkCount,
      total_count: result.totalCount,
      message: 'Batch notifications enqueued successfully',
    });
  } catch (error) {
    logger.error('Batch send failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/test-batch', async (req: Request, res: Response) => {
  try {
    const { count = 100, template_id, category = 'order' } = req.body;

    const notifications: SendNotificationRequest[] = [];
    for (let i = 0; i < count; i++) {
      notifications.push({
        user_id: `user_${i}`,
        category: category as any,
        template_id: template_id || 'test',
        template_data: {
          username: `User ${i}`,
          orderId: `ORD-${10000 + i}`,
          amount: (Math.random() * 1000).toFixed(2),
        },
        is_urgent: false,
      });
    }

    const result = await producer.sendBatch(notifications);

    res.json({
      success: true,
      batch_id: result.batchId,
      chunk_count: result.chunkCount,
      total_count: result.totalCount,
      message: `Test batch of ${count} notifications enqueued`,
    });
  } catch (error) {
    logger.error('Test batch failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
