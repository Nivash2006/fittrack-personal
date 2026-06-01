/**
 * FitTrack Personal — OCR Nutrition Extractor & Validation Layer
 */

import { parseRawOcrText } from './ocrParser';

export interface ParsedNutrition {
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
  confidenceScore: number; // 0 to 100
  rawText: string;
}

/**
 * Extracts, validates, and rates the confidence of parsed OCR nutrition text.
 */
export function extractAndValidateNutrition(
  rawText: string,
  tesseractConfidence: number // Tesseract's own word confidence percentage (0-100)
): ParsedNutrition {
  const parsed = parseRawOcrText(rawText);

  // ─── Validation Layer ──────────────────────────────────────────────────────
  let calories = parsed.calories;
  let protein = parsed.protein;
  let carbs = parsed.carbs;
  let fats = parsed.fats;

  // 1. Calories check (do not exceed 2500 kcal per serving, must be positive)
  if (calories !== undefined && (calories <= 0 || calories > 2500)) {
    calories = undefined;
  }

  // 2. Protein check (do not exceed 150g per serving, must be positive)
  if (protein !== undefined && (protein < 0 || protein > 150)) {
    protein = undefined;
  }

  // 3. Carbohydrates check (do not exceed 150g per serving, must be positive)
  if (carbs !== undefined && (carbs < 0 || carbs > 150)) {
    carbs = undefined;
  }

  // 4. Fats check (do not exceed 150g per serving, must be positive)
  if (fats !== undefined && (fats < 0 || fats > 150)) {
    fats = undefined;
  }

  // ─── Confidence Scoring ────────────────────────────────────────────────────
  // We calculate our own adjusted confidence score based on:
  // 1. Tesseract's baseline reading confidence.
  // 2. The density of parsed metrics (parsing calories + all 3 macros boosts score).
  let parsedCount = 0;
  if (calories !== undefined) parsedCount++;
  if (protein !== undefined) parsedCount++;
  if (carbs !== undefined) parsedCount++;
  if (fats !== undefined) parsedCount++;

  const densityBonus = parsedCount * 12; // up to +48% bonus for parsing all metrics
  let adjustedConfidence = Math.round(tesseractConfidence * 0.6 + densityBonus);

  // Bound between 0 and 100
  adjustedConfidence = Math.max(0, Math.min(100, adjustedConfidence));

  return {
    calories,
    protein,
    carbs,
    fats,
    confidenceScore: adjustedConfidence,
    rawText,
  };
}
