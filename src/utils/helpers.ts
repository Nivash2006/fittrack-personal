export function getTodayStr(): string {
  return new Date().toISOString().split('T')[0];
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDateShort(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
}

export function getLast7Days(): string[] {
  const days: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export function getLast30Days(): string[] {
  const days: string[] = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().split('T')[0]);
  }
  return days;
}

export function getDayName(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { weekday: 'short' });
}

export function calculateBMR(
  gender: 'male' | 'female',
  weightKg: number,
  heightCm: number,
  age: number
): number {
  // Mifflin-St Jeor
  if (gender === 'male') {
    return 10 * weightKg + 6.25 * heightCm - 5 * age + 5;
  }
  return 10 * weightKg + 6.25 * heightCm - 5 * age - 161;
}

export function calculateTDEE(
  bmr: number,
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
): number {
  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9,
  };
  return Math.round(bmr * multipliers[activityLevel]);
}

export function calculateTargetCalories(
  tdee: number,
  goal: 'lose' | 'maintain' | 'gain'
): number {
  switch (goal) {
    case 'lose': return Math.round(tdee - 500);
    case 'gain': return Math.round(tdee + 300);
    default: return tdee;
  }
}

export function calculateWaterTarget(
  weightKg: number,
  activityLevel: 'sedentary' | 'light' | 'moderate' | 'active' | 'very_active'
): number {
  // Base: 35 ml per kg of body weight
  const base = weightKg * 35;
  // Activity modifiers in ml
  const modifiers = {
    sedentary: 0,
    light: 250,
    moderate: 500,
    active: 750,
    very_active: 1000,
  };
  const activeAdjustment = modifiers[activityLevel] || 0;
  // Round to nearest 250 ml (one standard glass size)
  return Math.round((base + activeAdjustment) / 250) * 250;
}

export function calculateMacros(
  calories: number, 
  goal: 'lose' | 'maintain' | 'gain',
  dietType: 'balanced' | 'low_carb' | 'high_protein' = 'balanced'
) {
  const splits = {
    balanced: {
      lose: { protein: 0.3, carbs: 0.35, fats: 0.35 },
      maintain: { protein: 0.25, carbs: 0.5, fats: 0.25 },
      gain: { protein: 0.25, carbs: 0.5, fats: 0.25 },
    },
    low_carb: {
      lose: { protein: 0.35, carbs: 0.15, fats: 0.5 },
      maintain: { protein: 0.3, carbs: 0.2, fats: 0.5 },
      gain: { protein: 0.3, carbs: 0.25, fats: 0.45 },
    },
    high_protein: {
      lose: { protein: 0.4, carbs: 0.3, fats: 0.3 },
      maintain: { protein: 0.35, carbs: 0.4, fats: 0.25 },
      gain: { protein: 0.35, carbs: 0.4, fats: 0.25 },
    }
  };

  const dietConfig = splits[dietType] || splits.balanced;
  const s = dietConfig[goal];
  return {
    protein: Math.round((calories * s.protein) / 4),
    carbs: Math.round((calories * s.carbs) / 4),
    fats: Math.round((calories * s.fats) / 9),
  };
}

export function calculateBMI(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return Math.round((weightKg / (heightM * heightM)) * 10) / 10;
}

export function getBMICategory(bmi: number): string {
  if (bmi < 18.5) return 'Underweight';
  if (bmi < 25) return 'Normal';
  if (bmi < 30) return 'Overweight';
  return 'Obese';
}
