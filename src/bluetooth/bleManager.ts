/**
 * FitTrack Personal — Web Bluetooth BLE Manager
 */

import {
  type BluetoothConnectionStatus,
  type BluetoothError,
  type BluetoothErrorType,
  type BluetoothDeviceMetadata,
} from './bluetoothTypes';
import { parseWeightPacket, resetStabilizationBuffer } from './packetParser';

// Web Bluetooth custom types fallback for TypeScript compile
type BluetoothDevice = any;
type BluetoothRemoteGATTCharacteristic = any;

// GATT Service & Characteristic UUIDs
const UUIDS = {
  WEIGHT_SERVICE: 'weight_scale', // or '0000181d-0000-1000-8000-00805f9b34fb'
  WEIGHT_CHAR: 'weight_measurement', // or '00002a9d-0000-1000-8000-00805f9b34fb'
  BATTERY_SERVICE: 'battery_service',
  BATTERY_CHAR: 'battery_level',
};

export class BLEManager {
  private device: BluetoothDevice | null = null;
  private weightCharacteristic: BluetoothRemoteGATTCharacteristic | null = null;
  
  private connectionStatus: BluetoothConnectionStatus = 'disconnected';
  private onStatusChange: (status: BluetoothConnectionStatus) => void = () => {};
  private onWeightReceived: (weightKg: number, isStable: boolean) => void = () => {};
  private onError: (error: BluetoothError) => void = () => {};
  private onDevicePaired: (meta: BluetoothDeviceMetadata) => void = () => {};

  private connectionTimeout: any = null;
  private scanTimeout: any = null;
  private retryCount = 0;
  private maxRetries = 3;

  constructor() {}

  /**
   * Registers event handlers
   */
  public registerCallbacks(callbacks: {
    onStatusChange: (status: BluetoothConnectionStatus) => void;
    onWeightReceived: (weightKg: number, isStable: boolean) => void;
    onError: (error: BluetoothError) => void;
    onDevicePaired: (meta: BluetoothDeviceMetadata) => void;
  }) {
    this.onStatusChange = callbacks.onStatusChange;
    this.onWeightReceived = callbacks.onWeightReceived;
    this.onError = callbacks.onError;
    this.onDevicePaired = callbacks.onDevicePaired;
  }

  /**
   * Checks browser compatibility
   */
  public isSupported(): boolean {
    return typeof navigator !== 'undefined' && 'bluetooth' in (navigator as any);
  }

  /**
   * Returns current status
   */
  public getStatus(): BluetoothConnectionStatus {
    return this.connectionStatus;
  }

  private setStatus(status: BluetoothConnectionStatus) {
    this.connectionStatus = status;
    this.onStatusChange(status);
  }

  /**
   * Initiates Web Bluetooth Device Scan & Pairing
   */
  public async connect(): Promise<void> {
    if (!this.isSupported()) {
      this.handleError('BLUETOOTH_UNAVAILABLE', 'Web Bluetooth is not supported in this browser. Please use Chrome or Edge on Android.');
      return;
    }

    try {
      this.setStatus('scanning');
      resetStabilizationBuffer();

      // Scan timeout (30 seconds)
      this.scanTimeout = setTimeout(() => {
        if (this.connectionStatus === 'scanning') {
          this.disconnect();
          this.handleError('DEVICE_NOT_FOUND', 'Device scanning timed out. Please make sure the scale is turned on and in range.');
        }
      }, 30000);

      // Web Bluetooth prompt (requires explicit user action)
      const device = await (navigator as any).bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: [
          UUIDS.WEIGHT_SERVICE,
          '0000181d-0000-1000-8000-00805f9b34fb', // standard weight scale
          '0000181b-0000-1000-8000-00805f9b34fb', // standard body composition
          UUIDS.BATTERY_SERVICE,
          'battery_service',
          'device_information'
        ]
      });

      if (this.scanTimeout) {
        clearTimeout(this.scanTimeout);
      }

      this.device = device;
      this.device.addEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));

      await this.establishGattConnection();
    } catch (err: any) {
      if (this.scanTimeout) clearTimeout(this.scanTimeout);
      this.setStatus('failed');

      if (err.name === 'NotFoundError') {
        this.handleError('PAIRING_CANCELLED', 'Connection was cancelled by the user.');
      } else {
        this.handleError('CONNECTION_FAILED', err.message || 'Failed to select and pair device.');
      }
    }
  }

  /**
   * Establishes GATT server connection and discovers characteristics
   */
  private async establishGattConnection(): Promise<void> {
    if (!this.device) return;

    try {
      this.setStatus('connecting');

      // GATT Connect Timeout (15 seconds)
      this.connectionTimeout = setTimeout(() => {
        if (this.connectionStatus === 'connecting') {
          this.disconnect();
          this.handleError('CONNECTION_FAILED', 'GATT server connection timed out.');
        }
      }, 15000);

      const server = await this.device.gatt?.connect();
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

      if (!server) {
        throw new Error('Could not connect to GATT Server');
      }

      this.setStatus('connected');

      // Fire paired metadata event
      this.onDevicePaired({
        deviceMac: this.device.id, // MAC addresses are obfuscated as IDs in Web Bluetooth for security
        deviceName: this.device.name || 'AntAlpha Smart Scale',
      });

      // Discover Weight Service & Characteristic
      const service = await server.getPrimaryService(UUIDS.WEIGHT_SERVICE);
      const characteristic = await service.getCharacteristic(UUIDS.WEIGHT_CHAR);
      this.weightCharacteristic = characteristic;

      // Subscribe to weight value notifications
      await characteristic.startNotifications();
      characteristic.addEventListener('characteristicvaluechanged', this.handleWeightNotification.bind(this));

      // Attempt to read battery level (if supported)
      try {
        const batteryService = await server.getPrimaryService(UUIDS.BATTERY_SERVICE);
        const batteryChar = await batteryService.getCharacteristic(UUIDS.BATTERY_CHAR);
        const batteryValue = await batteryChar.readValue();
        const batteryLevel = batteryValue.getUint8(0);

        this.onDevicePaired({
          deviceMac: this.device.id,
          deviceName: this.device.name || 'AntAlpha Smart Scale',
          lastBatteryLevel: batteryLevel,
        });
      } catch {
        // Battery service optional — ignore errors
      }

      this.setStatus('syncing');
      this.retryCount = 0;
    } catch (err: any) {
      if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
      this.attemptReconnection(err.message);
    }
  }

  /**
   * GATT value notification handler
   */
  private handleWeightNotification(event: any) {
    const characteristic = event.target as BluetoothRemoteGATTCharacteristic;
    const value = characteristic.value;
    if (!value) return;

    // Parse bytes
    const measurement = parseWeightPacket(value);
    if (measurement) {
      this.onWeightReceived(measurement.weightKg, measurement.isStable);
    }
  }

  /**
   * Automatic Reconnection logic with Exponential Backoff
   */
  private async attemptReconnection(reason: string) {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      const delay = Math.pow(2, this.retryCount) * 1000; // 2s, 4s, 8s
      console.warn(`BLE GATT connection failed (${reason}). Retrying ${this.retryCount}/${this.maxRetries} in ${delay}ms...`);
      
      this.setStatus('connecting');
      setTimeout(async () => {
        try {
          await this.establishGattConnection();
        } catch {
          // Failure handled in call
        }
      }, delay);
    } else {
      this.setStatus('failed');
      this.handleError('CONNECTION_FAILED', `Failed to establish connection after ${this.maxRetries} retries: ${reason}`);
    }
  }

  /**
   * Handle unexpected server disconnections
   */
  private handleDisconnection() {
    console.warn('BLE Device disconnected unexpectedly.');
    this.setStatus('disconnected');
    // If we're mid-session, attempt to reconnect
    if (this.device) {
      this.attemptReconnection('Device disconnected');
    }
  }

  /**
   * Terminates active sessions and cleans up listeners
   */
  public disconnect(): void {
    if (this.scanTimeout) clearTimeout(this.scanTimeout);
    if (this.connectionTimeout) clearTimeout(this.connectionTimeout);

    try {
      if (this.weightCharacteristic) {
        this.weightCharacteristic.removeEventListener('characteristicvaluechanged', this.handleWeightNotification.bind(this));
      }
      if (this.device) {
        this.device.removeEventListener('gattserverdisconnected', this.handleDisconnection.bind(this));
        if (this.device.gatt?.connected) {
          this.device.gatt.disconnect();
        }
      }
    } catch (err) {
      console.error('Error during BLE disconnect:', err);
    }

    this.device = null;
    this.weightCharacteristic = null;
    this.setStatus('disconnected');
    resetStabilizationBuffer();
  }

  /**
   * Emits standardized error codes
   */
  private handleError(type: BluetoothErrorType, message: string) {
    this.onError({ type, message });
  }
}
