import { BaseChannelAdapter } from './base';
import { ChannelType, ChannelSendResult, NotificationLog, TemplateSnapshot } from '../types';
import { createInAppNotification } from '../db/inapp.db';
import logger from '../utils/logger';

export class InAppChannelAdapter extends BaseChannelAdapter {
  channel: ChannelType = 'in_app';

  async send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult> {
    try {
      const title = templateSnapshot.rendered_subject || '系统通知';
      const content = templateSnapshot.rendered_content;

      const inApp = await createInAppNotification(
        notification.id,
        notification.user_id,
        title,
        content
      );

      logger.info(`[In-App] Sent to user ${notification.user_id}`, {
        notificationId: notification.id,
        inAppId: inApp.id,
      });

      return this.formatResult(true, inApp.id, undefined, {
        inAppId: inApp.id,
        title,
      });
    } catch (error) {
      logger.error('[In-App] Send failed', { error, notificationId: notification.id });
      return this.formatResult(false, undefined, (error as Error).message);
    }
  }
}

export default InAppChannelAdapter;
