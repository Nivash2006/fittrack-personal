import { useState } from 'react';
import { supabase } from '../db/supabaseClient';
import { Mail, Lock, ShieldAlert, ArrowRight, Eye, EyeOff } from 'lucide-react';

interface LoginScreenProps {
  onSuccess: () => void;
}

export default function LoginScreen({ onSuccess }: LoginScreenProps) {
  const [activeTab, setActiveTab] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const cleanEmail = email.trim();
    const cleanPassword = password.trim();

    if (!cleanEmail || !cleanPassword) {
      setErrorMsg('Please enter both email and password.');
      return;
    }

    if (activeTab === 'signup' && !name.trim()) {
      setErrorMsg('Please enter your name.');
      return;
    }

    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setErrorMsg('Database configuration missing. Please verify VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in your Vercel project settings.');
      return;
    }

    setIsLoading(true);

    try {
      if (activeTab === 'login') {
        const { error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password: cleanPassword
        });

        if (error) throw error;
        onSuccess();
      } else {
        const { error, data } = await supabase.auth.signUp({
          email: cleanEmail,
          password: cleanPassword,
          options: {
            data: {
              full_name: name.trim()
            }
          }
        });

        if (error) throw error;

        // Check if user is logged in immediately or needs email confirmation
        if (data.session) {
          onSuccess();
        } else {
          setSuccessMsg('Account registered! Please check your email inbox to confirm your account.');
          setEmail('');
          setPassword('');
          setName('');
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'An error occurred during authentication.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      setErrorMsg('Database configuration missing. Google login is unavailable.');
      return;
    }

    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          scopes: 'https://www.googleapis.com/auth/fitness.activity.read https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile',
          queryParams: {
            access_type: 'offline',
            prompt: 'consent'
          }
        }
      });
      if (error) throw error;
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to start Google OAuth.');
      setIsLoading(false);
    }
  };

  return (
    <div className="login-screen" style={{ minHeight: 'calc(100vh - var(--space-xl) * 2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="glass-card" style={{ width: '100%', maxWidth: '400px', padding: 'var(--space-lg)' }}>
        
        {/* App Logo & Header */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-lg)' }}>
          <div style={{ 
            width: '60px', 
            height: '60px', 
            borderRadius: 'var(--radius-lg)', 
            background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)', 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'center', 
            margin: '0 auto var(--space-sm) auto',
            boxShadow: 'var(--shadow-glow)'
          }}>
            <svg viewBox="0 0 24 24" width="30" height="30" fill="none" stroke="var(--text-inverse)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 6.5h11" />
              <path d="M6.5 17.5h11" />
              <path d="M12 2v20" />
              <rect x="2" y="5" width="4" height="14" rx="1" />
              <rect x="18" y="5" width="4" height="14" rx="1" />
            </svg>
          </div>
          <h2 className="text-display" style={{ fontSize: '1.75rem', fontWeight: 800, margin: 0 }}>FitTrack</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Your premium offline-first health portal
          </p>
        </div>

        {/* Tab Selector */}
        <div style={{ display: 'flex', gap: 'var(--space-xs)', background: 'var(--bg-glass-strong)', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', marginBottom: 'var(--space-lg)' }}>
          <button 
            type="button"
            onClick={() => { setActiveTab('login'); setErrorMsg(''); setSuccessMsg(''); }}
            className="btn"
            style={{ 
              flex: 1, 
              padding: '8px 16px', 
              fontSize: '0.8125rem',
              borderRadius: '6px',
              background: activeTab === 'login' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'login' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            Sign In
          </button>
          <button 
            type="button"
            onClick={() => { setActiveTab('signup'); setErrorMsg(''); setSuccessMsg(''); }}
            className="btn"
            style={{ 
              flex: 1, 
              padding: '8px 16px', 
              fontSize: '0.8125rem',
              borderRadius: '6px',
              background: activeTab === 'signup' ? 'var(--bg-card)' : 'transparent',
              color: activeTab === 'signup' ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
          >
            Register
          </button>
        </div>

        {/* Feedback Messages */}
        {errorMsg && (
          <div className="guidance-tip" style={{ display: 'flex', gap: '8px', padding: '12px', background: 'var(--danger-dim)', border: '1px solid var(--danger)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
            <ShieldAlert size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="guidance-tip" style={{ display: 'flex', gap: '8px', padding: '12px', background: 'var(--accent-dim)', border: '1px solid var(--accent)', borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-md)' }}>
            <ShieldAlert size={16} color="var(--accent)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.4 }}>{successMsg}</p>
          </div>
        )}

        {/* Input Form */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-md)' }}>
          {activeTab === 'signup' && (
            <div>
              <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
                Full Name
              </label>
              <input 
                type="text" 
                placeholder="Enter your name" 
                value={name} 
                onChange={(e) => setName(e.target.value)} 
                required 
              />
            </div>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Email Address
            </label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type="email" 
                placeholder="you@example.com" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                style={{ paddingLeft: '40px' }}
                required 
              />
            </div>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '6px' }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} color="var(--text-muted)" style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input 
                type={showPassword ? 'text' : 'password'} 
                placeholder="••••••••" 
                value={password} 
                onChange={(e) => setPassword(e.target.value)} 
                style={{ paddingLeft: '40px', paddingRight: '40px' }}
                required 
              />
              <button 
                type="button" 
                onClick={() => setShowPassword(prev => !prev)} 
                style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', padding: 0, color: 'var(--text-muted)' }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="btn btn-primary btn-block" 
            style={{ height: '46px', marginTop: '4px' }}
          >
            <span>{isLoading ? 'Processing...' : activeTab === 'login' ? 'Sign In' : 'Create Account'}</span>
            {!isLoading && <ArrowRight size={16} />}
          </button>
        </form>

        {/* Separator Divider */}
        <div style={{ display: 'flex', alignItems: 'center', margin: '20px 0', gap: '10px' }}>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
          <span style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Or continue with</span>
          <div style={{ flex: 1, height: '1px', background: 'var(--border-subtle)' }}></div>
        </div>

        {/* OAuth Social login */}
        <button 
          onClick={handleGoogleLogin}
          type="button"
          disabled={isLoading}
          className="btn btn-secondary btn-block"
          style={{ height: '46px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', background: 'var(--bg-glass-strong)', border: '1px solid var(--border-medium)', color: 'var(--text-primary)' }}
        >
          <svg viewBox="0 0 24 24" width="18" height="18" style={{ marginRight: '4px' }}>
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Google Account</span>
        </button>

      </div>
    </div>
  );
}
