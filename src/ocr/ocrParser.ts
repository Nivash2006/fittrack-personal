/**
 * FitTrack Personal — OCR Label Regex Parser
 */

export interface RawOcrValues {
  calories?: number;
  protein?: number;
  carbs?: number;
  fats?: number;
}

/**
 * Searches the raw text lines for nutrient matches using target keywords and patterns.
 */
export function parseRawOcrText(rawText: string): RawOcrValues {
  const lines = rawText.toLowerCase().split('\n');
  const result: RawOcrValues = {};

  for (const line of lines) {
    // ─── Calories ────────────────────────────────────────────────────────────
    if (!result.calories && (line.includes('calorie') || line.includes('kcal') || line.includes('energy') || line.includes('valur') || line.includes('value'))) {
      // Find numbers in line, ignoring words. We avoid "calories from fat" if possible.
      if (!line.includes('fat calorie') && !line.includes('calories from fat')) {
        const matches = line.match(/(?:energy|calories|kcal|value|valur)\D*(\d+)/i);
        if (matches && matches[1]) {
          const val = parseInt(matches[1]);
          if (!isNaN(val) && val > 0 && val < 2000) {
            result.calories = val;
          }
        }
      }
    }

    // ─── Protein ─────────────────────────────────────────────────────────────
    if (!result.protein && (line.includes('protein') || line.includes('pro') || line.includes('prorim'))) {
      const matches = line.match(/(?:protein|proteins|pro|prorim)\D*(\d+(?:\.\d+)?)/i);
      if (matches && matches[1]) {
        const val = parseFloat(matches[1]);
        if (!isNaN(val) && val >= 0 && val < 200) {
          result.protein = val;
        }
      }
    }

    // ─── Carbohydrates ───────────────────────────────────────────────────────
    if (!result.carbs && (line.includes('carbohydrate') || line.includes('carb') || line.includes('total carb') || line.includes('carbo'))) {
      const matches = line.match(/(?:carbohydrate|carbohydrates|carbs|total carb|carbo)\D*(\d+(?:\.\d+)?)/i);
      if (matches && matches[1]) {
        const val = parseFloat(matches[1]);
        if (!isNaN(val) && val >= 0 && val < 200) {
          result.carbs = val;
        }
      }
    }

    // ─── Fats ────────────────────────────────────────────────────────────────
    if (!result.fats && (line.includes('fat') || line.includes('fats') || line.includes('lipid') || line.includes('lipids'))) {
      // Focus on "total fat" or plain "fat" and avoid "saturated fat", "trans fat" if possible
      if (!line.includes('saturated') && !line.includes('trans') && !line.includes('poly') && !line.includes('mono')) {
        const matches = line.match(/(?:total fat|fat|fats|lipids|lipid)\D*(\d+(?:\.\d+)?)/i);
        if (matches && matches[1]) {
          const val = parseFloat(matches[1]);
          if (!isNaN(val) && val >= 0 && val < 200) {
            result.fats = val;
          }
        }
      }
    }
  }

  // Backup fallback: if some lines didn't match the keyword but had standard numbers
  // we do a secondary check for lines matching "Energy X kcal" or "Protein Xg"
  if (!result.calories) {
    const energyMatch = rawText.match(/(\d+)\s*(?:kcal|calories)/i);
    if (energyMatch && energyMatch[1]) {
      result.calories = parseInt(energyMatch[1]);
    }
  }

  return result;
}
