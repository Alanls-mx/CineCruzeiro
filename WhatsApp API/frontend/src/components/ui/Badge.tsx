import React from 'react';

export type BadgeVariant = 'bot' | 'human' | 'waiting' | 'closed' | 'unread' | 'neutral';

interface BadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  icon?: React.ReactNode;
  size?: 'sm' | 'md';
  style?: React.CSSProperties;
}

const BADGE_STYLES: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  bot: {
    bg: 'rgba(10, 132, 255, 0.14)',
    text: '#0A84FF',
    border: 'rgba(10, 132, 255, 0.28)',
  },
  human: {
    bg: 'rgba(191, 90, 242, 0.14)',
    text: '#BF5AF2',
    border: 'rgba(191, 90, 242, 0.28)',
  },
  waiting: {
    bg: 'rgba(255, 159, 10, 0.14)',
    text: '#FF9F0A',
    border: 'rgba(255, 159, 10, 0.28)',
  },
  closed: {
    bg: 'rgba(142, 142, 147, 0.14)',
    text: '#8E8E93',
    border: 'rgba(142, 142, 147, 0.25)',
  },
  unread: {
    bg: 'var(--ios-green)',
    text: '#000000',
    border: 'transparent',
  },
  neutral: {
    bg: 'rgba(255, 255, 255, 0.08)',
    text: 'var(--text-secondary)',
    border: 'rgba(255, 255, 255, 0.1)',
  },
};

export const Badge: React.FC<BadgeProps> = ({
  variant = 'neutral',
  children,
  icon,
  size = 'sm',
  style,
}) => {
  const cfg = BADGE_STYLES[variant];
  const isSm = size === 'sm';

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: isSm ? '4px' : '6px',
        padding: isSm ? '2px 8px' : '4px 10px',
        borderRadius: '9999px',
        backgroundColor: cfg.bg,
        color: cfg.text,
        border: `1px solid ${cfg.border}`,
        fontSize: isSm ? '0.7rem' : '0.78rem',
        fontWeight: 600,
        letterSpacing: '0.02em',
        lineHeight: 1.2,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {children}
    </span>
  );
};
