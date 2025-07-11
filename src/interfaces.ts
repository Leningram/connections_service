export enum ConnectionStatus {
  IDLE = 'idle',
  CONNECTED = 'connected',
  UNAVAILABLE = 'unavailable',
}

export interface Response {
  data: any;
  timestamp: number;
}

export interface Channel {
  id: string;
  priority: number;
  status: ConnectionStatus;
  checkAvailability(): Promise<boolean>;
  connect(): Promise<void>;
  getData(): Promise<Response>;
}