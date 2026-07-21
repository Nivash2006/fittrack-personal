import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { supabase } from '../db/supabaseClient';
import { getTodayStr } from '../utils/helpers';
import Modal from '../components/Modal';
import Toast from '../components/Toast';

interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}

export default function CoachScreen() {
  const today = getTodayStr();

  // Load database context
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const todayMeals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);
  const todayWater = useLiveQuery(() => db.waterLogs.where('date').equals(today).toArray(), [today]);
  const todaySleep = useLiveQuery(() => db.sleepLogs.where('date').equals(today).first(), [today]);
  const todayWorkouts = useLiveQuery(() => db.workouts.where('date').equals(today).toArray(), [today]);

  const totalCalories = todayMeals?.reduce((s, m) => s + m.calories, 0) ?? 0;
  const totalProtein = todayMeals?.reduce((s, m) => s + m.protein, 0) ?? 0;
  const totalCarbs = todayMeals?.reduce((s, m) => s + m.carbs, 0) ?? 0;
  const totalFats = todayMeals?.reduce((s, m) => s + m.fats, 0) ?? 0;
  const waterVolume = todayWater?.reduce((s, w) => s + w.amount, 0) ?? 0;

  // Local storage keys
  const LOCAL_GEMINI_KEY = 'fittrack_gemini_key';
  const HISTORY_STORAGE = 'fittrack_coach_history';

  // API Key & Mode management
  const [localApiKey, setLocalApiKey] = useState(() => localStorage.getItem(LOCAL_GEMINI_KEY) || '');
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showLocalKeyModal, setShowLocalKeyModal] = useState(false);
  const [localKeyInputValue, setLocalKeyInputValue] = useState(localApiKey);
  
  // Connection status state
  const [backendStatus, setBackendStatus] = useState<'checking' | 'active' | 'unconfigured' | 'error'>('checking');

  // Chat message management
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback
      }
    }
    return [
      {
        role: 'model',
        content: `👋 Hello! I am **AlphaCoach**, your personal AI Health Coach.\n\nI am connected to your local logs. By default, I will request the AI suggestions securely through your **Supabase Backend** so your API key remains hidden.\n\nTap **"⚙️ Setup Guide"** in the top right to configure your backend OpenAI, Gemini, or Claude key!`,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
    ];
  });

  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll chat to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(messages.slice(-40))); // Keep last 40 messages
  }, [messages]);

  // Check if backend edge function is reachable and configured
  useEffect(() => {
    const testBackend = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('fitness-coach', {
          body: { systemPrompt: 'Ping', messages: [], userMessage: 'Ping' }
        });
        if (error) {
          setBackendStatus('error');
        } else if (data?.error === 'NO_KEY_CONFIGURED') {
          setBackendStatus('unconfigured');
        } else {
          setBackendStatus('active');
        }
      } catch {
        setBackendStatus('error');
      }
    };
    testBackend();
  }, []);

  // Construct context string for system prompt
  const systemPrompt = useMemo(() => {
    if (!profile) return 'You are a personal fitness coach named AlphaCoach.';
    return `You are "AlphaCoach", a personal AI fitness trainer and nutritionist for the FitTrack Personal app.
You have access to the user's profile and logging metrics for today.
User Profile:
- Name: ${profile.name}
- Age: ${profile.age}, Gender: ${profile.gender}
- Height: ${profile.heightCm} cm, Weight: ${profile.weightKg} kg
- Activity Level: ${profile.activityLevel}
- Goal: ${profile.goal}
- Targets: Cal: ${profile.calorieTarget} kcal, Protein: ${profile.proteinTarget}g, Carbs: ${profile.carbTarget}g, Fats: ${profile.fatTarget}g, Water: ${profile.waterTarget} ml

Today's Logs:
- Consumed: ${todayMeals?.map(m => `${m.foodName} (${m.quantity}g, ${m.calories}kcal)`).join(', ') || 'No meals logged yet'}
- Total Macros Consumed: P: ${totalProtein}g, C: ${totalCarbs}g, F: ${totalFats}g, Cal: ${totalCalories} kcal
- Water Logged: ${waterVolume} ml / ${profile.waterTarget} ml
- Sleep Logged: ${todaySleep?.hours || 'Not logged yet'} hours
- Workouts Logged Today: ${todayWorkouts?.map(w => `${w.exercise} (${w.category})`).join(', ') || 'No workouts logged yet'}

Provide helpful, expert, actionable fitness and diet advice. Be encouraging, precise (using ranges where relevant), and focus on South Indian/general nutrition contexts. Keep responses relatively concise and highly readable with bullet points. Formatting should be markdown-compatible (bolding, spacing).`;
  }, [profile, todayMeals, todayWater, todaySleep, todayWorkouts, totalCalories, totalProtein, totalCarbs, totalFats, waterVolume]);

  // Invokes the Supabase Backend Edge Function
  const callBackendAI = async (userPrompt: string, chatHistory: Message[]) => {
    const { data, error } = await supabase.functions.invoke('fitness-coach', {
      body: {
        systemPrompt,
        messages: chatHistory.filter(m => m.role !== 'system'),
        userMessage: userPrompt
      }
    });

    if (error) {
      throw new Error(error.message || JSON.stringify(error));
    }

    if (data?.error) {
      if (data.error === 'NO_KEY_CONFIGURED') {
        setBackendStatus('unconfigured');
        throw new Error('NO_KEY_CONFIGURED');
      }
      throw new Error(data.message || data.error);
    }

    setBackendStatus('active');
    return data?.reply || 'No response returned from backend AI.';
  };

  // Local Direct Browser Gemini API Request (Local Fallback option)
  const callLocalGeminiAPI = async (userPrompt: string, chatHistory: Message[]) => {
    if (!localApiKey.trim()) {
      throw new Error('LOCAL_KEY_MISSING');
    }

    const formattedContents = chatHistory
      .filter(m => m.role !== 'system')
      .map(m => ({
        role: m.role === 'model' ? 'model' : 'user',
        parts: [{ text: m.content }]
      }));

    formattedContents.push({
      role: 'user',
      parts: [{ text: userPrompt }]
    });

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${localApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: formattedContents,
          systemInstruction: { parts: [{ text: systemPrompt }] },
          generationConfig: { maxOutputTokens: 800, temperature: 0.7 }
        }),
      }
    );

    if (!response.ok) {
      const errJson = await response.json().catch(() => ({}));
      throw new Error(errJson?.error?.message || `HTTP error ${response.status}`);
    }

    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Empty response.';
  };

  // Local Offline Expert System responses (if no API Key is configured anywhere)
  const getOfflineSuggestion = (query: string): string => {
    const q = query.toLowerCase();
    if (!profile) return 'Profile information is loading.';

    if (q.includes('diet') || q.includes('food') || q.includes('nutrition')) {
      const calRemaining = Math.max(0, profile.calorieTarget - totalCalories);
      const protRemaining = Math.max(0, profile.proteinTarget - totalProtein);
      return `🥗 **Offline Diet Analysis:**
* **Calorie Status:** You consumed **${totalCalories}** / ${profile.calorieTarget} kcal today (**${calRemaining} kcal** remaining).
* **Protein Target:** logged **${totalProtein}g** / ${profile.proteinTarget}g (${protRemaining}g remaining).
* **Suggested Foods:**
  * To hit remaining protein target: Grill Chicken Breast (31g P/100g), Boiled Eggs (13g P/100g) or Paneer (18g P/100g).
  * South Indian Specialties: Ven Pongal or Ragi Mudhe for slow-digesting carbs and fiber.
  * Snacks: Handful of almonds or walnuts.
  
*Configure your Supabase AI secrets to unlock personalized recipes!*`;
    }

    if (q.includes('workout') || q.includes('exercise') || q.includes('routine') || q.includes('overload')) {
      return `🏋️ **Offline Workout Recommendation:**
* **Today's Status:** You have logged **${todayWorkouts?.length || 0}** exercises today.
* **Progressive Overload Strategy:**
  * For Strength Training: If you can complete all reps for a set, increase weight by **2.5kg to 5kg** in your next session.
  * For Cardio (Treadmill, Cycling): Try keeping incline at **2-4%** and target a sustained speed of **6-8 km/h** for 20-30 minutes.
  * Fatigue Check: Ensure you rest 60-90 seconds between strength sets.

*Configure your Supabase AI secrets to unlock custom overload workouts!*`;
    }

    if (q.includes('sleep') || q.includes('rest') || q.includes('recovery')) {
      const hrs = todaySleep?.hours || 0;
      return `😴 **Offline Sleep & Recovery Review:**
* **Sleep Logged:** You logged **${hrs} hours** of sleep today.
* **Recovery Note:** 
  * Target is **7 to 9 hours** per night. 
  * If sleep is under 6 hours, your body's progressive overload capabilities are reduced by 15-20% due to central nervous system fatigue. Focus on mobility stretching today instead of heavy training.
  * Keep caffeine intake capped at 6 hours before bedtime.`;
    }

    return `💡 **AlphaCoach Standby Mode:**
I'm ready to help you hit your goal to **${profile.goal === 'lose' ? 'Lose Weight' : profile.goal === 'gain' ? 'Gain Muscle' : 'Maintain Fitness'}**!

Please set up your AI API Key in the **Supabase Dashboard** (secrets manager) as a backend variable. In the meantime, try these quick triggers:
* "Analyze my diet"
* "Suggest exercises"
* "Review recovery"`;
  };

  // Submit User Message
  const handleSendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg: Message = {
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInputMessage('');
    setIsLoading(true);

    let replyText = '';
    try {
      // 1. Try secure Supabase Backend Edge Function call
      replyText = await callBackendAI(userMsg.content, messages);
    } catch (err: any) {
      console.warn('Backend call failed, trying local fallback:', err.message);
      
      if (localApiKey.trim()) {
        try {
          // 2. Try client-side direct browser fallback (if local key is set)
          replyText = await callLocalGeminiAPI(userMsg.content, messages);
        } catch (localErr: any) {
          replyText = `❌ **Local connection failed**: ${localErr.message}\n\nFalling back to offline metrics.`;
        }
      } else {
        // 3. Offline heuristics fallback
        await new Promise(resolve => setTimeout(resolve, 800)); // Simulate thinking
        replyText = getOfflineSuggestion(userMsg.content);
        
        if (err.message === 'NO_KEY_CONFIGURED') {
          replyText += `\n\n⚠️ **Notice**: Supabase function did not detect an API key. Tap **"⚙️ Setup Guide"** to add one to your backend.`;
        }
      }
    }

    setMessages(prev => [
      ...prev,
      {
        role: 'model',
        content: replyText,
        timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setIsLoading(false);
  };

  // Save local API Key (for standalone client side bypass testing)
  const handleSaveLocalApiKey = () => {
    localStorage.setItem(LOCAL_GEMINI_KEY, localKeyInputValue.trim());
    setLocalApiKey(localKeyInputValue.trim());
    setToast(localKeyInputValue.trim() ? '🔑 Local fallback key updated!' : '🔑 Local fallback key removed.');
    setShowLocalKeyModal(false);
  };

  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your chat history?')) {
      const defaultMsg: Message[] = [
        {
          role: 'model',
          content: `Chat history cleared. I'm ready to assist you!`,
          timestamp: new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        },
      ];
      setMessages(defaultMsg);
      localStorage.setItem(HISTORY_STORAGE, JSON.stringify(defaultMsg));
    }
  };

  const getStatusLabel = () => {
    switch (backendStatus) {
      case 'active':
        return '● Supabase AI Coach · Ready';
      case 'unconfigured':
        return '⚠️ Supabase AI Coach · Config Needed';
      case 'checking':
        return '⚙️ Supabase AI Coach · Connecting...';
      default:
        return '⚠️ Supabase AI Coach · Error/Offline';
    }
  };

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'active':
        return 'var(--accent)';
      case 'unconfigured':
        return '#ffb347';
      default:
        return 'var(--danger)';
    }
  };

  return (
    <div className="animate-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header Panel */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <h1 className="page-header__title" style={{ margin: 0 }}>AI Coach</h1>
          <div style={{ fontSize: '0.75rem', color: getStatusColor(), fontWeight: 600 }}>
            {getStatusLabel()}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            onClick={handleClearHistory}
            style={{
              background: 'rgba(255, 77, 106, 0.1)',
              color: 'var(--danger)',
              border: '1px solid rgba(255, 77, 106, 0.2)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer'
            }}
          >
            🗑️ Clear
          </button>
          <button
            onClick={() => setShowConfigModal(true)}
            style={{
              background: 'var(--bg-glass-strong)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-subtle)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            ⚙️ Setup Guide
          </button>
        </div>
      </div>

      {/* Chat Messages Container */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: 'var(--space-md)',
        background: 'var(--bg-glass)',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-subtle)',
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--space-md)',
        marginBottom: 'var(--space-md)'
      }}>
        {messages.map((m, idx) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={idx}
              style={{
                alignSelf: isUser ? 'flex-end' : 'flex-start',
                maxWidth: '85%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: isUser ? 'flex-end' : 'flex-start'
              }}
            >
              {/* Message Bubble */}
              <div style={{
                background: isUser ? 'var(--accent)' : 'var(--bg-glass-strong)',
                color: isUser ? '#0a1a12' : 'var(--text-primary)',
                padding: '10px 14px',
                borderRadius: isUser ? '16px 16px 2px 16px' : '16px 16px 16px 2px',
                border: isUser ? 'none' : '1px solid var(--border-subtle)',
                fontSize: '0.875rem',
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                boxShadow: isUser ? '0 2px 8px var(--accent-glow)' : 'none'
              }}>
                {/* Parse basic markdown bolding & lists */}
                {m.content.split('\n').map((line, lIdx) => {
                  let formatted = line;
                  const isBullet = line.startsWith('* ');
                  if (isBullet) {
                    formatted = line.substring(2);
                  }
                  
                  const parts = formatted.split('**');
                  const renderedLine = parts.map((part, pIdx) => {
                    if (pIdx % 2 === 1) {
                      return <strong key={pIdx}>{part}</strong>;
                    }
                    return part;
                  });

                  return (
                    <div key={lIdx} style={{ marginLeft: isBullet ? '12px' : 0, display: isBullet ? 'list-item' : 'block' }}>
                      {renderedLine}
                    </div>
                  );
                })}
              </div>
              <span style={{ fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '4px', padding: '0 4px' }}>
                {m.timestamp}
              </span>
            </div>
          );
        })}

        {/* Loading / Typing Indicator */}
        {isLoading && (
          <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '4px', padding: '12px 16px', background: 'var(--bg-glass-strong)', borderRadius: '16px 16px 16px 2px', border: '1px solid var(--border-subtle)' }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate 0.2s' }} />
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate 0.4s' }} />
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggestion Chips */}
      <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', paddingBottom: '8px', marginBottom: '8px' }}>
        {[
          '📊 Analyze my diet today',
          '🏋️ Suggest an exercise overload routine',
          '😴 Review my recovery and sleep',
        ].map((chipText) => (
          <button
            key={chipText}
            onClick={() => handleSendMessage(chipText.substring(2))} // strip emojis
            style={{
              padding: '6px 12px',
              fontSize: '0.75rem',
              background: 'var(--bg-glass-strong)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-full)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              transition: 'all 150ms ease'
            }}
          >
            {chipText}
          </button>
        ))}
      </div>

      {/* Input Message Area */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendMessage(inputMessage);
        }}
        style={{ display: 'flex', gap: '8px', marginBottom: 'var(--space-md)' }}
      >
        <input
          type="text"
          placeholder="Ask AlphaCoach... (e.g. recommend dinner, analyze workouts)"
          value={inputMessage}
          onChange={(e) => setInputMessage(e.target.value)}
          disabled={isLoading}
          style={{
            flex: 1,
            padding: '12px 16px',
            fontSize: '0.875rem',
            background: 'var(--bg-glass-strong)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)'
          }}
        />
        <button
          type="submit"
          disabled={isLoading || !inputMessage.trim()}
          className="btn btn-primary"
          style={{ width: '50px', height: '45px', padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          ➔
        </button>
      </form>

      {/* Setup Guide Modal */}
      <Modal isOpen={showConfigModal} onClose={() => setShowConfigModal(false)} title="⚙️ AI Backend Configuration Guide">
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
          <p style={{ marginTop: 0 }}>
            FitTrack routes requests through your secure Supabase Edge Function. Paste your API Key directly into your backend so it is never exposed to users.
          </p>
          
          <h4 style={{ color: 'var(--text-primary)', margin: '12px 0 6px 0', fontSize: '0.875rem' }}>Step 1: Set Secret in Supabase Vault</h4>
          <p style={{ margin: '0 0 8px 0' }}>
            Open your terminal and use the Supabase CLI to set your key (use Nvidia, OpenAI, Gemini, or Claude):
          </p>
          <pre style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            overflowX: 'auto',
            color: 'var(--accent2)',
            fontFamily: 'monospace'
          }}>
            # For Nvidia Nemotron Keys:<br/>
            supabase secrets set NVIDIA_API_KEY=nvapi-...<br/><br/>
            # For OpenAI API Keys:<br/>
            supabase secrets set OPENAI_API_KEY=sk-proj-...<br/><br/>
            # OR for Google Gemini Keys:<br/>
            supabase secrets set GEMINI_API_KEY=AIzaSy...<br/><br/>
            # OR for Anthropic Claude Keys:<br/>
            supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
          </pre>
          <p style={{ margin: '6px 0 12px 0', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
            *Alternatively, log into the Supabase Dashboard, select your project, go to <strong>Settings {"\u2192"} API {"\u2192"} Edge Function Secrets</strong> and add the secret key.
          </p>

          <h4 style={{ color: 'var(--text-primary)', margin: '12px 0 6px 0', fontSize: '0.875rem' }}>Step 2: Deploy the Edge Function</h4>
          <p style={{ margin: '0 0 8px 0' }}>
            Push the fitness-coach function to the cloud using:
          </p>
          <pre style={{
            background: 'rgba(0,0,0,0.4)',
            padding: '8px 12px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem',
            overflowX: 'auto',
            color: 'var(--accent2)',
            fontFamily: 'monospace'
          }}>
            supabase functions deploy fitness-coach
          </pre>

          <div style={{
            marginTop: '16px',
            padding: '8px 12px',
            background: 'rgba(0, 230, 138, 0.05)',
            border: '1px dashed rgba(0, 230, 138, 0.2)',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.75rem'
          }}>
            <strong>💡 Standalone testing bypass:</strong> Don't have a backend or deploying right now? You can configure a client-side local fallback Gemini key for quick testing:
            <div style={{ marginTop: '8px', display: 'flex', gap: '6px' }}>
              <button
                className="btn btn-sm btn-ghost"
                onClick={() => {
                  setShowConfigModal(false);
                  setShowLocalKeyModal(true);
                }}
                style={{ fontSize: '0.7rem', padding: '4px 8px' }}
              >
                🔑 Configure Local Fallback Key
              </button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-primary flex-1" onClick={() => setShowConfigModal(false)}>Close Guide</button>
        </div>
      </Modal>

      {/* Local Fallback Key Modal */}
      <Modal isOpen={showLocalKeyModal} onClose={() => setShowLocalKeyModal(false)} title="Local Fallback Gemini API Key">
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 'var(--space-md)' }}>
          Configure a local Gemini API key as a client-side fallback if you do not have the Supabase backend set up yet.
        </div>
        <div className="form-group">
          <label className="form-label">Fallback Gemini Key</label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={localKeyInputValue}
            onChange={(e) => setLocalKeyInputValue(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-secondary flex-1" onClick={() => setShowLocalKeyModal(false)}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={handleSaveLocalApiKey}>Save Key</button>
        </div>
      </Modal>

      {/* Bouncing animation style */}
      <style>{`
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-5px); }
        }
      `}</style>
    </div>
  );
}
