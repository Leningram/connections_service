import { Channel, ConnectionStatus, DataPriority, Response } from './interfaces';
import { getAvailableChannels, sortChannelsByPriority } from './utils';

export class ChannelManager {
  private channels: Channel[] = [];
  private activeChannel: Channel | null = null;
  private checkInterval = 10000;
  private buffer: Response | null = null;

  // Флаг для предотвращения повторных подключений
  private isConnecting = false;

  constructor(channels: Channel[]) {
    this.channels = channels;
    this.init();
  }

  private async init() {
    await this.connect();
    setInterval(() => this.checkUnavailableChannels(), this.checkInterval);
  }

  private async connect(): Promise<boolean> {
    if (this.isConnecting) return false;
    this.isConnecting = true;
    const sorted = sortChannelsByPriority(getAvailableChannels(this.channels));

    for (const channel of sorted) {
      try {
        await channel.connect();
        channel.status = ConnectionStatus.CONNECTED;
        this.activeChannel = channel;
        console.info(`Канал ${channel.id} подключен`);
        this.startMonitoring(channel);
        this.isConnecting = false;
        return true;
      } catch {
        channel.status = ConnectionStatus.UNAVAILABLE;
      }
    }
    this.isConnecting = false;
    console.warn('Нет доступных каналов для подключения');
    return false;
  }

  private startMonitoring(channel: Channel) {
    const interval = setInterval(async () => {
      try {
        const available = await channel.checkAvailability();
        if (!available) throw new Error('Channel down');
      } catch {
        clearInterval(interval);
        channel.status = ConnectionStatus.UNAVAILABLE;
        console.warn(`Канал ${channel.id} недоступен, пытаемся переподключиться...`);
        this.activeChannel = null;
        await this.connect();
      }
    }, 5000);
  }

  private async checkUnavailableChannels() {
    for (const channel of this.channels.filter((c) => c.status === 'unavailable')) {
      try {
        const available = await channel.checkAvailability();
        if (available) channel.status = ConnectionStatus.IDLE;
      } catch {
        console.warn(`Канал ${channel.id} недоступен`);
      }
    }
  }

  public async getData(dataPriority: DataPriority = DataPriority.LOW): Promise<Response | null> {
    if (!this.activeChannel) return null;
    try {
      const data = await this.activeChannel.getData();

      // Добавляем в буфер
      this.buffer = data;

      return data;
    } catch {
      this.activeChannel.status = ConnectionStatus.UNAVAILABLE;
      if (dataPriority === DataPriority.HIGH) {
        await this.delay(2000);
      }
      this.activeChannel = null;
      await this.connect();
      const success = await this.connect();

      if (success) {
        return this.getData();
      }
      // возвращаем данные из буфера при неудаче
      const lastKnown = this.buffer;
      return lastKnown;
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
