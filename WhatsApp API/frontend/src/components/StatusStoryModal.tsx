import React, { useState, useRef } from 'react';
import { X, Send, Image as ImageIcon, Type, MessageSquare, AlertCircle, CheckCircle2, Upload, CalendarDays } from 'lucide-react';
import { api } from '../services/api.js';

interface StatusStoryModalProps {
  isOpen: boolean;
  companyId: string;
  onClose: () => void;
  onSuccess?: () => void;
}

const STORY_COLORS = [
  { name: 'Dourado Cine Cruzeiro', hex: '#facc15' },
  { name: 'Azul do painel', hex: '#2563eb' },
  { name: 'Azul programação', hex: '#38bdf8' },
  { name: 'Verde disponibilidade', hex: '#34d399' },
  { name: 'Vermelho aviso', hex: '#f43f5e' },
  { name: 'Roxo sessão especial', hex: '#e879f9' },
  { name: 'Grafite', hex: '#0f172a' },
  { name: 'Azul escuro', hex: '#162641' },
];

const STATUS_TEMPLATES = [
  {
    id: 'programacao',
    label: 'Programação',
    color: '#162641',
    text: '🎬 Confira a programação do Cine Cruzeiro. Escolha sua sessão e garanta o ingresso antes de chegar.',
  },
  {
    id: 'estreia',
    label: 'Estreia',
    color: '#facc15',
    text: '🎬 Estreia no Cine Cruzeiro. Consulte os horários e garanta sua poltrona para a próxima sessão.',
  },
  {
    id: 'promocao',
    label: 'Promoção',
    color: '#2563eb',
    text: '🍿 Tem novidade no Cine Cruzeiro. Confira a programação e os benefícios disponíveis para a sua próxima visita.',
  },
  {
    id: 'aviso',
    label: 'Aviso',
    color: '#0f172a',
    text: '📌 Aviso importante: consulte os horários atualizados antes de sair de casa.',
  },
];

export const StatusStoryModal: React.FC<StatusStoryModalProps> = ({
  isOpen,
  companyId,
  onClose,
  onSuccess,
}) => {
  const [activeTab, setActiveTab] = useState<'text' | 'image'>('text');
  const [textContent, setTextContent] = useState('');
  const [selectedColor, setSelectedColor] = useState(STORY_COLORS[0].hex);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [imageCaption, setImageCaption] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione um arquivo de imagem válido (JPG, PNG, WebP).');
      return;
    }

    setError(null);
    setImageFile(file);
    const reader = new FileReader();
    reader.onload = () => {
      setImageDataUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handlePublish = async () => {
    setError(null);
    setLoading(true);

    try {
      if (activeTab === 'text') {
        if (!textContent.trim()) {
          setError('Digite algum texto para publicar no Status.');
          setLoading(false);
          return;
        }

        await api.publishStatus(companyId, {
          type: 'text',
          text: textContent.trim(),
          backgroundColor: selectedColor,
          font: 1,
        });
      } else {
        if (!imageDataUrl) {
          setError('Selecione uma imagem para o Story.');
          setLoading(false);
          return;
        }

        await api.publishStatus(companyId, {
          type: 'image',
          mediaUrl: imageDataUrl,
          caption: imageCaption.trim() || undefined,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setTextContent('');
        setImageFile(null);
        setImageDataUrl(null);
        setImageCaption('');
        onSuccess?.();
        onClose();
      }, 1500);
    } catch (err: any) {
      console.error('Error publishing status', err);
      setError(err.message || 'Falha ao publicar no Status do WhatsApp');
    } finally {
      setLoading(false);
    }
  };

  const applyTemplate = (template: (typeof STATUS_TEMPLATES)[number]) => {
    setActiveTab('text');
    setTextContent(template.text);
    setSelectedColor(template.color);
    setError(null);
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
          maxWidth: '940px',
          background: '#111622',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '10px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
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
                borderRadius: '8px',
                background: '#162641',
                border: '1px solid #2c4a70',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  borderRadius: '6px',
                  background: '#162641',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <MessageSquare size={20} color="#facc15" />
              </div>
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ color: '#fff', fontSize: '1.2rem', fontWeight: 700 }}>
                  Criar Status
                </h2>
                <span
                  style={{
                    background: 'rgba(250, 204, 21, 0.15)',
                    color: '#facc15',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '9999px',
                    border: '1px solid rgba(250, 204, 21, 0.28)',
                  }}
                >
                  24 HORAS
                </span>
              </div>
              <p style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '2px' }}>
                Publique uma comunicação clara para os contatos conectados ao WhatsApp
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
              borderRadius: '8px',
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.06)',
            background: 'rgba(0, 0, 0, 0.2)',
          }}
        >
          <button
            type="button"
            onClick={() => setActiveTab('text')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: activeTab === 'text' ? '1px solid #facc15' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeTab === 'text' ? 'rgba(250, 204, 21, 0.10)' : 'transparent',
              color: activeTab === 'text' ? '#facc15' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <Type size={18} />
            Texto
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('image')}
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              border: activeTab === 'image' ? '1px solid #38bdf8' : '1px solid rgba(255, 255, 255, 0.08)',
              background: activeTab === 'image' ? 'rgba(56, 189, 248, 0.12)' : 'transparent',
              color: activeTab === 'image' ? '#38bdf8' : '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            <ImageIcon size={18} />
            Imagem
          </button>
        </div>

        {/* Content Body with Live Preview */}
        <div
          style={{
            padding: '24px',
            overflowY: 'auto',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: '24px',
          }}
        >
          {/* Controls Column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {error && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: '10px',
                  color: '#f87171',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {success && (
              <div
                style={{
                  padding: '10px 14px',
                  background: 'rgba(37, 211, 102, 0.15)',
                  border: '1px solid rgba(37, 211, 102, 0.3)',
                  borderRadius: '10px',
                  color: '#4ade80',
                  fontSize: '0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
              >
                <CheckCircle2 size={16} />
                <span>Status publicado no WhatsApp com sucesso!</span>
              </div>
            )}

            {activeTab === 'text' ? (
              <>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600 }}>
                      Modelos rápidos
                    </label>
                    <span style={{ color: '#64748b', fontSize: '0.75rem' }}>Edite antes de publicar</span>
                  </div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {STATUS_TEMPLATES.map((template) => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => applyTemplate(template)}
                        style={{
                          border: '1px solid rgba(148, 163, 184, 0.22)',
                          background: 'rgba(15, 23, 42, 0.7)',
                          color: '#cbd5e1',
                          borderRadius: '6px',
                          padding: '7px 10px',
                          fontSize: '0.78rem',
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                    <label style={{ color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600 }}>
                      Texto do Status
                    </label>
                    <span style={{ color: textContent.length > 650 ? '#f87171' : '#64748b', fontSize: '0.75rem' }}>{textContent.length}/700</span>
                  </div>
                  <textarea
                    value={textContent}
                    onChange={(e) => setTextContent(e.target.value)}
                    placeholder="Escreva uma mensagem clara, com uma chamada para a programação."
                    rows={4}
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '6px',
                      color: '#fff',
                      fontSize: '0.92rem',
                      fontFamily: 'inherit',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>
                    Cor de Fundo do Story
                  </label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {STORY_COLORS.map((col) => (
                      <button
                        key={col.hex}
                        type="button"
                        onClick={() => setSelectedColor(col.hex)}
                        title={col.name}
                        style={{
                          width: '34px',
                          height: '34px',
                          borderRadius: '6px',
                          background: col.hex,
                          border: selectedColor === col.hex ? '3px solid #ffffff' : '2px solid rgba(255, 255, 255, 0.2)',
                          cursor: 'pointer',
                          transform: selectedColor === col.hex ? 'translateY(-2px)' : 'translateY(0)',
                          transition: 'all 0.2s',
                        }}
                      />
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <>
                <div>
                  <label style={{ display: 'block', color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>
                    Escolher Imagem
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                  />
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      border: '2px dashed rgba(56, 189, 248, 0.3)',
                      borderRadius: '6px',
                      padding: '24px',
                      textAlign: 'center',
                      background: 'rgba(56, 189, 248, 0.03)',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <Upload size={28} color="#38bdf8" />
                    <div>
                      <div style={{ color: '#fff', fontWeight: 600, fontSize: '0.9rem' }}>
                        {imageFile ? imageFile.name : 'Clique para selecionar uma foto'}
                      </div>
                      <div style={{ color: '#94a3b8', fontSize: '0.75rem', marginTop: '2px' }}>
                        PNG, JPG ou WebP (alta resolução suportada)
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', color: '#f1f5f9', fontSize: '0.88rem', fontWeight: 600, marginBottom: '8px' }}>
                    Legenda da Foto (Opcional)
                  </label>
                  <input
                    type="text"
                    value={imageCaption}
                    onChange={(e) => setImageCaption(e.target.value)}
                    placeholder="Adicionar legenda para acompanhar a imagem"
                    style={{
                      width: '100%',
                      padding: '12px 14px',
                      background: 'rgba(255, 255, 255, 0.05)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                      borderRadius: '12px',
                      color: '#fff',
                      fontSize: '0.9rem',
                      outline: 'none',
                    }}
                  />
                </div>
              </>
            )}
          </div>

          {/* Right Column: Live Status Preview */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.05em' }}>
              <CalendarDays size={13} /> Prévia do Status
            </div>
            <div
              style={{
                width: '220px',
                height: '390px',
                borderRadius: '8px',
                border: '1px solid #334155',
                overflow: 'hidden',
                position: 'relative',
                background: activeTab === 'text' ? selectedColor : '#000',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '16px',
                textAlign: 'center',
                boxShadow: '0 14px 34px rgba(0, 0, 0, 0.45)',
              }}
            >
              {/* WhatsApp Story top progress bar mockup */}
              <div
                style={{
                  position: 'absolute',
                  top: '10px',
                  left: '12px',
                  right: '12px',
                  height: '3px',
                  background: 'rgba(255, 255, 255, 0.4)',
                  borderRadius: '2px',
                  overflow: 'hidden',
                }}
              >
                <div style={{ width: '60%', height: '100%', background: '#fff' }} />
              </div>

              {activeTab === 'text' ? (
                <div
                  style={{
                    color: '#ffffff',
                    fontWeight: 700,
                    fontSize: '0.9rem',
                    lineHeight: '1.4',
                    wordBreak: 'break-word',
                    textShadow: '0 1px 4px rgba(0,0,0,0.4)',
                  }}
                >
                  {textContent || 'Seu texto de Story aqui...'}
                </div>
              ) : imageDataUrl ? (
                <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                  <img
                    src={imageDataUrl}
                    alt="Prévia do Status"
                    style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 0 }}
                  />
                  {imageCaption && (
                    <div
                      style={{
                        position: 'absolute',
                        bottom: '12px',
                        left: '8px',
                        right: '8px',
                        background: 'rgba(0, 0, 0, 0.7)',
                        backdropFilter: 'blur(4px)',
                        padding: '4px 8px',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 600,
                        textAlign: 'center',
                      }}
                    >
                      {imageCaption}
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ color: '#64748b', fontSize: '0.75rem', textAlign: 'center' }}>
                  <ImageIcon size={32} style={{ opacity: 0.3, marginBottom: '6px' }} />
                  <div>Nenhuma foto selecionada</div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'flex-end',
            gap: '12px',
            background: 'rgba(0, 0, 0, 0.25)',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: '10px 18px',
              borderRadius: '6px',
              background: 'transparent',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#94a3b8',
              fontWeight: 600,
              fontSize: '0.88rem',
              cursor: 'pointer',
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={loading || success}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 22px',
              borderRadius: '6px',
              background: '#facc15',
              border: 'none',
              color: '#0b1220',
              fontWeight: 700,
              fontSize: '0.9rem',
              cursor: loading || success ? 'not-allowed' : 'pointer',
              opacity: loading || success ? 0.7 : 1,
              boxShadow: '0 4px 14px rgba(250, 204, 21, 0.2)',
            }}
          >
            <Send size={16} />
            {loading ? 'Publicando...' : success ? 'Publicado!' : 'Publicar por 24 horas'}
          </button>
        </div>
      </div>
    </div>
  );
};
