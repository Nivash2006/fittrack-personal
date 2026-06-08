import { useState, useEffect, useMemo, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { getTodayStr, getLast7Days, getDayName } from '../utils/helpers';
import Modal from './Modal';
import Toast from './Toast';

export default function StepTrackerCard() {
  const today = getTodayStr();
  const todaySteps = useLiveQuery(() => db.stepLogs.where('date').equals(today).first(), [today]);
  const allStepLogs = useLiveQuery(() => db.stepLogs.toArray());

  const [isOpen, setIsOpen] = useState(false);
  const [isLiveTracking, setIsLiveTracking] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  
  // Manual input state
  const [manualSteps, setManualSteps] = useState('');
  
  // Google OAuth and Fit Sync state
  const [googleToken, setGoogleToken] = useState<string | null>(localStorage.getItem('fittrack_google_token'));
  const [googleTokenExpiry, setGoogleTokenExpiry] = useState<string | null>(localStorage.getItem('fittrack_google_token_expiry'));
  const [isSyncing, setIsSyncing] = useState(false);
  const [customClientId, setCustomClientId] = useState(localStorage.getItem('fittrack_google_client_id') || '');
  const [showConfig, setShowConfig] = useState(false);

  // Live motion visual indicator
  const [lastAcceleration, setLastAcceleration] = useState<number>(0);
  const [pulseActive, setPulseActive] = useState(false);

  const stepsGoal = 10000;
  const currentSteps = todaySteps?.count || 0;
  const stepPercent = Math.min(100, Math.round((currentSteps / stepsGoal) * 100));

  // Compute standard health metrics
  const distanceKm = useMemo(() => ((currentSteps * 0.75) / 1000).toFixed(2), [currentSteps]);
  const activeCalories = useMemo(() => Math.round(currentSteps * 0.04), [currentSteps]);
  const activeMinutes = useMemo(() => Math.round(currentSteps / 100), [currentSteps]);

  // Check token validity
  const [isGoogleConnected, setIsGoogleConnected] = useState(false);

  useEffect(() => {
    if (!googleToken || !googleTokenExpiry) {
      setIsGoogleConnected(false);
      return;
    }
    const expiry = parseInt(googleTokenExpiry);
    setIsGoogleConnected(Date.now() < expiry);
  }, [googleToken, googleTokenExpiry]);

  // Trigger Google Fit Sync
  const fetchGoogleFitSteps = useCallback(async (token: string, silent = false) => {
    setIsSyncing(true);
    try {
      const startOfToday = new Date();
      startOfToday.setHours(0, 0, 0, 0);
      const startTimeMillis = startOfToday.getTime();

      const endOfToday = new Date();
      endOfToday.setHours(23, 59, 59, 999);
      const endTimeMillis = endOfToday.getTime();

      const response = await fetch('https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          aggregateBy: [{
            dataTypeName: 'com.google.step_count.delta',
            dataSourceId: 'derived:com.google.step_count.delta:com.google.android.gms:estimated_steps'
          }],
          bucketByTime: { durationMillis: 86400000 },
          startTimeMillis,
          endTimeMillis
        })
      });

      if (!response.ok) {
        throw new Error('Google Fit API returned an error.');
      }

      const data = await response.json();
      let googleSteps = 0;
      
      if (data?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.intVal !== undefined) {
        googleSteps = data.bucket[0].dataset[0].point[0].value[0].intVal;
      } else if (data?.bucket?.[0]?.dataset?.[0]?.point?.[0]?.value?.[0]?.fpVal !== undefined) {
        googleSteps = Math.round(data.bucket[0].dataset[0].point[0].value[0].fpVal);
      }

      if (googleSteps > 0) {
        if (todaySteps?.id) {
          await db.stepLogs.update(todaySteps.id, { count: googleSteps });
        } else {
          await db.stepLogs.add({ count: googleSteps, date: today });
        }
        if (!silent) setToast(`Synced! Fetched ${googleSteps} steps from Google Fit.`);
      } else {
        if (!silent) setToast('Sync completed. No steps retrieved for today yet.');
      }
    } catch (err: any) {
      console.error(err);
      if (!silent) setToast('Failed to retrieve steps from Google Fit.');
    } finally {
      setIsSyncing(false);
    }
  }, [today, todaySteps]);

  // Handle OAuth Redirect processing inside the component if mounted
  useEffect(() => {
    const handleHashCallback = async () => {
      const hash = window.location.hash;
      if (hash && hash.includes('state=google_fit')) {
        const params = new URLSearchParams(hash.substring(1));
        const token = params.get('access_token');
        const expiresIn = params.get('expires_in');
        
        if (token) {
          const expiryTime = Date.now() + parseInt(expiresIn || '3600') * 1000;
          localStorage.setItem('fittrack_google_token', token);
          localStorage.setItem('fittrack_google_token_expiry', String(expiryTime));
          
          setGoogleToken(token);
          setGoogleTokenExpiry(String(expiryTime));

          // Clean URL hash
          window.history.replaceState({}, document.title, window.location.pathname);
          
          setToast('Successfully connected to Google Fit!');
          await fetchGoogleFitSteps(token, true);
        }
      }
    };
    handleHashCallback();
  }, [fetchGoogleFitSteps]);

  // Accelerometer Pedometer Logic
  useEffect(() => {
    if (!isLiveTracking) return;

    let lastStepTime = 0;
    const stepThreshold = 12.2; 
    const minStepInterval = 360; 
    let lastMagnitude = 9.8;

    const handleMotion = (event: DeviceMotionEvent) => {
      const acc = event.accelerationIncludingGravity;
      if (!acc) return;

      const x = acc.x || 0;
      const y = acc.y || 0;
      const z = acc.z || 0;

      const magnitude = Math.sqrt(x * x + y * y + z * z);
      setLastAcceleration(magnitude);

      // Flash motion visualizer pulsing dot
      if (magnitude > 11.5) {
        setPulseActive(true);
        setTimeout(() => setPulseActive(false), 200);
      }

      const now = Date.now();
      if (magnitude > stepThreshold && lastMagnitude <= stepThreshold && (now - lastStepTime) > minStepInterval) {
        lastStepTime = now;
        
        db.stepLogs.where('date').equals(today).first().then(async (record) => {
          const newCount = (record?.count || 0) + 1;
          if (record?.id) {
            await db.stepLogs.update(record.id, { count: newCount });
          } else {
            await db.stepLogs.add({ count: newCount, date: today });
          }
        });
      }
      lastMagnitude = magnitude;
    };

    window.addEventListener('devicemotion', handleMotion);
    return () => {
      window.removeEventListener('devicemotion', handleMotion);
    };
  }, [isLiveTracking, today]);

  // Start Pedometer & Request Permission
  const startLiveSensor = async () => {
    if (
      typeof DeviceMotionEvent !== 'undefined' &&
      typeof (DeviceMotionEvent as any).requestPermission === 'function'
    ) {
      try {
        const permissionState = await (DeviceMotionEvent as any).requestPermission();
        if (permissionState === 'granted') {
          setIsLiveTracking(true);
          setToast('Pedometer active. Place the phone in your pocket to track steps!');
        } else {
          setToast('Motion sensor access denied.');
        }
      } catch (err) {
        console.error(err);
        setToast('Motion permissions request failed.');
      }
    } else {
      setIsLiveTracking(true);
      setToast('Pedometer active. Place your phone in your pocket to track steps!');
    }
  };

  const stopLiveSensor = () => {
    setIsLiveTracking(false);
    setToast('Live step counter stopped.');
  };

  // Google Fit OAuth redirection
  const connectGoogleFit = () => {
    const clientId = customClientId.trim() || '1067204907997-vtr0tq6kpgsqp704g95d03pce4k402r5.apps.googleusercontent.com';
    const redirectUri = encodeURIComponent(window.location.origin);
    const scope = encodeURIComponent('https://www.googleapis.com/auth/fitness.activity.read');
    
    const oauthUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=token&scope=${scope}&include_granted_scopes=true&state=google_fit`;
    
    setToast('Redirecting to Google Sign-In...');
    window.location.href = oauthUrl;
  };

  const disconnectGoogleFit = () => {
    localStorage.removeItem('fittrack_google_token');
    localStorage.removeItem('fittrack_google_token_expiry');
    setGoogleToken(null);
    setGoogleTokenExpiry(null);
    setToast('Google Fit account disconnected.');
  };

  const saveClientId = () => {
    localStorage.setItem('fittrack_google_client_id', customClientId.trim());
    setShowConfig(false);
    setToast('Custom Client ID saved.');
  };

  // Simulate Google Fit Sync (Demo/Mock Mode)
  const simulateGoogleFitSync = async () => {
    setIsSyncing(true);
    setToast('Contacting Google Fit servers...');
    
    await new Promise((r) => setTimeout(r, 1200));
    
    const randomSteps = Math.floor(Math.random() * 5000) + 6000; // 6000 to 11000
    
    if (todaySteps?.id) {
      await db.stepLogs.update(todaySteps.id, { count: randomSteps });
    } else {
      await db.stepLogs.add({ count: randomSteps, date: today });
    }
    
    setIsSyncing(false);
    setToast(`[DEMO SYNC] Synced ${randomSteps} steps from Google Fit!`);
  };

  // Manual step override
  const handleSaveManualSteps = async () => {
    const parsed = parseInt(manualSteps);
    if (isNaN(parsed) || parsed < 0) return;
    
    if (todaySteps?.id) {
      await db.stepLogs.update(todaySteps.id, { count: parsed });
    } else {
      await db.stepLogs.add({ count: parsed, date: today });
    }
    
    setManualSteps('');
    setToast(`Steps updated to ${parsed}`);
  };

  const handleClearSteps = async () => {
    if (todaySteps?.id) {
      await db.stepLogs.delete(todaySteps.id);
      setToast("Today's steps cleared.");
    } else {
      setToast("No steps logged today to clear.");
    }
  };

  // Add steps (+1k, +5k)
  const quickAddSteps = async (amount: number) => {
    const current = todaySteps?.count || 0;
    const next = current + amount;
    
    if (todaySteps?.id) {
      await db.stepLogs.update(todaySteps.id, { count: next });
    } else {
      await db.stepLogs.add({ count: next, date: today });
    }
    setToast(`Added ${amount} steps`);
  };

  // Generate 7-day data for historical steps chart
  const weeklyData = useMemo(() => {
    const last7 = getLast7Days();
    return last7.map((day) => {
      const log = allStepLogs?.find((l) => l.date === day);
      return {
        date: day,
        name: getDayName(day),
        count: log?.count || 0,
      };
    });
  }, [allStepLogs]);

  const maxWeeklySteps = useMemo(() => {
    const counts = weeklyData.map((d) => d.count);
    return Math.max(...counts, stepsGoal);
  }, [weeklyData]);

  // SVG ring variables
  const size = 130;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (stepPercent / 100) * circumference;

  return (
    <div className="glass-card mb-md">
      
      {/* Header */}
      <div className="section-header" style={{ marginBottom: 'var(--space-md)' }}>
        <span className="section-header__title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          👟 Step Counter
          {isLiveTracking && (
            <span className="pulse-dot-active">● LIVE</span>
          )}
          {isGoogleConnected && (
            <span className="gfit-badge">GFIT SYNCED</span>
          )}
        </span>
        <button
          onClick={() => setIsOpen(true)}
          className="section-header__action"
          style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: 'none', padding: '4px 10px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem', fontWeight: 600 }}
        >
          Manage & Analytics
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-lg)', flexWrap: 'wrap' }}>
        
        {/* SVG Progress Ring */}
        <div style={{ position: 'relative', width: size, height: size, flexShrink: 0, margin: '0 auto' }}>
          <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
            <defs>
              <linearGradient id="stepsGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="var(--accent2)" />
                <stop offset="100%" stopColor="var(--accent)" />
              </linearGradient>
            </defs>
            {/* Background Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="var(--bg-glass-strong)"
              strokeWidth={strokeWidth}
            />
            {/* Active Ring */}
            <circle
              cx={size / 2}
              cy={size / 2}
              r={radius}
              fill="transparent"
              stroke="url(#stepsGradient)"
              strokeWidth={strokeWidth}
              strokeDasharray={circumference}
              strokeDashoffset={strokeDashoffset}
              strokeLinecap="round"
              style={{ transition: 'stroke-dashoffset 400ms ease' }}
            />
          </svg>
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: size,
            height: size,
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center',
            textAlign: 'center',
            fontFamily: 'var(--font-display)'
          }}>
            <span style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              {currentSteps.toLocaleString()}
            </span>
            <span style={{ fontSize: '0.625rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              / {stepsGoal.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Metrics Grid */}
        <div style={{ flex: 1, minWidth: '160px', display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-xs)' }}>
          <div className="glass-card" style={{ padding: '8px 4px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)' }}>
            <div style={{ fontSize: '1.125rem' }}>🔥</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginTop: '2px' }}>{activeCalories}</div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>kcal</div>
          </div>
          <div className="glass-card" style={{ padding: '8px 4px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)' }}>
            <div style={{ fontSize: '1.125rem' }}>📍</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginTop: '2px' }}>{distanceKm}</div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>km</div>
          </div>
          <div className="glass-card" style={{ padding: '8px 4px', textAlign: 'center', background: 'rgba(255, 255, 255, 0.015)' }}>
            <div style={{ fontSize: '1.125rem' }}>⚡</div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '0.9375rem', marginTop: '2px' }}>{activeMinutes}</div>
            <div style={{ fontSize: '0.625rem', color: 'var(--text-secondary)' }}>mins</div>
          </div>
        </div>
      </div>

      {/* Quick Access Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', marginTop: 'var(--space-md)', justifyContent: 'flex-end', alignItems: 'center' }}>
        <button className="btn btn-secondary btn-sm" onClick={() => quickAddSteps(1000)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
          +1,000
        </button>
        <button className="btn btn-secondary btn-sm" onClick={() => quickAddSteps(5000)} style={{ fontSize: '0.75rem', padding: '6px 12px' }}>
          +5,000
        </button>
        <button
          onClick={isLiveTracking ? stopLiveSensor : startLiveSensor}
          className={`btn btn-sm ${isLiveTracking ? 'btn-danger' : 'btn-secondary'}`}
          style={{
            fontSize: '0.75rem',
            padding: '6px 12px',
            background: isLiveTracking ? 'rgba(255, 77, 106, 0.15)' : 'rgba(0, 230, 138, 0.08)',
            border: isLiveTracking ? '1px solid var(--danger)' : '1px solid var(--accent)',
            color: isLiveTracking ? 'var(--danger)' : 'var(--accent)'
          }}
        >
          {isLiveTracking ? '⏹️ Stop Live' : '📱 Live Sensor'}
        </button>
      </div>

      {/* Analytics & Configuration Modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} title="Step Counter Engine & Analytics">
        <div style={{ maxHeight: '75vh', overflowY: 'auto', paddingRight: '4px', display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          
          {/* Main Visualizer & Live Accelerometer */}
          <div className="glass-card" style={{ padding: 'var(--space-md)', textAlign: 'center', background: 'rgba(255,255,255,0.015)' }}>
            <h4 style={{ margin: '0 0 var(--space-xs) 0', fontSize: '0.875rem', fontWeight: 600 }}>Mobile Motion Pedometer</h4>
            <p className="text-small text-muted" style={{ margin: '0 0 var(--space-sm) 0', fontSize: '0.75rem' }}>
              Counts walking footsteps offline using your phone's built-in 3D accelerometer.
            </p>
            
            {/* Pulsing Visual Sensor Node */}
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '80px', position: 'relative' }}>
              <div style={{
                width: '50px',
                height: '50px',
                borderRadius: '50%',
                background: isLiveTracking ? 'rgba(0, 230, 138, 0.15)' : 'rgba(255,255,255,0.02)',
                border: isLiveTracking ? '2px solid var(--accent)' : '2px solid var(--border-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '1.5rem',
                transform: pulseActive ? 'scale(1.2)' : 'scale(1)',
                transition: 'transform 100ms ease',
                boxShadow: isLiveTracking ? '0 0 20px rgba(0, 230, 138, 0.3)' : 'none'
              }}>
                🏃
              </div>
              {isLiveTracking && (
                <div style={{
                  position: 'absolute',
                  width: '70px',
                  height: '70px',
                  borderRadius: '50%',
                  border: '1px solid var(--accent)',
                  animation: 'ripple 1.5s infinite ease-out',
                  opacity: 0.5
                }} />
              )}
            </div>

            {isLiveTracking && (
              <div style={{ fontSize: '0.6875rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', marginTop: '8px' }}>
                ACCEL MAGNITUDE: {lastAcceleration.toFixed(2)} m/s²
              </div>
            )}

            <div style={{ marginTop: 'var(--space-sm)' }}>
              {isLiveTracking ? (
                <button className="btn btn-danger btn-block" onClick={stopLiveSensor}>
                  ⏹️ Stop Mobile Sensor
                </button>
              ) : (
                <button className="btn btn-secondary btn-block" onClick={startLiveSensor} style={{ border: '1px solid var(--accent)', color: 'var(--accent)' }}>
                  📱 Start Mobile Sensor
                </button>
              )}
            </div>
          </div>

          {/* Google Fit Integration Panel */}
          <div className="glass-card" style={{ padding: 'var(--space-md)', background: 'rgba(255,255,255,0.015)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-sm)' }}>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 600 }}>Google Fit Cloud Sync</h4>
              <button 
                type="button" 
                onClick={() => setShowConfig(!showConfig)}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', padding: 0 }}
                title="Configure Client ID"
              >
                ⚙️
              </button>
            </div>

            <p className="text-small text-muted" style={{ margin: '0 0 var(--space-sm) 0', fontSize: '0.75rem' }}>
              Import step counts directly from your Google Fit account using standard OAuth2.
            </p>

            {/* Custom Google Client ID configuration */}
            {showConfig && (
              <div className="glass-card mb-sm" style={{ padding: '8px', border: '1px solid var(--border-medium)' }}>
                <label style={{ display: 'block', fontSize: '0.6875rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '4px' }}>
                  Google Client ID (OAuth 2.0)
                </label>
                <input 
                  type="text" 
                  value={customClientId} 
                  onChange={(e) => setCustomClientId(e.target.value)} 
                  placeholder="Enter your oauth client id..." 
                  style={{ width: '100%', padding: '6px', fontSize: '0.75rem', marginBottom: '6px' }}
                />
                <div style={{ display: 'flex', gap: '4px' }}>
                  <button className="btn btn-primary btn-sm" onClick={saveClientId} style={{ flex: 1, fontSize: '0.6875rem' }}>Save</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setShowConfig(false)} style={{ flex: 1, fontSize: '0.6875rem' }}>Cancel</button>
                </div>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8125rem' }}>
                <span className="text-secondary">Connection Status:</span>
                <span style={{ 
                  fontWeight: 700, 
                  color: isGoogleConnected ? 'var(--accent)' : 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}>
                  {isGoogleConnected ? '🟢 Connected' : '✕ Disconnected'}
                </span>
              </div>

              {isGoogleConnected ? (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={() => googleToken && fetchGoogleFitSteps(googleToken)} 
                    disabled={isSyncing}
                    style={{ flex: 1, fontSize: '0.8125rem' }}
                  >
                    {isSyncing ? 'Syncing...' : '🔄 Sync Google Fit'}
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={disconnectGoogleFit}
                    style={{ flex: 1, fontSize: '0.8125rem', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div style={{ display: 'flex', gap: '6px' }}>
                  <button 
                    className="btn btn-primary" 
                    onClick={connectGoogleFit} 
                    style={{ flex: 1, fontSize: '0.8125rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  >
                    🔗 Link Google Fit
                  </button>
                  <button 
                    className="btn btn-secondary" 
                    onClick={simulateGoogleFitSync} 
                    disabled={isSyncing}
                    style={{ flex: 1, fontSize: '0.8125rem' }}
                  >
                    🧪 Simulator Sync
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Weekly Step History Chart */}
          <div className="glass-card" style={{ padding: 'var(--space-md)', background: 'rgba(255,255,255,0.015)' }}>
            <h4 style={{ margin: '0 0 var(--space-md) 0', fontSize: '0.875rem', fontWeight: 600 }}>Weekly Steps History</h4>
            
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '120px', paddingBottom: '10px', borderBottom: '1px solid var(--border-subtle)' }}>
              {weeklyData.map((d, i) => {
                const heightPercent = Math.max(8, Math.min(100, (d.count / maxWeeklySteps) * 100));
                const isToday = d.date === today;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', height: '100%', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '0.625rem', color: isToday ? 'var(--accent)' : 'var(--text-secondary)', fontWeight: isToday ? 700 : 400 }}>
                      {d.count > 0 ? (d.count >= 1000 ? `${(d.count / 1000).toFixed(1)}k` : d.count) : '0'}
                    </span>
                    <div style={{
                      width: '12px',
                      height: `${heightPercent}%`,
                      background: isToday 
                        ? 'linear-gradient(to top, var(--accent), var(--accent2))' 
                        : 'var(--bg-glass-strong)',
                      borderRadius: '4px',
                      boxShadow: isToday ? '0 0 10px rgba(0, 230, 138, 0.2)' : 'none',
                      transition: 'height 400ms ease'
                    }} />
                    <span style={{ fontSize: '0.6875rem', color: isToday ? 'var(--accent)' : 'var(--text-muted)', fontWeight: isToday ? 700 : 400 }}>
                      {d.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Manual Step Log Adjustment */}
          <div className="glass-card" style={{ padding: 'var(--space-md)', background: 'rgba(255,255,255,0.015)' }}>
            <h4 style={{ margin: '0 0 var(--space-sm) 0', fontSize: '0.875rem', fontWeight: 600 }}>Manual Log Correction</h4>
            <div style={{ display: 'flex', gap: 'var(--space-sm)', alignItems: 'center' }}>
              <input
                type="number"
                value={manualSteps}
                onChange={(e) => setManualSteps(e.target.value)}
                placeholder={String(currentSteps)}
                style={{ flex: 1, padding: '8px 12px', fontSize: '0.875rem', background: 'var(--bg-glass)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)' }}
                min="0"
              />
              <button className="btn btn-primary" onClick={handleSaveManualSteps} style={{ padding: '8px 16px', fontSize: '0.875rem' }}>
                Save Steps
              </button>
              {currentSteps > 0 && (
                <button 
                  className="btn btn-secondary" 
                  onClick={handleClearSteps} 
                  style={{ padding: '8px 12px', fontSize: '0.875rem', color: 'var(--danger)', border: '1px solid var(--danger)' }}
                >
                  🗑️ Clear
                </button>
              )}
            </div>
          </div>

        </div>
      </Modal>

      {/* Ripple Animation and Pulse styles for Pedometer */}
      <style>{`
        @keyframes ripple {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
        .pulse-dot-active {
          font-size: 0.625rem;
          color: #00e68a;
          background: rgba(0, 230, 138, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          box-shadow: 0 0 6px rgba(0, 230, 138, 0.3);
          letter-spacing: 0.5px;
          animation: text-pulse 1.5s infinite;
        }
        .gfit-badge {
          font-size: 0.625rem;
          color: var(--accent2);
          background: rgba(77, 141, 255, 0.15);
          padding: 2px 6px;
          border-radius: 4px;
          font-weight: 700;
          box-shadow: 0 0 6px rgba(77, 141, 255, 0.3);
          letter-spacing: 0.5px;
        }
        @keyframes text-pulse {
          0% { opacity: 0.7; }
          50% { opacity: 1; }
          100% { opacity: 0.7; }
        }
      `}</style>

      {toast && <Toast message={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
