import { getDb, saveDb } from './index';
import { UserPreference, NotificationCategory, ChannelType } from '../types';
import logger from '../utils/logger';
import { config } from '../config';

export async function getPreference(userId: string, category: NotificationCategory): Promise<UserPreference | null> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ? AND category = ?');
  const row = stmt.getAsObject(userId, category) as (UserPreference & { channels: string }) | undefined;
  
  if (!row || !row.user_id) {
    return null;
  }

  return {
    ...row,
    channels: JSON.parse(row.channels as unknown as string) as ChannelType[],
  };
}

export async function getPreferencesByUser(userId: string): Promise<UserPreference[]> {
  const db = await getDb();
  const stmt = db.prepare('SELECT * FROM user_preferences WHERE user_id = ?');
  const rows = stmt.getAsObject(userId) as any;
  const rowArray: any[] = Array.isArray(rows) ? rows : (rows && rows.user_id ? [rows] : []);

  return rowArray.map(row => ({
    ...row,
    channels: JSON.parse(row.channels) as ChannelType[],
  }));
}

export async function upsertPreference(
  userId: string,
  category: NotificationCategory,
  channels: ChannelType[],
  enabled: boolean = true,
  silentHoursStart?: string,
  silentHoursEnd?: string
): Promise<UserPreference> {
  const db = await getDb();
  const now = new Date().toISOString();
  const channelsJson = JSON.stringify(channels);

  const existing = await getPreference(userId, category);

  if (existing) {
    const stmt = db.prepare(`
      UPDATE user_preferences 
      SET channels = ?, enabled = ?, silent_hours_start = ?, silent_hours_end = ?, updated_at = ?
      WHERE user_id = ? AND category = ?
    `);
    stmt.run(channelsJson, enabled ? 1 : 0, silentHoursStart || null, silentHoursEnd || null, now, userId, category);
  } else {
    const stmt = db.prepare(`
      INSERT INTO user_preferences (user_id, category, channels, enabled, silent_hours_start, silent_hours_end, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(userId, category, channelsJson, enabled ? 1 : 0, silentHoursStart || null, silentHoursEnd || null, now);
  }
  saveDb();

  logger.debug(`Preference updated for user ${userId}, category ${category}`);
  const result = await getPreference(userId, category);
  return result as UserPreference;
}

export async function disableCategory(userId: string, category: NotificationCategory): Promise<boolean> {
  const existing = await getPreference(userId, category);
  
  if (!existing) {
    await upsertPreference(userId, category, config.channels.defaultChannels, false);
    return true;
  }

  const db = await getDb();
  const stmt = db.prepare(`
    UPDATE user_preferences 
    SET enabled = 0, updated_at = ?
    WHERE user_id = ? AND category = ?
  `);
  const result = stmt.run(new Date().toISOString(), userId, category);
  saveDb();
  return result.changes > 0;
}

export async function getEffectivePreference(userId: string, category: NotificationCategory): Promise<UserPreference> {
  const userPref = await getPreference(userId, category);
  
  if (userPref) {
    return userPref;
  }

  return {
    user_id: userId,
    category,
    channels: config.channels.defaultChannels,
    enabled: 1,
    silent_hours_start: config.silentHours.default.start,
    silent_hours_end: config.silentHours.default.end,
    updated_at: new Date().toISOString(),
  };
}

export default {
  getPreference,
  getPreferencesByUser,
  upsertPreference,
  disableCategory,
  getEffectivePreference,
};
