import { BaseChannelAdapter } from './base';
import { ChannelType, ChannelSendResult, NotificationLog, TemplateSnapshot } from '../types';
import logger from '../utils/logger';

let smsCount = 0;

export class SmsChannelAdapter extends BaseChannelAdapter {
  channel: ChannelType = 'sms';

  async send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult> {
    try {
      smsCount++;

      const content = this.stripHtml(templateSnapshot.rendered_content);

      logger.info(`[SMS] Mock sent to user ${notification.user_id}`, {
        notificationId: notification.id,
        content: content.substring(0, 100),
        totalSmsCount: smsCount,
      });

      const messageId = `sms_${notification.id}_${smsCount}`;

      return this.formatResult(true, messageId, undefined, {
        content,
        totalCount: smsCount,
      });
    } catch (error) {
      logger.error('[SMS] Send failed', { error, notificationId: notification.id });
      return this.formatResult(false, undefined, (error as Error).message);
    }
  }

  private stripHtml(html: string): string {
    return html.replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim();
  }

  static getSmsCount(): number {
    return smsCount;
  }

  static resetSmsCount(): void {
    smsCount = 0;
  }
}

export default SmsChannelAdapter;
