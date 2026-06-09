import * as https from 'https';
import * as http from 'http';
import { URL } from 'url';
import { BaseChannelAdapter } from './base';
import { ChannelType, ChannelSendResult, NotificationLog, TemplateSnapshot } from '../types';
import { generateWebhookHeaders } from '../utils/hmac';
import { config } from '../config';
import logger from '../utils/logger';

export class WebhookChannelAdapter extends BaseChannelAdapter {
  channel: ChannelType = 'webhook';
  private secret: string;

  constructor(secret?: string) {
    super();
    this.secret = secret || config.channels.webhook.defaultSecret;
  }

  async send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult> {
    try {
      const metadata = notification.metadata ? JSON.parse(notification.metadata) : {};
      const webhookUrl = metadata.webhook_url;

      if (!webhookUrl) {
        throw new Error('Webhook URL not provided in metadata');
      }

      const payload = {
        notification_id: notification.id,
        user_id: notification.user_id,
        category: notification.category,
        channel: notification.channel,
        template_id: notification.template_id,
        template_name: templateSnapshot.template_name,
        subject: templateSnapshot.rendered_subject,
        content: templateSnapshot.rendered_content,
        timestamp: new Date().toISOString(),
        data: metadata.template_data || {},
      };

      const headers = generateWebhookHeaders(payload, this.secret);

      const response = await this.makeRequest(webhookUrl, payload, headers);

      logger.info(`[Webhook] Sent to ${webhookUrl}`, {
        notificationId: notification.id,
        statusCode: response.statusCode,
      });

      const success = response.statusCode >= 200 && response.statusCode < 300;

      return this.formatResult(success, `wh_${notification.id}`, success ? undefined : `HTTP ${response.statusCode}`, {
        statusCode: response.statusCode,
        responseBody: response.body,
      });
    } catch (error) {
      logger.error('[Webhook] Send failed', { error, notificationId: notification.id });
      return this.formatResult(false, undefined, (error as Error).message);
    }
  }

  private makeRequest(
    url: string,
    payload: Record<string, any>,
    headers: Record<string, string>
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const client = parsedUrl.protocol === 'https:' ? https : http;

      const postData = JSON.stringify(payload);

      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        method: 'POST',
        headers: {
          ...headers,
          'Content-Length': Buffer.byteLength(postData),
        },
      };

      const req = client.request(options, (res) => {
        let body = '';
        res.on('data', (chunk) => { body += chunk; });
        res.on('end', () => {
          resolve({ statusCode: res.statusCode || 500, body });
        });
      });

      req.on('error', (err) => {
        reject(err);
      });

      req.write(postData);
      req.end();
    });
  }
}

export default WebhookChannelAdapter;
