import { getDb, saveDb } from './index';
import { NotificationLog, NotificationStatus, ChannelType, TemplateSnapshot } from '../types';
import { generateSnowflakeId } from '../utils/snowflake';
import logger from '../utils/logger';

export async function createNotificationLog(
  data: Omit<NotificationLog, 'id' | 'status' | 'attempts' | 'created_at' | 'updated_at'> & {
    status?: NotificationStatus;
  }
): Promise<NotificationLog> {
  const db = await getDb();
  const id = generateSnowflakeId();
  const now = new Date().toISOString();
  const status = data.status || 'pending';

  const stmt = db.prepare(`
    INSERT INTO notification_logs 
    (id, user_id, channel, category, template_id, template_snapshot, status, attempts, created_at, updated_at, metadata)
    VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
  `);

  stmt.run(
    id,
    data.user_id,
    data.channel,
    data.category,
    data.template_id,
    data.template_snapshot,
    status,
    now,
    now,
    data.metadata || null
  );
  saveDb();

  const result = await getNotificationLogById(id);
  return result as NotificationLog;
}

export async function getNotificationLogById(id: string): Promise<NotificationLog | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM notification_logs WHERE id = ?');
  const row = stmt.getAsObject(id) as NotificationLog | undefined;
  return row && row.id ? row : null;
}

export async function updateNotificationStatus(
  id: string,
  status: NotificationStatus,
  error?: string,
  sentAt?: string
): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE notification_logs 
    SET status = ?, error = ?, sent_at = ?, updated_at = ?
    WHERE id = ?
  `);
  const result = stmt.run(status, error || null, sentAt || null, now, id);
  saveDb();
  return result.changes > 0;
}

export async function incrementAttempts(id: string): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE notification_logs 
    SET attempts = attempts + 1, updated_at = ?
    WHERE id = ?
  `);
  stmt.run(now, id);
  saveDb();

  const log = await getNotificationLogById(id);
  return log?.attempts || 0;
}

export async function markAsRead(id: string): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  const stmt = db.prepare(`
    UPDATE notification_logs 
    SET status = 'read', read_at = ?, updated_at = ?
    WHERE id = ? AND status != 'read'
  `);
  const result = stmt.run(now, now, id);
  saveDb();
  return result.changes > 0;
}

export async function listNotificationLogs(
  userId?: string,
  status?: NotificationStatus,
  channel?: ChannelType,
  limit: number = 50,
  offset: number = 0
): Promise<NotificationLog[]> {
  const db = await getDb();
  let query = 'SELECT * FROM notification_logs WHERE 1=1';
  const params: any[] = [];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }
  if (status) {
    query += ' AND status = ?';
    params.push(status);
  }
  if (channel) {
    query += ' AND channel = ?';
    params.push(channel);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const results = stmt.getAsObject(...params);
  return Array.isArray(results) ? results : (results && results.id ? [results] : []);
}

export async function countNotificationsByStatus(status: NotificationStatus): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notification_logs WHERE status = ?');
  const result = stmt.getAsObject(status) as { count: number };
  return result?.count || 0;
}

export async function countNotificationsByChannel(channel: ChannelType): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM notification_logs WHERE channel = ?');
  const result = stmt.getAsObject(channel) as { count: number };
  return result?.count || 0;
}

export async function getStats(): Promise<{
  total: number;
  byStatus: Record<string, number>;
  byChannel: Record<string, number>;
}> {
  const db = await getDb();

  const totalResult = db.prepare('SELECT COUNT(*) as count FROM notification_logs').getAsObject() as any;

  const statusRows = db.prepare('SELECT status, COUNT(*) as count FROM notification_logs GROUP BY status').getAsObject() as any;
  const statusArray: any[] = Array.isArray(statusRows) ? statusRows : (statusRows && statusRows.status ? [statusRows] : []);
  const byStatus: Record<string, number> = {};
  for (const row of statusArray) {
    byStatus[row.status] = row.count;
  }

  const channelRows = db.prepare('SELECT channel, COUNT(*) as count FROM notification_logs GROUP BY channel').getAsObject() as any;
  const channelArray: any[] = Array.isArray(channelRows) ? channelRows : (channelRows && channelRows.channel ? [channelRows] : []);
  const byChannel: Record<string, number> = {};
  for (const row of channelArray) {
    byChannel[row.channel] = row.count;
  }

  return {
    total: totalResult?.count || 0,
    byStatus,
    byChannel,
  };
}

export async function getDeadLetterNotifications(limit: number = 100): Promise<NotificationLog[]> {
  return listNotificationLogs(undefined, 'dead_letter', undefined, limit, 0);
}

export async function retryDeadLetterNotification(id: string): Promise<boolean> {
  const log = await getNotificationLogById(id);
  if (!log || log.status !== 'dead_letter') {
    return false;
  }
  return updateNotificationStatus(id, 'pending');
}

export default {
  createNotificationLog,
  getNotificationLogById,
  updateNotificationStatus,
  incrementAttempts,
  markAsRead,
  listNotificationLogs,
  countNotificationsByStatus,
  countNotificationsByChannel,
  getStats,
  getDeadLetterNotifications,
  retryDeadLetterNotification,
};
