import { ChannelType, ChannelAdapter } from '../types';
import { EmailChannelAdapter } from './email';
import { SmsChannelAdapter } from './sms';
import { InAppChannelAdapter } from './inapp';
import { PushChannelAdapter } from './push';
import { WebhookChannelAdapter } from './webhook';
import logger from '../utils/logger';

class ChannelManager {
  private channels: Map<ChannelType, ChannelAdapter>;

  constructor() {
    this.channels = new Map();
    this.registerDefaultChannels();
  }

  private registerDefaultChannels(): void {
    this.register(new EmailChannelAdapter());
    this.register(new SmsChannelAdapter());
    this.register(new InAppChannelAdapter());
    this.register(new PushChannelAdapter());
    this.register(new WebhookChannelAdapter());
    logger.info('Default channels registered');
  }

  register(adapter: ChannelAdapter): void {
    this.channels.set(adapter.channel, adapter);
    logger.debug(`Channel registered: ${adapter.channel}`);
  }

  getChannel(channel: ChannelType): ChannelAdapter | undefined {
    return this.channels.get(channel);
  }

  hasChannel(channel: ChannelType): boolean {
    return this.channels.has(channel);
  }

  getAvailableChannels(): ChannelType[] {
    return Array.from(this.channels.keys());
  }
}

const channelManager = new ChannelManager();

export default channelManager;
export { ChannelManager };
