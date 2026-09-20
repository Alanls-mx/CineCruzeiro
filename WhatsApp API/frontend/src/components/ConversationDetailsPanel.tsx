import React from 'react';
import type { Conversation } from '../types/index.js';
import { Avatar } from './ui/Avatar.js';
import { Badge } from './ui/Badge.js';
import {
  X,
  Phone,
  Calendar,
  Clock,
  UserCheck,
  MessageSquare,
  RotateCcw,
  RefreshCw,
} from 'lucide-react';

interface ConversationDetailsPanelProps {
  conversation: Conversation;
  onClose: () => void;
  onTakeover: () => void;
  onRelease: () => void;
  onCloseConversation: () => void;
  onSyncPicture: () => void;
  syncingPicture?: boolean;
  isMobile?: boolean;
}

export const ConversationDetailsPanel: React.FC<ConversationDetailsPanelProps> = ({
  conversation,
  onClose,
  onTakeover,
  onRelease,
  onCloseConversation,
  onSyncPicture,
  syncingPicture = false,
  isMobile = false,
}) => {
  const { contact } = conversation;

  return (
    <aside
      style={{
        position: isMobile ? 'absolute' : 'relative',
        top: 0,
        bottom: 0,
        right: 0,
        left: isMobile ? 0 : 'auto',
        width: isMobile ? '100%' : 'var(--details-panel-width)',
        minWidth: isMobile ? '100%' : 'var(--details-panel-width)',
        maxWidth: isMobile ? '100%' : 'var(--details-panel-width)',
        height: '100%',
        backgroundColor: 'var(--bg-secondary)',
        borderLeft: isMobile ? 'none' : '1px solid var(--separator)',
        display: 'flex',
        flexDirection: 'column',
        overflowY: 'auto',
        zIndex: 50,
        boxShadow: isMobile ? '0 0 40px rgba(0,0,0,0.8)' : 'none',
        flexShrink: 0,
      }}
    >
      {/* Header */}
      <div
        style={{
          height: '64px',
          padding: '0 20px',
          borderBottom: '1px solid var(--separator)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: '0.95rem', fontWeight: 600, color: '#FFFFFF' }}>
          Dados do Contato
        </span>
        <button
          type="button"
          onClick={onClose}
          className="icon-btn"
          title="Fechar painel"
        >
          <X size={18} />
        </button>
      </div>

      {/* Profile Overview */}
      <div
        style={{
          padding: '24px 20px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
          borderBottom: '1px solid var(--separator)',
        }}
      >
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <Avatar
            src={contact.profilePicture}
            name={contact.name || contact.phone}
            size="xl"
            isBot={conversation.mode === 'BOT'}
          />
          <button
            type="button"
            onClick={onSyncPicture}
            disabled={syncingPicture}
            title="Sincronizar foto real do WhatsApp"
            style={{
              position: 'absolute',
              bottom: '0',
              right: '0',
              width: '24px',
              height: '24px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-tertiary)',
              border: '1px solid var(--separator)',
              color: 'var(--text-primary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} className={syncingPicture ? 'spin' : ''} />
          </button>
        </div>

        <h3 style={{ fontSize: '1.15rem', fontWeight: 600, color: '#FFFFFF', marginBottom: '4px' }}>
          {contact.name || contact.phone}
        </h3>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '12px' }}>
          <Phone size={13} />
          <span>{contact.phone}</span>
        </div>

        {/* Status Badges */}
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center' }}>
          <Badge variant={conversation.mode === 'BOT' ? 'bot' : 'human'}>
            {conversation.mode === 'BOT' ? 'Automação ativa' : 'Atendente responsável'}
          </Badge>
          <Badge variant={conversation.status === 'OPEN' ? 'unread' : 'closed'}>
            {conversation.status === 'OPEN' ? 'Atendimento Aberto' : 'Encerrado'}
          </Badge>
        </div>
      </div>

      {/* Info Sections (iOS Table View Style) */}
      <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Atendimento Group */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
            ATENDIMENTO & FLUXO
          </div>
          <div className="ios-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Fluxo Ativo</span>
              <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{conversation.currentFlow || 'MAIN_MENU'}</span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Responsável</span>
              <span style={{ color: '#FFFFFF', fontWeight: 500, textAlign: 'right' }}>
                {conversation.context?.assignedAgent?.userName || 'Não atribuído'}
              </span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Etapa da automação</span>
              <span style={{ color: '#FFFFFF', fontWeight: 500 }}>{conversation.currentState || 'INITIAL'}</span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Não lidas</span>
              <span style={{ color: conversation.unreadCount > 0 ? 'var(--ios-green)' : '#FFFFFF', fontWeight: 600 }}>
                {conversation.unreadCount}
              </span>
            </div>
          </div>
        </div>

        {/* Timestamps Group */}
        <div>
          <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-tertiary)', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.04em' }}>
            REGISTROS
          </div>
          <div className="ios-card" style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Calendar size={14} />
                <span>Iniciado em</span>
              </div>
              <span style={{ color: '#FFFFFF' }}>
                {conversation.startedAt ? new Date(conversation.startedAt).toLocaleDateString('pt-BR') : 'Hoje'}
              </span>
            </div>
            <div style={{ height: '1px', backgroundColor: 'var(--separator)' }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.84rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)' }}>
                <Clock size={14} />
                <span>Última mensagem</span>
              </div>
              <span style={{ color: '#FFFFFF' }}>
                {new Date(conversation.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          {conversation.mode === 'BOT' ? (
            <button
              type="button"
              onClick={onTakeover}
              className="btn btn-primary"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', padding: '10px' }}
            >
              <UserCheck size={16} />
              Assumir como Atendente
            </button>
          ) : (
            <button
              type="button"
              onClick={onRelease}
              className="btn btn-secondary"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', padding: '10px' }}
            >
              <MessageSquare size={16} />
              Retomar automação
            </button>
          )}

          {conversation.status !== 'CLOSED' && (
            <button
              type="button"
              onClick={onCloseConversation}
              className="btn btn-ghost"
              style={{ width: '100%', borderRadius: 'var(--radius-md)', padding: '10px', color: 'var(--ios-red)' }}
            >
              <RotateCcw size={16} />
              Encerrar Atendimento
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
