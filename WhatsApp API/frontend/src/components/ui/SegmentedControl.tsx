import React from 'react';

export interface SegmentOption<T extends string = string> {
  key: T;
  label: string;
  count?: number;
  icon?: React.ReactNode;
}

interface SegmentedControlProps<T extends string = string> {
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: 'sm' | 'md';
}

export function SegmentedControl<T extends string = string>({
  options,
  value,
  onChange,
  size = 'md',
}: SegmentedControlProps<T>) {
  const isSm = size === 'sm';

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'rgba(118, 118, 128, 0.24)',
        padding: '2px',
        borderRadius: '9px',
        width: '100%',
        userSelect: 'none',
      }}
    >
      {options.map((opt) => {
        const isSelected = opt.key === value;

        return (
          <button
            key={opt.key}
            type="button"
            onClick={() => onChange(opt.key)}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              padding: isSm ? '5px 8px' : '6px 12px',
              fontSize: isSm ? '0.78rem' : '0.84rem',
              fontWeight: isSelected ? 600 : 500,
              color: isSelected ? '#FFFFFF' : 'var(--text-secondary)',
              background: isSelected ? '#2C2C2E' : 'transparent',
              borderRadius: '7px',
              border: 'none',
              cursor: 'pointer',
              boxShadow: isSelected ? '0 2px 6px rgba(0, 0, 0, 0.35)' : 'none',
              transition: 'all 0.18s cubic-bezier(0.2, 0, 0, 1)',
              outline: 'none',
              whiteSpace: 'nowrap',
            }}
          >
            {opt.icon}
            <span>{opt.label}</span>
            {typeof opt.count === 'number' && opt.count > 0 && (
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '1px 5px',
                  borderRadius: '9999px',
                  backgroundColor: isSelected ? 'var(--ios-blue)' : 'rgba(255, 255, 255, 0.12)',
                  color: '#FFFFFF',
                }}
              >
                {opt.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
