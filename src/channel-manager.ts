import { Channel, ConnectionStatus, Response } from './interfaces';
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
  }

  public async init() {
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
        console.warn(`Не удалось подключиться к каналу ${channel.id}`);
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

  public async getData(): Promise<Response | null> {
    // 1. Если есть активный канал — пытаемся получить данные
    if (this.activeChannel) {
      try {
        const data = await this.activeChannel.getData();
        this.buffer = data;
        return data;
      } catch (e) {
        console.warn(`Ошибка при получении данных с канала ${this.activeChannel.id}`, e);
      }
    }

    // 2. Пытаемся подключиться к доступному каналу
    const connected = await this.connect();

    // 3. Если подключились — получаем данные сразу же!
    if (connected && this.activeChannel) {
      try {
        const data = await this.activeChannel.getData();
        this.buffer = data;
        return data;
      } catch (e) {
        console.warn(`Ошибка при получении данных после подключения`, e);
      }
    }

    // 4. Если ничего не получилось — возвращаем последнее из буфера
    const lastKnown = this.buffer ?? null;
    console.warn('Используем данные из буфера:', lastKnown);
    return lastKnown;
  }
}
