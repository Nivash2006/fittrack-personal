interface CircularProgressProps {
  value: number;
  max: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  label?: string;
  unit?: string;
}

export default function CircularProgress({
  value,
  max,
  size = 160,
  strokeWidth = 10,
  color = 'var(--accent)',
  label = '',
  unit = '',
}: CircularProgressProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = Math.min(value / max, 1);
  const offset = circumference - percentage * circumference;

  return (
    <div className="circular-progress" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          className="circular-progress__track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
        />
        <circle
          className="circular-progress__bar"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={color}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="circular-progress__content">
        <span className="circular-progress__value" style={{ color }}>
          {Math.round(value)}
        </span>
        {unit && <span className="circular-progress__label">{unit}</span>}
        {label && <span className="circular-progress__label">{label}</span>}
      </div>
    </div>
  );
}
