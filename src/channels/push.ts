import { BaseChannelAdapter } from './base';
import { ChannelType, ChannelSendResult, NotificationLog, TemplateSnapshot } from '../types';
import logger from '../utils/logger';

let pushCount = 0;

export class PushChannelAdapter extends BaseChannelAdapter {
  channel: ChannelType = 'push';

  async send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult> {
    try {
      pushCount++;

      const title = templateSnapshot.rendered_subject || '通知';
      const body = this.stripHtml(templateSnapshot.rendered_content);

      logger.info(`[Push] Mock sent to user ${notification.user_id}`, {
        notificationId: notification.id,
        title,
        body: body.substring(0, 100),
        totalPushCount: pushCount,
      });

      const messageId = `push_${notification.id}_${pushCount}`;

      return this.formatResult(true, messageId, undefined, {
        title,
        body,
        totalCount: pushCount,
      });
    } catch (error) {
      logger.error('[Push] Send failed', { error, notificationId: notification.id });
      return this.formatResult(false, undefined, (error as Error).message);
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  static getPushCount(): number {
    return pushCount;
  }

  static resetPushCount(): void {
    pushCount = 0;
  }
}

export default PushChannelAdapter;
