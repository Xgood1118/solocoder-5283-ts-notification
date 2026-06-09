import { NotificationLog, TemplateSnapshot, NotificationStatus } from '../types';
import {
  createNotificationLog,
  getNotificationLogById,
  updateNotificationStatus,
  incrementAttempts,
  markAsRead,
  listNotificationLogs,
  getStats as dbGetStats,
} from '../db/notification.db';
import logger from '../utils/logger';

export class TrackingService {
  async createLog(
    data: Omit<NotificationLog, 'id' | 'status' | 'attempts' | 'created_at' | 'updated_at'> & {
      status?: NotificationStatus;
    }
  ): Promise<NotificationLog> {
    return createNotificationLog(data);
  }

  async getById(id: string): Promise<NotificationLog | null> {
    return getNotificationLogById(id);
  }

  async updateStatus(id: string, status: NotificationStatus, error?: string, sentAt?: string): Promise<boolean> {
    const result = await updateNotificationStatus(id, status, error, sentAt);
    if (result) {
      logger.debug(`Notification ${id} status updated to ${status}`);
    }
    return result;
  }

  async incrementAttempts(id: string): Promise<number> {
    const attempts = await incrementAttempts(id);
    logger.debug(`Notification ${id} attempt ${attempts}`);
    return attempts;
  }

  async markRead(id: string): Promise<boolean> {
    return markAsRead(id);
  }

  async list(
    userId?: string,
    status?: NotificationStatus,
    channel?: string,
    limit?: number,
    offset?: number
  ): Promise<NotificationLog[]> {
    return listNotificationLogs(userId, status as any, channel as any, limit, offset);
  }

  async getStats(): Promise<{
    total: number;
    byStatus: Record<string, number>;
    byChannel: Record<string, number>;
  }> {
    return dbGetStats();
  }

  async createLogWithSnapshot(
    userId: string,
    channel: string,
    category: string,
    templateId: string,
    templateSnapshot: TemplateSnapshot,
    metadata?: Record<string, any>,
    status: NotificationStatus = 'pending'
  ): Promise<NotificationLog> {
    return this.createLog({
      user_id: userId,
      channel: channel as any,
      category: category as any,
      template_id: templateId,
      template_snapshot: JSON.stringify(templateSnapshot),
      status,
      metadata: metadata ? JSON.stringify(metadata) : undefined,
    });
  }

  async getTemplateSnapshot(notificationId: string): Promise<TemplateSnapshot | null> {
    const log = await this.getById(notificationId);
    if (!log) {
      return null;
    }
    try {
      return JSON.parse(log.template_snapshot) as TemplateSnapshot;
    } catch {
      return null;
    }
  }
}

const trackingService = new TrackingService();

export default trackingService;
