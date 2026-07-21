import { useState, useEffect, useCallback, lazy, Suspense } from 'react';
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
import AIAssistant from './components/AIAssistant';
import { syncEngine } from './db/syncEngine';

// Lazy-load heavy screens for better initial bundle size
const FastingScreen = lazy(() => import('./screens/FastingScreen'));

function App() {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<any>(null);
  const [hasProfile, setHasProfile] = useState(false);
  const [showSplash, setShowSplash] = useState(true);

  const checkProfile = useCallback(async () => {
    try {
      const localProfiles = await db.userProfiles.toArray();
      if (localProfiles.length > 0) {
        setHasProfile(true);
        setLoading(false);
        return;
      }

      // Check if we have a Supabase session
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        const { data: cloudProfile, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();

        if (cloudProfile && !error) {
          // Found cloud profile, save locally
          await db.userProfiles.add({
            name: cloudProfile.name,
            email: cloudProfile.email,
            heightCm: Number(cloudProfile.height_cm),
            weightKg: Number(cloudProfile.weight_kg),
            age: Number(cloudProfile.age),
            gender: cloudProfile.gender,
            activityLevel: cloudProfile.activity_level,
            goal: cloudProfile.goal,
            calorieTarget: Number(cloudProfile.calorie_target),
            proteinTarget: Number(cloudProfile.protein_target),
            carbTarget: Number(cloudProfile.carb_target),
            fatTarget: Number(cloudProfile.fat_target),
            waterTarget: Number(cloudProfile.water_target || 2000),
            createdAt: cloudProfile.created_at,
          });
          setHasProfile(true);
          setLoading(false);
          return;
        }
      }
      setHasProfile(false);
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
        // Trigger background data sync/pull
        syncEngine.pullAllFromCloud(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // 2. Listen to authentication changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        checkProfile();
        // Trigger background data sync/pull
        syncEngine.pullAllFromCloud(session.user.id);
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
          <Suspense fallback={<div style={{ padding: 'var(--space-xl)', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>}>
            <Routes>
              <Route path="/" element={<DashboardScreen />} />
              <Route path="/diet" element={<DietScreen />} />
              <Route path="/workout" element={<WorkoutScreen />} />
              <Route path="/analytics" element={<AnalyticsScreen />} />
              <Route path="/deficit" element={<DeficitScreen />} />
              <Route path="/notes" element={<NotesScreen />} />
              <Route path="/fasting" element={<FastingScreen />} />
              <Route path="/profile" element={<ProfileScreen onReset={handleSignOut} />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </div>
        <BottomNav />
        {/* Floating AI Assistant on every screen */}
        <AIAssistant />
      </div>
    </BrowserRouter>
  );
}

export default App;
