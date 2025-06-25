import { Channel, ConnectionStatus } from "./interfaces";

export const sortChannelsByPriority = (channels: Channel[]): Channel[] => {
  return channels.sort((a, b) => a.priority - b.priority);
}

export const getAvailableChannels = (channels: Channel[]): Channel[] => {
  return channels.filter(channel => channel.status === ConnectionStatus.IDLE);
}