import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { syncEngine } from '../db/syncEngine';
import { searchFoods, calculateNutrition, type FoodItem } from '../db/foodDatabase';
import Modal from '../components/Modal';
import Toast from '../components/Toast';
import MacroBar from '../components/MacroBar';
import { getTodayStr } from '../utils/helpers';

const OCRScanner = lazy(() => import('../components/OCRScanner'));

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack'] as const;
const MEAL_ICONS: Record<string, string> = {
  breakfast: '🌅',
  lunch: '☀️',
  dinner: '🌙',
  snack: '🍪',
};

export default function DietScreen() {
  const today = getTodayStr();
  const profile = useLiveQuery(() => db.userProfiles.toCollection().first());
  const todayMeals = useLiveQuery(() => db.meals.where('date').equals(today).toArray(), [today]);

  const [activeMealType, setActiveMealType] = useState<typeof MEAL_TYPES[number]>('breakfast');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [showOcrModal, setShowOcrModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedFood, setSelectedFood] = useState<FoodItem | null>(null);
  const [servingG, setServingG] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  // Custom food form
  const [customName, setCustomName] = useState('');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFats, setCustomFats] = useState('');
  const [customQuantity, setCustomQuantity] = useState('100');

  const searchResults = useMemo(() => {
    if (searchQuery.length < 2) return [];
    return searchFoods(searchQuery).slice(0, 20);
  }, [searchQuery]);

  const totalCalories = todayMeals?.reduce((s, m) => s + m.calories, 0) ?? 0;
  const totalProtein = todayMeals?.reduce((s, m) => s + m.protein, 0) ?? 0;
  const totalCarbs = todayMeals?.reduce((s, m) => s + m.carbs, 0) ?? 0;
  const totalFats = todayMeals?.reduce((s, m) => s + m.fats, 0) ?? 0;

  const mealsByType = useMemo(() => {
    const grouped: Record<string, typeof todayMeals> = {};
    MEAL_TYPES.forEach((t) => {
      grouped[t] = todayMeals?.filter((m) => m.mealType === t) ?? [];
    });
    return grouped;
  }, [todayMeals]);

  const handleSelectFood = (food: FoodItem) => {
    setSelectedFood(food);
    setServingG(String(food.defaultServingG));
  };

  const handleAddMeal = useCallback(async () => {
    if (!selectedFood) return;
    const grams = parseFloat(servingG) || selectedFood.defaultServingG;
    const nutrition = calculateNutrition(selectedFood, grams);

    await syncEngine.saveMeal({
      foodName: selectedFood.name,
      mealType: activeMealType,
      quantity: grams,
      calories: Math.round(nutrition.calories),
      protein: Math.round(nutrition.protein * 10) / 10,
      carbs: Math.round(nutrition.carbs * 10) / 10,
      fats: Math.round(nutrition.fats * 10) / 10,
      date: today,
      createdAt: new Date().toISOString(),
    });

    setToast(`${selectedFood.name} added!`);
    setSelectedFood(null);
    setSearchQuery('');
    setServingG('');
    setShowAddModal(false);
  }, [selectedFood, servingG, activeMealType, today]);

  const handleAddCustom = useCallback(async () => {
    if (!customName.trim()) return;
    const qty = parseFloat(customQuantity) || 100;

    await syncEngine.saveMeal({
      foodName: customName.trim(),
      mealType: activeMealType,
      quantity: qty,
      calories: Math.round(parseFloat(customCalories) || 0),
      protein: Math.round((parseFloat(customProtein) || 0) * 10) / 10,
      carbs: Math.round((parseFloat(customCarbs) || 0) * 10) / 10,
      fats: Math.round((parseFloat(customFats) || 0) * 10) / 10,
      date: today,
      createdAt: new Date().toISOString(),
    });

    setToast(`${customName} added!`);
    setCustomName('');
    setCustomCalories('');
    setCustomProtein('');
    setCustomCarbs('');
    setCustomFats('');
    setCustomQuantity('100');
    setShowCustomModal(false);
  }, [customName, customCalories, customProtein, customCarbs, customFats, customQuantity, activeMealType, today]);

  const handleDeleteMeal = useCallback(async (id: number) => {
    await syncEngine.deleteMeal(id);
    setToast('Meal removed');
  }, []);

  const handleOcrComplete = useCallback((nutrition: { calories?: number; protein?: number; carbs?: number; fats?: number }) => {
    setCustomCalories(nutrition.calories !== undefined ? String(nutrition.calories) : '');
    setCustomProtein(nutrition.protein !== undefined ? String(nutrition.protein) : '');
    setCustomCarbs(nutrition.carbs !== undefined ? String(nutrition.carbs) : '');
    setCustomFats(nutrition.fats !== undefined ? String(nutrition.fats) : '');
    setCustomName('Scanned Label Food');
    setCustomQuantity('100');
    setShowCustomModal(true);
  }, []);

  if (!profile) return null;

  return (
    <div className="animate-in">
      {toast && <Toast message={toast} onClose={() => setToast(null)} />}

      {/* Header */}
      <div className="page-header">
        <h1 className="page-header__title">Diet Planner</h1>
      </div>

      {/* Daily Summary */}
      <div className="glass-card mb-md">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-md)' }}>
          <div>
            <div className="text-caption">Today's Intake</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 800 }}>
              <span style={{ color: 'var(--accent)' }}>{totalCalories}</span>
              <span className="text-muted" style={{ fontSize: '1rem', fontWeight: 400 }}> / {profile.calorieTarget} kcal</span>
            </div>
          </div>
          <div style={{
            width: 52, height: 52, borderRadius: 'var(--radius-full)',
            background: totalCalories <= profile.calorieTarget ? 'var(--accent-dim)' : 'var(--danger-dim)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem',
          }}>
            {totalCalories <= profile.calorieTarget ? '✅' : '⚠️'}
          </div>
        </div>
        <div className="macro-stats">
          <MacroBar label="Protein" value={totalProtein} max={profile.proteinTarget} type="protein" />
          <MacroBar label="Carbs" value={totalCarbs} max={profile.carbTarget} type="carbs" />
          <MacroBar label="Fats" value={totalFats} max={profile.fatTarget} type="fats" />
        </div>
      </div>

      {/* Meal Type Tabs */}
      <div className="tab-switcher">
        {MEAL_TYPES.map((t) => (
          <button
            key={t}
            className={`tab-switcher__tab ${activeMealType === t ? 'active' : ''}`}
            onClick={() => setActiveMealType(t)}
          >
            {MEAL_ICONS[t]} {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      {/* Meals List */}
      <div style={{ marginBottom: 'var(--space-md)' }}>
        {mealsByType[activeMealType]?.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state__icon">{MEAL_ICONS[activeMealType]}</div>
            <div className="empty-state__title">No {activeMealType} logged</div>
            <div className="empty-state__text">Tap the button below to add food</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-sm)' }}>
            {mealsByType[activeMealType]?.map((meal) => (
              <div key={meal.id} className="meal-card">
                <div className="meal-card__icon" style={{ background: 'var(--accent-dim)' }}>
                  {MEAL_ICONS[activeMealType]}
                </div>
                <div className="meal-card__info">
                  <div className="meal-card__name">{meal.foodName}</div>
                  <div className="meal-card__meta">
                    {meal.quantity}g · P:{meal.protein}g · C:{meal.carbs}g · F:{meal.fats}g
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-sm)' }}>
                  <div className="meal-card__calories">{meal.calories}</div>
                  <button
                    className="btn btn-ghost btn-icon"
                    onClick={() => meal.id && handleDeleteMeal(meal.id)}
                    style={{ width: 32, height: 32, fontSize: '0.875rem', color: 'var(--danger)' }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Buttons */}
      <div style={{ display: 'flex', gap: 'var(--space-xs)', flexWrap: 'wrap' }}>
        <button className="btn btn-primary flex-1" onClick={() => setShowAddModal(true)} style={{ minWidth: '110px' }}>
          🔍 Search
        </button>
        <button className="btn btn-secondary flex-1" onClick={() => setShowCustomModal(true)} style={{ minWidth: '110px' }}>
          ✏️ Custom
        </button>
        <button className="btn btn-secondary flex-1" onClick={() => setShowOcrModal(true)} style={{ minWidth: '110px', background: 'rgba(77, 141, 255, 0.1)', color: '#4d8dff', border: '1px solid rgba(77, 141, 255, 0.2)' }}>
          📸 Scan Label
        </button>
      </div>

      {/* Search Food Modal */}
      <Modal isOpen={showAddModal} onClose={() => { setShowAddModal(false); setSelectedFood(null); setSearchQuery(''); }} title="Add Food">
        {!selectedFood ? (
          <>
            <div className="search-bar">
              <span className="search-bar__icon">🔍</span>
              <input
                type="text"
                placeholder="Search foods... (e.g., Idli, Biryani, Rice)"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                autoFocus
              />
            </div>
            <div style={{ maxHeight: 300, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-xs)' }}>
              {searchResults.map((food, i) => (
                <button
                  key={i}
                  className="meal-card glass-card--interactive"
                  onClick={() => handleSelectFood(food)}
                >
                  <div className="meal-card__info">
                    <div className="meal-card__name">{food.name}</div>
                    <div className="meal-card__meta">
                      {food.caloriesPer100g} kcal/100g · {food.servingUnit}
                    </div>
                  </div>
                  <div className="meal-card__calories">{food.caloriesPer100g}</div>
                </button>
              ))}
              {searchQuery.length >= 2 && searchResults.length === 0 && (
                <div className="text-small text-muted text-center" style={{ padding: 'var(--space-lg)' }}>
                  No foods found. Try a different search or add a custom entry.
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="glass-card glass-card--accent mb-md">
              <div style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 'var(--space-sm)' }}>
                {selectedFood.name}
              </div>
              <div className="text-small text-secondary">
                Per 100g: {selectedFood.caloriesPer100g} kcal · P:{selectedFood.proteinPer100g}g · C:{selectedFood.carbsPer100g}g · F:{selectedFood.fatsPer100g}g
              </div>
            </div>
            <div className="form-group">
              <label className="form-label">Serving Size (grams)</label>
              <input
                type="number"
                value={servingG}
                onChange={(e) => setServingG(e.target.value)}
                min="1"
              />
              <div className="text-small text-muted mt-sm">
                Suggested: {selectedFood.defaultServingG}g ({selectedFood.servingUnit})
              </div>
            </div>
            {servingG && (
              <div className="glass-card mb-md" style={{ padding: 'var(--space-md)' }}>
                <div className="text-caption mb-sm">Nutrition for {servingG}g</div>
                <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                  {(() => {
                    const n = calculateNutrition(selectedFood, parseFloat(servingG) || 0);
                    return (
                      <>
                        <div className="profile-stat">
                          <div className="profile-stat__value" style={{ color: 'var(--accent)' }}>{Math.round(n.calories)}</div>
                          <div className="profile-stat__label">kcal</div>
                        </div>
                        <div className="profile-stat">
                          <div className="profile-stat__value" style={{ color: 'var(--protein-color)' }}>{Math.round(n.protein)}g</div>
                          <div className="profile-stat__label">Protein</div>
                        </div>
                        <div className="profile-stat">
                          <div className="profile-stat__value" style={{ color: 'var(--carbs-color)' }}>{Math.round(n.carbs)}g</div>
                          <div className="profile-stat__label">Carbs</div>
                        </div>
                        <div className="profile-stat">
                          <div className="profile-stat__value" style={{ color: 'var(--fats-color)' }}>{Math.round(n.fats)}g</div>
                          <div className="profile-stat__label">Fats</div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>
            )}
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button className="btn btn-secondary flex-1" onClick={() => setSelectedFood(null)}>
                Back
              </button>
              <button className="btn btn-primary flex-1" onClick={handleAddMeal}>
                Add to {activeMealType}
              </button>
            </div>
          </>
        )}
      </Modal>

      {/* Custom Food Modal */}
      <Modal isOpen={showCustomModal} onClose={() => setShowCustomModal(false)} title="Custom Food Entry">
        <div className="form-group">
          <label className="form-label">Food Name</label>
          <input
            type="text"
            placeholder="e.g., Homemade curry"
            value={customName}
            onChange={(e) => setCustomName(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Quantity (g)</label>
            <input type="number" value={customQuantity} onChange={(e) => setCustomQuantity(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Calories</label>
            <input type="number" value={customCalories} onChange={(e) => setCustomCalories(e.target.value)} placeholder="0" />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Protein (g)</label>
            <input type="number" value={customProtein} onChange={(e) => setCustomProtein(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Carbs (g)</label>
            <input type="number" value={customCarbs} onChange={(e) => setCustomCarbs(e.target.value)} placeholder="0" />
          </div>
          <div className="form-group">
            <label className="form-label">Fats (g)</label>
            <input type="number" value={customFats} onChange={(e) => setCustomFats(e.target.value)} placeholder="0" />
          </div>
        </div>
        <button className="btn btn-primary btn-block mt-md" onClick={handleAddCustom}>
          Add to {activeMealType}
        </button>
      </Modal>

      {/* Lazy-Loaded OCR Scanner Overlay */}
      <Suspense fallback={null}>
        {showOcrModal && (
          <OCRScanner
            isOpen={showOcrModal}
            onClose={() => setShowOcrModal(false)}
            onScanComplete={handleOcrComplete}
          />
        )}
      </Suspense>
    </div>
  );
}
