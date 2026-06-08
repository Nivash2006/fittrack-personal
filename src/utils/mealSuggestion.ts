/**
 * FitTrack Personal — Rule-Based Meal Suggestion Engine
 *
 * Suggests foods from FOOD_DATABASE based on:
 * - Remaining macro targets for the day
 * - Meal type appropriateness (breakfast vs dinner)
 * - Diversity tracking (avoids repeating recent suggestions)
 * - Goal alignment (lose/maintain/gain)
 *
 * Fully offline. No external APIs.
 */

import { FOOD_DATABASE, type FoodItem, type FoodCategory } from '../db/foodDatabase';
import type { UserProfile, Meal } from '../db/database';

// ─── Public Interfaces ────────────────────────────────────────────────────────

export interface SuggestionReason {
  text: string;
  icon: string;
}

export interface MealSuggestion {
  food: FoodItem;
  score: number;          // 0-100 relevance score
  servingGrams: number;
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  reasons: SuggestionReason[];  // Why this food is suggested
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIVERSITY_STORAGE_KEY = 'fittrack_recent_suggestions';
const DIVERSITY_WINDOW = 10;  // Track last 10 suggestions to avoid repetition

/** Caloric density (kcal/g) threshold used to label a food "light" */
const LOW_CAL_DENSITY_THRESHOLD = 1.5; // ≤1.5 kcal/g

/** Caloric density threshold to label a food "energy-dense" */
const HIGH_CAL_DENSITY_THRESHOLD = 2.5; // ≥2.5 kcal/g

/**
 * Categories strongly associated with each meal type.
 * Used to compute an appropriateness multiplier.
 */
const MEAL_TYPE_PREFERRED: Record<
  'breakfast' | 'lunch' | 'dinner' | 'snack',
  { boost: FoodCategory[]; penalise: FoodCategory[] }
> = {
  breakfast: {
    boost: ['grains', 'dairy', 'fruits', 'south_indian', 'tamil_nadu_special'],
    penalise: ['protein', 'north_indian'],
  },
  lunch: {
    boost: ['protein', 'south_indian', 'north_indian', 'tamil_nadu_special', 'grains'],
    penalise: ['sweets', 'beverages'],
  },
  dinner: {
    boost: ['protein', 'south_indian', 'north_indian', 'tamil_nadu_special'],
    penalise: ['sweets', 'beverages', 'snacks'],
  },
  snack: {
    boost: ['fruits', 'nuts_oils', 'dairy', 'beverages', 'snacks'],
    penalise: ['north_indian', 'south_indian', 'tamil_nadu_special'],
  },
};

// ─── Diversity Helpers ────────────────────────────────────────────────────────

/**
 * Get recent suggestion history from localStorage for diversity tracking.
 */
function getRecentSuggestions(): string[] {
  try {
    const raw = localStorage.getItem(DIVERSITY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as string[]) : [];
  } catch {
    return [];
  }
}

/**
 * Save a suggested food name to localStorage history.
 * Keeps only the last DIVERSITY_WINDOW entries.
 */
function trackSuggestion(foodName: string): void {
  try {
    const recent = getRecentSuggestions();
    // Avoid duplicates within the same window
    const filtered = recent.filter((n) => n !== foodName);
    filtered.push(foodName);
    const trimmed = filtered.slice(-DIVERSITY_WINDOW);
    localStorage.setItem(DIVERSITY_STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // localStorage may be unavailable in some environments — fail silently
  }
}

// ─── Internal Scoring Logic ───────────────────────────────────────────────────

interface MacroGaps {
  calorie: number;   // remaining kcal
  protein: number;   // remaining g
  carbs: number;     // remaining g
  fats: number;      // remaining g
}

/**
 * Compute how many macros have already been consumed today.
 */
function computeConsumed(todayMeals: Meal[]): {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
} {
  return todayMeals.reduce(
    (acc, meal) => ({
      calories: acc.calories + meal.calories,
      protein: acc.protein + meal.protein,
      carbs: acc.carbs + meal.carbs,
      fats: acc.fats + meal.fats,
    }),
    { calories: 0, protein: 0, carbs: 0, fats: 0 },
  );
}

/**
 * Compute the macro gap score contribution for a single food item
 * at its default serving size.
 *
 * Strategy: reward foods that proportionally fill the biggest remaining gaps.
 * Returns a value in [0, 1] where 1 = perfect macro alignment.
 */
function macroGapScore(food: FoodItem, gaps: MacroGaps): number {
  const factor = food.defaultServingG / 100;
  const servingProtein = food.proteinPer100g * factor;
  const servingCarbs = food.carbsPer100g * factor;
  const servingFats = food.fatsPer100g * factor;
  const servingCal = food.caloriesPer100g * factor;

  // How well does each macro fill its gap? Capped at 1 (don't over-reward overfill)
  const calScore = gaps.calorie > 0 ? Math.min(servingCal / gaps.calorie, 1) : 0;
  const protScore = gaps.protein > 0 ? Math.min(servingProtein / gaps.protein, 1) : 0;
  const carbScore = gaps.carbs > 0 ? Math.min(servingCarbs / gaps.carbs, 1) : 0;
  const fatScore = gaps.fats > 0 ? Math.min(servingFats / gaps.fats, 1) : 0;

  // Weighted average: protein gap matters most for fitness goals
  return (calScore * 0.3 + protScore * 0.4 + carbScore * 0.2 + fatScore * 0.1);
}

/**
 * Score a food item against user context. Returns a raw score in [0, 100].
 */
function scoreFood(
  food: FoodItem,
  gaps: MacroGaps,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  goal: 'lose' | 'maintain' | 'gain',
  recentSuggestions: string[],
): number {
  // 1. Base macro-gap score (0-40 points)
  const gapScore = macroGapScore(food, gaps) * 40;

  // 2. Protein density bonus (0-20 points)
  //    Foods with higher protein per 100 g get an intrinsic bonus
  const proteinDensity = food.proteinPer100g; // max realistic ~31 (chicken breast)
  const proteinBonus = Math.min(proteinDensity / 31, 1) * 20;

  // 3. Meal-type appropriateness (multiplier applied to subtotal)
  const prefs = MEAL_TYPE_PREFERRED[mealType];
  let mealMultiplier = 1.0;
  if (prefs.boost.includes(food.category as FoodCategory)) {
    mealMultiplier = 1.2;
  } else if (prefs.penalise.includes(food.category as FoodCategory)) {
    mealMultiplier = 0.7;
  }

  // 4. Goal alignment (0-20 points)
  const calDensity = food.caloriesPer100g / 100; // kcal/g
  let goalScore = 10; // neutral
  if (goal === 'lose') {
    // Prefer low-calorie, high-protein
    const lowCalBonus = calDensity <= LOW_CAL_DENSITY_THRESHOLD ? 10 : 0;
    const highProtBonus = food.proteinPer100g >= 10 ? 10 : 5;
    goalScore = lowCalBonus + highProtBonus;
  } else if (goal === 'gain') {
    // Prefer energy-dense, high-protein
    const highCalBonus = calDensity >= HIGH_CAL_DENSITY_THRESHOLD ? 10 : 0;
    const highProtBonus = food.proteinPer100g >= 10 ? 10 : 5;
    goalScore = highCalBonus + highProtBonus;
  } else {
    // maintain: moderate calories and decent protein
    const midCalBonus =
      calDensity >= LOW_CAL_DENSITY_THRESHOLD && calDensity <= HIGH_CAL_DENSITY_THRESHOLD
        ? 10
        : 5;
    goalScore = midCalBonus + (food.proteinPer100g >= 6 ? 10 : 5);
  }

  // 5. Diversity penalty
  const diversityPenalty = recentSuggestions.includes(food.name) ? 30 : 0;

  // 6. Combine
  const raw = (gapScore + proteinBonus + goalScore) * mealMultiplier - diversityPenalty;

  // Clamp to [0, 100]
  return Math.max(0, Math.min(100, raw));
}

// ─── Reason Builder ───────────────────────────────────────────────────────────

/**
 * Build an array of human-readable reasons explaining why this food is suggested.
 */
function buildReasons(
  food: FoodItem,
  gaps: MacroGaps,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  goal: 'lose' | 'maintain' | 'gain',
  recentSuggestions: string[],
): SuggestionReason[] {
  const reasons: SuggestionReason[] = [];
  const factor = food.defaultServingG / 100;
  const servingProtein = food.proteinPer100g * factor;
  const calDensity = food.caloriesPer100g / 100;

  // Protein gap help
  if (gaps.protein > 10 && servingProtein >= 8) {
    reasons.push({
      text: `Adds ${servingProtein.toFixed(0)} g protein — helps close your daily gap`,
      icon: '💪',
    });
  }

  // Calorie gap help
  const servingCal = food.caloriesPer100g * factor;
  if (gaps.calorie > 100 && servingCal <= gaps.calorie * 0.6) {
    reasons.push({
      text: `Fits your remaining ${Math.round(gaps.calorie)} kcal budget`,
      icon: '🎯',
    });
  }

  // Goal-specific reasons
  if (goal === 'lose' && calDensity <= LOW_CAL_DENSITY_THRESHOLD) {
    reasons.push({ text: 'Low calorie density — great for weight loss', icon: '🔥' });
  }
  if (goal === 'gain' && calDensity >= HIGH_CAL_DENSITY_THRESHOLD) {
    reasons.push({ text: 'Energy-dense — supports muscle gain goals', icon: '⚡' });
  }
  if ((goal === 'lose' || goal === 'gain') && food.proteinPer100g >= 15) {
    reasons.push({ text: 'High protein — supports lean muscle mass', icon: '🥩' });
  }

  // Meal-type appropriateness
  const prefs = MEAL_TYPE_PREFERRED[mealType];
  if (prefs.boost.includes(food.category as FoodCategory)) {
    const mealLabel =
      mealType === 'breakfast'
        ? 'morning meal'
        : mealType === 'snack'
          ? 'snack time'
          : mealType;
    reasons.push({ text: `Good choice for ${mealLabel}`, icon: '🍽️' });
  }

  // Variety nudge
  if (!recentSuggestions.includes(food.name)) {
    reasons.push({ text: 'Fresh pick — adds variety to your diet', icon: '🌟' });
  }

  // Nutrient-specific highlights
  if (food.carbsPer100g <= 5 && gaps.calorie < 200) {
    reasons.push({ text: 'Low-carb option for the end of the day', icon: '🥗' });
  }

  // Cap reasons at 3 to keep the UI clean
  return reasons.slice(0, 3);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Main function: get top N meal suggestions ranked by score.
 *
 * @param profile     User profile with macro targets and goal
 * @param todayMeals  All meals already logged today
 * @param mealType    Which meal slot is being planned
 * @param limit       Number of suggestions to return (default 5)
 */
export function getSuggestedMeals(
  profile: UserProfile,
  todayMeals: Meal[],
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snack',
  limit = 5,
): MealSuggestion[] {
  // Compute remaining macro budget
  const consumed = computeConsumed(todayMeals);
  const gaps: MacroGaps = {
    calorie: Math.max(0, profile.calorieTarget - consumed.calories),
    protein: Math.max(0, profile.proteinTarget - consumed.protein),
    carbs: Math.max(0, profile.carbTarget - consumed.carbs),
    fats: Math.max(0, profile.fatTarget - consumed.fats),
  };

  const recentSuggestions = getRecentSuggestions();

  // Score every food in the database
  const scored = FOOD_DATABASE.map((food) => {
    const score = scoreFood(food, gaps, mealType, profile.goal, recentSuggestions);
    const factor = food.defaultServingG / 100;
    const calories = Math.round(food.caloriesPer100g * factor);
    const protein = parseFloat((food.proteinPer100g * factor).toFixed(1));
    const carbs = parseFloat((food.carbsPer100g * factor).toFixed(1));
    const fats = parseFloat((food.fatsPer100g * factor).toFixed(1));
    const reasons = buildReasons(food, gaps, mealType, profile.goal, recentSuggestions);

    return {
      food,
      score: parseFloat(score.toFixed(1)),
      servingGrams: food.defaultServingG,
      calories,
      protein,
      carbs,
      fats,
      reasons,
    } satisfies MealSuggestion;
  });

  // Sort descending by score, pick top N
  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, limit);

  // Track the suggestions so future calls diversify
  top.forEach((s) => trackSuggestion(s.food.name));

  return top;
}

/**
 * Clear suggestion history (call when user logs out or resets data).
 */
export function clearSuggestionHistory(): void {
  localStorage.removeItem(DIVERSITY_STORAGE_KEY);
}
