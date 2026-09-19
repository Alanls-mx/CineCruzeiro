import React from 'react';

interface SwitchProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  label?: string;
  description?: string;
  id?: string;
}

export const Switch: React.FC<SwitchProps> = ({
  checked,
  onChange,
  disabled = false,
  label,
  description,
  id,
}) => {
  return (
    <div
      onClick={() => {
        if (!disabled) onChange(!checked);
      }}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.5 : 1,
        gap: '16px',
        userSelect: 'none',
      }}
    >
      {(label || description) && (
        <div style={{ flex: 1, minWidth: 0 }}>
          {label && (
            <div style={{ color: '#FFFFFF', fontSize: '0.92rem', fontWeight: 500 }}>
              {label}
            </div>
          )}
          {description && (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', marginTop: '2px' }}>
              {description}
            </div>
          )}
        </div>
      )}

      {/* iOS Switch Track */}
      <div
        id={id}
        role="switch"
        aria-checked={checked}
        style={{
          width: '46px',
          height: '28px',
          borderRadius: '9999px',
          backgroundColor: checked ? 'var(--ios-green)' : 'rgba(120, 120, 128, 0.32)',
          position: 'relative',
          transition: 'background-color 0.22s cubic-bezier(0.2, 0, 0, 1)',
          flexShrink: 0,
        }}
      >
        {/* iOS Switch Thumb */}
        <div
          style={{
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            backgroundColor: '#FFFFFF',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.4)',
            position: 'absolute',
            top: '2px',
            left: '2px',
            transform: checked ? 'translateX(18px)' : 'translateX(0)',
            transition: 'transform 0.22s cubic-bezier(0.2, 0, 0, 1)',
          }}
        />
      </div>
    </div>
  );
};
