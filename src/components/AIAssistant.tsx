import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { supabase } from '../db/supabaseClient';
import { getTodayStr } from '../utils/helpers';
import Toast from './Toast';

interface Message {
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: string;
}

export default function AIAssistant() {
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
  const HISTORY_STORAGE = 'fittrack_coach_history';

  // Toggle drawer state
  const [isOpen, setIsOpen] = useState(false);
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
        content: `👋 Hello! I am **AlphaCoach**, your personal AI Health Coach.\n\nI am connected to your local logs. Ask me any question about your diet, workouts, or recovery, and I'll give you customized suggestions using our secure backend!`,
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
    if (isOpen) {
      scrollToBottom();
    }
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(messages.slice(-40)));
  }, [messages, isOpen]);

  // Check backend status
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

  // System prompt (PII Redacted for privacy shield)
  const systemPrompt = useMemo(() => {
    if (!profile) return 'You are a personal fitness coach named AlphaCoach.';
    return `You are "AlphaCoach", a personal AI fitness trainer and nutritionist for the FitTrack Personal app.
You have access to the user's profile and logging metrics for today.
User Profile:
- Name: User (Redacted for Privacy Shield)
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

  const getOfflineSuggestion = (query: string): string => {
    const q = query.toLowerCase();
    if (!profile) return 'Profile information is loading.';

    if (q.includes('diet') || q.includes('food') || q.includes('nutrition')) {
      const calRemaining = Math.max(0, profile.calorieTarget - totalCalories);
      const protRemaining = Math.max(0, profile.proteinTarget - totalProtein);
      return `🥗 **Offline Diet Analysis:**
* **Calories:** Consumed **${totalCalories}** / ${profile.calorieTarget} kcal today (**${calRemaining} kcal** remaining).
* **Protein:** logged **${totalProtein}g** / ${profile.proteinTarget}g (${protRemaining}g remaining).
* **Suggested Foods:**
  * For protein gaps: Grill Chicken Breast, Boiled Eggs or Paneer.
  * South Indian Carb Options: Ven Pongal or Ragi Mudhe.`;
    }

    if (q.includes('workout') || q.includes('exercise') || q.includes('routine') || q.includes('overload')) {
      return `🏋️ **Offline Workout Recommendation:**
* **Today's Status:** logged **${todayWorkouts?.length || 0}** exercises today.
* **Overload Rule:** If sets are completed with good form, increase weight by **2.5kg to 5kg** next time. Rest 60-90s between sets.`;
    }

    return `💡 **AlphaCoach Offline mode:**
I'm ready to help you hit your goal to **${profile.goal === 'lose' ? 'Lose Weight' : profile.goal === 'gain' ? 'Gain Muscle' : 'Maintain Fitness'}**!

Try asking about:
* "Analyze my diet"
* "Suggest exercises"
* "Review recovery"`;
  };

  // Submit message
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
      replyText = await callBackendAI(userMsg.content, messages);
    } catch {
      await new Promise(resolve => setTimeout(resolve, 800));
      replyText = getOfflineSuggestion(userMsg.content);
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

  const handleClearHistory = () => {
    if (window.confirm('Clear chat history?')) {
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

  const getStatusColor = () => {
    switch (backendStatus) {
      case 'active': return 'var(--accent)';
      case 'unconfigured': return '#ffb347';
      default: return 'var(--danger)';
    }
  };

  return (
    <>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Floating Action Button (FAB) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          position: 'fixed',
          bottom: '80px', // Anchored nicely above bottom navigation bar
          right: '20px',
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'var(--accent-dim)',
          border: `2px solid ${isOpen ? 'var(--text-secondary)' : 'var(--accent)'}`,
          boxShadow: '0 4px 16px rgba(0, 230, 138, 0.25)',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 200ms cubic-bezier(0.4, 0, 0.2, 1)',
          transform: isOpen ? 'rotate(90deg)' : 'none',
          outline: 'none'
        }}
        title="Toggle AI Coach"
      >
        {isOpen ? (
          <span style={{ fontSize: '1.25rem', color: 'var(--text-primary)', fontWeight: 600 }}>✕</span>
        ) : (
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ width: '28px', height: '28px' }}
          >
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4M8 15h.01M16 15h.01" />
          </svg>
        )}
        {!isOpen && (
          <span style={{
            position: 'absolute',
            width: '100%',
            height: '100%',
            borderRadius: '50%',
            border: '2px solid var(--accent)',
            animation: 'ping 2s infinite ease-in-out',
            opacity: 0.7,
            pointerEvents: 'none'
          }} />
        )}
      </button>

      {/* Slide-Up / Slide-In Glassmorphism Chat Drawer */}
      <div style={{
        position: 'fixed',
        bottom: isOpen ? '146px' : '-800px', // slides down when closed
        right: '20px',
        width: 'calc(100% - 40px)',
        maxWidth: '380px',
        height: 'calc(100vh - 220px)',
        maxHeight: '520px',
        background: 'var(--bg-glass-strong)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1px solid var(--border-subtle)',
        borderRadius: 'var(--radius-md)',
        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        zIndex: 9998,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'all 300ms cubic-bezier(0.4, 0, 0.2, 1)',
        opacity: isOpen ? 1 : 0,
        pointerEvents: isOpen ? 'all' : 'none'
      }}>
        {/* Chat Drawer Header */}
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          background: 'rgba(255,255,255,0.02)'
        }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: getStatusColor() }} />
              AlphaCoach AI
            </div>
            {/* Redacted Privacy & Expiration Footnote */}
            <div style={{ display: 'flex', gap: '8px', fontSize: '0.625rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              <span>🔒 Privacy Shield Active</span>
              <span>•</span>
              <span>⏰ Expiring Jan 21, 2027</span>
            </div>
          </div>
          <button
            onClick={handleClearHistory}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-muted)',
              fontSize: '0.75rem',
              cursor: 'pointer',
              fontWeight: 600
            }}
            title="Clear Chat History"
          >
            🗑️ Clear
          </button>
        </div>

        {/* Message Logs Body */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '12px 16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
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
                <div style={{
                  background: isUser ? 'var(--accent)' : 'rgba(255,255,255,0.03)',
                  color: isUser ? '#0a1a12' : 'var(--text-primary)',
                  padding: '8px 12px',
                  borderRadius: isUser ? '14px 14px 2px 14px' : '14px 14px 14px 2px',
                  border: isUser ? 'none' : '1px solid var(--border-subtle)',
                  fontSize: '0.8125rem',
                  lineHeight: 1.45,
                  whiteSpace: 'pre-wrap'
                }}>
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
                <span style={{ fontSize: '0.5625rem', color: 'var(--text-muted)', marginTop: '2px', padding: '0 4px' }}>
                  {m.timestamp}
                </span>
              </div>
            );
          })}

          {isLoading && (
            <div style={{ alignSelf: 'flex-start', display: 'flex', gap: '3px', padding: '10px 14px', background: 'rgba(255,255,255,0.03)', borderRadius: '14px 14px 14px 2px', border: '1px solid var(--border-subtle)' }}>
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate 0.2s' }} />
              <span style={{ width: 5, height: 5, borderRadius: '50%', background: 'var(--accent)', animation: 'bounce 1s infinite alternate 0.4s' }} />
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Suggestion Chips */}
        <div style={{ display: 'flex', gap: '6px', overflowX: 'auto', padding: '6px 12px 0 12px', borderTop: '1px solid var(--border-subtle)', background: 'rgba(0,0,0,0.05)' }}>
          {[
            '📊 Analyze my diet',
            '🏋️ Suggest a workout',
            '😴 Review sleep',
          ].map((chipText) => (
            <button
              key={chipText}
              onClick={() => handleSendMessage(chipText.substring(2))}
              style={{
                padding: '4px 8px',
                fontSize: '0.6875rem',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                marginBottom: '6px'
              }}
            >
              {chipText}
            </button>
          ))}
        </div>

        {/* Text Input Row */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage(inputMessage);
          }}
          style={{
            display: 'flex',
            gap: '8px',
            padding: '10px 12px',
            background: 'rgba(0,0,0,0.1)'
          }}
        >
          <input
            type="text"
            placeholder="Ask AlphaCoach..."
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            style={{
              flex: 1,
              padding: '8px 12px',
              fontSize: '0.8125rem',
              background: 'rgba(255,255,255,0.03)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)',
              outline: 'none'
            }}
          />
          <button
            type="submit"
            disabled={isLoading || !inputMessage.trim()}
            className="btn btn-primary"
            style={{
              width: '36px',
              height: '32px',
              padding: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-sm)'
            }}
          >
            ➔
          </button>
        </form>
      </div>

      {/* Embedded CSS Animations for FAB and indicator */}
      <style>{`
        @keyframes ping {
          0% { transform: scale(1); opacity: 0.7; }
          70% { transform: scale(1.4); opacity: 0; }
          100% { transform: scale(1.4); opacity: 0; }
        }
        @keyframes bounce {
          0% { transform: translateY(0); }
          100% { transform: translateY(-4px); }
        }
      `}</style>
    </>
  );
}
