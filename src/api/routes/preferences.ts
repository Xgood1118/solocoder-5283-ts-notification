import { Router, Request, Response } from 'express';
import preferenceService from '../../services/preference.service';
import { NotificationCategory, ChannelType } from '../../types';
import logger from '../../utils/logger';

const router = Router();

router.get('/:userId/:category', async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.params;

    const preference = await preferenceService.getUserPreference(
      userId,
      category as NotificationCategory
    );

    res.json({
      success: true,
      data: preference,
    });
  } catch (error) {
    logger.error('Get preference failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const preferences = await preferenceService.getUserPreference(userId, 'order' as any);

    res.json({
      success: true,
      data: preferences,
    });
  } catch (error) {
    logger.error('Get user preferences failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.put('/:userId/:category', async (req: Request, res: Response) => {
  try {
    const { userId, category } = req.params;
    const { channels, enabled, silent_hours_start, silent_hours_end } = req.body;

    if (!channels || !Array.isArray(channels)) {
      return res.status(400).json({
        error: 'channels must be an array',
      });
    }

    const preference = await preferenceService.setUserPreference(
      userId,
      category as NotificationCategory,
      channels as ChannelType[],
      enabled !== false,
      silent_hours_start,
      silent_hours_end
    );

    res.json({
      success: true,
      data: preference,
    });
  } catch (error) {
    logger.error('Set preference failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

router.post('/unsubscribe/:token', async (req: Request, res: Response) => {
  try {
    const { token } = req.params;

    const result = await preferenceService.unsubscribeByToken(token);

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid unsubscribe token',
      });
    }

    res.json({
      success: true,
      message: `Successfully unsubscribed from ${result.category} notifications`,
    });
  } catch (error) {
    logger.error('Unsubscribe failed', { error });
    res.status(500).json({
      error: (error as Error).message,
    });
  }
});

export default router;
