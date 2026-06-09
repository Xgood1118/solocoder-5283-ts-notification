import { ChannelAdapter, ChannelSendResult, NotificationLog, TemplateSnapshot, ChannelType } from '../types';

export abstract class BaseChannelAdapter implements ChannelAdapter {
  abstract channel: ChannelType;

  abstract send(
    notification: NotificationLog,
    templateSnapshot: TemplateSnapshot
  ): Promise<ChannelSendResult>;

  protected formatResult(
    success: boolean,
    channelMessageId?: string,
    error?: string,
    metadata?: Record<string, any>
  ): ChannelSendResult {
    return {
      success,
      channel_message_id: channelMessageId,
      error,
      metadata,
    };
  }
}

export default BaseChannelAdapter;
