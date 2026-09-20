import React from 'react';
import { MessageSquare, User } from 'lucide-react';

interface AvatarProps {
  src?: string | null;
  name?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  isOnline?: boolean;
  isBot?: boolean;
  onClick?: () => void;
  title?: string;
  className?: string;
}

const AVATAR_SIZES = {
  sm: { px: 32, icon: 16, fontSize: '0.75rem', badge: 8 },
  md: { px: 44, icon: 20, fontSize: '0.92rem', badge: 10 },
  lg: { px: 50, icon: 24, fontSize: '1.05rem', badge: 12 },
  xl: { px: 68, icon: 32, fontSize: '1.4rem', badge: 14 },
};

const PALETTE = [
  '#0A84FF', // iOS Blue
  '#30D158', // iOS Green
  '#FF9F0A', // iOS Orange
  '#BF5AF2', // iOS Purple
  '#64D2FF', // iOS Teal
  '#FF375F', // iOS Pink
];

function getInitialsColor(name?: string): string {
  if (!name) return '#2C2C2E';
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % PALETTE.length;
  return PALETTE[index];
}

function getInitials(name?: string): string {
  if (!name) return '';
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  name,
  size = 'md',
  isOnline = false,
  isBot = false,
  onClick,
  title,
  className = '',
}) => {
  const config = AVATAR_SIZES[size];
  const bgColor = getInitialsColor(name);
  const initials = getInitials(name);

  return (
    <div
      onClick={onClick}
      title={title || name}
      className={className}
      style={{
        width: `${config.px}px`,
        height: `${config.px}px`,
        minWidth: `${config.px}px`,
        minHeight: `${config.px}px`,
        borderRadius: '50%',
        position: 'relative',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: onClick ? 'pointer' : 'default',
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {/* Avatar Content Surface */}
      <div
        style={{
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          overflow: 'hidden',
          background: src ? 'var(--bg-secondary)' : bgColor,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#FFFFFF',
          fontWeight: 600,
          fontSize: config.fontSize,
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
        }}
      >
        {src ? (
          <img
            src={src}
            alt={name || 'Avatar'}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onError={(e) => {
              // fallback if image fails loading
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        ) : isBot ? (
          <MessageSquare size={config.icon} />
        ) : initials ? (
          initials
        ) : (
          <User size={config.icon} />
        )}
      </div>

      {/* Online Status Indicator */}
      {isOnline && (
        <span
          style={{
            position: 'absolute',
            bottom: '1px',
            right: '1px',
            width: `${config.badge}px`,
            height: `${config.badge}px`,
            borderRadius: '50%',
            backgroundColor: 'var(--ios-green)',
            border: '2px solid var(--bg-primary)',
            boxShadow: '0 0 4px rgba(48, 209, 88, 0.6)',
          }}
        />
      )}
    </div>
  );
};
