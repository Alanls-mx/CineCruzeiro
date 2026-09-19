import { useState, useEffect } from 'react';
import type { Company, WhatsAppInstance } from './types/index.js';
import { api } from './services/api.js';
import { NavRail, type NavTab } from './components/ui/NavRail.js';
import { Inbox } from './components/Inbox.js';
import { WhatsAppConnection } from './components/WhatsAppConnection.js';
import { BotSettings } from './components/BotSettings.js';
import { CinemaPreview } from './components/CinemaPreview.js';

export function App() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [activeTab, setActiveTab] = useState<NavTab>('inbox');
  const [activeInstance, setActiveInstance] = useState<WhatsAppInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [windowWidth, setWindowWidth] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1440
  );

  // Responsive resize listener
  useEffect(() => {
    const handleResize = () => setWindowWidth(window.innerWidth);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isMobile = windowWidth < 768;
  const hideNavOnMobileChat = isMobile && activeTab === 'inbox' && isChatOpen;

  // Load Companies on mount
  useEffect(() => {
    async function loadCompanies() {
      try {
        const list = await api.getCompanies();
        setCompanies(list);
        if (list.length > 0) {
          setSelectedCompany(list[0]);
        }
      } catch (err) {
        console.error('Failed to load companies', err);
      } finally {
        setLoading(false);
      }
    }
    loadCompanies();
  }, []);

  // Poll / check WhatsApp instance status for the selected company
  useEffect(() => {
    if (!selectedCompany) return;

    let isMounted = true;
    const fetchInstance = async () => {
      try {
        const instances = await api.getInstances(selectedCompany.id);
        if (isMounted && instances.length > 0) {
          setActiveInstance(instances[0]);
        }
      } catch {
        // silent fail
      }
    };

    fetchInstance();
    const interval = setInterval(fetchInstance, 15000);

    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, [selectedCompany?.id]);

  if (loading) {
    return (
      <div
        style={{
          height: '100vh',
          width: '100vw',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--bg-primary)',
          color: 'var(--text-secondary)',
          gap: '12px',
        }}
      >
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            border: '2px solid rgba(255, 255, 255, 0.1)',
            borderTopColor: 'var(--ios-green)',
            animation: 'spin 0.8s linear infinite',
          }}
        />
        <span style={{ fontSize: '0.92rem', fontWeight: 500, color: 'var(--text-tertiary)' }}>
          Carregando a central do Cine Cruzeiro...
        </span>
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }

  if (!selectedCompany) {
    return (
      <div style={{ padding: '60px', color: '#FFFFFF', textAlign: 'center' }}>
        A central do WhatsApp ainda não foi inicializada. Verifique a configuração do serviço.
      </div>
    );
  }

  return (
    <div
      style={{
        height: '100vh',
        maxHeight: '100vh',
        width: '100vw',
        maxWidth: '100vw',
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* 1. Left Nav Rail (Desktop 64px) or Hidden on Mobile if reading chat */}
      {!isMobile && (
        <NavRail
          companies={companies}
          selectedCompany={selectedCompany}
          onSelectCompany={setSelectedCompany}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          whatsappInstance={activeInstance}
          isMobile={false}
        />
      )}

      {/* 2. Main Workspace Surface */}
      <main
        style={{
          flex: 1,
          height: isMobile ? (hideNavOnMobileChat ? '100%' : 'calc(100% - 56px)') : '100%',
          maxHeight: isMobile ? (hideNavOnMobileChat ? '100%' : 'calc(100% - 56px)') : '100%',
          minHeight: 0,
          width: isMobile ? '100%' : 'calc(100vw - 64px)',
          maxWidth: isMobile ? '100%' : 'calc(100vw - 64px)',
          display: 'flex',
          flexDirection: 'column',
          overflow: activeTab === 'inbox' ? 'hidden' : 'auto',
          position: 'relative',
          backgroundColor: 'var(--bg-primary)',
        }}
      >
        {activeTab === 'inbox' && (
          <Inbox
            company={selectedCompany}
            isMobile={isMobile}
            onChatOpenChange={setIsChatOpen}
          />
        )}
        {activeTab === 'connection' && <WhatsAppConnection company={selectedCompany} />}
        {activeTab === 'settings' && <BotSettings company={selectedCompany} />}
        {activeTab === 'cinema' && <CinemaPreview company={selectedCompany} />}
      </main>

      {/* 3. Mobile Bottom Nav Rail (Visible only when not inside open chat) */}
      {isMobile && !hideNavOnMobileChat && (
        <NavRail
          companies={companies}
          selectedCompany={selectedCompany}
          onSelectCompany={setSelectedCompany}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          whatsappInstance={activeInstance}
          isMobile={true}
        />
      )}
    </div>
  );
}

export default App;
