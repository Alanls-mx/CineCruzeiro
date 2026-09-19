import React from 'react';
import type { Company } from '../types/index.js';
import { MessageSquare, QrCode, Settings, Clapperboard, Building2 } from 'lucide-react';

interface NavbarProps {
  companies: Company[];
  selectedCompany: Company | null;
  onSelectCompany: (company: Company) => void;
  activeTab: 'inbox' | 'connection' | 'settings' | 'cinema';
  onSelectTab: (tab: 'inbox' | 'connection' | 'settings' | 'cinema') => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  companies,
  selectedCompany,
  onSelectCompany,
  activeTab,
  onSelectTab,
}) => {
  return (
    <header style={{
      borderBottom: '1px solid var(--border-subtle)',
      background: 'rgba(10, 13, 20, 0.85)',
      backdropFilter: 'blur(12px)',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      padding: '0 24px',
      height: '68px',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
    }}>
      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <div style={{
          width: '38px',
          height: '38px',
          borderRadius: '10px',
          background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 14px var(--wa-green-glow)',
        }}>
          <MessageSquare size={20} color="#ffffff" />
        </div>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontWeight: 800, fontSize: '1.15rem', color: '#ffffff', letterSpacing: '-0.02em' }}>
              LumixEngine
            </span>
            <span style={{
              background: 'rgba(37, 211, 102, 0.15)',
              color: '#25D366',
              fontSize: '0.7rem',
              fontWeight: 700,
              padding: '2px 8px',
              borderRadius: '9999px',
              border: '1px solid rgba(37, 211, 102, 0.3)',
            }}>
              WhatsApp SaaS
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <nav style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <button
          onClick={() => onSelectTab('inbox')}
          className={`btn btn-sm ${activeTab === 'inbox' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <MessageSquare size={16} />
          Conversas & Inbox
        </button>

        <button
          onClick={() => onSelectTab('connection')}
          className={`btn btn-sm ${activeTab === 'connection' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <QrCode size={16} />
          Conexão WhatsApp
        </button>

        <button
          onClick={() => onSelectTab('settings')}
          className={`btn btn-sm ${activeTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Settings size={16} />
          Configurações Bot
        </button>

        <button
          onClick={() => onSelectTab('cinema')}
          className={`btn btn-sm ${activeTab === 'cinema' ? 'btn-primary' : 'btn-secondary'}`}
        >
          <Clapperboard size={16} />
          Cinema Lumix
        </button>
      </nav>

      {/* Tenant Selector */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <Building2 size={18} color="var(--text-muted)" />
        <select
          value={selectedCompany?.id || ''}
          onChange={(e) => {
            const found = companies.find((c) => c.id === e.target.value);
            if (found) onSelectCompany(found);
          }}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            fontSize: '0.85rem',
            fontWeight: 600,
            cursor: 'pointer',
            outline: 'none',
          }}
        >
          {companies.map((comp) => (
            <option key={comp.id} value={comp.id}>
              🎬 {comp.name}
            </option>
          ))}
        </select>
      </div>
    </header>
  );
};
