import app, { initApp } from './app';
import { config } from './config';
import logger from './utils/logger';
import notificationQueue from './queue';

async function startServer(): Promise<void> {
  try {
    initApp();

    const server = app.listen(config.server.port, config.server.host, () => {
      logger.info(`Notification Center server running on http://${config.server.host}:${config.server.port}`);
      logger.info(`Health check: http://${config.server.host}:${config.server.port}/health`);
      logger.info(`Metrics: http://${config.server.host}:${config.server.port}/metrics`);
      logger.info(`API docs: http://${config.server.host}:${config.server.port}/api`);
    });

    process.on('SIGTERM', async () => {
      logger.info('SIGTERM received, shutting down gracefully');
      await notificationQueue.close();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', async () => {
      logger.info('SIGINT received, shutting down gracefully');
      await notificationQueue.close();
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
}

export default startServer;

if (require.main === module) {
  startServer();
}
