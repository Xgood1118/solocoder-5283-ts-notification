import { NotificationCategory, ChannelType, UserPreference } from '../types';
import { getEffectivePreference, upsertPreference, disableCategory } from '../db/preference.db';
import { config } from '../config';
import logger from '../utils/logger';

export class PreferenceService {
  async getUserPreference(userId: string, category: NotificationCategory): Promise<UserPreference> {
    return getEffectivePreference(userId, category);
  }

  async setUserPreference(
    userId: string,
    category: NotificationCategory,
    channels: ChannelType[],
    enabled: boolean = true,
    silentHoursStart?: string,
    silentHoursEnd?: string
  ): Promise<UserPreference> {
    return upsertPreference(userId, category, channels, enabled, silentHoursStart, silentHoursEnd);
  }

  async disableNotificationCategory(userId: string, category: NotificationCategory): Promise<boolean> {
    const result = await disableCategory(userId, category);
    logger.info(`User ${userId} disabled category: ${category}`);
    return result;
  }

  async getEffectiveChannels(
    userId: string,
    category: NotificationCategory,
    isUrgent: boolean = false,
    channelOverrides?: ChannelType[]
  ): Promise<ChannelType[]> {
    if (channelOverrides && channelOverrides.length > 0) {
      logger.debug(`Using channel overrides for user ${userId}: ${channelOverrides.join(', ')}`);
      return channelOverrides;
    }

    const preference = await this.getUserPreference(userId, category);

    if (!preference.enabled) {
      logger.debug(`Category ${category} is disabled for user ${userId}`);
      return [];
    }

    return preference.channels;
  }

  async isCategoryEnabled(userId: string, category: NotificationCategory): Promise<boolean> {
    const preference = await this.getUserPreference(userId, category);
    return preference.enabled === 1;
  }

  async unsubscribeByToken(token: string): Promise<{ success: boolean; category?: NotificationCategory }> {
    try {
      const decoded = Buffer.from(token, 'base64').toString('utf-8');
      const [userId, category] = decoded.split(':');

      if (!userId || !category) {
        return { success: false };
      }

      await this.disableNotificationCategory(userId, category as NotificationCategory);
      return { success: true, category: category as NotificationCategory };
    } catch (error) {
      logger.error('Unsubscribe token invalid', { error, token });
      return { success: false };
    }
  }
}

const preferenceService = new PreferenceService();

export default preferenceService;
