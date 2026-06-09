import { getDb, saveDb } from './index';
import { InAppNotification } from '../types';
import { generateSnowflakeId } from '../utils/snowflake';
import { markAsRead as markLogAsRead } from './notification.db';
import logger from '../utils/logger';

export async function createInAppNotification(
  notificationLogId: string,
  userId: string,
  title: string,
  content: string
): Promise<InAppNotification> {
  const db = await getDb();
  const id = generateSnowflakeId();
  const now = new Date().toISOString();

  const stmt = db.prepare(`
    INSERT INTO in_app_notifications (id, notification_log_id, user_id, title, content, is_read, created_at)
    VALUES (?, ?, ?, ?, ?, 0, ?)
  `);

  stmt.run(id, notificationLogId, userId, title, content, now);
  saveDb();

  const result = await getInAppNotificationById(id);
  return result as InAppNotification;
}

export async function getInAppNotificationById(id: string): Promise<InAppNotification | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM in_app_notifications WHERE id = ?');
  const row = stmt.getAsObject(id) as InAppNotification | undefined;
  return row && row.id ? row : null;
}

export async function getInAppNotificationsByUser(
  userId: string,
  isRead?: boolean,
  limit: number = 50,
  offset: number = 0
): Promise<InAppNotification[]> {
  const db = await getDb();
  let query = 'SELECT * FROM in_app_notifications WHERE user_id = ?';
  const params: any[] = [userId];

  if (isRead !== undefined) {
    query += ' AND is_read = ?';
    params.push(isRead ? 1 : 0);
  }

  query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);

  const stmt = db.prepare(query);
  const results = stmt.getAsObject(...params);
  return Array.isArray(results) ? results : (results && results.id ? [results] : []);
}

export async function markInAppAsRead(id: string, userId?: string): Promise<boolean> {
  const db = await getDb();
  const now = new Date().toISOString();
  
  let query = 'UPDATE in_app_notifications SET is_read = 1, read_at = ? WHERE id = ? AND is_read = 0';
  const params: any[] = [now, id];

  if (userId) {
    query += ' AND user_id = ?';
    params.push(userId);
  }

  const stmt = db.prepare(query);
  stmt.run(...params);
  const changes = db.getRowsModified();
  saveDb();

  if (changes > 0) {
    const notification = await getInAppNotificationById(id);
    if (notification) {
      await markLogAsRead(notification.notification_log_id);
    }
  }

  return changes > 0;
}

export async function markAllAsRead(userId: string): Promise<number> {
  const db = await getDb();
  const now = new Date().toISOString();
  
  const unreadStmt = db.prepare('SELECT notification_log_id FROM in_app_notifications WHERE user_id = ? AND is_read = 0');
  const unreadResults = unreadStmt.getAsObject(userId);
  const unreadList = Array.isArray(unreadResults) ? unreadResults : (unreadResults && unreadResults.notification_log_id ? [unreadResults] : []);

  const stmt = db.prepare(`
    UPDATE in_app_notifications 
    SET is_read = 1, read_at = ? 
    WHERE user_id = ? AND is_read = 0
  `);
  stmt.run(now, userId);
  const changes = db.getRowsModified();
  saveDb();

  for (const item of unreadList) {
    await markLogAsRead(item.notification_log_id);
  }

  logger.info(`Marked ${changes} in-app notifications as read for user ${userId}`);
  return changes;
}

export async function countUnread(userId: string): Promise<number> {
  const db = await getDb();
  const stmt = db.prepare('SELECT COUNT(*) as count FROM in_app_notifications WHERE user_id = ? AND is_read = 0');
  const result = stmt.getAsObject(userId) as { count: number };
  return result?.count || 0;
}

export default {
  createInAppNotification,
  getInAppNotificationById,
  getInAppNotificationsByUser,
  markInAppAsRead,
  markAllAsRead,
  countUnread,
};
