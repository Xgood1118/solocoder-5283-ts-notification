export type ChannelType = 'email' | 'sms' | 'in_app' | 'push' | 'webhook';

export type NotificationCategory = 'order' | 'password_reset' | 'alert' | 'marketing' | 'system';

export type NotificationStatus = 'pending' | 'queued' | 'sent' | 'failed' | 'read' | 'dead_letter';

export type TemplateEngine = 'handlebars';

export interface Template {
  id: string;
  name: string;
  category: NotificationCategory;
  subject?: string;
  content: string;
  engine: TemplateEngine;
  version: number;
  created_at: string;
  updated_at: string;
  is_active: number;
}

export interface TemplateSnapshot {
  template_id: string;
  template_name: string;
  template_version: number;
  subject?: string;
  content: string;
  rendered_subject?: string;
  rendered_content: string;
  engine: TemplateEngine;
}

export interface UserPreference {
  user_id: string;
  category: NotificationCategory;
  channels: ChannelType[];
  enabled: number;
  silent_hours_start?: string;
  silent_hours_end?: string;
  updated_at: string;
}

export interface NotificationLog {
  id: string;
  user_id: string;
  channel: ChannelType;
  category: NotificationCategory;
  template_id: string;
  template_snapshot: string;
  status: NotificationStatus;
  sent_at?: string;
  read_at?: string;
  error?: string;
  attempts: number;
  created_at: string;
  updated_at: string;
  metadata?: string;
}

export interface InAppNotification {
  id: string;
  notification_log_id: string;
  user_id: string;
  title: string;
  content: string;
  is_read: number;
  read_at?: string;
  created_at: string;
}

export interface SendNotificationRequest {
  user_id: string;
  category: NotificationCategory;
  template_id: string;
  template_data: Record<string, any>;
  is_urgent?: boolean;
  metadata?: Record<string, any>;
  channel_overrides?: ChannelType[];
}

export interface BatchNotificationRequest {
  notifications: SendNotificationRequest[];
  batch_id?: string;
}

export interface ChannelSendResult {
  success: boolean;
  channel_message_id?: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ChannelAdapter {
  channel: ChannelType;
  send(notification: NotificationLog, templateSnapshot: TemplateSnapshot): Promise<ChannelSendResult>;
}

export interface QueueJobData {
  notificationId: string;
  notificationLogId?: string;
  retries?: number;
}

export interface BatchQueueJobData {
  notifications: SendNotificationRequest[];
  batchId: string;
  chunkIndex: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxCount: number;
}

export interface SilentHoursConfig {
  start: string;
  end: string;
}

export interface WebhookConfig {
  secret: string;
  url?: string;
}

export interface DashboardStats {
  total_sent: number;
  total_failed: number;
  total_pending: number;
  by_channel: Record<ChannelType, number>;
  by_status: Record<NotificationStatus, number>;
  queue_depth: number;
  dead_letter_count: number;
}
