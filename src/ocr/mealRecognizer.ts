/**
 * FitTrack Personal — Meal Recognizer
 *
 * Extracts food items from raw OCR text using a multi-pass pipeline:
 *   1. Tokenise OCR text into lines and words
 *   2. Filter noise (numbers, units, single chars, stopwords)
 *   3. Expand tokens via the alias dictionary
 *   4. Search the FOOD_DATABASE for each meaningful token/phrase
 *   5. Score every candidate match with a tiered rubric
 *   6. Deduplicate by food name (keep highest-scoring result)
 *   7. Sort descending by confidence and cap at 8 results
 *
 * Confidence Tiers:
 *   > 85  → 'auto'    — High confidence, auto-fill the meal log
 *   60–85 → 'confirm' — Medium confidence, prompt user to confirm
 *   < 60  → 'manual'  — Low confidence, show selector for manual pick
 */

import { searchFoods, type FoodItem } from '../db/foodDatabase';
import { expandPhrase, resolveAlias } from './foodAliases';

// ─── Types ────────────────────────────────────────────────────────────────────

export type ConfidenceTier = 'auto' | 'confirm' | 'manual';

export interface MealRecognitionResult {
  /** Matched food item from FOOD_DATABASE */
  food: FoodItem;
  /** Confidence score 0–100 */
  confidence: number;
  /** Action tier derived from confidence */
  tier: ConfidenceTier;
  /** The keyword or phrase that triggered this match */
  matchedKeyword: string;
  /** Default serving size in grams */
  estimatedGrams: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/** Maximum number of recognition results to return. */
const MAX_RESULTS = 8;

/**
 * Noise words to discard during tokenisation.
 * Includes common OCR artefacts, units, and generic fillers.
 */
const NOISE_WORDS = new Set([
  // Units & quantities
  'g', 'gm', 'gms', 'gram', 'grams', 'kg', 'ml', 'ltr', 'litre', 'liters',
  'oz', 'lb', 'cup', 'tsp', 'tbsp', 'serving', 'portion', 'piece', 'pieces',
  'plate', 'bowl', 'glass', 'bottle', 'packet', 'pack',
  // Articles & prepositions
  'a', 'an', 'the', 'of', 'in', 'with', 'and', 'or', 'to', 'for', 'by',
  'at', 'on', 'from', 'as', 'is', 'it', 'its', 'be', 'no', 'not',
  // Meal labels
  'breakfast', 'lunch', 'dinner', 'snack', 'meal', 'food', 'item', 'items',
  'total', 'calories', 'cal', 'kcal', 'protein', 'carb', 'carbs', 'fat',
  'fats', 'fibre', 'fiber', 'sodium', 'sugar', 'nutrition', 'nutritional',
  // Common receipt/menu words
  'qty', 'quantity', 'price', 'rs', 'inr', 'subtotal', 'tax', 'gst',
  'amount', 'order', 'table', 'date', 'time', 'invoice', 'bill',
  // Generic adjectives that add no food meaning
  'fresh', 'hot', 'cold', 'spicy', 'plain', 'special', 'regular', 'large',
  'small', 'medium', 'full', 'half', 'extra',
]);

/** Minimum token length after noise filtering. */
const MIN_TOKEN_LEN = 2;

// ─── Main Export ──────────────────────────────────────────────────────────────

/**
 * Recognise food items from raw OCR text.
 *
 * @param rawText  The full OCR output string (may contain newlines, noise).
 * @returns        Array of recognition results sorted by confidence desc.
 */
export function recognizeMealsFromText(rawText: string): MealRecognitionResult[] {
  if (!rawText || !rawText.trim()) return [];

  // ── Step 1: Extract candidate tokens from the raw text ──────────────────
  const candidates = extractCandidates(rawText);

  if (candidates.length === 0) return [];

  // ── Step 2: For each candidate, search the database and score ───────────
  const allMatches: MealRecognitionResult[] = [];

  for (const keyword of candidates) {
    const dbResults = searchFoods(keyword);

    // Also search with the alias-expanded version of the keyword
    const expanded = expandPhrase(keyword);
    const expandedResults = expanded !== keyword ? searchFoods(expanded) : [];

    // Merge, deduplicate by food name within this keyword's results
    const seen = new Set<string>();
    const combined: FoodItem[] = [];
    for (const f of [...dbResults, ...expandedResults]) {
      if (!seen.has(f.name)) {
        seen.add(f.name);
        combined.push(f);
      }
    }

    for (const food of combined) {
      const score = scoreMatch(food, keyword, expanded);
      const tier = getConfidenceTier(score);
      allMatches.push({
        food,
        confidence: score,
        tier,
        matchedKeyword: keyword,
        estimatedGrams: food.defaultServingG,
      });
    }
  }

  // ── Step 3: Deduplicate by food name — keep highest score ───────────────
  const bestByName = new Map<string, MealRecognitionResult>();
  for (const result of allMatches) {
    const existing = bestByName.get(result.food.name);
    if (!existing || result.confidence > existing.confidence) {
      bestByName.set(result.food.name, result);
    }
  }

  // ── Step 4: Sort by confidence descending, cap at MAX_RESULTS ───────────
  return Array.from(bestByName.values())
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, MAX_RESULTS);
}

// ─── Token Extraction ─────────────────────────────────────────────────────────

/**
 * Extract meaningful search candidates from OCR text.
 *
 * Strategy:
 *  - Scan each line for 2–3 word phrase candidates (bigrams / trigrams)
 *    because food names are often multi-word (e.g., "masala dosa").
 *  - Also include single-word tokens after alias resolution.
 *  - All candidates are deduplicated.
 */
function extractCandidates(rawText: string): string[] {
  // Normalise whitespace and split into lines
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.length > 0);

  const candidates = new Set<string>();

  for (const line of lines) {
    // Tokenise: split on whitespace and punctuation except hyphens inside words
    const rawTokens = line
      .replace(/[^\w\s'-]/g, ' ')   // remove punctuation except ' and -
      .split(/\s+/)
      .map(t => t.toLowerCase().trim())
      .filter(t => isValidToken(t));

    if (rawTokens.length === 0) continue;

    // Resolve aliases for each token
    const resolvedTokens = rawTokens.map(resolveAlias);

    // Generate unigrams
    for (const token of resolvedTokens) {
      if (isValidToken(token)) candidates.add(token);
    }

    // Generate bigrams
    for (let i = 0; i < resolvedTokens.length - 1; i++) {
      const bigram = `${resolvedTokens[i]} ${resolvedTokens[i + 1]}`;
      candidates.add(bigram);
    }

    // Generate trigrams
    for (let i = 0; i < resolvedTokens.length - 2; i++) {
      const trigram = `${resolvedTokens[i]} ${resolvedTokens[i + 1]} ${resolvedTokens[i + 2]}`;
      candidates.add(trigram);
    }

    // Also try the full line (expanded via alias) if it's short enough
    if (rawTokens.length <= 5) {
      const lineExpanded = expandPhrase(rawTokens.join(' '));
      candidates.add(lineExpanded.trim());
    }
  }

  return Array.from(candidates).filter(c => c.length >= MIN_TOKEN_LEN);
}

/**
 * Returns true if the token is meaningful (not noise, not a pure number,
 * not too short).
 */
function isValidToken(token: string): boolean {
  if (!token || token.length < MIN_TOKEN_LEN) return false;
  if (NOISE_WORDS.has(token)) return false;
  // Pure number or decimal
  if (/^\d+(\.\d+)?$/.test(token)) return false;
  // Mostly digits (e.g., "100g", "200ml")
  if (/^\d+[a-z]{1,3}$/.test(token)) return false;
  // Single letter (even if MIN_TOKEN_LEN allows it for safety)
  if (token.length === 1) return false;
  return true;
}

// ─── Scoring ──────────────────────────────────────────────────────────────────

/**
 * Scores how well a food item matches the search keyword.
 *
 * Rubric:
 *  95 — Exact full name match
 *  85 — Name starts with keyword
 *  70 — Name contains keyword (substring)
 *  +10 — Multi-word keyword matches all tokens in the food name
 *  +5  — Category bonus: keyword belongs to same category cluster
 *
 * Score is clamped to [0, 100].
 */
export function scoreMatch(food: FoodItem, keyword: string, expandedKeyword?: string): number {
  const foodNameLower = food.name.toLowerCase();
  const kw = keyword.toLowerCase().trim();
  const kwExpanded = (expandedKeyword ?? keyword).toLowerCase().trim();

  let base = 0;

  // ── Primary match against canonical name ────────────────────────────────
  if (foodNameLower === kw || foodNameLower === kwExpanded) {
    base = 95;
  } else if (foodNameLower.startsWith(kw) || foodNameLower.startsWith(kwExpanded)) {
    base = 85;
  } else if (foodNameLower.includes(kw) || foodNameLower.includes(kwExpanded)) {
    base = 70;
  } else {
    // Partial match: some tokens of the keyword match parts of the food name
    const kwTokens = kw.split(/\s+/);
    const matchedTokens = kwTokens.filter(t => foodNameLower.includes(t) && t.length > 2);
    if (matchedTokens.length === 0) return 0;
    // Proportional partial score
    base = Math.round(50 * (matchedTokens.length / kwTokens.length));
  }

  // ── Multi-word bonus (+10) ───────────────────────────────────────────────
  const kwTokens = kwExpanded.split(/\s+/);
  if (kwTokens.length > 1) {
    const allTokensMatch = kwTokens.every(t => t.length <= 1 || foodNameLower.includes(t));
    if (allTokensMatch) base = Math.min(100, base + 10);
  }

  // ── Category affinity bonus (+5) ─────────────────────────────────────────
  const categoryBonus = getCategoryBonus(food.category, kw);
  base = Math.min(100, base + categoryBonus);

  return base;
}

/**
 * Returns a +5 category bonus if the keyword strongly suggests the food's
 * category, reducing false matches across unrelated categories.
 */
function getCategoryBonus(category: FoodItem['category'], keyword: string): number {
  const kwLower = keyword.toLowerCase();

  const categoryHints: Record<FoodItem['category'], string[]> = {
    tamil_nadu_special: [
      'idli', 'dosa', 'sambar', 'rasam', 'pongal', 'parotta', 'kothu',
      'biryani', 'vadai', 'vada', 'appam', 'puttu', 'idiyappam', 'upma',
      'kootu', 'poriyal', 'curd rice', 'lemon rice', 'tamarind rice', 'bajji',
    ],
    south_indian: [
      'upma', 'poha', 'pesarattu', 'aval', 'rava', 'semolina', 'south',
    ],
    north_indian: [
      'roti', 'naan', 'chapati', 'paratha', 'dal', 'rajma', 'chole',
      'paneer', 'palak', 'aloo', 'butter', 'makhani', 'tandoor',
    ],
    snacks: [
      'murukku', 'mixture', 'thattai', 'seedai', 'chips', 'biscuit',
      'namkeen', 'cracker',
    ],
    fruits: [
      'banana', 'apple', 'mango', 'orange', 'papaya', 'grapes', 'watermelon',
      'fruit', 'pazham',
    ],
    dairy: [
      'milk', 'curd', 'yogurt', 'paneer', 'cheese', 'lassi', 'buttermilk',
      'paal', 'dahi',
    ],
    protein: [
      'egg', 'chicken', 'fish', 'prawn', 'whey', 'soya', 'meat', 'boiled',
      'grilled',
    ],
    grains: [
      'rice', 'oats', 'bread', 'cornflakes', 'muesli', 'cereal', 'wheat',
      'grain',
    ],
    nuts_oils: [
      'almond', 'cashew', 'peanut', 'walnut', 'ghee', 'oil', 'honey',
      'sugar', 'jaggery',
    ],
    beverages: [
      'tea', 'coffee', 'juice', 'water', 'milk', 'lassi', 'buttermilk',
      'drink', 'kaapi', 'chai',
    ],
    sweets: [
      'payasam', 'kesari', 'halwa', 'ladoo', 'sweet', 'kheer', 'adhirasam',
    ],
  };

  const hints = categoryHints[category] ?? [];
  const matches = hints.some(h => kwLower.includes(h) || h.includes(kwLower));
  return matches ? 5 : 0;
}

// ─── Tier & Label Helpers ─────────────────────────────────────────────────────

/**
 * Assigns a ConfidenceTier based on the numeric confidence score.
 *
 *  > 85  → 'auto'     High confidence — auto-fill the meal log
 *  60–85 → 'confirm'  Medium — ask user to confirm
 *  < 60  → 'manual'   Low — show food picker for manual selection
 */
export function getConfidenceTier(confidence: number): ConfidenceTier {
  if (confidence > 85) return 'auto';
  if (confidence >= 60) return 'confirm';
  return 'manual';
}

/**
 * Returns a human-readable label and CSS colour variable for a confidence tier.
 * Colors align with FitTrack's design system CSS variables.
 */
export function getConfidenceLabel(tier: ConfidenceTier): { label: string; color: string } {
  switch (tier) {
    case 'auto':
      return { label: 'High Confidence', color: 'var(--accent)' };        // green
    case 'confirm':
      return { label: 'Needs Confirmation', color: 'var(--accent2)' };    // blue
    case 'manual':
      return { label: 'Manual Selection', color: 'var(--text-muted)' };   // muted
  }
}

/**
 * Returns a short summary string for display in the UI.
 *
 * @example
 *   formatResult(result)
 *   // → "Masala Dosa · 95% · auto · 150 g"
 */
export function formatResult(result: MealRecognitionResult): string {
  return `${result.food.name} · ${result.confidence}% · ${result.tier} · ${result.estimatedGrams} g`;
}
