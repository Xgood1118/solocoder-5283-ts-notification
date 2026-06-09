import { SendNotificationRequest, ChannelType, NotificationLog, TemplateSnapshot } from '../types';
import templateService from '../templates/service';
import templateEngine from '../templates/engine';
import preferenceService from '../services/preference.service';
import rateLimitService from '../services/rateLimit.service';
import silentHoursService from '../services/silentHours.service';
import trackingService from '../track/service';
import channelManager from '../channels';
import logger from '../utils/logger';

export interface ProcessResult {
  notificationLogs: NotificationLog[];
  skipped: { channel: ChannelType; reason: string }[];
}

export class NotificationProcessor {
  async processNotification(request: SendNotificationRequest): Promise<ProcessResult> {
    const { user_id, category, template_id, template_data, is_urgent, metadata, channel_overrides } = request;

    const template = await templateService.getTemplateById(template_id);
    if (!template) {
      throw new Error(`Template not found: ${template_id}`);
    }

    const channels = await preferenceService.getEffectiveChannels(
      user_id,
      category,
      is_urgent || false,
      channel_overrides
    );

    if (channels.length === 0) {
      logger.info(`No channels available for user ${user_id}, category ${category}`);
      return { notificationLogs: [], skipped: [{ channel: 'email' as any, reason: 'all_channels_disabled' }] };
    }

    const templateSnapshot = templateEngine.createSnapshot(template, template_data);

    const notificationLogs: NotificationLog[] = [];
    const skipped: { channel: ChannelType; reason: string }[] = [];

    for (const channel of channels) {
      const result = await this.processSingleChannel(
        user_id,
        channel,
        category,
        template.id,
        templateSnapshot,
        template_data,
        is_urgent || false,
        metadata
      );

      if (result.log) {
        notificationLogs.push(result.log);
      }
      if (result.skipped) {
        skipped.push({ channel, reason: result.skipped });
      }
    }

    return { notificationLogs, skipped };
  }

  private async processSingleChannel(
    userId: string,
    channel: ChannelType,
    category: string,
    templateId: string,
    templateSnapshot: TemplateSnapshot,
    templateData: Record<string, any>,
    isUrgent: boolean,
    metadata?: Record<string, any>
  ): Promise<{ log?: NotificationLog; skipped?: string }> {
    const rateLimitResult = await rateLimitService.checkAndIncrement(userId, category as any, channel);
    if (!rateLimitResult.allowed) {
      logger.info(`Rate limited for user ${userId}, channel ${channel}, category ${category}`);
      return { skipped: 'rate_limited' };
    }

    const silentResult = await silentHoursService.checkSilentHours(userId, category as any, isUrgent);

    const notificationLog = await trackingService.createLogWithSnapshot(
      userId,
      channel,
      category,
      templateId,
      templateSnapshot,
      {
        ...metadata,
        template_data: templateData,
      },
      'pending'
    );

    if (silentResult.shouldDelay && silentResult.delayUntil) {
      await trackingService.updateStatus(notificationLog.id, 'pending', undefined, undefined);
      logger.debug(`Notification ${notificationLog.id} delayed due to silent hours`);
      return { log: notificationLog };
    }

    return { log: notificationLog };
  }

  async sendNotificationImmediately(notificationId: string): Promise<{ success: boolean; error?: string }> {
    const log = await trackingService.getById(notificationId);
    if (!log) {
      return { success: false, error: 'Notification not found' };
    }

    const snapshot = await trackingService.getTemplateSnapshot(notificationId);
    if (!snapshot) {
      return { success: false, error: 'Template snapshot not found' };
    }

    const channelAdapter = channelManager.getChannel(log.channel);
    if (!channelAdapter) {
      return { success: false, error: `Channel adapter not found: ${log.channel}` };
    }

    try {
      await trackingService.incrementAttempts(notificationId);
      const result = await channelAdapter.send(log, snapshot);

      if (result.success) {
        await trackingService.updateStatus(
          notificationId,
          'sent',
          undefined,
          new Date().toISOString()
        );
        logger.info(`Notification ${notificationId} sent via ${log.channel}`);
        return { success: true };
      } else {
        await trackingService.updateStatus(notificationId, 'failed', result.error);
        logger.warn(`Notification ${notificationId} failed via ${log.channel}: ${result.error}`);
        return { success: false, error: result.error };
      }
    } catch (error) {
      const errMsg = (error as Error).message;
      await trackingService.updateStatus(notificationId, 'failed', errMsg);
      logger.error(`Notification ${notificationId} error via ${log.channel}`, { error });
      return { success: false, error: errMsg };
    }
  }
}

const notificationProcessor = new NotificationProcessor();

export default notificationProcessor;
