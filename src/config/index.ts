import { ChannelType, NotificationCategory, RateLimitConfig, SilentHoursConfig } from '../types';

export const config = {
  server: {
    port: parseInt(process.env.PORT || '3000', 10),
    host: process.env.HOST || '0.0.0.0',
  },

  redis: {
    host: process.env.REDIS_HOST || '127.0.0.1',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    db: parseInt(process.env.REDIS_DB || '0', 10),
  },

  database: {
    path: process.env.DB_PATH || './data/notifications.db',
  },

  queue: {
    defaultAttempts: 5,
    backoff: {
      type: 'exponential' as const,
      delay: 1000,
    },
    concurrency: 10,
    batchChunkSize: 100,
    deadLetterQueueName: 'notifications:dlq',
  },

  rateLimit: {
    default: {
      windowMs: 60 * 60 * 1000,
      maxCount: 5,
    } as RateLimitConfig,
    byCategory: {
      alert: { windowMs: 60 * 60 * 1000, maxCount: 20 },
      password_reset: { windowMs: 60 * 60 * 1000, maxCount: 10 },
    } as Record<NotificationCategory, RateLimitConfig>,
  },

  silentHours: {
    default: {
      start: '23:00',
      end: '07:00',
    } as SilentHoursConfig,
    urgentCategories: ['password_reset', 'alert'] as NotificationCategory[],
  },

  templates: {
    defaultEngine: 'handlebars' as const,
  },

  channels: {
    defaultChannels: ['email', 'in_app'] as ChannelType[],
    email: {
      from: 'noreply@example.com',
      mockOutputDir: './tmp/emails',
    },
    sms: {
      mockLog: true,
    },
    webhook: {
      defaultSecret: process.env.WEBHOOK_SECRET || 'notification-center-secret',
    },
  },

  snowflake: {
    machineId: parseInt(process.env.MACHINE_ID || '1', 10),
  },

  monitoring: {
    prometheus: {
      enabled: true,
      path: '/metrics',
    },
  },

  logging: {
    level: process.env.LOG_LEVEL || 'info',
  },
};

export default config;
