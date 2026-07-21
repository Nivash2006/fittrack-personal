/**
 * FitTrack Personal — Device Connection & Smart Scale Card
 */

import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { useWebBluetoothScale } from '../bluetooth/useWebBluetoothScale';
import { db } from '../db/database';
import { syncEngine } from '../db/syncEngine';

interface DeviceConnectionCardProps {
  onManualLogClick?: () => void;
}

export default function DeviceConnectionCard({ onManualLogClick }: DeviceConnectionCardProps) {
  const {
    connectScale,
    disconnectScale,
    latestWeight,
    connectionStatus,
    error,
    pairedDevice,
    isBluetoothSupported,
  } = useWebBluetoothScale();

  const [isOnline, setIsOnline] = useState(syncEngine.isOnline());

  // Watch paired devices list in IndexedDB
  const localDevices = useLiveQuery(() => db.connectedDevices.toArray());
  const activeDevice = localDevices?.find((d) => d.isPrimary) || localDevices?.[0] || pairedDevice;

  // Listen to sync engine status
  useEffect(() => {
    const handleNetworkChange = () => {
      setIsOnline(syncEngine.isOnline());
    };
    syncEngine.addListener(handleNetworkChange);
    return () => syncEngine.removeListener(handleNetworkChange);
  }, []);

  // Status mapping to HSL color classes and labels
  const getStatusMeta = () => {
    switch (connectionStatus) {
      case 'scanning':
        return {
          color: '#ffb347', // Orange/Amber
          label: 'Scanning for Scale...',
          pulse: true,
        };
      case 'connecting':
        return {
          color: '#4d8dff', // Blue
          label: 'Establishing Connection...',
          pulse: true,
        };
      case 'connected':
        return {
          color: '#00e68a', // Green
          label: 'Connected — Step on Scale',
          pulse: true,
        };
      case 'syncing':
        return {
          color: '#4d8dff', // Pulsing blue
          label: 'Weighing / Syncing...',
          pulse: true,
        };
      case 'failed':
        return {
          color: '#ff4d6a', // Red
          label: 'Failed to Connect',
          pulse: false,
        };
      default:
        return {
          color: '#9a9ab0', // Gray
          label: activeDevice ? 'Scale Paired — Standby' : 'No Scale Paired',
          pulse: false,
        };
    }
  };

  const statusMeta = getStatusMeta();

  return (
    <div className="glass-card mb-md animate-in" style={{ padding: 'var(--space-md)', position: 'relative' }}>
      
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <span style={{ fontSize: '0.6875rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>
            Smart Integration
          </span>
          <h3 style={{ margin: '2px 0 0 0', fontSize: '1.125rem', fontWeight: 700 }}>
            AntAlpha Smart Scale
          </h3>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <span className="text-small text-muted" style={{ fontSize: '0.75rem' }}>
            {isOnline ? '🟢 Online' : '⚠️ Offline Mode'}
          </span>
        </div>
      </div>

      {/* Connection Info */}
      <div className="glass-card" style={{ background: 'rgba(255,255,255,0.015)', padding: 'var(--space-sm) var(--space-md)', marginBottom: 'var(--space-md)', borderRadius: 'var(--radius-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: statusMeta.color,
              boxShadow: `0 0 8px ${statusMeta.color}`,
              animation: statusMeta.pulse ? 'pulse 1.5s infinite ease-in-out' : 'none',
            }}
          />
          <div style={{ flex: 1, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            {statusMeta.label}
          </div>
          {activeDevice?.lastBatteryLevel !== undefined && (
            <div className="text-caption" style={{ color: 'var(--accent)', fontWeight: 600 }}>
              🔋 {activeDevice.lastBatteryLevel}%
            </div>
          )}
        </div>

        {/* Display MAC details & metadata */}
        {activeDevice && (
          <div style={{ display: 'flex', gap: 'var(--space-md)', marginTop: '6px', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px' }}>
            <span className="text-caption" style={{ fontSize: '0.625rem' }}>
              Scale: <strong style={{ color: 'var(--text-primary)' }}>{activeDevice.deviceName}</strong>
            </span>
            <span className="text-caption" style={{ fontSize: '0.625rem' }}>
              ID: <strong style={{ color: 'var(--text-primary)' }}>{activeDevice.deviceMac.substring(0, 12)}...</strong>
            </span>
          </div>
        )}
      </div>

      {/* Live Weight Display */}
      {latestWeight !== null && (
        <div style={{ textAlign: 'center', padding: 'var(--space-sm) 0', animation: 'pulse 1.2s infinite ease-in-out' }}>
          <div className="text-caption">Live Scale Weight</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: '3.5rem', fontWeight: 900, color: connectionStatus === 'syncing' ? 'var(--accent)' : 'var(--text-primary)' }}>
            {latestWeight.toFixed(1)} <span style={{ fontSize: '1.5rem', fontWeight: 500 }}>kg</span>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-sm)', flexDirection: 'column', marginTop: 'var(--space-sm)' }}>
        
        {isBluetoothSupported ? (
          connectionStatus === 'disconnected' || connectionStatus === 'failed' ? (
            <button className="btn btn-primary btn-block" onClick={connectScale}>
              ⚖️ Pair & Sync Scale
            </button>
          ) : (
            <button className="btn btn-secondary btn-block" onClick={disconnectScale} style={{ color: 'var(--danger)' }}>
              ✕ Stop Sync / Disconnect
            </button>
          )
        ) : (
          <div className="text-small text-muted text-center" style={{ padding: 'var(--space-xs) 0', border: '1px dashed rgba(255,255,255,0.08)', borderRadius: 'var(--radius-sm)' }}>
            🚫 Web Bluetooth is unavailable on this device. Use Google Chrome on Android.
          </div>
        )}

        {/* Manual Fallback Option */}
        {onManualLogClick && (
          <button
            className="btn btn-ghost btn-block btn-sm"
            onClick={onManualLogClick}
            style={{ fontSize: '0.8125rem', marginTop: '4px' }}
          >
            ✏️ Log Weight Manually
          </button>
        )}
      </div>

      {/* Error Alert Display */}
      {error && (
        <div style={{
          marginTop: 'var(--space-md)',
          padding: 'var(--space-sm)',
          background: 'rgba(255, 77, 106, 0.05)',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid rgba(255, 77, 106, 0.15)',
          color: 'var(--danger)',
          fontSize: '0.75rem',
          lineHeight: 1.4
        }}>
          <strong>Connection Alert:</strong> {error.message}
        </div>
      )}

      {/* Bluetooth Connection Warning Guide */}
      <div style={{
        marginTop: 'var(--space-md)',
        padding: 'var(--space-sm)',
        background: 'var(--bg-glass-strong)',
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--border-subtle)',
        fontSize: '0.75rem',
        lineHeight: 1.4,
        color: 'var(--text-secondary)'
      }}>
        <div style={{ fontWeight: 700, display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--accent)', marginBottom: '4px' }}>
          <span>💡</span> Connection Troubleshooting
        </div>
        <ul style={{ margin: 0, paddingLeft: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Close official scale apps:</strong> Weight scales can only connect to one app at a time. If the official scale app is open or running in the background, it will block this app. **Force close the scale app** and try again!
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Re-cycle Bluetooth:</strong> Turn off your Bluetooth, turn it back on, step on the scale to wake it up, and tap Pair.
          </li>
          <li>
            <strong style={{ color: 'var(--text-primary)' }}>Browser support:</strong> Use Google Chrome on Android. On iOS, use the **Bluefy** browser app.
          </li>
        </ul>
      </div>

      {/* CSS Pulse Keyframe Animation */}
      <style>{`
        @keyframes pulse {
          0% { opacity: 0.6; }
          50% { opacity: 1; }
          100% { opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
