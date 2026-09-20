import React from 'react';
import type { Conversation } from '../types/index.js';
import {
  X,
  User,
  Phone,
  MessageSquare,
  UserCheck,
  RotateCcw,
  Clock,
  Radio,
  CheckCircle2,
  Calendar,
  Layers,
} from 'lucide-react';

interface ConversationStatusModalProps {
  isOpen: boolean;
  conversation: Conversation | null;
  onClose: () => void;
  onTakeover: () => void;
  onRelease: () => void;
  onCloseConversation: () => void;
}

export const ConversationStatusModal: React.FC<ConversationStatusModalProps> = ({
  isOpen,
  conversation,
  onClose,
  onTakeover,
  onRelease,
  onCloseConversation,
}) => {
  if (!isOpen || !conversation) return null;

  const formatDate = (dateStr?: string | Date) => {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'OPEN':
        return <span className="badge badge-connected">● Em Aberto</span>;
      case 'CLOSED':
        return <span className="badge badge-disconnected">● Encerrado</span>;
      default:
        return <span className="badge badge-connecting">● Aguardando</span>;
    }
  };

  const getModeBadge = (mode: string) => {
    switch (mode) {
      case 'BOT':
        return <span className="badge badge-bot">Automação ativa</span>;
      case 'HUMAN':
        return <span className="badge badge-human">Atendente responsável</span>;
      default:
        return <span className="badge badge-connecting">Pausado</span>;
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(5, 8, 15, 0.85)',
        backdropFilter: 'blur(8px)',
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '580px',
          background: '#111622',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '12px',
                background: 'rgba(56, 189, 248, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#38bdf8',
              }}
            >
              <Radio size={22} />
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.1rem', fontWeight: 700 }}>
                Atendimento pelo WhatsApp
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem' }}>
                Detalhes da sessão, conexão e fluxo ativo
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '6px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div
          style={{
            padding: '24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {/* Contact Card */}
          <div
            style={{
              padding: '16px 20px',
              background: 'rgba(255, 255, 255, 0.04)',
              borderRadius: '14px',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  background: 'var(--bg-tertiary)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 700,
                  overflow: 'hidden',
                  border: '2px solid rgba(37, 211, 102, 0.3)',
                  flexShrink: 0,
                }}
              >
                {conversation.contact.profilePicture ? (
                  <img
                    src={conversation.contact.profilePicture}
                    alt={conversation.contact.name || conversation.contact.phone}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  conversation.contact.name?.charAt(0) || <User size={22} />
                )}
              </div>
              <div>
                <h4 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
                  {conversation.contact.name || conversation.contact.phone}
                </h4>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#94a3b8', fontSize: '0.85rem' }}>
                  <Phone size={14} />
                  <span>{conversation.contact.phone}</span>
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
              {getStatusBadge(conversation.status)}
              {getModeBadge(conversation.mode)}
            </div>
          </div>

          {/* Status Details Grid */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: '12px',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                <Layers size={14} /> Fluxo automático
              </div>
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '0.95rem' }}>
                {conversation.currentFlow || 'MAIN_MENU'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                Estado: {conversation.currentState || 'INITIAL'}
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                <CheckCircle2 size={14} /> Conexão WhatsApp
              </div>
              <div style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.95rem' }}>
                Ativa (Evolution API)
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: '0.75rem', marginTop: '2px' }}>
                Canal conectado ao Cine Cruzeiro
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                <Clock size={14} /> Última Interação
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                {formatDate(conversation.lastMessageAt)}
              </div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                background: 'rgba(255, 255, 255, 0.02)',
                borderRadius: '12px',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#94a3b8', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                <Calendar size={14} /> Início da Conversa
              </div>
              <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>
                {formatDate(conversation.createdAt || conversation.startedAt || conversation.lastMessageAt)}
              </div>
            </div>
          </div>

          {/* Quick Actions Panel */}
          <div
            style={{
              padding: '16px',
              background: 'rgba(37, 211, 102, 0.05)',
              borderRadius: '14px',
              border: '1px solid rgba(37, 211, 102, 0.15)',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px',
            }}
          >
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: '#25D366', textTransform: 'uppercase' }}>
              Ações do atendimento
            </span>

            <div style={{ display: 'flex', gap: '10px' }}>
              {conversation.mode === 'BOT' ? (
                <button
                  type="button"
                  onClick={() => {
                    onTakeover();
                    onClose();
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                >
                  <UserCheck size={16} /> Assumir atendimento
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onRelease();
                    onClose();
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, borderColor: '#38bdf8', color: '#38bdf8' }}
                >
                  <MessageSquare size={16} /> Retomar automação
                </button>
              )}

              {conversation.status !== 'CLOSED' && (
                <button
                  type="button"
                  onClick={() => {
                    onCloseConversation();
                    onClose();
                  }}
                  className="btn btn-secondary"
                  style={{ borderColor: 'rgba(244, 63, 94, 0.3)', color: '#fb7185' }}
                >
                  <RotateCcw size={16} /> Encerrar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(255, 255, 255, 0.02)',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary btn-sm">
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
