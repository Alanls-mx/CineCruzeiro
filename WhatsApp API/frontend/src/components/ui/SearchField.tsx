import React, { useRef } from 'react';
import { Search, X } from 'lucide-react';

interface SearchFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  autoFocus?: boolean;
}

export const SearchField: React.FC<SearchFieldProps> = ({
  value,
  onChange,
  placeholder = 'Buscar conversa...',
  autoFocus = false,
}) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleClear = () => {
    onChange('');
    inputRef.current?.focus();
  };

  return (
    <div
      style={{
        position: 'relative',
        display: 'flex',
        alignItems: 'center',
        width: '100%',
        backgroundColor: 'rgba(118, 118, 128, 0.22)',
        borderRadius: '10px',
        padding: '0 10px',
        height: '36px',
        transition: 'background-color 0.2s ease',
      }}
    >
      <Search size={16} color="var(--text-tertiary)" style={{ flexShrink: 0, marginRight: '8px' }} />

      <input
        ref={inputRef}
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        style={{
          width: '100%',
          background: 'transparent',
          border: 'none',
          outline: 'none',
          color: '#FFFFFF',
          fontSize: '0.88rem',
          fontWeight: 400,
        }}
      />

      {value && (
        <button
          type="button"
          onClick={handleClear}
          title="Limpar busca"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '18px',
            height: '18px',
            borderRadius: '50%',
            backgroundColor: 'rgba(255, 255, 255, 0.25)',
            border: 'none',
            color: '#000000',
            cursor: 'pointer',
            flexShrink: 0,
            padding: 0,
          }}
        >
          <X size={12} strokeWidth={2.5} />
        </button>
      )}
    </div>
  );
};
