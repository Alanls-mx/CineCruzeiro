import React, { useState } from 'react';
import { FileText, Image as ImageIcon, Film, Music, File, X, Send } from 'lucide-react';

interface FileAttachModalProps {
  isOpen: boolean;
  file: File | null;
  fileDataUrl: string | null;
  onClose: () => void;
  onSendFile: (params: {
    fileDataUrl: string;
    fileName: string;
    fileType: string;
    caption: string;
  }) => Promise<void>;
}

export const FileAttachModal: React.FC<FileAttachModalProps> = ({
  isOpen,
  file,
  fileDataUrl,
  onClose,
  onSendFile,
}) => {
  const [caption, setCaption] = useState<string>('');
  const [sending, setSending] = useState<boolean>(false);

  if (!isOpen || !file || !fileDataUrl) return null;

  const isImage = file.type.startsWith('image/');
  const isVideo = file.type.startsWith('video/');
  const isAudio = file.type.startsWith('audio/');
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = () => {
    if (isImage) return <ImageIcon size={42} color="#38bdf8" />;
    if (isVideo) return <Film size={42} color="#a855f7" />;
    if (isAudio) return <Music size={42} color="#f59e0b" />;
    if (isPdf) return <FileText size={42} color="#f43f5e" />;
    return <File size={42} color="#94a3b8" />;
  };

  const handleSend = async () => {
    if (sending) return;
    setSending(true);

    try {
      const type = isImage ? 'IMAGE' : isVideo ? 'VIDEO' : isAudio ? 'AUDIO' : 'DOCUMENT';
      await onSendFile({
        fileDataUrl,
        fileName: file.name,
        fileType: type,
        caption,
      });
      setCaption('');
      onClose();
    } catch (err: any) {
      alert(`Erro ao enviar anexo: ${err.message || 'Falha no envio'}`);
    } finally {
      setSending(false);
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
          maxWidth: '560px',
          background: '#111622',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          borderRadius: '20px',
          boxShadow: '0 24px 60px rgba(0, 0, 0, 0.8)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.02)',
          }}
        >
          <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
            Enviar Anexo
          </h3>
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

        {/* Preview Area */}
        <div
          style={{
            padding: '28px 24px',
            background: '#0a0d14',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '260px',
            maxHeight: '380px',
            overflow: 'hidden',
          }}
        >
          {isImage ? (
            <img
              src={fileDataUrl}
              alt="Pré-visualização do anexo"
              style={{
                maxWidth: '100%',
                maxHeight: '280px',
                objectFit: 'contain',
                borderRadius: '12px',
                boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
              }}
            />
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                padding: '24px',
                background: 'rgba(255, 255, 255, 0.04)',
                borderRadius: '16px',
                border: '1px solid rgba(255, 255, 255, 0.08)',
                width: '100%',
                maxWidth: '380px',
              }}
            >
              <div style={{ marginBottom: '14px' }}>{getFileIcon()}</div>
              <span
                style={{
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  maxWidth: '100%',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {file.name}
              </span>
              <span style={{ color: '#94a3b8', fontSize: '0.8rem', marginTop: '4px' }}>
                {formatFileSize(file.size)} • {file.type || 'Documento'}
              </span>
            </div>
          )}
        </div>

        {/* Input and Actions Footer */}
        <div
          style={{
            padding: '18px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(17, 22, 34, 0.95)',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
          }}
        >
          <input
            type="text"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Adicionar legenda (opcional)"
            autoFocus
            style={{
              width: '100%',
              padding: '12px 16px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '10px',
              color: '#fff',
              fontSize: '0.9rem',
              outline: 'none',
            }}
          />

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              disabled={sending}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleSend}
              className="btn btn-primary"
              disabled={sending}
            >
              {sending ? (
                'Enviando...'
              ) : (
                <>
                  <Send size={16} /> Enviar Arquivo
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
