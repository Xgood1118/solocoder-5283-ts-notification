import express from 'express';
import { Request, Response, NextFunction } from 'express';
import apiRouter from './api';
import { initDb } from './db';
import { seedDefaultTemplates } from './db/template.db';
import { config } from './config';
import logger from './utils/logger';

const app = express();

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req: Request, res: Response, next: NextFunction) => {
  logger.debug(`${req.method} ${req.path}`);
  next();
});

app.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'notification-center',
  });
});

app.use('/api', apiRouter);

app.get('/api/unsubscribe', (req: Request, res: Response) => {
  const token = req.query.token as string;
  if (!token) {
    return res.status(400).send('Invalid unsubscribe link');
  }
  res.send(`
    <!DOCTYPE html>
    <html>
    <head><title>退订通知</title></head>
    <body>
      <h1>退订通知</h1>
      <p>请使用 POST /api/preferences/unsubscribe/${token} 来确认退订</p>
    </body>
    </html>
  `);
});

app.use((err: Error, req: Request, res: Response, next: NextFunction) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({
    error: 'Not found',
    path: req.path,
  });
});

export async function initApp(): Promise<void> {
  await initDb();
  await seedDefaultTemplates();
  logger.info('Application initialized');
}

export default app;
