import { useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { supabase } from '../db/supabaseClient';
import { useAppStore } from '../store/useAppStore';
import { 
  Menu, 
  X, 
  BookMarked, 
  User, 
  LogOut, 
  ShieldAlert, 
  Flame,
  Timer,
  TrendingDown,
} from 'lucide-react';

interface HeaderProps {
  onReset: () => void;
}

export default function Header({ onReset }: HeaderProps) {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const location = useLocation();
  const activeFast = useAppStore((s) => s.activeFast);

  // Helper to resolve header screen title
  const getScreenTitle = (path: string) => {
    switch (path) {
      case '/': return 'Dashboard';
      case '/diet': return 'Diet Planner';
      case '/workout': return 'Workout Tracker';
      case '/analytics': return 'Health Analytics';
      case '/deficit': return 'Deficit Tracker';
      case '/notes': return 'Health Journals';
      case '/profile': return 'Profile Settings';
      default: return 'FitTrack';
    }
  };

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setShowLogoutConfirm(false);
      setIsDrawerOpen(false);
      onReset(); // Triggers session reset on App level
    } catch (err) {
      console.error('Logout error:', err);
    }
  };

  return (
    <>
      {/* 3-Column Top Navigation Header Bar */}
      <header className="global-header" style={{
        position: 'sticky',
        top: 0,
        left: 0,
        right: 0,
        height: '60px',
        background: 'rgba(10, 10, 15, 0.85)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid var(--border-subtle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 var(--space-md)',
        zIndex: 150
      }}>
        {/* Left Column: Hamburger Drawer Menu Button */}
        <button 
          onClick={() => setIsDrawerOpen(true)}
          style={{ color: 'var(--text-primary)', padding: '6px', display: 'flex', alignItems: 'center' }}
          aria-label="Open side menu"
        >
          <Menu size={22} />
        </button>

        {/* Center Column: Active Screen Title */}
        <h1 style={{ 
          fontFamily: 'var(--font-display)', 
          fontSize: '1.125rem', 
          fontWeight: 700, 
          margin: 0,
          color: 'var(--text-primary)'
        }}>
          {getScreenTitle(location.pathname)}
        </h1>

        {/* Right Column: Dynamic Status Indicators */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {activeFast?.isRunning && (
            <NavLink to="/fasting" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: 'var(--accent)', textDecoration: 'none', background: 'var(--accent-dim)', padding: '4px 8px', borderRadius: '99px', fontWeight: 600 }}>
              <Timer size={12} />
              <span>Fasting</span>
            </NavLink>
          )}
          <div style={{ 
            width: '8px', 
            height: '8px', 
            borderRadius: '50%', 
            background: 'var(--accent)', 
            boxShadow: '0 0 8px var(--accent-glow)' 
          }} title="Database Active (Online)" />
        </div>
      </header>

      {/* Slide-out Drawer Backdrop Overlay */}
      {isDrawerOpen && (
        <div 
          onClick={() => setIsDrawerOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(6px)',
            WebkitBackdropFilter: 'blur(6px)',
            zIndex: 1000,
            animation: 'fadeIn 200ms ease-out'
          }}
        />
      )}

      {/* Slide-out Side Navigation Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        bottom: 0,
        left: 0,
        width: '280px',
        background: 'rgba(18, 18, 26, 0.96)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        borderRight: '1px solid var(--border-subtle)',
        boxShadow: 'var(--shadow-lg)',
        zIndex: 1010,
        transform: isDrawerOpen ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 300ms cubic-bezier(0.16, 1, 0.3, 1)',
        display: 'flex',
        flexDirection: 'column',
        padding: 'var(--space-md)'
      }}>
        {/* Drawer Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', paddingBottom: 'var(--space-md)', marginBottom: 'var(--space-lg)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ 
              width: '32px', 
              height: '32px', 
              borderRadius: 'var(--radius-sm)', 
              background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent-dark) 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Flame size={18} color="var(--text-inverse)" />
            </div>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>FitTrack</span>
          </div>
          <button 
            onClick={() => setIsDrawerOpen(false)}
            style={{ color: 'var(--text-secondary)', padding: '4px' }}
            aria-label="Close side menu"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Items (Secondary & Settings) */}
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
          <NavLink 
            to="/" 
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
            style={drawerNavItemStyle}
          >
            🏠 <span style={{ marginLeft: '12px' }}>Dashboard</span>
          </NavLink>

          <NavLink 
            to="/deficit" 
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
            style={drawerNavItemStyle}
          >
            <TrendingDown size={18} color="var(--accent2)" style={{ flexShrink: 0 }} />
            <span style={{ marginLeft: '12px' }}>Calorie Deficit</span>
          </NavLink>

          <NavLink 
            to="/fasting" 
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
            style={drawerNavItemStyle}
          >
            <span style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0, position: 'relative' }}>
              <Timer size={18} color="var(--accent)" />
              {activeFast?.isRunning && (
                <span style={{ position: 'absolute', top: -2, right: -2, width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />
              )}
            </span>
            <span style={{ marginLeft: '12px' }}>Intermittent Fasting</span>
          </NavLink>

          <NavLink 
            to="/notes" 
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
            style={drawerNavItemStyle}
          >
            <BookMarked size={18} color="var(--accent3)" style={{ flexShrink: 0 }} />
            <span style={{ marginLeft: '12px' }}>Health Journals</span>
          </NavLink>

          <NavLink 
            to="/profile" 
            onClick={() => setIsDrawerOpen(false)}
            className={({ isActive }) => `drawer-nav-item ${isActive ? 'active' : ''}`}
            style={drawerNavItemStyle}
          >
            <User size={18} color="var(--accent2)" style={{ flexShrink: 0 }} />
            <span style={{ marginLeft: '12px' }}>Profile Settings</span>
          </NavLink>
        </nav>

        {/* Drawer Footer: Logout Actions */}
        <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 'var(--space-md)', marginTop: 'auto' }}>
          {!showLogoutConfirm ? (
            <button 
              onClick={() => setShowLogoutConfirm(true)}
              className="btn btn-secondary btn-block"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '1px solid var(--border-subtle)', background: 'var(--danger-dim)', color: 'var(--danger)' }}
            >
              <LogOut size={16} />
              <span>Sign Out</span>
            </button>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'rgba(255, 77, 106, 0.05)', padding: '10px', borderRadius: 'var(--radius-md)', border: '1px solid rgba(255, 77, 106, 0.2)' }}>
              <div style={{ display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
                <ShieldAlert size={16} color="var(--danger)" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.3 }}>Are you sure you want to sign out?</span>
              </div>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button 
                  onClick={handleSignOut} 
                  className="btn btn-danger btn-sm" 
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem' }}
                >
                  Yes, Sign Out
                </button>
                <button 
                  onClick={() => setShowLogoutConfirm(false)} 
                  className="btn btn-secondary btn-sm" 
                  style={{ flex: 1, padding: '4px 8px', fontSize: '0.75rem', border: '1px solid var(--border-subtle)' }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// Styling Object for Drawer Items
const drawerNavItemStyle = {
  display: 'flex',
  alignItems: 'center',
  padding: '12px 16px',
  borderRadius: 'var(--radius-md)',
  fontSize: '0.875rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  textDecoration: 'none',
  transition: 'all 200ms ease'
};
