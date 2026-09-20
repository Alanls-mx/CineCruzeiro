import React, { useState, useEffect } from 'react';
import type { Company, WhatsAppInstance } from '../types/index.js';
import { api } from '../services/api.js';
import { QrCode, RefreshCw, PowerOff, CheckCircle2, AlertCircle, Smartphone } from 'lucide-react';
import { Badge } from './ui/Badge.js';

interface WhatsAppConnectionProps {
  company: Company;
}

export const WhatsAppConnection: React.FC<WhatsAppConnectionProps> = ({ company }) => {
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [loading, setLoading] = useState(false);
  const [qrCodeData, setQrCodeData] = useState<{ base64?: string; code?: string } | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadInstances = async () => {
    try {
      setLoading(true);
      const data = await api.getInstances(company.id);
      setInstances(data);
    } catch (err: any) {
      setFeedback(`Erro ao carregar instâncias: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstances();
    setQrCodeData(null);
  }, [company.id]);

  const activeInstance = instances[0] || null;

  // Poll connection status and auto-refresh QR Code while waiting for scan
  useEffect(() => {
    if (!activeInstance || activeInstance.status === 'CONNECTED') return;

    const interval = setInterval(async () => {
      try {
        const updated = await api.getStatus(company.id, activeInstance.id);
        if (updated.status === 'CONNECTED') {
          setQrCodeData(null);
          setFeedback('WhatsApp conectado com sucesso.');
          loadInstances();
          return;
        }

        if (qrCodeData) {
          const qrRes = await api.getQrCode(company.id, activeInstance.id);
          if (qrRes.qrcode?.base64 && qrRes.qrcode.base64 !== qrCodeData.base64) {
            setQrCodeData(qrRes.qrcode);
          }
        }
      } catch {
        // silent check
      }
    }, 4000);

    return () => clearInterval(interval);
  }, [activeInstance?.id, activeInstance?.status, company.id, qrCodeData?.base64]);

  const handleConnect = async () => {
    try {
      setLoading(true);
      setFeedback(null);

      let targetId = activeInstance?.id;

      if (!targetId) {
        const instanceSlug = `${company.slug}-whatsapp`;
        const res = await api.createInstance(company.id, instanceSlug);
        targetId = res.instance.id;
        if (res.qrcode?.base64) {
          setQrCodeData(res.qrcode);
        }
      }

      const connectResult = await api.connectInstance(company.id, targetId);
      if (connectResult.qrcode?.base64) {
        setQrCodeData(connectResult.qrcode);
        setFeedback('Aponte a câmera do seu WhatsApp para o QR Code abaixo:');
      } else if (connectResult.status === 'CONNECTED') {
        setFeedback('WhatsApp já está conectado!');
      }

      await loadInstances();
    } catch (err: any) {
      setFeedback(`Erro ao conectar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async () => {
    if (!activeInstance) return;
    if (!confirm('Deseja desconectar esta sessão do WhatsApp? A automação e os atendentes não receberão novas mensagens até que ela seja reconectada.')) return;

    try {
      setLoading(true);
      await api.disconnectInstance(company.id, activeInstance.id);
      setQrCodeData(null);
      setFeedback('WhatsApp desconectado.');
      await loadInstances();
    } catch (err: any) {
      setFeedback(`Erro ao desconectar: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const isConnected = activeInstance?.status === 'CONNECTED';

  return (
    <div
      style={{
        flex: 1,
        height: '100%',
        overflowY: 'auto',
        backgroundColor: 'var(--bg-primary)',
        padding: '32px 40px',
      }}
    >
      <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {/* Header */}
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em', marginBottom: '4px' }}>
            Conexão WhatsApp
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Gerencie o pareamento e a sessão da Evolution API para {company.name}.
          </p>
        </div>

        {/* Feedback Alert if any */}
        {feedback && (
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              backgroundColor: feedback.includes('Erro') ? 'rgba(255, 69, 58, 0.12)' : 'rgba(48, 209, 88, 0.12)',
              border: `1px solid ${feedback.includes('Erro') ? 'rgba(255, 69, 58, 0.3)' : 'rgba(48, 209, 88, 0.3)'}`,
              color: feedback.includes('Erro') ? 'var(--ios-red)' : 'var(--ios-green)',
              fontSize: '0.88rem',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
            }}
          >
            {feedback.includes('Erro') ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{feedback}</span>
          </div>
        )}

        {/* Main Connection Card */}
        <div className="ios-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Status Row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: isConnected ? 'rgba(48, 209, 88, 0.15)' : 'rgba(255, 69, 58, 0.15)',
                  border: `1px solid ${isConnected ? 'rgba(48, 209, 88, 0.3)' : 'rgba(255, 69, 58, 0.3)'}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: isConnected ? 'var(--ios-green)' : 'var(--ios-red)',
                }}
              >
                <Smartphone size={24} />
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: '#FFFFFF' }}>
                    Cine Cruzeiro WhatsApp
                  </h3>
                  <Badge variant={isConnected ? 'unread' : 'closed'}>
                    {isConnected ? 'Conectado' : 'Desconectado'}
                  </Badge>
                </div>
                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  {activeInstance?.phoneNumber ? `Número pareado: ${activeInstance.phoneNumber}` : 'Nenhum número pareado'}
                </div>
              </div>
            </div>

            {/* Quick Action Button */}
            {isConnected ? (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={loading}
                className="btn btn-ghost"
                style={{ color: 'var(--ios-red)', gap: '6px' }}
              >
                <PowerOff size={16} />
                Desconectar
              </button>
            ) : (
              <button
                type="button"
                onClick={handleConnect}
                disabled={loading}
                className="btn btn-primary"
                style={{ gap: '6px' }}
              >
                {loading ? <RefreshCw size={16} className="spin" /> : <QrCode size={16} />}
                {qrCodeData ? 'Atualizar QR' : 'Conectar WhatsApp'}
              </button>
            )}
          </div>

          {/* QR Code Display when pairing */}
          {!isConnected && qrCodeData && (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                padding: '24px',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-md)',
                gap: '16px',
                border: '1px solid var(--separator)',
              }}
            >
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#FFFFFF',
                  borderRadius: '16px',
                  boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
                }}
              >
                {qrCodeData.base64 ? (
                  <img
                    src={qrCodeData.base64}
                    alt="WhatsApp QR Code"
                    style={{ width: '220px', height: '220px', display: 'block' }}
                  />
                ) : (
                  <div style={{ width: '220px', height: '220px', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000' }}>
                    QR Code gerado
                  </div>
                )}
              </div>

              {/* Instructions */}
              <div style={{ textAlign: 'center', maxWidth: '340px' }}>
                <h4 style={{ color: '#FFFFFF', fontSize: '0.92rem', fontWeight: 600, marginBottom: '6px' }}>
                  Escaneie o código com seu WhatsApp
                </h4>
                <ol
                  style={{
                    color: 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    textAlign: 'left',
                    lineHeight: '1.6',
                    paddingLeft: '20px',
                  }}
                >
                  <li>Abra o WhatsApp no seu smartphone</li>
                  <li>Toque em <strong>Configurações</strong> ou <strong>Mais opções</strong></li>
                  <li>Selecione <strong>Aparelhos conectados</strong> e <strong>Conectar aparelho</strong></li>
                  <li>Aponte a câmera para esta tela</li>
                </ol>
              </div>
            </div>
          )}

          {/* Instance metadata list */}
          <div style={{ borderTop: '1px solid var(--separator)', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Provedor</span>
              <span style={{ color: '#FFFFFF', fontWeight: 500 }}>Evolution API (Baileys)</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Status da Sessão</span>
              <span style={{ color: isConnected ? 'var(--ios-green)' : 'var(--text-tertiary)', fontWeight: 600 }}>
                {activeInstance?.status || 'DISCONNECTED'}
              </span>
            </div>
            {activeInstance?.connectedAt && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Conectado em</span>
                <span style={{ color: '#FFFFFF' }}>
                  {new Date(activeInstance.connectedAt).toLocaleString('pt-BR')}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
