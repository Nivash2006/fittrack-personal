interface MacroBarProps {
  label: string;
  value: number;
  max: number;
  type: 'protein' | 'carbs' | 'fats' | 'water';
}

export default function MacroBar({ label, value, max, type }: MacroBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div className="macro-stat">
      <div className="macro-stat__header">
        <span className="macro-stat__label">{label}</span>
        <span className="macro-stat__value">
          {Math.round(value)}<span className="text-muted" style={{ fontSize: '0.6875rem' }}>/{max}g</span>
        </span>
      </div>
      <div className={`progress-bar progress-bar--${type}`}>
        <div
          className="progress-bar__fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
