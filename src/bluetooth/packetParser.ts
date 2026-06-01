/**
 * FitTrack Personal — BLE Packet Parser & Weight Stabilizer
 */

import { type ScaleMeasurement } from './bluetoothTypes';

// Keep a sliding buffer to verify stabilization if the scale doesn't broadcast a native stability flag
let stabilizationBuffer: number[] = [];

/**
 * Normalizes weight in pounds (lb) or other units to kilograms (kg).
 */
export function normalizeToKg(value: number, unit: 'kg' | 'lb'): number {
  if (unit === 'lb') {
    return Math.round((value * 0.45359237) * 100) / 100;
  }
  return Math.round(value * 100) / 100;
}

/**
 * Resets the sliding window stabilizer buffer.
 */
export function resetStabilizationBuffer(): void {
  stabilizationBuffer = [];
}

/**
 * Filter that requires either:
 * A) A native scale packet stability bit.
 * B) 3 consecutive identical weight values within a small threshold (e.g., 0.1kg).
 */
export function processStabilization(weightKg: number, nativeStableFlag: boolean): boolean {
  if (nativeStableFlag) {
    return true;
  }

  // Push to buffer
  stabilizationBuffer.push(weightKg);

  // Keep last 3 values
  if (stabilizationBuffer.length > 3) {
    stabilizationBuffer.shift();
  }

  if (stabilizationBuffer.length < 3) {
    return false;
  }

  // Check if all 3 values are virtually identical (difference < 0.1 kg)
  const [v1, v2, v3] = stabilizationBuffer;
  const isStable = Math.abs(v1 - v2) < 0.1 && Math.abs(v2 - v3) < 0.1;
  return isStable;
}

/**
 * Decodes a raw binary BLE DataView packet (Weight Scale Service 0x181D / Weight Measurement 0x2A9D).
 * Supports standard Bluetooth SIG GATT Weight Measurement specification.
 */
export function parseWeightPacket(dataView: DataView): ScaleMeasurement | null {
  try {
    if (dataView.byteLength < 3) {
      return null;
    }

    const flags = dataView.getUint8(0);
    
    // Bit 0 of flags: 0 = SI (kg), 1 = Imperial (lbs)
    const isImperial = (flags & 0x01) !== 0;
    const unit: 'kg' | 'lb' = isImperial ? 'lb' : 'kg';

    // Bytes 1-2: Weight value (standard GATT is uint16)
    const rawWeight = dataView.getUint16(1, true); // Little endian

    // Standard GATT scales resolve kg by factor of 0.005 or 0.1 depending on flags.
    // However, many commercial scales transmit weight multiplied by 10 or 100 directly.
    // We adjust multiplier based on typical commercial ranges (e.g., raw 7840 = 78.4kg).
    let weight = rawWeight;
    if (rawWeight > 1000) {
      // If weight value is large (e.g. 7850 for 78.5kg or 17320 for 173.2lb), scale by 100 or 1000
      weight = rawWeight / 100;
    } else {
      // Scale by 10 (e.g. 785 for 78.5kg)
      weight = rawWeight / 10;
    }

    // Bit 1 of flags: Timestamp present
    const hasTimestamp = (flags & 0x02) !== 0;
    let timestamp = Date.now();

    if (hasTimestamp && dataView.byteLength >= 10) {
      // Parse GATT DateTime: Year (2B), Month (1B), Day (1B), Hour (1B), Min (1B), Sec (1B)
      const year = dataView.getUint16(3, true);
      const month = dataView.getUint8(5) - 1; // JS Month is 0-indexed
      const day = dataView.getUint8(6);
      const hour = dataView.getUint8(7);
      const min = dataView.getUint8(8);
      const sec = dataView.getUint8(9);

      const parsedDate = new Date(year, month, day, hour, min, sec);
      if (!isNaN(parsedDate.getTime())) {
        timestamp = parsedDate.getTime();
      }
    }

    // Determine stability: check if a proprietary/custom bit 4 or 5 is set, or default to false
    // Most scales use the 5th bit (0x10) to indicate final/locked weight.
    const isStableNative = (flags & 0x10) !== 0;

    const normalizedWeight = normalizeToKg(weight, unit);
    const stabilized = processStabilization(normalizedWeight, isStableNative);

    return {
      weightKg: normalizedWeight,
      unit: 'kg', // Stored values are always normalized to kg
      isStable: stabilized,
      timestamp,
    };
  } catch (error) {
    console.error('BLE Packet parsing failed:', error);
    return null;
  }
}
