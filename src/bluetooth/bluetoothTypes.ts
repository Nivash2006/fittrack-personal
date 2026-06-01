/**
 * FitTrack Personal — Bluetooth Domain Types & Error Enums
 */

export type BluetoothConnectionStatus =
  | 'disconnected'
  | 'scanning'
  | 'connecting'
  | 'connected'
  | 'syncing'
  | 'failed';

export type BluetoothErrorType =
  | 'BLUETOOTH_UNAVAILABLE'
  | 'DEVICE_NOT_FOUND'
  | 'CONNECTION_FAILED'
  | 'PAIRING_CANCELLED'
  | 'PACKET_PARSE_FAILED'
  | 'SYNC_FAILED';

export interface BluetoothError {
  type: BluetoothErrorType;
  message: string;
}

export interface ScaleMeasurement {
  weightKg: number;
  unit: 'kg' | 'lb';
  isStable: boolean;
  timestamp: number;
  impedanceOhms?: number; // Optional body fat impedance
  batteryLevel?: number; // Optional battery level of scale
}

export interface BluetoothDeviceMetadata {
  deviceMac: string;
  deviceName: string;
  lastBatteryLevel?: number;
  firmwareVersion?: string;
}
