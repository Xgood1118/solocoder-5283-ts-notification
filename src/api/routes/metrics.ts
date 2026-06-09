import { Router, Request, Response } from 'express';
import * as client from 'prom-client';
import { config } from '../../config';

const router = Router();

const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ prefix: 'notification_center_' });

const notificationSentTotal = new client.Counter({
  name: 'notification_center_notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['channel', 'category'],
});

const notificationFailedTotal = new client.Counter({
  name: 'notification_center_notifications_failed_total',
  help: 'Total number of failed notifications',
  labelNames: ['channel', 'category'],
});

const notificationQueueDepth = new client.Gauge({
  name: 'notification_center_queue_depth',
  help: 'Current depth of notification queue',
  labelNames: ['queue'],
});

const notificationDuration = new client.Histogram({
  name: 'notification_center_notification_duration_seconds',
  help: 'Duration of notification processing',
  labelNames: ['channel', 'status'],
  buckets: [0.01, 0.05, 0.1, 0.5, 1, 5],
});

router.get('/metrics', async (req: Request, res: Response) => {
  res.set('Content-Type', client.register.contentType);
  res.end(await client.register.metrics());
});

export const metrics = {
  notificationSentTotal,
  notificationFailedTotal,
  notificationQueueDepth,
  notificationDuration,
};

export default router;
