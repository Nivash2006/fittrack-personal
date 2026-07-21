import { useState, useEffect, useRef, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
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
  const API_KEY_STORAGE = 'fittrack_gemini_key';
  const HISTORY_STORAGE = 'fittrack_coach_history';

  // API Key management
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(API_KEY_STORAGE) || '');
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyInputValue, setKeyInputValue] = useState(apiKey);

  // Chat message management
  const [messages, setMessages] = useState<Message[]>(() => {
    const saved = localStorage.getItem(HISTORY_STORAGE);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fallback to default
      }
    }
    return [
      {
        role: 'model',
        content: `👋 Hello! I am **AlphaCoach**, your personal AI Health Coach.\n\nI have synced with your local fitness logs. Tap **"🔑 API Key"** at the top to enter your Google Gemini API key and activate full conversational chat. Otherwise, you can tap any of the quick analysis chips below!`,
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
    // Save history to localStorage
    localStorage.setItem(HISTORY_STORAGE, JSON.stringify(messages.slice(-40))); // Keep last 40 messages
  }, [messages]);

  // Construct context string for Gemini prompt
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

  // Trigger Gemini API Request
  const callGeminiAPI = async (userPrompt: string, chatHistory: Message[]) => {
    if (!apiKey.trim()) {
      return `⚠️ **Gemini API Key is missing.**\n\nPlease tap the **"🔑 API Key"** button in the top right to paste your Google Gemini API key. You can generate a free API key at [Google AI Studio](https://aistudio.google.com/).`;
    }

    try {
      // Form contents payload mapping from history
      // Gemini expects role: 'user' or 'model'
      const formattedContents = chatHistory
        .filter(m => m.role !== 'system')
        .map(m => ({
          role: m.role === 'model' ? 'model' : 'user',
          parts: [{ text: m.content }]
        }));

      // Append current message
      formattedContents.push({
        role: 'user',
        parts: [{ text: userPrompt }]
      });

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: formattedContents,
            systemInstruction: {
              parts: [{ text: systemPrompt }]
            },
            generationConfig: {
              maxOutputTokens: 800,
              temperature: 0.7,
            }
          }),
        }
      );

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `HTTP error ${response.status}`);
      }

      const data = await response.json();
      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
      if (!reply) {
        throw new Error('Empty response from model API.');
      }
      return reply;
    } catch (err: any) {
      console.error('Gemini API call failed:', err);
      return `❌ **Connection Failed**: ${err.message || 'Unable to connect to Google Gemini. Please check your API key and connection.'}`;
    }
  };

  // Local Offline Expert System responses (if no API Key is configured)
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
  
*Configure your Gemini API key above to get free-flowing conversational recipes!*`;
    }

    if (q.includes('workout') || q.includes('exercise') || q.includes('routine') || q.includes('overload')) {
      return `🏋️ **Offline Workout Recommendation:**
* **Today's Status:** You have logged **${todayWorkouts?.length || 0}** exercises today.
* **Progressive Overload Strategy:**
  * For Strength Training: If you can complete all reps for a set, increase weight by **2.5kg to 5kg** in your next session.
  * For Cardio (Treadmill, Cycling): Try keeping incline at **2-4%** and target a sustained speed of **6-8 km/h** for 20-30 minutes.
  * Fatigue Check: Ensure you rest 60-90 seconds between strength sets.

*Configure your Gemini API key above to get a customized exercise routine!*`;
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

To activate full conversational AI support, tap **"🔑 API Key"** in the top header and paste your key. In the meantime, try these quick triggers below:
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
    if (apiKey.trim()) {
      // Connect to real Gemini
      replyText = await callGeminiAPI(userMsg.content, messages);
    } else {
      // Offline fallback
      await new Promise(resolve => setTimeout(resolve, 800)); // Simulate thinking
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

  // Save API Key from input modal
  const handleSaveApiKey = () => {
    localStorage.setItem(API_KEY_STORAGE, keyInputValue.trim());
    setApiKey(keyInputValue.trim());
    setToast(keyInputValue.trim() ? '🔑 API Key updated!' : '🔑 API Key removed.');
    setShowKeyModal(false);
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

  return (
    <div className="animate-in" style={{ height: 'calc(100vh - 120px)', display: 'flex', flexDirection: 'column' }}>
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header Panel */}
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
        <div>
          <h1 className="page-header__title" style={{ margin: 0 }}>AI Coach</h1>
          <div style={{ fontSize: '0.75rem', color: 'var(--accent)' }}>
            ● AlphaCoach AI {apiKey ? '· Connected' : '· Offline Fallback'}
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
            onClick={() => {
              setKeyInputValue(apiKey);
              setShowKeyModal(true);
            }}
            style={{
              background: apiKey ? 'var(--accent-dim)' : 'var(--bg-glass-strong)',
              color: apiKey ? 'var(--accent)' : 'var(--text-secondary)',
              border: apiKey ? '1px solid rgba(0, 230, 138, 0.2)' : '1px solid var(--border-subtle)',
              padding: '6px 12px',
              fontSize: '0.75rem',
              borderRadius: 'var(--radius-sm)',
              cursor: 'pointer',
              fontWeight: 700
            }}
          >
            🔑 {apiKey ? 'API Key Set' : 'Add API Key'}
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
                  // Handle lists
                  const isBullet = line.startsWith('* ');
                  if (isBullet) {
                    formatted = line.substring(2);
                  }
                  
                  // Parse bold markers **text**
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

      {/* API Key Input Modal */}
      <Modal isOpen={showKeyModal} onClose={() => setShowKeyModal(false)} title="Google Gemini API Key">
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginBottom: 'var(--space-md)' }}>
          To unlock real-time custom AI coach advice, configure a free API key:
          <ol style={{ paddingLeft: '16px', marginTop: '6px', marginBottom: 0 }}>
            <li>Go to <a href="https://aistudio.google.com/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>Google AI Studio</a>.</li>
            <li>Click <strong>"Get API key"</strong> (free tier available).</li>
            <li>Copy and paste it below. It is stored securely in your browser's local storage.</li>
          </ol>
        </div>
        <div className="form-group">
          <label className="form-label">Gemini API Key</label>
          <input
            type="password"
            placeholder="AIzaSy..."
            value={keyInputValue}
            onChange={(e) => setKeyInputValue(e.target.value)}
            autoFocus
          />
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-sm)', marginTop: 'var(--space-md)' }}>
          <button className="btn btn-secondary flex-1" onClick={() => setShowKeyModal(false)}>Cancel</button>
          <button className="btn btn-primary flex-1" onClick={handleSaveApiKey}>Save Key</button>
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
