import * as fs from 'fs';
import * as path from 'path';
import { BaseChannelAdapter } from './base';
import { ChannelType, ChannelSendResult, NotificationLog, TemplateSnapshot } from '../types';
import { config } from '../config';
import logger from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

export class EmailChannelAdapter extends BaseChannelAdapter {
  channel: ChannelType = 'email';

  private outputDir: string;

  constructor() {
    super();
    this.outputDir = config.channels.email.mockOutputDir;
    this.ensureOutputDir();
  }

  private ensureOutputDir(): void {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }
  }

  async send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult> {
    try {
      const messageId = uuidv4();
      const subject = templateSnapshot.rendered_subject || 'Notification';
      const content = templateSnapshot.rendered_content;

      const emailHtml = this.buildEmailHtml(notification, subject, content);

      const filePath = path.join(this.outputDir, `${notification.id}.html`);
      fs.writeFileSync(filePath, emailHtml, 'utf-8');

      logger.info(`[Email] Mock sent to user ${notification.user_id}, saved to ${filePath}`);

      return this.formatResult(true, messageId, undefined, {
        filePath,
        subject,
        to: notification.user_id,
        from: config.channels.email.from,
      });
    } catch (error) {
      logger.error('[Email] Send failed', { error, notificationId: notification.id });
      return this.formatResult(false, undefined, (error as Error).message);
    }
  }

  private buildEmailHtml(
    notification: NotificationLog,
    subject: string,
    content: string
  ): string {
    const unsubscribeLink = `/api/unsubscribe?token=${this.generateUnsubscribeToken(notification)}`;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
    .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; padding: 30px; }
    .header { border-bottom: 1px solid #eee; padding-bottom: 15px; margin-bottom: 20px; }
    .footer { margin-top: 30px; padding-top: 15px; border-top: 1px solid #eee; font-size: 12px; color: #999; }
    .unsubscribe { color: #999; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h2>${subject}</h2>
    </div>
    <div class="content">
      ${content}
    </div>
    <div class="footer">
      <p>这是系统自动发送的邮件，请勿直接回复。</p>
      <p>通知ID: ${notification.id}</p>
      <p><a href="${unsubscribeLink}" class="unsubscribe">退订此类通知</a></p>
    </div>
  </div>
</body>
</html>`;
  }

  private generateUnsubscribeToken(notification: NotificationLog): string {
    return Buffer.from(`${notification.user_id}:${notification.category}`).toString('base64');
  }
}

export default EmailChannelAdapter;
