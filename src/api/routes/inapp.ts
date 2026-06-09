import { Router, Request, Response } from 'express';
import {
  getInAppNotificationsByUser,
  markInAppAsRead,
  markAllAsRead,
  countUnread,
  getInAppNotificationById,
} from '../../db/inapp.db';
import logger from '../../utils/logger';

const router = Router();

router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { is_read, limit = '50', offset = '0' } = req.query;

    const notifications = await getInAppNotificationsByUser(
      userId,
      is_read !== undefined ? is_read === 'true' : undefined,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    const unreadCount = await countUnread(userId);

    res.json({
      success: true,
      data: notifications,
      count: notifications.length,
      unread_count: unreadCount,
    });
  } catch (error) {
    logger.error('Get in-app notifications failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const notification = await getInAppNotificationById(id);

    if (!notification) {
      return res.status(404).json({ error: 'In-app notification not found' });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    logger.error('Get in-app notification failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/:id/read', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { user_id } = req.body;

    const result = await markInAppAsRead(id, user_id);

    if (!result) {
      return res.status(404).json({
        success: false,
        error: 'Notification not found or already read',
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    logger.error('Mark in-app read failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/users/:userId/read-all', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = await markAllAsRead(userId);

    res.json({
      success: true,
      marked_count: count,
    });
  } catch (error) {
    logger.error('Mark all as read failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/users/:userId/unread-count', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const count = await countUnread(userId);

    res.json({
      success: true,
      unread_count: count,
    });
  } catch (error) {
    logger.error('Get unread count failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
