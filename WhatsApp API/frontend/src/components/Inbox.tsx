import React, { useState, useEffect, useRef } from 'react';
import type { Company, Conversation, Message } from '../types/index.js';
import { api } from '../services/api.js';
import {
  ArrowUp,
  User,
  Bot,
  UserCheck,
  RotateCcw,
  CheckCheck,
  MessageCircleOff,
  Smile,
  Camera,
  Info,
  FileText,
  Download,
  Sparkles,
  ArrowDown,
  MoreVertical,
  Plus,
  Image as ImageIcon,
  RefreshCw,
  ChevronLeft,
} from 'lucide-react';
import { Avatar } from './ui/Avatar.js';
import { Badge } from './ui/Badge.js';
import { SegmentedControl } from './ui/SegmentedControl.js';
import { SearchField } from './ui/SearchField.js';
import { ConversationDetailsPanel } from './ConversationDetailsPanel.js';
import { EmojiPicker } from './EmojiPicker.js';
import { CameraCaptureModal } from './CameraCaptureModal.js';
import { FileAttachModal } from './FileAttachModal.js';
import { ConversationStatusModal } from './ConversationStatusModal.js';
import { StatusStoryModal } from './StatusStoryModal.js';

interface InboxProps {
  company: Company;
  isMobile?: boolean;
  onChatOpenChange?: (open: boolean) => void;
}

export const Inbox: React.FC<InboxProps> = ({ company, isMobile = false, onChatOpenChange }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'OPEN' | 'ALL' | 'CLOSED'>('OPEN');

  // Modals & Panels state
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showStatusModal, setShowStatusModal] = useState(false);
  const [showStatusStoryModal, setShowStatusStoryModal] = useState(false);
  const [showFileAttachModal, setShowFileAttachModal] = useState(false);
  const [showDetailsPanel, setShowDetailsPanel] = useState(false);
  const [showContextMenu, setShowContextMenu] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);

  // Attachment files
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedFileDataUrl, setSelectedFileDataUrl] = useState<string | null>(null);
  const [syncingPicture, setSyncingPicture] = useState(false);

  // Refs for scrolling and inputs
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);
  const [showScrollBottomBtn, setShowScrollBottomBtn] = useState(false);

  // ---------------------------------------------------------------------------
  // Deduplicated Message Appender
  // ---------------------------------------------------------------------------
  const appendMessageDeduplicated = (newMsg: Message) => {
    setMessages((prev) => {
      const exists = prev.some(
        (m) =>
          m.id === newMsg.id ||
          (m.externalMessageId && newMsg.externalMessageId && m.externalMessageId === newMsg.externalMessageId)
      );
      if (exists) return prev;
      return [...prev, newMsg];
    });
  };

  // ---------------------------------------------------------------------------
  // Smooth Internal Scroll to Bottom (Never scrolls window or parents)
  // ---------------------------------------------------------------------------
  const scrollToBottom = (force = false, smooth = true) => {
    if (!messagesContainerRef.current) return;
    if (isUserScrolledUpRef.current && !force) {
      return;
    }
    const container = messagesContainerRef.current;
    if (smooth) {
      container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' });
    } else {
      container.scrollTop = container.scrollHeight;
    }
  };

  const handleMessagesScroll = () => {
    if (!messagesContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
    const distanceFromBottom = scrollHeight - scrollTop - clientHeight;
    const isScrolledUp = distanceFromBottom > 150;
    isUserScrolledUpRef.current = isScrolledUp;
    setShowScrollBottomBtn(isScrolledUp);
  };

  // Notify parent if chat is open on mobile
  useEffect(() => {
    onChatOpenChange?.(!!selectedConversation);
  }, [selectedConversation, onChatOpenChange]);

  // ---------------------------------------------------------------------------
  // Data Fetching & Sync
  // ---------------------------------------------------------------------------
  const loadConversations = async () => {
    try {
      const data = await api.getConversations(
        company.id,
        statusFilter === 'ALL' ? undefined : statusFilter
      );
      setConversations(data);
      if (data.length > 0 && !selectedConversation && !isMobile) {
        setSelectedConversation(data[0]);
      }
    } catch (e) {
      console.error('Failed loading conversations', e);
    }
  };

  const loadMessages = async (convId: string) => {
    try {
      const msgs = await api.getMessages(company.id, convId);
      setMessages(msgs);
      isUserScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
      setTimeout(() => {
        scrollToBottom(true, false);
      }, 50);
    } catch (e) {
      console.error('Failed loading messages', e);
    }
  };

  useEffect(() => {
    loadConversations();
  }, [company.id, statusFilter]);

  useEffect(() => {
    if (selectedConversation) {
      loadMessages(selectedConversation.id);
    } else {
      setMessages([]);
    }
  }, [selectedConversation?.id]);

  // Setup Server-Sent Events (SSE) for Realtime Updates
  useEffect(() => {
    const eventSource = api.createEventSource(company.id);

    eventSource.addEventListener('message:new', (e: MessageEvent) => {
      try {
        const payload = JSON.parse(e.data);
        if (selectedConversation && payload.conversationId === selectedConversation.id) {
          appendMessageDeduplicated(payload.message);
          setTimeout(() => {
            scrollToBottom(false, true);
          }, 50);
        }
        loadConversations();
      } catch (err) {
        console.error('SSE message parse error', err);
      }
    });

    eventSource.addEventListener('conversation:update', (e: MessageEvent) => {
      try {
        const updated = JSON.parse(e.data);
        if (selectedConversation && selectedConversation.id === updated.id) {
          setSelectedConversation((prev) => (prev ? { ...prev, ...updated } : null));
        }
        loadConversations();
      } catch (err) {
        console.error('SSE conversation parse error', err);
      }
    });

    return () => {
      eventSource.close();
    };
  }, [company.id, selectedConversation?.id]);

  // ---------------------------------------------------------------------------
  // Message Sending Handlers
  // ---------------------------------------------------------------------------
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputText.trim() || !selectedConversation || sending) return;

    const textToSend = inputText.trim();
    setInputText('');
    setSending(true);

    try {
      const newMsg = await api.sendMessage(company.id, selectedConversation.id, textToSend);
      appendMessageDeduplicated(newMsg);
      isUserScrolledUpRef.current = false;
      setShowScrollBottomBtn(false);
      setTimeout(() => {
        scrollToBottom(true, true);
      }, 50);
      loadConversations();
    } catch (err: any) {
      alert(`Erro ao enviar mensagem: ${err.message}`);
    } finally {
      setSending(false);
    }
  };

  const handleTakeover = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await api.takeoverConversation(company.id, selectedConversation.id);
      setSelectedConversation(updated);
      setShowContextMenu(false);
      loadConversations();
    } catch (err: any) {
      alert(`Erro ao assumir conversa: ${err.message}`);
    }
  };

  const handleRelease = async () => {
    if (!selectedConversation) return;
    try {
      const updated = await api.releaseConversation(company.id, selectedConversation.id);
      setSelectedConversation(updated);
      setShowContextMenu(false);
      loadConversations();
    } catch (err: any) {
      alert(`Erro ao devolver ao bot: ${err.message}`);
    }
  };

  const handleClose = async () => {
    if (!selectedConversation) return;
    if (!confirm('Deseja realmente encerrar este atendimento?')) return;
    try {
      const updated = await api.closeConversation(company.id, selectedConversation.id);
      setSelectedConversation(updated);
      setShowContextMenu(false);
      loadConversations();
    } catch (err: any) {
      alert(`Erro ao encerrar conversa: ${err.message}`);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    e.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedFile(file);
      setSelectedFileDataUrl(reader.result as string);
      setShowFileAttachModal(true);
      setShowAttachMenu(false);
    };
    reader.readAsDataURL(file);
  };

  const handleSendAttachedFile = async (params: {
    fileDataUrl: string;
    fileName: string;
    fileType: string;
    caption: string;
  }) => {
    if (!selectedConversation) return;
    const newMsg = await api.sendMessage(company.id, selectedConversation.id, {
      text: params.caption,
      type: params.fileType,
      mediaUrl: params.fileDataUrl,
      fileName: params.fileName,
    });
    appendMessageDeduplicated(newMsg);
    isUserScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    setTimeout(() => {
      scrollToBottom(true, true);
    }, 50);
    loadConversations();
  };

  const handleSendCameraPhoto = async (base64Image: string, caption: string) => {
    if (!selectedConversation) return;
    const newMsg = await api.sendMessage(company.id, selectedConversation.id, {
      text: caption,
      type: 'IMAGE',
      mediaUrl: base64Image,
      fileName: `foto_${Date.now()}.jpg`,
    });
    appendMessageDeduplicated(newMsg);
    isUserScrolledUpRef.current = false;
    setShowScrollBottomBtn(false);
    setTimeout(() => {
      scrollToBottom(true, true);
    }, 50);
    loadConversations();
  };

  const handleSyncProfilePicture = async () => {
    if (!selectedConversation?.contact?.id || syncingPicture) return;
    try {
      setSyncingPicture(true);
      const res = await api.syncProfilePicture(company.id, selectedConversation.contact.id);
      if (res?.profilePictureUrl) {
        setSelectedConversation((prev) =>
          prev ? { ...prev, contact: { ...prev.contact, profilePicture: res.profilePictureUrl } } : null
        );
        setConversations((prev) =>
          prev.map((c) =>
            c.id === selectedConversation.id
              ? { ...c, contact: { ...c.contact, profilePicture: res.profilePictureUrl } }
              : c
          )
        );
      }
    } catch (err) {
      console.error('Failed to sync profile picture', err);
    } finally {
      setSyncingPicture(false);
    }
  };

  // Filter conversations by search text
  const filteredConversations = conversations.filter((conv) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const name = conv.contact?.name?.toLowerCase() || '';
    const phone = conv.contact?.phone?.toLowerCase() || '';
    const lastMsg = conv.messages?.[0]?.content?.toLowerCase() || '';
    return name.includes(q) || phone.includes(q) || lastMsg.includes(q);
  });

  // Deduplicate messages by id / externalMessageId to prevent duplicate rendering
  const uniqueMessages = React.useMemo(() => {
    const seen = new Set<string>();
    return messages.filter((msg) => {
      const key = msg.id || msg.externalMessageId;
      if (key && seen.has(key)) return false;
      if (key) seen.add(key);
      return true;
    });
  }, [messages]);

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'row',
        height: '100%',
        maxHeight: '100%',
        width: '100%',
        maxWidth: '100%',
        minHeight: 0,
        minWidth: 0,
        overflow: 'hidden',
        backgroundColor: 'var(--bg-primary)',
      }}
    >
      {/* =================================================================== */}
      {/* 1. Sidebar: WhatsApp Web Inspired Conversation List (380px)         */}
      {/* =================================================================== */}
      <div
        style={{
          width: isMobile ? '100%' : 'var(--sidebar-width)',
          minWidth: isMobile ? '100%' : 'var(--sidebar-width)',
          maxWidth: isMobile ? '100%' : 'var(--sidebar-width)',
          height: '100%',
          maxHeight: '100%',
          borderRight: isMobile ? 'none' : '1px solid var(--separator)',
          display: isMobile && selectedConversation ? 'none' : 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-secondary)',
          overflow: 'hidden',
          flexShrink: 0,
        }}
      >
        {/* Sidebar Header: iOS Navigation Bar Style */}
        <div
          style={{
            height: '64px',
            padding: '0 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderBottom: '1px solid var(--separator)',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.02em' }}>
              Conversas
            </h2>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {/* WhatsApp Status Story Button */}
            <button
              type="button"
              onClick={() => setShowStatusStoryModal(true)}
              title="Publicar no Status do WhatsApp (Stories 24h)"
              className="btn btn-sm"
              style={{
                background: 'rgba(255, 159, 10, 0.15)',
                color: 'var(--ios-orange)',
                border: '1px solid rgba(255, 159, 10, 0.3)',
                borderRadius: '9999px',
                padding: '4px 10px',
                gap: '5px',
                fontSize: '0.76rem',
                fontWeight: 600,
              }}
            >
              <Sparkles size={13} color="var(--ios-orange)" />
              Status
            </button>
          </div>
        </div>

        {/* Search & Filter Bar */}
        <div
          style={{
            padding: '10px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
            borderBottom: '1px solid var(--separator)',
            flexShrink: 0,
          }}
        >
          <SearchField
            value={searchQuery}
            onChange={setSearchQuery}
            placeholder="Buscar conversa..."
          />

          <SegmentedControl
            options={[
              { key: 'OPEN', label: 'Abertas' },
              { key: 'ALL', label: 'Todas' },
              { key: 'CLOSED', label: 'Fechadas' },
            ]}
            value={statusFilter}
            onChange={(v) => setStatusFilter(v as any)}
            size="sm"
          />
        </div>

        {/* Conversations Scrollable Feed */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            overflowY: 'auto',
            overflowX: 'hidden',
          }}
        >
          {filteredConversations.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                color: 'var(--text-tertiary)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <MessageCircleOff size={36} strokeWidth={1.5} style={{ opacity: 0.4 }} />
              <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Nenhuma conversa encontrada</span>
            </div>
          ) : (
            filteredConversations.map((conv) => {
              const isSelected = selectedConversation?.id === conv.id;
              const lastMsg = conv.messages?.[0];
              const contactName = conv.contact.name || conv.contact.phone;

              return (
                <div
                  key={conv.id}
                  onClick={() => setSelectedConversation(conv)}
                  style={{
                    position: 'relative',
                    padding: '12px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    cursor: 'pointer',
                    backgroundColor: isSelected ? 'rgba(255, 255, 255, 0.07)' : 'transparent',
                    borderLeft: isSelected ? '3px solid var(--ios-blue)' : '3px solid transparent',
                    transition: 'background-color 0.15s ease',
                  }}
                >
                  {/* Avatar */}
                  <Avatar
                    src={conv.contact.profilePicture}
                    name={contactName}
                    size="md"
                    isBot={conv.mode === 'BOT'}
                  />

                  {/* Conversation Row Text */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '3px' }}>
                      <span
                        style={{
                          fontWeight: 600,
                          fontSize: '0.92rem',
                          color: '#FFFFFF',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {contactName}
                      </span>

                      <span style={{ fontSize: '0.72rem', color: 'var(--text-tertiary)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {new Date(conv.lastMessageAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          color: conv.unreadCount > 0 ? '#FFFFFF' : 'var(--text-secondary)',
                          fontWeight: conv.unreadCount > 0 ? 500 : 400,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          maxWidth: '180px',
                        }}
                      >
                        {lastMsg ? lastMsg.content : 'Conversa iniciada'}
                      </span>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        <Badge variant={conv.mode === 'BOT' ? 'bot' : 'human'} size="sm">
                          {conv.mode}
                        </Badge>

                        {conv.unreadCount > 0 && (
                          <span
                            style={{
                              backgroundColor: 'var(--ios-green)',
                              color: '#000000',
                              fontSize: '0.7rem',
                              fontWeight: 700,
                              borderRadius: '9999px',
                              padding: '1px 6px',
                              minWidth: '18px',
                              textAlign: 'center',
                            }}
                          >
                            {conv.unreadCount}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Separator Hairline (iOS style) */}
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 0,
                      left: '72px',
                      right: 0,
                      height: '1px',
                      backgroundColor: 'var(--separator)',
                    }}
                  />
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. Main Chat Area: iMessage / Apple iOS Style                       */}
      {/* =================================================================== */}
      {selectedConversation ? (
        <div
          style={{
            flex: 1,
            height: '100%',
            maxHeight: '100%',
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            backgroundColor: '#08080A',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Chat Header */}
          <div
            style={{
              height: '64px',
              padding: isMobile ? '0 12px' : '0 20px',
              backgroundColor: 'var(--bg-secondary)',
              borderBottom: '1px solid var(--separator)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              zIndex: 10,
            }}
          >
            {/* Contact Info & Avatar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '4px' : '12px' }}>
              {isMobile && (
                <button
                  type="button"
                  onClick={() => setSelectedConversation(null)}
                  className="icon-btn"
                  title="Voltar para conversas"
                  style={{
                    padding: '4px',
                    marginRight: '2px',
                    color: 'var(--ios-blue)',
                  }}
                >
                  <ChevronLeft size={24} />
                </button>
              )}
              <div
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}
              >
                <Avatar
                  src={selectedConversation.contact.profilePicture}
                  name={selectedConversation.contact.name || selectedConversation.contact.phone}
                  size="md"
                  isBot={selectedConversation.mode === 'BOT'}
                  onClick={handleSyncProfilePicture}
                  title="Clique para atualizar foto do WhatsApp"
                />

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <h3 style={{ fontSize: '0.98rem', fontWeight: 600, color: '#FFFFFF' }}>
                      {selectedConversation.contact.name || selectedConversation.contact.phone}
                    </h3>
                    <Badge variant={selectedConversation.mode === 'BOT' ? 'bot' : 'human'} size="sm">
                      {selectedConversation.mode === 'BOT' ? 'Robô' : 'Humano'}
                    </Badge>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    <span>{selectedConversation.contact.phone}</span>
                    <span>•</span>
                    <span>Fluxo: {selectedConversation.currentFlow || 'MAIN_MENU'}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Header Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', position: 'relative' }}>
              {/* Quick Mode Switch Button */}
              {selectedConversation.mode === 'BOT' ? (
                <button
                  type="button"
                  onClick={handleTakeover}
                  className="btn btn-sm btn-primary"
                  title="Assumir conversa como atendente humano"
                >
                  <UserCheck size={14} />
                  Assumir
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleRelease}
                  className="btn btn-sm btn-secondary"
                  title="Devolver conversa ao fluxo automático do bot"
                >
                  <Bot size={14} />
                  Devolver
                </button>
              )}

              {/* Info / Details Drawer Button */}
              <button
                type="button"
                onClick={() => setShowDetailsPanel(!showDetailsPanel)}
                className="icon-btn"
                title="Ver dados do contato"
                style={{
                  color: showDetailsPanel ? 'var(--ios-blue)' : 'var(--text-secondary)',
                  backgroundColor: showDetailsPanel ? 'rgba(10, 132, 255, 0.15)' : 'transparent',
                }}
              >
                <Info size={18} />
              </button>

              {/* More Options Context Menu (•••) */}
              <div style={{ position: 'relative' }}>
                <button
                  type="button"
                  onClick={() => setShowContextMenu(!showContextMenu)}
                  className="icon-btn"
                  title="Mais opções"
                >
                  <MoreVertical size={18} />
                </button>

                {showContextMenu && (
                  <div
                    style={{
                      position: 'absolute',
                      top: '44px',
                      right: '0',
                      width: '210px',
                      backgroundColor: 'var(--bg-secondary)',
                      border: '1px solid var(--separator)',
                      borderRadius: 'var(--radius-md)',
                      boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                      backdropFilter: 'blur(24px)',
                      padding: '4px',
                      zIndex: 100,
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setShowStatusModal(true);
                        setShowContextMenu(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#FFFFFF',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <Info size={15} color="var(--ios-blue)" />
                      Ver Status Conexão
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        handleSyncProfilePicture();
                        setShowContextMenu(false);
                      }}
                      style={{
                        padding: '8px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        color: '#FFFFFF',
                        background: 'transparent',
                        border: 'none',
                        borderRadius: '8px',
                        fontSize: '0.84rem',
                        cursor: 'pointer',
                        textAlign: 'left',
                      }}
                    >
                      <RefreshCw size={15} color="var(--ios-green)" />
                      Atualizar Foto WhatsApp
                    </button>

                    <div style={{ height: '1px', backgroundColor: 'var(--separator)', margin: '2px 0' }} />

                    {selectedConversation.status !== 'CLOSED' && (
                      <button
                        type="button"
                        onClick={handleClose}
                        style={{
                          padding: '8px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          color: 'var(--ios-red)',
                          background: 'transparent',
                          border: 'none',
                          borderRadius: '8px',
                          fontSize: '0.84rem',
                          cursor: 'pointer',
                          textAlign: 'left',
                        }}
                      >
                        <RotateCcw size={15} />
                        Encerrar Atendimento
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Messages Scroll Area (Feed) */}
          <div
            ref={messagesContainerRef}
            onScroll={handleMessagesScroll}
            style={{
              flex: 1,
              height: '100%',
              minHeight: 0,
              width: '100%',
              maxWidth: '100%',
              overflowY: 'auto',
              overflowX: 'hidden',
              padding: '20px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: '6px',
              overscrollBehavior: 'contain',
              position: 'relative',
            }}
          >
            {/* Central Date Pill */}
            <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 16px' }}>
              <span
                style={{
                  padding: '4px 12px',
                  borderRadius: '9999px',
                  backgroundColor: 'rgba(255, 255, 255, 0.08)',
                  color: 'var(--text-secondary)',
                  fontSize: '0.72rem',
                  fontWeight: 500,
                  backdropFilter: 'blur(10px)',
                  letterSpacing: '0.02em',
                }}
              >
                Hoje
              </span>
            </div>

            {uniqueMessages.map((msg, index) => {
              const isCustomer = msg.direction === 'INBOUND';
              const isAgent = !isCustomer && msg.sender === 'AGENT';
              const isBot = !isCustomer && msg.sender === 'BOT';

              const nextMsg = uniqueMessages[index + 1];
              const isLastInGroup = !nextMsg || nextMsg.direction !== msg.direction;

              const mediaUrl = (msg.metadata as any)?.mediaUrl;
              const fileName = (msg.metadata as any)?.fileName;
              const isImage = msg.type === 'IMAGE' || (mediaUrl && (mediaUrl.startsWith('data:image') || mediaUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i)));
              const isDocument = msg.type === 'DOCUMENT' || (!isImage && mediaUrl);

              // Apple iMessage Bubble Colors
              let bubbleBg = 'var(--bubble-customer)'; // #2C2C2E
              if (isAgent) bubbleBg = 'var(--bubble-agent)'; // #0A84FF
              if (isBot) bubbleBg = 'var(--bubble-bot)'; // #1C6E5A

              return (
                <div
                  key={msg.id}
                  style={{
                    alignSelf: isCustomer ? 'flex-start' : 'flex-end',
                    maxWidth: '68%',
                    minWidth: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    marginBottom: isLastInGroup ? '8px' : '2px',
                  }}
                >
                  {/* Bubble Surface */}
                  <div
                    style={{
                      padding: '10px 14px',
                      borderRadius: '18px',
                      borderBottomLeftRadius: isCustomer && isLastInGroup ? '4px' : '18px',
                      borderBottomRightRadius: !isCustomer && isLastInGroup ? '4px' : '18px',
                      backgroundColor: bubbleBg,
                      color: '#FFFFFF',
                      fontSize: '0.92rem',
                      lineHeight: '1.45',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      overflowWrap: 'anywhere',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.25)',
                    }}
                  >
                    {/* Render Image Media if present */}
                    {isImage && mediaUrl && (
                      <div style={{ marginBottom: '8px', borderRadius: '12px', overflow: 'hidden' }}>
                        <img
                          src={mediaUrl}
                          alt="Mídia da conversa"
                          style={{
                            maxWidth: '100%',
                            maxHeight: '280px',
                            objectFit: 'contain',
                            borderRadius: '12px',
                            display: 'block',
                            cursor: 'pointer',
                          }}
                          onClick={() => {
                            const win = window.open();
                            win?.document.write(`<img src="${mediaUrl}" style="max-width:100%"/>`);
                          }}
                        />
                      </div>
                    )}

                    {/* Render Document Media if present */}
                    {isDocument && mediaUrl && (
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '10px',
                          padding: '8px 12px',
                          backgroundColor: 'rgba(0, 0, 0, 0.25)',
                          borderRadius: '10px',
                          marginBottom: msg.content ? '8px' : '0',
                        }}
                      >
                        <FileText size={20} color="var(--ios-teal)" />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.84rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {fileName || msg.content || 'Documento'}
                          </div>
                        </div>
                        <a
                          href={mediaUrl}
                          download={fileName || 'documento'}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--ios-green)', display: 'flex', alignItems: 'center' }}
                          title="Baixar arquivo"
                        >
                          <Download size={16} />
                        </a>
                      </div>
                    )}

                    {/* Message Content */}
                    {msg.content && (!msg.content.startsWith('📷 Foto') && !msg.content.startsWith('📎 ') || msg.type === 'TEXT') && (
                      <div>{msg.content}</div>
                    )}

                    {/* Inline Timestamp & Double Check (WhatsApp Web + iOS) */}
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'flex-end',
                        gap: '4px',
                        fontSize: '0.68rem',
                        color: isCustomer ? 'var(--text-tertiary)' : 'rgba(255, 255, 255, 0.7)',
                        marginTop: '4px',
                        fontVariantNumeric: 'tabular-nums',
                      }}
                    >
                      {isBot && <span>Lumix Bot • </span>}
                      <span>{new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span>
                      {!isCustomer && <CheckCheck size={13} color={isAgent ? '#FFFFFF' : 'var(--ios-green)'} />}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Floating button when scrolled up */}
            {showScrollBottomBtn && (
              <button
                type="button"
                onClick={() => {
                  isUserScrolledUpRef.current = false;
                  setShowScrollBottomBtn(false);
                  scrollToBottom(true, true);
                }}
                style={{
                  position: 'sticky',
                  bottom: '16px',
                  alignSelf: 'center',
                  zIndex: 20,
                  backgroundColor: 'rgba(28, 28, 30, 0.92)',
                  border: '1px solid var(--separator)',
                  color: 'var(--ios-blue)',
                  borderRadius: '9999px',
                  padding: '6px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '0.78rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 6px 18px rgba(0, 0, 0, 0.5)',
                  backdropFilter: 'blur(16px)',
                }}
              >
                <ArrowDown size={14} />
                Descer para o final
              </button>
            )}
          </div>

          {/* =============================================================== */}
          {/* Composer: WhatsApp Web + iMessage Rounded Floating Bar          */}
          {/* =============================================================== */}
          <div
            style={{
              padding: '12px 20px',
              backgroundColor: 'var(--bg-secondary)',
              borderTop: '1px solid var(--separator)',
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              position: 'relative',
              flexShrink: 0,
            }}
          >
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleFileChange}
              style={{ display: 'none' }}
              accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.txt,.csv"
            />

            {/* Emoji Picker Popover */}
            {showEmojiPicker && (
              <EmojiPicker
                onSelect={(emoji) => {
                  setInputText((prev) => prev + emoji);
                }}
                onClose={() => setShowEmojiPicker(false)}
              />
            )}

            {/* Attachments Popover Menu */}
            {showAttachMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '68px',
                  left: '20px',
                  width: '180px',
                  backgroundColor: 'var(--bg-secondary)',
                  border: '1px solid var(--separator)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: '0 12px 32px rgba(0, 0, 0, 0.6)',
                  backdropFilter: 'blur(24px)',
                  padding: '4px',
                  zIndex: 50,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#FFFFFF',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  <FileText size={16} color="var(--ios-blue)" />
                  Documento
                </button>

                <button
                  type="button"
                  onClick={() => {
                    fileInputRef.current?.click();
                    setShowAttachMenu(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#FFFFFF',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  <ImageIcon size={16} color="var(--ios-purple)" />
                  Fotos e Vídeos
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowCameraModal(true);
                    setShowAttachMenu(false);
                  }}
                  style={{
                    padding: '8px 12px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    color: '#FFFFFF',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                  }}
                >
                  <Camera size={16} color="var(--ios-green)" />
                  Tirar Foto
                </button>
              </div>
            )}

            {/* Quick Action Icon Buttons */}
            <button
              type="button"
              onClick={() => setShowAttachMenu(!showAttachMenu)}
              className="icon-btn"
              title="Anexar arquivo ou foto"
            >
              <Plus size={20} />
            </button>

            <button
              type="button"
              onClick={() => setShowCameraModal(true)}
              className="icon-btn"
              title="Abrir câmera"
            >
              <Camera size={20} />
            </button>

            <button
              type="button"
              onClick={() => setShowEmojiPicker(!showEmojiPicker)}
              className="icon-btn"
              title="Emojis"
            >
              <Smile size={20} />
            </button>

            {/* Rounded iOS Input Capsule */}
            <form
              onSubmit={handleSendMessage}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                backgroundColor: 'var(--bg-tertiary)',
                borderRadius: '24px',
                padding: '4px 6px 4px 16px',
                border: '1px solid var(--separator)',
              }}
            >
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder={
                  selectedConversation.mode === 'HUMAN'
                    ? 'Digite uma mensagem...'
                    : 'Aviso: Em modo BOT. Ao enviar, você assumirá a conversa.'
                }
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FFFFFF',
                  fontSize: '0.92rem',
                  padding: '6px 0',
                }}
              />

              {/* iOS Arrow Up Circular Send Button */}
              <button
                type="submit"
                disabled={!inputText.trim() || sending}
                title="Enviar mensagem"
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: inputText.trim() ? 'var(--ios-blue)' : 'rgba(255, 255, 255, 0.1)',
                  color: '#FFFFFF',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: inputText.trim() && !sending ? 'pointer' : 'default',
                  transition: 'all 0.18s ease',
                  flexShrink: 0,
                }}
              >
                <ArrowUp size={16} strokeWidth={2.5} />
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div
          style={{
            flex: 1,
            height: '100%',
            display: isMobile ? 'none' : 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: '#08080A',
            color: 'var(--text-tertiary)',
            gap: '12px',
          }}
        >
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: 'var(--bg-secondary)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              border: '1px solid var(--separator)',
            }}
          >
            <User size={32} style={{ opacity: 0.35 }} />
          </div>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
            Selecione uma conversa para iniciar o atendimento
          </h3>
        </div>
      )}

      {/* =================================================================== */}
      {/* 3. Contextual Right Details Panel (Apple iOS Style)                  */}
      {/* =================================================================== */}
      {selectedConversation && showDetailsPanel && (
        <ConversationDetailsPanel
          conversation={selectedConversation}
          onClose={() => setShowDetailsPanel(false)}
          onTakeover={handleTakeover}
          onRelease={handleRelease}
          onCloseConversation={handleClose}
          onSyncPicture={handleSyncProfilePicture}
          syncingPicture={syncingPicture}
          isMobile={isMobile}
        />
      )}

      {/* Camera Capture Modal */}
      <CameraCaptureModal
        isOpen={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onSendPhoto={handleSendCameraPhoto}
      />

      {/* File Attach Modal */}
      <FileAttachModal
        isOpen={showFileAttachModal}
        file={selectedFile}
        fileDataUrl={selectedFileDataUrl}
        onClose={() => {
          setShowFileAttachModal(false);
          setSelectedFile(null);
          setSelectedFileDataUrl(null);
        }}
        onSendFile={handleSendAttachedFile}
      />

      {/* Conversation & WhatsApp Status Modal */}
      <ConversationStatusModal
        isOpen={showStatusModal}
        conversation={selectedConversation}
        onClose={() => setShowStatusModal(false)}
        onTakeover={handleTakeover}
        onRelease={handleRelease}
        onCloseConversation={handleClose}
      />

      {/* WhatsApp Status Story (Stories 24h) Modal */}
      <StatusStoryModal
        isOpen={showStatusStoryModal}
        companyId={company.id}
        onClose={() => setShowStatusStoryModal(false)}
        onSuccess={() => {
          // Status posted
        }}
      />
    </div>
  );
};
