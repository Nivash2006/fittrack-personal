/**
 * FitTrack Personal — Tamil Nadu & Regional Food Database
 *
 * A comprehensive nutritional database of ~120 food items with accurate
 * per-100 g values. Heavy emphasis on Tamil Nadu / Vellore region specialties,
 * South Indian staples, common Indian dishes, fruits, dairy, proteins, and
 * everyday pantry items.
 *
 * Nutritional values are practical approximations sourced from IFCT (Indian
 * Food Composition Tables), USDA, and NIN (National Institute of Nutrition,
 * Hyderabad) references.
 *
 * Usage:
 *   import { FOOD_DATABASE, searchFoods } from '@/db/foodDatabase';
 *   const results = searchFoods('biryani');
 */

// ─── Interface ───────────────────────────────────────────────────────────────

export interface FoodItem {
  name: string;
  category:
    | 'tamil_nadu_special'
    | 'south_indian'
    | 'north_indian'
    | 'snacks'
    | 'fruits'
    | 'dairy'
    | 'protein'
    | 'grains'
    | 'nuts_oils'
    | 'beverages'
    | 'sweets';
  /** Calories per 100 g */
  caloriesPer100g: number;
  /** Protein per 100 g */
  proteinPer100g: number;
  /** Carbohydrates per 100 g */
  carbsPer100g: number;
  /** Fat per 100 g */
  fatsPer100g: number;
  /** Default serving size in grams */
  defaultServingG: number;
  /** Human-readable serving description */
  servingUnit: string;
}

// ─── Database ────────────────────────────────────────────────────────────────

export const FOOD_DATABASE: FoodItem[] = [
  // ═══════════════════════════════════════════════════════════════════════════
  // TAMIL NADU / VELLORE SPECIALTIES  (~35 items)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Biryani ──────────────────────────────────────────────────────────────
  {
    name: 'Ambur Biryani (Seeraga Samba Rice)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 180,
    proteinPer100g: 7,
    carbsPer100g: 24,
    fatsPer100g: 6,
    defaultServingG: 300,
    servingUnit: '1 plate',
  },
  {
    name: 'Ambur Star Biryani — Chicken',
    category: 'tamil_nadu_special',
    caloriesPer100g: 195,
    proteinPer100g: 10,
    carbsPer100g: 22,
    fatsPer100g: 7.5,
    defaultServingG: 350,
    servingUnit: '1 plate',
  },
  {
    name: 'Ambur Star Biryani — Mutton',
    category: 'tamil_nadu_special',
    caloriesPer100g: 210,
    proteinPer100g: 11,
    carbsPer100g: 21,
    fatsPer100g: 9,
    defaultServingG: 350,
    servingUnit: '1 plate',
  },

  // ── Tiffin / Breakfast ───────────────────────────────────────────────────
  {
    name: 'Idli (Plain)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 130,
    proteinPer100g: 3.5,
    carbsPer100g: 26,
    fatsPer100g: 0.5,
    defaultServingG: 40,
    servingUnit: '1 piece',
  },
  {
    name: 'Masala Dosa',
    category: 'tamil_nadu_special',
    caloriesPer100g: 165,
    proteinPer100g: 3.8,
    carbsPer100g: 22,
    fatsPer100g: 7,
    defaultServingG: 150,
    servingUnit: '1 dosa',
  },
  {
    name: 'Plain Dosa',
    category: 'tamil_nadu_special',
    caloriesPer100g: 150,
    proteinPer100g: 3.5,
    carbsPer100g: 24,
    fatsPer100g: 4.5,
    defaultServingG: 100,
    servingUnit: '1 dosa',
  },
  {
    name: 'Rava Dosa',
    category: 'tamil_nadu_special',
    caloriesPer100g: 175,
    proteinPer100g: 3.2,
    carbsPer100g: 25,
    fatsPer100g: 7,
    defaultServingG: 110,
    servingUnit: '1 dosa',
  },
  {
    name: 'Onion Uttapam',
    category: 'tamil_nadu_special',
    caloriesPer100g: 160,
    proteinPer100g: 4,
    carbsPer100g: 25,
    fatsPer100g: 5,
    defaultServingG: 140,
    servingUnit: '1 piece',
  },
  {
    name: 'Ven Pongal',
    category: 'tamil_nadu_special',
    caloriesPer100g: 155,
    proteinPer100g: 4,
    carbsPer100g: 22,
    fatsPer100g: 5.5,
    defaultServingG: 200,
    servingUnit: '1 cup',
  },
  {
    name: 'Sweet Pongal (Sakkarai Pongal)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 220,
    proteinPer100g: 3,
    carbsPer100g: 35,
    fatsPer100g: 8,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },

  // ── Curries & Gravies ────────────────────────────────────────────────────
  {
    name: 'Sambar',
    category: 'tamil_nadu_special',
    caloriesPer100g: 65,
    proteinPer100g: 3,
    carbsPer100g: 9,
    fatsPer100g: 1.5,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Rasam',
    category: 'tamil_nadu_special',
    caloriesPer100g: 25,
    proteinPer100g: 1,
    carbsPer100g: 4,
    fatsPer100g: 0.5,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Kootu',
    category: 'tamil_nadu_special',
    caloriesPer100g: 75,
    proteinPer100g: 3.5,
    carbsPer100g: 10,
    fatsPer100g: 2,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Poriyal (Mixed Vegetable)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 85,
    proteinPer100g: 2.5,
    carbsPer100g: 8,
    fatsPer100g: 5,
    defaultServingG: 100,
    servingUnit: '1 serving',
  },

  // ── Rice Varieties ───────────────────────────────────────────────────────
  {
    name: 'Curd Rice (Thayir Sadam)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 140,
    proteinPer100g: 4,
    carbsPer100g: 22,
    fatsPer100g: 3.5,
    defaultServingG: 200,
    servingUnit: '1 bowl',
  },
  {
    name: 'Lemon Rice (Elumichai Sadam)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 170,
    proteinPer100g: 3,
    carbsPer100g: 28,
    fatsPer100g: 5,
    defaultServingG: 200,
    servingUnit: '1 plate',
  },
  {
    name: 'Tamarind Rice (Puliyodharai)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 175,
    proteinPer100g: 3,
    carbsPer100g: 30,
    fatsPer100g: 5,
    defaultServingG: 200,
    servingUnit: '1 plate',
  },

  // ── Ragi ─────────────────────────────────────────────────────────────────
  {
    name: 'Ragi Mudde / Ragi Kali',
    category: 'tamil_nadu_special',
    caloriesPer100g: 110,
    proteinPer100g: 3,
    carbsPer100g: 23,
    fatsPer100g: 0.5,
    defaultServingG: 150,
    servingUnit: '1 ball',
  },
  {
    name: 'Ragi Dosa',
    category: 'tamil_nadu_special',
    caloriesPer100g: 140,
    proteinPer100g: 3.5,
    carbsPer100g: 24,
    fatsPer100g: 3,
    defaultServingG: 100,
    servingUnit: '1 dosa',
  },

  // ── Parotta ──────────────────────────────────────────────────────────────
  {
    name: 'Parotta (Plain)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 290,
    proteinPer100g: 6,
    carbsPer100g: 40,
    fatsPer100g: 12,
    defaultServingG: 80,
    servingUnit: '1 piece',
  },
  {
    name: 'Kothu Parotta',
    category: 'tamil_nadu_special',
    caloriesPer100g: 250,
    proteinPer100g: 8,
    carbsPer100g: 30,
    fatsPer100g: 11,
    defaultServingG: 250,
    servingUnit: '1 plate',
  },
  {
    name: 'Parotta with Chicken Salna',
    category: 'tamil_nadu_special',
    caloriesPer100g: 215,
    proteinPer100g: 10,
    carbsPer100g: 24,
    fatsPer100g: 9,
    defaultServingG: 300,
    servingUnit: '1 plate (2 parotta + gravy)',
  },
  {
    name: 'Parotta with Veg Salna',
    category: 'tamil_nadu_special',
    caloriesPer100g: 195,
    proteinPer100g: 5,
    carbsPer100g: 28,
    fatsPer100g: 7,
    defaultServingG: 280,
    servingUnit: '1 plate (2 parotta + gravy)',
  },

  // ── Non-Veg TN Specials ──────────────────────────────────────────────────
  {
    name: 'Chicken Chettinad',
    category: 'tamil_nadu_special',
    caloriesPer100g: 185,
    proteinPer100g: 16,
    carbsPer100g: 5,
    fatsPer100g: 11,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Mutton Kuzhambu',
    category: 'tamil_nadu_special',
    caloriesPer100g: 175,
    proteinPer100g: 14,
    carbsPer100g: 5,
    fatsPer100g: 11,
    defaultServingG: 200,
    servingUnit: '1 bowl',
  },
  {
    name: 'Fish Fry (Meen Varuval)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 210,
    proteinPer100g: 18,
    carbsPer100g: 6,
    fatsPer100g: 13,
    defaultServingG: 100,
    servingUnit: '1 piece',
  },

  // ── Vada / Bajji ─────────────────────────────────────────────────────────
  {
    name: 'Medhu Vadai',
    category: 'tamil_nadu_special',
    caloriesPer100g: 270,
    proteinPer100g: 10,
    carbsPer100g: 28,
    fatsPer100g: 13,
    defaultServingG: 50,
    servingUnit: '1 piece',
  },
  {
    name: 'Masala Vadai',
    category: 'tamil_nadu_special',
    caloriesPer100g: 280,
    proteinPer100g: 11,
    carbsPer100g: 26,
    fatsPer100g: 14,
    defaultServingG: 45,
    servingUnit: '1 piece',
  },
  {
    name: 'Bajji (Vazhakkai / Banana)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 235,
    proteinPer100g: 4,
    carbsPer100g: 30,
    fatsPer100g: 11,
    defaultServingG: 40,
    servingUnit: '1 piece',
  },
  {
    name: 'Bajji (Mirchi)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 225,
    proteinPer100g: 4,
    carbsPer100g: 28,
    fatsPer100g: 11,
    defaultServingG: 35,
    servingUnit: '1 piece',
  },

  // ── Beverages ────────────────────────────────────────────────────────────
  {
    name: 'Filter Coffee (with milk & sugar)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 55,
    proteinPer100g: 2,
    carbsPer100g: 7,
    fatsPer100g: 2,
    defaultServingG: 150,
    servingUnit: '1 tumbler',
  },
  {
    name: 'Jigarthanda',
    category: 'tamil_nadu_special',
    caloriesPer100g: 135,
    proteinPer100g: 3,
    carbsPer100g: 22,
    fatsPer100g: 4,
    defaultServingG: 250,
    servingUnit: '1 glass',
  },

  // ── Other TN Items ───────────────────────────────────────────────────────
  {
    name: 'Puttu',
    category: 'tamil_nadu_special',
    caloriesPer100g: 205,
    proteinPer100g: 3.5,
    carbsPer100g: 34,
    fatsPer100g: 6,
    defaultServingG: 150,
    servingUnit: '1 cylinder',
  },
  {
    name: 'Appam',
    category: 'tamil_nadu_special',
    caloriesPer100g: 140,
    proteinPer100g: 2.5,
    carbsPer100g: 26,
    fatsPer100g: 2.5,
    defaultServingG: 60,
    servingUnit: '1 piece',
  },
  {
    name: 'Idiyappam (String Hoppers)',
    category: 'tamil_nadu_special',
    caloriesPer100g: 135,
    proteinPer100g: 2.5,
    carbsPer100g: 28,
    fatsPer100g: 1,
    defaultServingG: 50,
    servingUnit: '1 piece',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // SOUTH INDIAN SNACKS / SWEETS
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Murukku',
    category: 'snacks',
    caloriesPer100g: 450,
    proteinPer100g: 7,
    carbsPer100g: 55,
    fatsPer100g: 22,
    defaultServingG: 30,
    servingUnit: '3 pieces',
  },
  {
    name: 'Mixture (South Indian)',
    category: 'snacks',
    caloriesPer100g: 480,
    proteinPer100g: 10,
    carbsPer100g: 48,
    fatsPer100g: 27,
    defaultServingG: 30,
    servingUnit: '1 handful',
  },
  {
    name: 'Thattai',
    category: 'snacks',
    caloriesPer100g: 430,
    proteinPer100g: 8,
    carbsPer100g: 50,
    fatsPer100g: 22,
    defaultServingG: 25,
    servingUnit: '2 pieces',
  },
  {
    name: 'Seedai',
    category: 'snacks',
    caloriesPer100g: 410,
    proteinPer100g: 6,
    carbsPer100g: 52,
    fatsPer100g: 20,
    defaultServingG: 30,
    servingUnit: '4 pieces',
  },

  // ── Sweets ───────────────────────────────────────────────────────────────
  {
    name: 'Semiya Payasam',
    category: 'sweets',
    caloriesPer100g: 155,
    proteinPer100g: 3,
    carbsPer100g: 24,
    fatsPer100g: 5,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Pal Payasam',
    category: 'sweets',
    caloriesPer100g: 140,
    proteinPer100g: 3.5,
    carbsPer100g: 22,
    fatsPer100g: 4.5,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Kesari (Rava Kesari)',
    category: 'sweets',
    caloriesPer100g: 300,
    proteinPer100g: 2.5,
    carbsPer100g: 42,
    fatsPer100g: 14,
    defaultServingG: 80,
    servingUnit: '1 serving',
  },
  {
    name: 'Adhirasam',
    category: 'sweets',
    caloriesPer100g: 360,
    proteinPer100g: 3,
    carbsPer100g: 55,
    fatsPer100g: 14,
    defaultServingG: 40,
    servingUnit: '1 piece',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // COMMON INDIAN FOODS  (~45 items)
  // ═══════════════════════════════════════════════════════════════════════════

  // ── Breads ───────────────────────────────────────────────────────────────
  {
    name: 'Chapati',
    category: 'north_indian',
    caloriesPer100g: 240,
    proteinPer100g: 8,
    carbsPer100g: 40,
    fatsPer100g: 5,
    defaultServingG: 40,
    servingUnit: '1 piece',
  },
  {
    name: 'Naan',
    category: 'north_indian',
    caloriesPer100g: 290,
    proteinPer100g: 8.5,
    carbsPer100g: 48,
    fatsPer100g: 7,
    defaultServingG: 80,
    servingUnit: '1 piece',
  },
  {
    name: 'Poori',
    category: 'north_indian',
    caloriesPer100g: 310,
    proteinPer100g: 7,
    carbsPer100g: 40,
    fatsPer100g: 14,
    defaultServingG: 30,
    servingUnit: '1 piece',
  },
  {
    name: 'Phulka',
    category: 'north_indian',
    caloriesPer100g: 210,
    proteinPer100g: 7,
    carbsPer100g: 38,
    fatsPer100g: 3,
    defaultServingG: 30,
    servingUnit: '1 piece',
  },
  {
    name: 'Roti (Whole Wheat)',
    category: 'north_indian',
    caloriesPer100g: 250,
    proteinPer100g: 8,
    carbsPer100g: 42,
    fatsPer100g: 5,
    defaultServingG: 40,
    servingUnit: '1 piece',
  },
  {
    name: 'Aloo Paratha',
    category: 'north_indian',
    caloriesPer100g: 260,
    proteinPer100g: 5.5,
    carbsPer100g: 35,
    fatsPer100g: 11,
    defaultServingG: 100,
    servingUnit: '1 piece',
  },
  {
    name: 'Gobi Paratha',
    category: 'north_indian',
    caloriesPer100g: 245,
    proteinPer100g: 6,
    carbsPer100g: 33,
    fatsPer100g: 10,
    defaultServingG: 100,
    servingUnit: '1 piece',
  },
  {
    name: 'Methi Paratha',
    category: 'north_indian',
    caloriesPer100g: 240,
    proteinPer100g: 6.5,
    carbsPer100g: 33,
    fatsPer100g: 9,
    defaultServingG: 90,
    servingUnit: '1 piece',
  },

  // ── Rice ─────────────────────────────────────────────────────────────────
  {
    name: 'White Rice (Cooked)',
    category: 'grains',
    caloriesPer100g: 130,
    proteinPer100g: 2.7,
    carbsPer100g: 28,
    fatsPer100g: 0.3,
    defaultServingG: 200,
    servingUnit: '1 cup',
  },
  {
    name: 'Brown Rice (Cooked)',
    category: 'grains',
    caloriesPer100g: 112,
    proteinPer100g: 2.6,
    carbsPer100g: 24,
    fatsPer100g: 0.9,
    defaultServingG: 200,
    servingUnit: '1 cup',
  },
  {
    name: 'Jeera Rice',
    category: 'grains',
    caloriesPer100g: 155,
    proteinPer100g: 3,
    carbsPer100g: 27,
    fatsPer100g: 4,
    defaultServingG: 200,
    servingUnit: '1 plate',
  },

  // ── Dals & Legumes ───────────────────────────────────────────────────────
  {
    name: 'Toor Dal (Cooked)',
    category: 'north_indian',
    caloriesPer100g: 120,
    proteinPer100g: 7,
    carbsPer100g: 17,
    fatsPer100g: 2,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Moong Dal (Cooked)',
    category: 'north_indian',
    caloriesPer100g: 105,
    proteinPer100g: 7,
    carbsPer100g: 15,
    fatsPer100g: 1.5,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Masoor Dal (Cooked)',
    category: 'north_indian',
    caloriesPer100g: 115,
    proteinPer100g: 8,
    carbsPer100g: 16,
    fatsPer100g: 1,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Chana Dal (Cooked)',
    category: 'north_indian',
    caloriesPer100g: 125,
    proteinPer100g: 8,
    carbsPer100g: 18,
    fatsPer100g: 2,
    defaultServingG: 150,
    servingUnit: '1 bowl',
  },
  {
    name: 'Rajma (Kidney Beans Curry)',
    category: 'north_indian',
    caloriesPer100g: 130,
    proteinPer100g: 7,
    carbsPer100g: 18,
    fatsPer100g: 3,
    defaultServingG: 200,
    servingUnit: '1 bowl',
  },
  {
    name: 'Chole (Chickpea Curry)',
    category: 'north_indian',
    caloriesPer100g: 140,
    proteinPer100g: 7,
    carbsPer100g: 18,
    fatsPer100g: 4.5,
    defaultServingG: 200,
    servingUnit: '1 bowl',
  },

  // ── North Indian Curries ─────────────────────────────────────────────────
  {
    name: 'Paneer Butter Masala',
    category: 'north_indian',
    caloriesPer100g: 195,
    proteinPer100g: 8,
    carbsPer100g: 8,
    fatsPer100g: 15,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Palak Paneer',
    category: 'north_indian',
    caloriesPer100g: 155,
    proteinPer100g: 8,
    carbsPer100g: 6,
    fatsPer100g: 11,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Aloo Gobi',
    category: 'north_indian',
    caloriesPer100g: 100,
    proteinPer100g: 3,
    carbsPer100g: 12,
    fatsPer100g: 4.5,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Baingan Bharta',
    category: 'north_indian',
    caloriesPer100g: 90,
    proteinPer100g: 2.5,
    carbsPer100g: 9,
    fatsPer100g: 5,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },

  // ── Non-Veg Mains ───────────────────────────────────────────────────────
  {
    name: 'Chicken Curry',
    category: 'north_indian',
    caloriesPer100g: 160,
    proteinPer100g: 14,
    carbsPer100g: 4,
    fatsPer100g: 10,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Butter Chicken',
    category: 'north_indian',
    caloriesPer100g: 195,
    proteinPer100g: 13,
    carbsPer100g: 7,
    fatsPer100g: 13,
    defaultServingG: 200,
    servingUnit: '1 serving',
  },
  {
    name: 'Tandoori Chicken',
    category: 'north_indian',
    caloriesPer100g: 160,
    proteinPer100g: 22,
    carbsPer100g: 3,
    fatsPer100g: 7,
    defaultServingG: 200,
    servingUnit: '2 pieces',
  },
  {
    name: 'Egg Curry',
    category: 'north_indian',
    caloriesPer100g: 140,
    proteinPer100g: 9,
    carbsPer100g: 5,
    fatsPer100g: 9.5,
    defaultServingG: 200,
    servingUnit: '1 serving (2 eggs)',
  },

  // ── Breakfast / Snacks ───────────────────────────────────────────────────
  {
    name: 'Upma',
    category: 'south_indian',
    caloriesPer100g: 155,
    proteinPer100g: 4,
    carbsPer100g: 22,
    fatsPer100g: 5.5,
    defaultServingG: 180,
    servingUnit: '1 plate',
  },
  {
    name: 'Poha (Aval)',
    category: 'south_indian',
    caloriesPer100g: 160,
    proteinPer100g: 3.5,
    carbsPer100g: 28,
    fatsPer100g: 4,
    defaultServingG: 180,
    servingUnit: '1 plate',
  },
  {
    name: 'Pesarattu',
    category: 'south_indian',
    caloriesPer100g: 140,
    proteinPer100g: 7,
    carbsPer100g: 20,
    fatsPer100g: 3,
    defaultServingG: 120,
    servingUnit: '1 dosa',
  },

  // ── Eggs ─────────────────────────────────────────────────────────────────
  {
    name: 'Boiled Egg',
    category: 'protein',
    caloriesPer100g: 155,
    proteinPer100g: 13,
    carbsPer100g: 1.1,
    fatsPer100g: 11,
    defaultServingG: 55,
    servingUnit: '1 egg',
  },
  {
    name: 'Omelette (2-egg)',
    category: 'protein',
    caloriesPer100g: 175,
    proteinPer100g: 12,
    carbsPer100g: 1,
    fatsPer100g: 14,
    defaultServingG: 120,
    servingUnit: '1 omelette',
  },
  {
    name: 'Egg Bhurji',
    category: 'protein',
    caloriesPer100g: 165,
    proteinPer100g: 11,
    carbsPer100g: 3,
    fatsPer100g: 12,
    defaultServingG: 130,
    servingUnit: '1 plate',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // FRUITS  (~10 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Banana',
    category: 'fruits',
    caloriesPer100g: 89,
    proteinPer100g: 1.1,
    carbsPer100g: 23,
    fatsPer100g: 0.3,
    defaultServingG: 120,
    servingUnit: '1 medium',
  },
  {
    name: 'Apple',
    category: 'fruits',
    caloriesPer100g: 52,
    proteinPer100g: 0.3,
    carbsPer100g: 14,
    fatsPer100g: 0.2,
    defaultServingG: 180,
    servingUnit: '1 medium',
  },
  {
    name: 'Mango',
    category: 'fruits',
    caloriesPer100g: 60,
    proteinPer100g: 0.8,
    carbsPer100g: 15,
    fatsPer100g: 0.4,
    defaultServingG: 200,
    servingUnit: '1 cup sliced',
  },
  {
    name: 'Papaya',
    category: 'fruits',
    caloriesPer100g: 43,
    proteinPer100g: 0.5,
    carbsPer100g: 11,
    fatsPer100g: 0.3,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },
  {
    name: 'Orange',
    category: 'fruits',
    caloriesPer100g: 47,
    proteinPer100g: 0.9,
    carbsPer100g: 12,
    fatsPer100g: 0.1,
    defaultServingG: 130,
    servingUnit: '1 medium',
  },
  {
    name: 'Grapes',
    category: 'fruits',
    caloriesPer100g: 69,
    proteinPer100g: 0.7,
    carbsPer100g: 18,
    fatsPer100g: 0.2,
    defaultServingG: 100,
    servingUnit: '1 cup',
  },
  {
    name: 'Watermelon',
    category: 'fruits',
    caloriesPer100g: 30,
    proteinPer100g: 0.6,
    carbsPer100g: 8,
    fatsPer100g: 0.2,
    defaultServingG: 200,
    servingUnit: '1 cup diced',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // DAIRY  (~7 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Whole Milk',
    category: 'dairy',
    caloriesPer100g: 62,
    proteinPer100g: 3.2,
    carbsPer100g: 4.8,
    fatsPer100g: 3.3,
    defaultServingG: 200,
    servingUnit: '1 glass',
  },
  {
    name: 'Toned Milk',
    category: 'dairy',
    caloriesPer100g: 50,
    proteinPer100g: 3,
    carbsPer100g: 4.8,
    fatsPer100g: 2,
    defaultServingG: 200,
    servingUnit: '1 glass',
  },
  {
    name: 'Curd / Yogurt',
    category: 'dairy',
    caloriesPer100g: 60,
    proteinPer100g: 3.5,
    carbsPer100g: 4.7,
    fatsPer100g: 3.1,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },
  {
    name: 'Buttermilk (Neer Mor)',
    category: 'dairy',
    caloriesPer100g: 25,
    proteinPer100g: 1.5,
    carbsPer100g: 3,
    fatsPer100g: 0.7,
    defaultServingG: 200,
    servingUnit: '1 glass',
  },
  {
    name: 'Lassi (Sweet)',
    category: 'dairy',
    caloriesPer100g: 75,
    proteinPer100g: 2.5,
    carbsPer100g: 12,
    fatsPer100g: 2,
    defaultServingG: 250,
    servingUnit: '1 glass',
  },
  {
    name: 'Paneer',
    category: 'dairy',
    caloriesPer100g: 265,
    proteinPer100g: 18,
    carbsPer100g: 1.2,
    fatsPer100g: 21,
    defaultServingG: 50,
    servingUnit: '50 g cube',
  },
  {
    name: 'Cheese Slice',
    category: 'dairy',
    caloriesPer100g: 310,
    proteinPer100g: 20,
    carbsPer100g: 2,
    fatsPer100g: 25,
    defaultServingG: 20,
    servingUnit: '1 slice',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // PROTEIN SOURCES  (~7 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Chicken Breast (Grilled)',
    category: 'protein',
    caloriesPer100g: 165,
    proteinPer100g: 31,
    carbsPer100g: 0,
    fatsPer100g: 3.6,
    defaultServingG: 150,
    servingUnit: '1 breast',
  },
  {
    name: 'Fish (Steamed)',
    category: 'protein',
    caloriesPer100g: 130,
    proteinPer100g: 22,
    carbsPer100g: 0,
    fatsPer100g: 4.5,
    defaultServingG: 120,
    servingUnit: '1 fillet',
  },
  {
    name: 'Prawns (Cooked)',
    category: 'protein',
    caloriesPer100g: 100,
    proteinPer100g: 20,
    carbsPer100g: 0.2,
    fatsPer100g: 1.7,
    defaultServingG: 100,
    servingUnit: '1 serving',
  },
  {
    name: 'Whey Protein (Scoop)',
    category: 'protein',
    caloriesPer100g: 380,
    proteinPer100g: 75,
    carbsPer100g: 10,
    fatsPer100g: 4,
    defaultServingG: 30,
    servingUnit: '1 scoop',
  },
  {
    name: 'Soya Chunks (Cooked)',
    category: 'protein',
    caloriesPer100g: 145,
    proteinPer100g: 16,
    carbsPer100g: 11,
    fatsPer100g: 4,
    defaultServingG: 100,
    servingUnit: '1 cup',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // GRAINS & CEREALS  (~7 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Oats (Cooked)',
    category: 'grains',
    caloriesPer100g: 71,
    proteinPer100g: 2.5,
    carbsPer100g: 12,
    fatsPer100g: 1.5,
    defaultServingG: 250,
    servingUnit: '1 bowl',
  },
  {
    name: 'Cornflakes',
    category: 'grains',
    caloriesPer100g: 370,
    proteinPer100g: 7,
    carbsPer100g: 84,
    fatsPer100g: 0.5,
    defaultServingG: 30,
    servingUnit: '1 cup',
  },
  {
    name: 'White Bread',
    category: 'grains',
    caloriesPer100g: 265,
    proteinPer100g: 8,
    carbsPer100g: 49,
    fatsPer100g: 3.2,
    defaultServingG: 30,
    servingUnit: '1 slice',
  },
  {
    name: 'Wheat Bread',
    category: 'grains',
    caloriesPer100g: 245,
    proteinPer100g: 10,
    carbsPer100g: 43,
    fatsPer100g: 3.5,
    defaultServingG: 30,
    servingUnit: '1 slice',
  },
  {
    name: 'Muesli',
    category: 'grains',
    caloriesPer100g: 370,
    proteinPer100g: 9,
    carbsPer100g: 64,
    fatsPer100g: 8,
    defaultServingG: 50,
    servingUnit: '½ cup',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // NUTS, OILS & SWEETENERS  (~9 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Almonds',
    category: 'nuts_oils',
    caloriesPer100g: 579,
    proteinPer100g: 21,
    carbsPer100g: 22,
    fatsPer100g: 50,
    defaultServingG: 15,
    servingUnit: '10 pieces',
  },
  {
    name: 'Cashews',
    category: 'nuts_oils',
    caloriesPer100g: 553,
    proteinPer100g: 18,
    carbsPer100g: 30,
    fatsPer100g: 44,
    defaultServingG: 15,
    servingUnit: '10 pieces',
  },
  {
    name: 'Peanuts',
    category: 'nuts_oils',
    caloriesPer100g: 567,
    proteinPer100g: 26,
    carbsPer100g: 16,
    fatsPer100g: 49,
    defaultServingG: 20,
    servingUnit: '1 handful',
  },
  {
    name: 'Walnuts',
    category: 'nuts_oils',
    caloriesPer100g: 654,
    proteinPer100g: 15,
    carbsPer100g: 14,
    fatsPer100g: 65,
    defaultServingG: 15,
    servingUnit: '5 halves',
  },
  {
    name: 'Ghee',
    category: 'nuts_oils',
    caloriesPer100g: 900,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatsPer100g: 100,
    defaultServingG: 5,
    servingUnit: '1 tsp',
  },
  {
    name: 'Coconut Oil',
    category: 'nuts_oils',
    caloriesPer100g: 892,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatsPer100g: 99,
    defaultServingG: 5,
    servingUnit: '1 tsp',
  },
  {
    name: 'Groundnut Oil',
    category: 'nuts_oils',
    caloriesPer100g: 884,
    proteinPer100g: 0,
    carbsPer100g: 0,
    fatsPer100g: 98,
    defaultServingG: 5,
    servingUnit: '1 tsp',
  },
  {
    name: 'Sugar',
    category: 'nuts_oils',
    caloriesPer100g: 387,
    proteinPer100g: 0,
    carbsPer100g: 100,
    fatsPer100g: 0,
    defaultServingG: 5,
    servingUnit: '1 tsp',
  },
  {
    name: 'Jaggery',
    category: 'nuts_oils',
    caloriesPer100g: 383,
    proteinPer100g: 0.4,
    carbsPer100g: 98,
    fatsPer100g: 0.1,
    defaultServingG: 10,
    servingUnit: '1 small piece',
  },
  {
    name: 'Honey',
    category: 'nuts_oils',
    caloriesPer100g: 304,
    proteinPer100g: 0.3,
    carbsPer100g: 82,
    fatsPer100g: 0,
    defaultServingG: 10,
    servingUnit: '1 tsp',
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BEVERAGES  (~5 items)
  // ═══════════════════════════════════════════════════════════════════════════
  {
    name: 'Black Tea (no sugar)',
    category: 'beverages',
    caloriesPer100g: 1,
    proteinPer100g: 0,
    carbsPer100g: 0.3,
    fatsPer100g: 0,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },
  {
    name: 'Tea with Milk & Sugar',
    category: 'beverages',
    caloriesPer100g: 40,
    proteinPer100g: 1,
    carbsPer100g: 6,
    fatsPer100g: 1.2,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },
  {
    name: 'Black Coffee',
    category: 'beverages',
    caloriesPer100g: 2,
    proteinPer100g: 0.1,
    carbsPer100g: 0,
    fatsPer100g: 0,
    defaultServingG: 150,
    servingUnit: '1 cup',
  },
  {
    name: 'Tender Coconut Water',
    category: 'beverages',
    caloriesPer100g: 19,
    proteinPer100g: 0.7,
    carbsPer100g: 3.7,
    fatsPer100g: 0.2,
    defaultServingG: 250,
    servingUnit: '1 coconut',
  },
  {
    name: 'Fresh Lime Soda (Sweet)',
    category: 'beverages',
    caloriesPer100g: 42,
    proteinPer100g: 0.1,
    carbsPer100g: 10,
    fatsPer100g: 0,
    defaultServingG: 250,
    servingUnit: '1 glass',
  },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * All unique food categories — useful for filter / tab UIs.
 */
export const FOOD_CATEGORIES = [
  'tamil_nadu_special',
  'south_indian',
  'north_indian',
  'snacks',
  'fruits',
  'dairy',
  'protein',
  'grains',
  'nuts_oils',
  'beverages',
  'sweets',
] as const;

export type FoodCategory = (typeof FOOD_CATEGORIES)[number];

/**
 * Search the food database with fuzzy matching.
 *
 * The search normalises both the query and food names to lowercase, then
 * checks for substring inclusion. It also supports multi-word queries — all
 * tokens must be present (AND logic) for a match, making searches like
 * "chicken biryani" or "rava dosa" work intuitively.
 *
 * Results are sorted so that items whose name *starts with* the query appear
 * first (more specific matches on top).
 *
 * @param query  User-typed search string
 * @returns      Array of matching FoodItem objects
 */
export function searchFoods(query: string): FoodItem[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return [];

  const tokens = trimmed.split(/\s+/);

  const matches = FOOD_DATABASE.filter((food) => {
    const name = food.name.toLowerCase();
    return tokens.every((t) => name.includes(t));
  });

  // Sort: prefix matches first, then alphabetical
  matches.sort((a, b) => {
    const aStarts = a.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
    const bStarts = b.name.toLowerCase().startsWith(trimmed) ? 0 : 1;
    if (aStarts !== bStarts) return aStarts - bStarts;
    return a.name.localeCompare(b.name);
  });

  return matches;
}

/**
 * Return all foods in a given category.
 */
export function getFoodsByCategory(category: FoodCategory): FoodItem[] {
  return FOOD_DATABASE.filter((f) => f.category === category);
}

/**
 * Calculate nutrition for a specific quantity of a food item.
 *
 * @param food      The food item from the database
 * @param grams     Actual weight in grams
 * @returns         Object with calculated calories, protein, carbs, fats
 */
export function calculateNutrition(
  food: FoodItem,
  grams: number,
): { calories: number; protein: number; carbs: number; fats: number } {
  const factor = grams / 100;
  return {
    calories: Math.round(food.caloriesPer100g * factor),
    protein: +(food.proteinPer100g * factor).toFixed(1),
    carbs: +(food.carbsPer100g * factor).toFixed(1),
    fats: +(food.fatsPer100g * factor).toFixed(1),
  };
}
