import { Router, Request, Response } from 'express';
import producer from '../../queue/producer';
import trackingService from '../../track/service';
import { SendNotificationRequest } from '../../types';
import logger from '../../utils/logger';

const router = Router();

router.post('/send', async (req: Request, res: Response) => {
  try {
    const request: SendNotificationRequest = req.body;

    if (!request.user_id || !request.category || !request.template_id || !request.template_data) {
      return res.status(400).json({
        error: 'Missing required fields: user_id, category, template_id, template_data',
      });
    }

    const result = await producer.sendNotification(request);

    res.json({
      success: true,
      notification_ids: result.notificationIds,
      skipped: result.skipped,
      count: result.notificationIds.length,
    });
  } catch (error) {
    logger.error('Send notification failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const notification = await trackingService.getById(id);

    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    let snapshot = null;
    try {
      snapshot = JSON.parse(notification.template_snapshot);
    } catch {
      snapshot = null;
    }

    let metadata = null;
    try {
      metadata = notification.metadata ? JSON.parse(notification.metadata) : null;
    } catch {
      metadata = null;
    }

    res.json({
      ...notification,
      template_snapshot: snapshot,
      metadata,
    });
  } catch (error) {
    logger.error('Get notification failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { user_id, status, channel, limit = '50', offset = '0' } = req.query;

    const notifications = await trackingService.list(
      user_id as string,
      status as any,
      channel as string,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const result = notifications.map(n => {
      let snapshot = null;
      try { snapshot = JSON.parse(n.template_snapshot); } catch { snapshot = null; }
      return { ...n, template_snapshot: snapshot };
    });

    res.json({
      success: true,
      data: result,
      count: result.length,
    });
  } catch (error) {
    logger.error('List notifications failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
