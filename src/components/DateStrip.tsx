import { useMemo } from 'react';
import { getTodayStr, formatDateLocal } from '../utils/helpers';

interface DateStripProps {
  selectedDate: string; // YYYY-MM-DD
  onChange: (date: string) => void;
}

export default function DateStrip({ selectedDate, onChange }: DateStripProps) {
  const today = getTodayStr();

  // Generate 7 days around the selected date (selected in middle: 3 before, 3 after)
  const days = useMemo(() => {
    const list = [];
    const baseDate = new Date(selectedDate + 'T00:00:00');
    for (let i = -3; i <= 3; i++) {
      const d = new Date(baseDate);
      d.setDate(d.getDate() + i);
      const dateStr = formatDateLocal(d);
      list.push({
        dateStr,
        dayNum: d.getDate(),
        dayName: d.toLocaleDateString('en-US', { weekday: 'short' }),
      });
    }
    return list;
  }, [selectedDate]);

  const handlePrev = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() - 1);
    onChange(formatDateLocal(d));
  };

  const handleNext = () => {
    const d = new Date(selectedDate + 'T00:00:00');
    d.setDate(d.getDate() + 1);
    onChange(formatDateLocal(d));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%', marginBottom: 'var(--space-md)' }}>
      {/* Top Header Row: Active Month & jump/calendar controls */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ fontSize: '0.875rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {selectedDate !== today && (
            <button
              onClick={() => onChange(today)}
              style={{
                background: 'var(--accent-dim)',
                color: 'var(--accent)',
                border: '1px solid rgba(0, 230, 138, 0.15)',
                padding: '4px 8px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 700
              }}
            >
              Today ↩
            </button>
          )}
          {/* Native hidden date picker triggered via standard styled overlay button */}
          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => e.target.value && onChange(e.target.value)}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                height: '100%',
                opacity: 0,
                cursor: 'pointer',
                zIndex: 2
              }}
            />
            <button
              style={{
                background: 'var(--bg-glass-strong)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-subtle)',
                padding: '4px 8px',
                fontSize: '0.75rem',
                borderRadius: '4px',
                cursor: 'pointer',
                pointerEvents: 'none' // Click passes through to hidden input date field
              }}
            >
              📅 Choose Date
            </button>
          </div>
        </div>
      </div>

      {/* Slide Navigation & Days Row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
        {/* Prev Day slider */}
        <button
          onClick={handlePrev}
          style={{
            background: 'var(--bg-glass-strong)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            width: '32px',
            height: '46px',
            cursor: 'pointer',
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms ease'
          }}
        >
          ‹
        </button>

        {/* Calendar Day card scroll strip */}
        <div style={{ display: 'flex', flex: 1, gap: '6px', overflowX: 'auto', padding: '2px 0' }}>
          {days.map((d) => {
            const isSelected = d.dateStr === selectedDate;
            const isToday = d.dateStr === today;
            return (
              <button
                key={d.dateStr}
                onClick={() => onChange(d.dateStr)}
                style={{
                  flex: 1,
                  minWidth: '42px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  padding: '6px 4px',
                  background: isSelected ? 'var(--accent)' : 'var(--bg-glass-strong)',
                  border: isSelected ? '1px solid var(--accent)' : '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 150ms ease',
                  position: 'relative'
                }}
              >
                <span style={{ fontSize: '0.625rem', textTransform: 'uppercase', color: isSelected ? '#0a1a12' : 'var(--text-muted)', fontWeight: isSelected ? 700 : 400 }}>
                  {d.dayName}
                </span>
                <span style={{ fontSize: '0.9rem', fontWeight: 800, color: isSelected ? '#0a1a12' : 'var(--text-primary)', marginTop: '2px' }}>
                  {d.dayNum}
                </span>
                {isToday && (
                  <div style={{
                    position: 'absolute',
                    bottom: '3px',
                    width: '4px',
                    height: '4px',
                    borderRadius: '50%',
                    background: isSelected ? '#0a1a12' : 'var(--accent)'
                  }} />
                )}
              </button>
            );
          })}
        </div>

        {/* Next Day slider */}
        <button
          onClick={handleNext}
          style={{
            background: 'var(--bg-glass-strong)',
            color: 'var(--text-secondary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)',
            width: '32px',
            height: '46px',
            cursor: 'pointer',
            fontSize: '1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 150ms ease'
          }}
        >
          ›
        </button>
      </div>
    </div>
  );
}
