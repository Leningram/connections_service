import { ChannelManager } from "./channel-manager";
import { Channel, ConnectionStatus, Response } from "./interfaces";

function mockChannel(id: string, priority: number, failConnect = false): Channel {
  return {
    id,
    priority,
    status: ConnectionStatus.IDLE,
    async connect() {
      if (failConnect) throw new Error('Connection failed');
      console.log(`✅ mockChannel ${id} connected`);
    },
    async getData() {
      return { data:{channel: id}, timestamp: Date.now() };
    },
    async checkAvailability() {
      return !failConnect;
    },
  };
}

async function main() {
  const channelA = mockChannel('A', 1);
  const channelB = mockChannel('B', 2, true); // отказ при подключении

  const manager = new ChannelManager([channelA, channelB]);

  const data = await manager.getData();
  console.log('📦 Данные:', data);
}

main();
