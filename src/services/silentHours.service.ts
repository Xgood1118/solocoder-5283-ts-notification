import { NotificationCategory, ChannelType, UserPreference } from '../types';
import { getEffectivePreference } from '../db/preference.db';
import { config } from '../config';
import logger from '../utils/logger';

export class SilentHoursService {
  isUrgentCategory(category: NotificationCategory): boolean {
    return config.silentHours.urgentCategories.includes(category);
  }

  parseTime(timeStr: string): { hours: number; minutes: number } {
    const [hours, minutes] = timeStr.split(':').map(Number);
    return { hours, minutes };
  }

  isInSilentHours(
    currentTime: Date,
    silentStart: string,
    silentEnd: string
  ): boolean {
    const currentMinutes = currentTime.getHours() * 60 + currentTime.getMinutes();
    const start = this.parseTime(silentStart);
    const end = this.parseTime(silentEnd);
    const startMinutes = start.hours * 60 + start.minutes;
    const endMinutes = end.hours * 60 + end.minutes;

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    } else {
      return currentMinutes >= startMinutes || currentMinutes < endMinutes;
    }
  }

  calculateNextSendTime(
    currentTime: Date,
    silentStart: string,
    silentEnd: string
  ): Date {
    const end = this.parseTime(silentEnd);
    const nextSend = new Date(currentTime);

    nextSend.setHours(end.hours, end.minutes, 0, 0);

    if (nextSend.getTime() <= currentTime.getTime()) {
      nextSend.setDate(nextSend.getDate() + 1);
    }

    return nextSend;
  }

  async checkSilentHours(
    userId: string,
    category: NotificationCategory,
    isUrgent: boolean = false
  ): Promise<{ shouldDelay: boolean; delayUntil?: Date }> {
    if (isUrgent || this.isUrgentCategory(category)) {
      logger.debug(`Skipping silent hours check for urgent category: ${category}`);
      return { shouldDelay: false };
    }

    const preference = await getEffectivePreference(userId, category);
    const silentStart = preference.silent_hours_start || config.silentHours.default.start;
    const silentEnd = preference.silent_hours_end || config.silentHours.default.end;

    const now = new Date();

    if (this.isInSilentHours(now, silentStart, silentEnd)) {
      const delayUntil = this.calculateNextSendTime(now, silentStart, silentEnd);
      logger.debug(`Notification for user ${userId} delayed due to silent hours`, {
        category,
        delayUntil: delayUntil.toISOString(),
      });
      return { shouldDelay: true, delayUntil };
    }

    return { shouldDelay: false };
  }

  async getSilentHoursConfig(userId: string, category: NotificationCategory): Promise<{ start: string; end: string }> {
    const preference = await getEffectivePreference(userId, category);
    return {
      start: preference.silent_hours_start || config.silentHours.default.start,
      end: preference.silent_hours_end || config.silentHours.default.end,
    };
  }
}

const silentHoursService = new SilentHoursService();

export default silentHoursService;
