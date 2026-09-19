import React, { useState } from 'react';
import type { Company, WhatsAppInstance } from '../../types/index.js';
import {
  MessageSquare,
  QrCode,
  Sliders,
  Clapperboard,
  Building2,
  Check,
} from 'lucide-react';

export type NavTab = 'inbox' | 'connection' | 'settings' | 'cinema';

interface NavRailProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  whatsappInstance?: WhatsAppInstance | null;
  isMobile?: boolean;
}

export const NavRail: React.FC<NavRailProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  activeTab,
  onSelectTab,
  whatsappInstance,
  isMobile = false,
}) => {
  const [showCompanyMenu, setShowCompanyMenu] = useState(false);

  const isConnected = whatsappInstance?.status === 'CONNECTED';

  const navItems = [
    {
      key: 'inbox' as NavTab,
      label: 'Conversas',
      icon: MessageSquare,
      badge: 0,
    },
    {
      key: 'connection' as NavTab,
      label: 'WhatsApp',
      icon: QrCode,
      statusDot: isConnected ? '#30D158' : '#FF453A',
    },
    {
      key: 'settings' as NavTab,
      label: 'Configurações',
      icon: Sliders,
    },
    {
      key: 'cinema' as NavTab,
      label: 'Cinema',
      icon: Clapperboard,
    },
  ];

  return (
    <aside
      style={{
        width: isMobile ? '100%' : '64px',
        minWidth: isMobile ? '100%' : '64px',
        maxWidth: isMobile ? '100%' : '64px',
        height: isMobile ? '56px' : '100%',
        backgroundColor: '#111113',
        borderRight: isMobile ? 'none' : '1px solid var(--separator)',
        borderTop: isMobile ? '1px solid var(--separator)' : 'none',
        display: 'flex',
        flexDirection: isMobile ? 'row' : 'column',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: isMobile ? '0 16px' : '16px 0',
        zIndex: 50,
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      {/* Navigation Section */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          alignItems: 'center',
          gap: isMobile ? '8px' : '20px',
          width: isMobile ? 'auto' : '100%',
          flex: isMobile ? 1 : 'unset',
          justifyContent: isMobile ? 'space-around' : 'flex-start',
        }}
      >
        {/* Central de atendimento do Cine Cruzeiro (Desktop only) */}
        {!isMobile && (
          <div
            title="Central do WhatsApp do Cine Cruzeiro"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '11px',
              background: 'linear-gradient(135deg, #1C1C1E 0%, #2C2C2E 100%)',
              border: '1px solid rgba(48, 209, 88, 0.35)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
              cursor: 'pointer',
            }}
            onClick={() => onSelectTab('inbox')}
          >
            <div
              style={{
                width: '12px',
                height: '12px',
                borderRadius: '50%',
                backgroundColor: 'var(--lumix-green)',
                boxShadow: '0 0 10px rgba(48, 209, 88, 0.8)',
              }}
            />
          </div>
        )}

        {/* Navigation Tabs */}
        <nav
          style={{
            display: 'flex',
            flexDirection: isMobile ? 'row' : 'column',
            alignItems: 'center',
            gap: isMobile ? '4px' : '8px',
            width: isMobile ? '100%' : '100%',
            justifyContent: isMobile ? 'space-around' : 'center',
          }}
        >
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;

            return (
              <button
                key={item.key}
                type="button"
                onClick={() => onSelectTab(item.key)}
                title={item.label}
                style={{
                  position: 'relative',
                  width: '44px',
                  height: '44px',
                  borderRadius: '12px',
                  border: 'none',
                  background: isActive ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
                  color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.16s ease',
                  outline: 'none',
                }}
              >
                <Icon size={20} strokeWidth={isActive ? 2.3 : 1.8} />

                {/* Status Dot */}
                {item.statusDot && (
                  <span
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      width: '6px',
                      height: '6px',
                      borderRadius: '50%',
                      backgroundColor: item.statusDot,
                      boxShadow: `0 0 6px ${item.statusDot}`,
                    }}
                  />
                )}

                {/* Active Indicator Bar */}
                {isActive && (
                  <span
                    style={{
                      position: 'absolute',
                      ...(isMobile
                        ? {
                            bottom: '2px',
                            left: '50%',
                            transform: 'translateX(-50%)',
                            width: '20px',
                            height: '3px',
                            borderRadius: '4px 4px 0 0',
                          }
                        : {
                            left: '-10px',
                            width: '3px',
                            height: '22px',
                            borderRadius: '0 4px 4px 0',
                          }),
                      backgroundColor: 'var(--ios-blue)',
                    }}
                  />
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom/Right Section: Company Selector & Connectivity Badge */}
      <div
        style={{
          display: 'flex',
          flexDirection: isMobile ? 'row' : 'column',
          alignItems: 'center',
          gap: isMobile ? '10px' : '14px',
          width: isMobile ? 'auto' : '100%',
          position: 'relative',
        }}
      >
        {/* Company Dropdown / Popover */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowCompanyMenu(!showCompanyMenu)}
            title={`Empresa ativa: ${selectedCompany?.name || 'Selecione'}`}
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              border: '1px solid var(--separator)',
              background: 'var(--bg-secondary)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            <Building2 size={18} />
          </button>

          {/* Company Popover Sheet */}
          {showCompanyMenu && (
            <div
              style={{
                position: 'absolute',
                ...(isMobile
                  ? {
                      bottom: '54px',
                      right: '0px',
                    }
                  : {
                      bottom: '0px',
                      left: '52px',
                    }),
                width: '240px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--separator)',
                borderRadius: 'var(--radius-md)',
                boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                backdropFilter: 'blur(20px)',
                padding: '6px',
                zIndex: 100,
              }}
            >
              <div style={{ padding: '8px 10px', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-tertiary)', borderBottom: '1px solid var(--separator)' }}>
                EMPRESAS CADASTRADAS
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {companies.map((comp) => {
                  const isCur = selectedCompany?.id === comp.id;
                  return (
                    <button
                      key={comp.id}
                      type="button"
                      onClick={() => {
                        onSelectCompany(comp);
                        setShowCompanyMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '8px 10px',
                        borderRadius: '8px',
                        border: 'none',
                        background: isCur ? 'rgba(255, 255, 255, 0.08)' : 'transparent',
                        color: isCur ? '#FFFFFF' : 'var(--text-secondary)',
                        fontSize: '0.84rem',
                        fontWeight: isCur ? 600 : 400,
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {comp.name}
                      </span>
                      {isCur && <Check size={14} color="var(--ios-blue)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* WhatsApp Connection Indicator */}
        <button
          type="button"
          onClick={() => onSelectTab('connection')}
          title={isConnected ? 'WhatsApp Conectado' : 'WhatsApp Desconectado'}
          style={{
            background: 'transparent',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            padding: '4px',
          }}
        >
          <span
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: isConnected ? 'var(--ios-green)' : 'var(--ios-red)',
              boxShadow: isConnected
                ? '0 0 8px rgba(48, 209, 88, 0.7)'
                : '0 0 8px rgba(255, 69, 58, 0.7)',
            }}
          />
        </button>
      </div>
    </aside>
  );
};
