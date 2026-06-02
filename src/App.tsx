import { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { db } from './db/database';
import { supabase } from './db/supabaseClient';
import SplashScreen from './screens/SplashScreen';
import OnboardingScreen from './screens/OnboardingScreen';
import LoginScreen from './screens/LoginScreen';
import DashboardScreen from './screens/DashboardScreen';
import DietScreen from './screens/DietScreen';
import WorkoutScreen from './screens/WorkoutScreen';
import AnalyticsScreen from './screens/AnalyticsScreen';
import ProfileScreen from './screens/ProfileScreen';
import DeficitScreen from './screens/DeficitScreen';
import NotesScreen from './screens/NotesScreen';
import BottomNav from './components/BottomNav';
import Header from './components/Header';

function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const checkProfile = useCallback(async () => {
    try {
      const profiles = await db.userProfiles.toArray();
      setHasProfile(profiles.length > 0);
    } catch {
      setHasProfile(false);
    } finally {
      setLoading(false);
    }
  }, []);

  // Monitor Supabase Authentication state
  useEffect(() => {
    // 1. Fetch current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) {
        checkProfile();
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkProfile();
      } else {
        setHasProfile(false);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [checkProfile]);

  useEffect(() => {
    const timer = setTimeout(() => setShowSplash(false), 2200);
    return () => clearTimeout(timer);
  }, []);

  if (showSplash || loading) {
    return <SplashScreen />;
  }

  // If the user has no authenticated cloud session, direct to Login screen
  if (!session) {
    return <LoginScreen onSuccess={checkProfile} />;
  }

  // If the user is authenticated but has not completed onboarding metrics, direct to Onboarding screen
  if (!hasProfile) {
    return <OnboardingScreen onComplete={() => setHasProfile(true)} />;
  }

  const handleSignOut = async () => {
    try {
      await supabase.auth.signOut();
      setSession(null);
      setHasProfile(false);
    } catch (err) {
      console.error('Sign out error:', err);
    }
  };

  return (
    <BrowserRouter>
      <div className="app-layout">
        <Header onReset={handleSignOut} />
        <div className="app-content">
          <Routes>
            <Route path="/" element={<DashboardScreen />} />
            <Route path="/diet" element={<DietScreen />} />
            <Route path="/workout" element={<WorkoutScreen />} />
            <Route path="/analytics" element={<AnalyticsScreen />} />
            <Route path="/deficit" element={<DeficitScreen />} />
            <Route path="/notes" element={<NotesScreen />} />
            <Route path="/profile" element={<ProfileScreen onReset={handleSignOut} />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default App;
