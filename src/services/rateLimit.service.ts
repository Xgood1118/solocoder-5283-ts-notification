import Redis from 'ioredis';
import { NotificationCategory } from '../types';
import { config } from '../config';
import logger from '../utils/logger';

export class RateLimitService {
  private redis: Redis;

  constructor() {
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      db: config.redis.db,
    });
  }

  private getRateLimitConfig(category: NotificationCategory): { windowMs: number; maxCount: number } {
    return config.rateLimit.byCategory[category] || config.rateLimit.default;
  }

  private getKey(userId: string, category: NotificationCategory, channel: string): string {
    return `ratelimit:${userId}:${category}:${channel}`;
  }

  async checkAndIncrement(
    userId: string,
    category: NotificationCategory,
    channel: string
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    const { windowMs, maxCount } = this.getRateLimitConfig(category);
    const key = this.getKey(userId, category, channel);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      const multi = this.redis.multi();

      multi.zremrangebyscore(key, 0, windowStart);
      multi.zcard(key);
      multi.zadd(key, now.toString(), `${now}-${Math.random().toString(36).substr(2, 9)}`);
      multi.expire(key, Math.ceil(windowMs / 1000));

      const results = await multi.exec();

      if (!results) {
        return { allowed: true, remaining: maxCount, resetTime: now + windowMs };
      }

      const currentCount = results[1][1] as number;
      const allowed = currentCount < maxCount;
      const remaining = Math.max(0, maxCount - currentCount - (allowed ? 1 : 0));

      if (!allowed) {
        logger.warn(`Rate limit exceeded for user ${userId}, category ${category}, channel ${channel}`, {
          currentCount,
          maxCount,
        });
      }

      return {
        allowed,
        remaining,
        resetTime: now + windowMs,
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error });
      return { allowed: true, remaining: maxCount, resetTime: now + windowMs };
    }
  }

  async getRemaining(
    userId: string,
    category: NotificationCategory,
    channel: string
  ): Promise<{ remaining: number; resetTime: number }> {
    const { windowMs, maxCount } = this.getRateLimitConfig(category);
    const key = this.getKey(userId, category, channel);
    const now = Date.now();
    const windowStart = now - windowMs;

    try {
      await this.redis.zremrangebyscore(key, 0, windowStart);
      const currentCount = await this.redis.zcard(key);
      const remaining = Math.max(0, maxCount - currentCount);

      return {
        remaining,
        resetTime: now + windowMs,
      };
    } catch (error) {
      logger.error('Rate limit remaining check failed', { error });
      return { remaining: maxCount, resetTime: now + windowMs };
    }
  }

  async reset(userId: string, category: NotificationCategory, channel: string): Promise<void> {
    const key = this.getKey(userId, category, channel);
    await this.redis.del(key);
  }

  getRedisClient(): Redis {
    return this.redis;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}

const rateLimitService = new RateLimitService();

export default rateLimitService;
