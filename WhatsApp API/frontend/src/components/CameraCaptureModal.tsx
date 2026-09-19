import React, { useState, useRef, useEffect } from 'react';
import { Camera, X, RefreshCw, Send, AlertCircle } from 'lucide-react';

interface CameraCaptureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSendPhoto: (base64Image: string, caption: string) => Promise<void>;
}

export const CameraCaptureModal: React.FC<CameraCaptureModalProps> = ({
  isOpen,
  onClose,
  onSendPhoto,
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [caption, setCaption] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [loadingCamera, setLoadingCamera] = useState<boolean>(true);
  const [sending, setSending] = useState<boolean>(false);

  // Start camera stream
  const startCamera = async () => {
    setError(null);
    setLoadingCamera(true);
    setCapturedImage(null);

    try {
      stopCamera();
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: false,
      });

      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
    } catch (err: any) {
      console.error('Camera access error:', err);
      if (err.name === 'NotAllowedError') {
        setError('Permissão de acesso à câmera negada pelo navegador.');
      } else if (err.name === 'NotFoundError') {
        setError('Nenhuma câmera encontrada no dispositivo.');
      } else {
        setError(`Não foi possível inicializar a câmera: ${err.message || 'Erro desconhecido'}`);
      }
    } finally {
      setLoadingCamera(false);
    }
  };

  // Stop camera stream tracks
  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  useEffect(() => {
    if (isOpen) {
      startCamera();
    } else {
      stopCamera();
      setCapturedImage(null);
      setCaption('');
      setError(null);
    }

    return () => {
      stopCamera();
    };
  }, [isOpen]);

  // Capture current frame from video onto canvas
  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      setCapturedImage(dataUrl);
      stopCamera();
    }
  };

  const handleRetake = () => {
    setCapturedImage(null);
    startCamera();
  };

  const handleSend = async () => {
    if (!capturedImage || sending) return;
    setSending(true);
    try {
      await onSendPhoto(capturedImage, caption);
      onClose();
    } catch (err: any) {
      alert(`Erro ao enviar foto: ${err.message || 'Falha no envio'}`);
    } finally {
      setSending(false);
    }
  };

  if (!isOpen) return null;

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
          maxWidth: '680px',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: 'rgba(37, 211, 102, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#25D366',
              }}
            >
              <Camera size={20} />
            </div>
            <div>
              <h3 style={{ color: '#fff', fontSize: '1.05rem', fontWeight: 700 }}>
                {capturedImage ? 'Confirmar e Enviar Foto' : 'Tirar Foto'}
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.75rem' }}>
                {capturedImage ? 'Revise a imagem antes de enviar para o cliente' : 'Posicione a câmera e clique para capturar'}
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

        {/* Viewfinder / Preview Body */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '400px',
            background: '#0a0d14',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            overflow: 'hidden',
          }}
        >
          {error ? (
            <div style={{ textAlign: 'center', padding: '24px', color: '#f87171' }}>
              <AlertCircle size={48} style={{ marginBottom: '12px', opacity: 0.8 }} />
              <p style={{ fontSize: '0.95rem', fontWeight: 600, marginBottom: '16px' }}>{error}</p>
              <button onClick={startCamera} className="btn btn-secondary btn-sm">
                <RefreshCw size={14} /> Tentar Novamente
              </button>
            </div>
          ) : capturedImage ? (
            <img
              src={capturedImage}
              alt="Foto Capturada"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />
          ) : (
            <>
              <video
                ref={videoRef}
                playsInline
                autoPlay
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  transform: 'scaleX(-1)', // Mirror preview for natural selfie feel
                }}
              />
              {loadingCamera && (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#0a0d14',
                    color: '#94a3b8',
                    fontSize: '0.9rem',
                  }}
                >
                  Inicializando câmera...
                </div>
              )}
            </>
          )}

          <canvas ref={canvasRef} style={{ display: 'none' }} />
        </div>

        {/* Action Controls Footer */}
        <div
          style={{
            padding: '18px 24px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(17, 22, 34, 0.95)',
          }}
        >
          {capturedImage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input
                type="text"
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                placeholder="Adicione uma legenda (opcional)..."
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

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <button
                  type="button"
                  onClick={handleRetake}
                  className="btn btn-secondary"
                  disabled={sending}
                >
                  <RefreshCw size={16} /> Tirar Outra
                </button>

                <div style={{ display: 'flex', gap: '10px' }}>
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
                        <Send size={16} /> Enviar Foto
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
              {!error && (
                <button
                  type="button"
                  onClick={handleCapture}
                  disabled={loadingCamera}
                  style={{
                    width: '64px',
                    height: '64px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, #25D366 0%, #128C7E 100%)',
                    border: '4px solid rgba(255, 255, 255, 0.2)',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    cursor: 'pointer',
                    boxShadow: '0 8px 24px rgba(37, 211, 102, 0.4)',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.92)')}
                  onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
                  title="Capturar Foto"
                >
                  <Camera size={28} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
