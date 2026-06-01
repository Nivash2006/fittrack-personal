/**
 * FitTrack Personal — Web Bluetooth Scale React Hook
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { BLEManager } from './bleManager';
import {
  type BluetoothConnectionStatus,
  type BluetoothError,
  type BluetoothDeviceMetadata,
} from './bluetoothTypes';
import { db } from '../db/database';

export function useWebBluetoothScale() {
  const [latestWeight, setLatestWeight] = useState<number | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<BluetoothConnectionStatus>('disconnected');
  const [error, setError] = useState<BluetoothError | null>(null);
  const [pairedDevice, setPairedDevice] = useState<BluetoothDeviceMetadata | null>(null);

  // Use a ref to hold a single persistent BLEManager instance
  const bleManagerRef = useRef<BLEManager | null>(null);

  // Initialize BLEManager on mount
  useEffect(() => {
    const manager = new BLEManager();
    bleManagerRef.current = manager;

    manager.registerCallbacks({
      onStatusChange: (status) => {
        setConnectionStatus(status);
        if (status === 'disconnected' || status === 'scanning') {
          setLatestWeight(null);
        }
      },
      onWeightReceived: async (weightKg, isStable) => {
        setLatestWeight(weightKg);
        if (isStable) {
          await saveStabilizedWeight(weightKg);
        }
      },
      onError: (err) => {
        setError(err);
      },
      onDevicePaired: (meta) => {
        setPairedDevice(meta);
        // Persist primary status or paired device MAC in DB
        saveConnectedDevice(meta);
      },
    });

    return () => {
      manager.disconnect();
    };
  }, []);

  /**
   * Save paired scale to local IndexedDB
   */
  const saveConnectedDevice = async (meta: BluetoothDeviceMetadata) => {
    try {
      const todayStr = new Date().toISOString();
      const existing = await db.connectedDevices.where('deviceMac').equals(meta.deviceMac).first();

      if (existing) {
        await db.connectedDevices.update(existing.id!, {
          deviceName: meta.deviceName,
          lastConnectedAt: todayStr,
          lastBatteryLevel: meta.lastBatteryLevel ?? existing.lastBatteryLevel,
          firmwareVersion: meta.firmwareVersion ?? existing.firmwareVersion,
        });
      } else {
        // Find if this is the first scale (make it primary by default)
        const total = await db.connectedDevices.count();
        const primary = total === 0;

        await db.connectedDevices.add({
          deviceMac: meta.deviceMac,
          deviceName: meta.deviceName,
          lastConnectedAt: todayStr,
          lastBatteryLevel: meta.lastBatteryLevel,
          firmwareVersion: meta.firmwareVersion,
          isPrimary: primary,
        });
      }
    } catch (err) {
      console.error('Failed to persist connected device:', err);
    }
  };

  /**
   * Saves stabilized scale measurements locally in IndexedDB & queues for sync
   */
  const saveStabilizedWeight = async (weightKg: number) => {
    try {
      const todayStr = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      
      // 1. Conflict Resolution / De-duplication Rule:
      // Ignore duplicate if same weight is logged on the same day (loggedAt)
      const isDuplicate = await db.weightLogs
        .where('[loggedAt+weight]')
        .equals([todayStr, weightKg])
        .first();

      if (isDuplicate) {
        console.warn(`Duplicate weight reading ${weightKg}kg for date ${todayStr} ignored.`);
        return;
      }

      const timestamp = new Date().toISOString();

      // 2. Add Weight Log
      const logId = await db.weightLogs.add({
        weight: weightKg,
        unit: 'kg',
        source: 'antalpha_scale',
        loggedAt: todayStr,
        createdAt: timestamp,
        updatedAt: timestamp,
        syncStatus: 'pending',
        deviceMac: pairedDevice?.deviceMac,
      });

      // 3. Add to Offline Sync Queue Table
      await db.syncQueue.add({
        entityType: 'weightLogs',
        entityId: logId,
        operation: 'create',
        createdAt: timestamp,
        retryCount: 0,
      });

      console.log(`Saved stabilized scale weight: ${weightKg}kg with Sync Queue ID reference.`);
    } catch (err) {
      console.error('Failed to save stabilized weight log:', err);
    }
  };

  /**
   * Connects to scale (Requires explicit user interaction context)
   */
  const connectScale = useCallback(() => {
    setError(null);
    if (bleManagerRef.current) {
      bleManagerRef.current.connect();
    }
  }, []);

  /**
   * Disconnects active BLE session
   */
  const disconnectScale = useCallback(() => {
    setError(null);
    if (bleManagerRef.current) {
      bleManagerRef.current.disconnect();
    }
  }, []);

  const isBluetoothSupported = bleManagerRef.current?.isSupported() ?? false;

  return {
    connectScale,
    disconnectScale,
    latestWeight,
    connectionStatus,
    error,
    pairedDevice,
    isBluetoothSupported,
  };
}
