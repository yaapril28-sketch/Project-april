export interface LogEntry {
  id: string;
  timestamp: string;
  text: string;
  type: 'mqtt' | 'publish' | 'error' | 'system' | 'voice';
}

export type BrokerId = 'mosquitto' | 'flespi' | 'mosquittoAuth';

export interface BrokerStatus {
  id: BrokerId;
  name: string;
  connected: boolean;
  latency: number | null;
  host: string;
}

export interface Relay {
  id: number;
  label: string;
  active: boolean;
}

export interface Pattern {
  id: number;
  name: string;
  active: boolean;
  description: string;
}

export interface SensorPoint {
  temperature: number;
  humidity: number;
  timestamp: Date;
}
