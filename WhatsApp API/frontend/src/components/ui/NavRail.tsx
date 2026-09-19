import React, { useState } from 'react';
import type { Company, WhatsAppInstance } from '../../types/index.js';
import {
  Building2,
  Check,
  Clapperboard,
  MessageSquare,
  QrCode,
  Sliders,
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
    { key: 'inbox' as NavTab, label: 'Conversas', icon: MessageSquare },
    { key: 'connection' as NavTab, label: 'Conexão', icon: QrCode },
    { key: 'settings' as NavTab, label: 'Automação', icon: Sliders },
    { key: 'cinema' as NavTab, label: 'Programação', icon: Clapperboard },
  ];

  return (
    <aside className="whatsapp-sidebar" aria-label="Navegação da central do WhatsApp">
      <div className="whatsapp-sidebar-heading">Atendimento</div>
      <nav className="whatsapp-nav" aria-label="Seções da central">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.key;
          const connectionDot = item.key === 'connection';

          return (
            <button
              key={item.key}
              type="button"
              onClick={() => onSelectTab(item.key)}
              title={item.label}
              className={`whatsapp-nav-item${isActive ? ' is-active' : ''}`}
              aria-current={isActive ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={isActive ? 2.35 : 1.9} />
              <span className="whatsapp-nav-label">{item.label}</span>
              {connectionDot && !isActive && (
                <span
                  aria-label={isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
                  style={{
                    width: '7px',
                    height: '7px',
                    marginLeft: 'auto',
                    borderRadius: '50%',
                    backgroundColor: isConnected ? 'var(--ios-green)' : 'var(--ios-red)',
                  }}
                />
              )}
            </button>
          );
        })}
      </nav>

      {!isMobile && (
        <div className="whatsapp-sidebar-footer">
          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setShowCompanyMenu((value) => !value)}
              className="whatsapp-company-button"
              title={`Cinema ativo: ${selectedCompany?.name || 'Selecione'}`}
              aria-expanded={showCompanyMenu}
            >
              <Building2 size={17} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {selectedCompany?.name || 'Selecionar cinema'}
              </span>
            </button>

            {showCompanyMenu && (
              <div className="whatsapp-company-popover" role="menu">
                <div style={{ padding: '8px 10px', color: 'var(--text-tertiary)', fontSize: '0.69rem', fontWeight: 800, letterSpacing: '0.07em' }}>
                  CINEMAS CADASTRADOS
                </div>
                {companies.map((company) => {
                  const isCurrent = selectedCompany?.id === company.id;
                  return (
                    <button
                      key={company.id}
                      type="button"
                      onClick={() => {
                        onSelectCompany(company);
                        setShowCompanyMenu(false);
                      }}
                      style={{
                        width: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '10px',
                        padding: '10px',
                        border: 0,
                        borderRadius: '8px',
                        background: isCurrent ? '#162641' : 'transparent',
                        color: isCurrent ? 'var(--text-primary)' : 'var(--text-secondary)',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        fontWeight: isCurrent ? 700 : 500,
                        textAlign: 'left',
                      }}
                    >
                      <span>{company.name}</span>
                      {isCurrent && <Check size={15} color="var(--lumix-green)" />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => onSelectTab('connection')}
            className="whatsapp-connection-button"
            title={isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
          >
            <span
              style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                flex: '0 0 auto',
                backgroundColor: isConnected ? 'var(--ios-green)' : 'var(--ios-red)',
              }}
            />
            {isConnected ? 'WhatsApp conectado' : 'WhatsApp desconectado'}
          </button>
        </div>
      )}
    </aside>
  );
};
