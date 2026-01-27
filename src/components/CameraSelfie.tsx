import React, { useCallback, useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RotateCcw, Check, X, Upload, AlertTriangle, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface CameraSelfieProps {
  onCapture: (imageBlob: Blob, uploadMethod: 'CAMERA' | 'GALLERY') => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

type CameraMode = 'stream' | 'preview' | 'fallback';

export const CameraSelfie: React.FC<CameraSelfieProps> = ({ 
  onCapture, 
  onCancel,
  autoStart = true 
}) => {
  // Refs
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  // States for live camera
  const [mode, setMode] = useState<CameraMode>('stream');
  const [videoReady, setVideoReady] = useState(false);
  const [starting, setStarting] = useState(false);
  const [needsUserAction, setNeedsUserAction] = useState(false);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  // States for fallback mode
  const [fallbackFile, setFallbackFile] = useState<File | null>(null);
  const [fallbackPreviewUrl, setFallbackPreviewUrl] = useState<string | null>(null);
  const [fallbackMethod, setFallbackMethod] = useState<'CAMERA' | 'GALLERY' | null>(null);

  // Check if getUserMedia is available
  const hasGetUserMedia = typeof navigator !== 'undefined' && 
    navigator.mediaDevices && 
    typeof navigator.mediaDevices.getUserMedia === 'function';

  // Stop camera and release resources
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => {
        track.stop();
      });
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setVideoReady(false);
  }, []);

  // Start camera with getUserMedia
  const startCamera = useCallback(async (origin: 'auto' | 'user') => {
    if (!hasGetUserMedia) {
      console.warn('⚠️ getUserMedia not available, using fallback');
      setMode('fallback');
      return;
    }

    // If already have a stream, don't recreate
    if (streamRef.current) {
      return;
    }

    setStarting(true);
    setNeedsUserAction(false);

    try {
      const constraints: MediaStreamConstraints = {
        video: {
          facingMode: 'user',
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      };

      console.log('📷 Requesting camera access...');
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;

        // Wait for video to be ready
        await new Promise<void>((resolve, reject) => {
          const video = videoRef.current!;
          
          const onLoadedMetadata = () => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            resolve();
          };
          
          const onError = (e: Event) => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video element error'));
          };
          
          video.addEventListener('loadedmetadata', onLoadedMetadata);
          video.addEventListener('error', onError);
          
          // Timeout after 5s
          setTimeout(() => {
            video.removeEventListener('loadedmetadata', onLoadedMetadata);
            video.removeEventListener('error', onError);
            reject(new Error('Video load timeout'));
          }, 5000);
        });

        // Try to play (may fail on iOS without user gesture)
        try {
          await videoRef.current.play();
          console.log('✅ Camera started successfully');
          setVideoReady(true);
          setNeedsUserAction(false);
          setMode('stream');
        } catch (playError) {
          console.warn('⚠️ Autoplay blocked (typical on iOS):', playError);
          // Don't go to fallback - just show "Ativar câmera" button
          setNeedsUserAction(true);
          setMode('stream');
        }
      }
    } catch (error: any) {
      console.error('❌ Camera error:', error);
      
      const errorName = error?.name || '';
      
      // If this was an auto-start attempt, don't go to fallback yet
      // Show "Ativar câmera" button instead (user gesture might help)
      if (origin === 'auto' && errorName === 'NotAllowedError') {
        console.log('🔄 Auto-start blocked, will retry with user gesture');
        setNeedsUserAction(true);
        setMode('stream');
        setStarting(false);
        return;
      }
      
      // For user-initiated attempts or definitive errors, go to fallback
      if (origin === 'user' || ['NotFoundError', 'NotReadableError', 'OverconstrainedError'].includes(errorName)) {
        let message = 'Não foi possível acessar a câmera.';
        if (errorName === 'NotAllowedError') {
          message = 'Permissão de câmera negada. Use a câmera nativa.';
        } else if (errorName === 'NotFoundError') {
          message = 'Nenhuma câmera encontrada. Use a câmera nativa.';
        } else if (errorName === 'NotReadableError') {
          message = 'Câmera em uso por outro app. Use a câmera nativa.';
        }
        
        toast.error(message);
        stopCamera();
        setMode('fallback');
      } else {
        // Unknown error on auto - show button to retry
        setNeedsUserAction(true);
        setMode('stream');
      }
    } finally {
      setStarting(false);
    }
  }, [hasGetUserMedia, stopCamera]);

  // Capture frame from video to canvas
  const captureFrame = useCallback(() => {
    if (mode !== 'stream' || !videoReady || !videoRef.current || !canvasRef.current) {
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');

    if (!ctx) {
      toast.error('Erro ao processar imagem.');
      return;
    }

    // Set canvas dimensions to match video
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    // Draw video frame to canvas
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Convert to blob
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          toast.error('Erro ao capturar imagem.');
          return;
        }

        const url = URL.createObjectURL(blob);
        setCapturedBlob(blob);
        setPreviewUrl(url);
        setMode('preview');
        stopCamera();
        console.log('📸 Frame captured successfully');
      },
      'image/jpeg',
      0.9
    );
  }, [mode, videoReady, stopCamera]);

  // Reset to try again
  const reset = useCallback(() => {
    // Clean up preview URL
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    if (fallbackPreviewUrl) {
      URL.revokeObjectURL(fallbackPreviewUrl);
    }

    setCapturedBlob(null);
    setPreviewUrl(null);
    setFallbackFile(null);
    setFallbackPreviewUrl(null);
    setFallbackMethod(null);

    if (selfieInputRef.current) selfieInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';

    // Restart camera if was in preview mode (getUserMedia mode)
    if (mode === 'preview') {
      setMode('stream');
      startCamera('user');
    } else if (mode === 'fallback') {
      // Stay in fallback mode
      setMode('fallback');
    }
  }, [mode, previewUrl, fallbackPreviewUrl, startCamera]);

  // Confirm and submit
  const confirm = useCallback(async () => {
    try {
      setConfirming(true);

      if (mode === 'preview' && capturedBlob) {
        // Live camera capture
        onCapture(capturedBlob, 'CAMERA');
      } else if (mode === 'fallback' && fallbackFile && fallbackMethod) {
        // Fallback file input
        const buf = await fallbackFile.arrayBuffer();
        const blob = new Blob([buf], { type: fallbackFile.type || 'image/jpeg' });
        onCapture(blob, fallbackMethod);
      }

      // Clean up
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (fallbackPreviewUrl) URL.revokeObjectURL(fallbackPreviewUrl);
      stopCamera();
    } catch (e) {
      console.error('❌ Error confirming selfie:', e);
      toast.error('Erro ao confirmar selfie. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  }, [mode, capturedBlob, fallbackFile, fallbackMethod, onCapture, previewUrl, fallbackPreviewUrl, stopCamera]);

  // Handle fallback file input (camera native)
  const onFallbackSelfieChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    const isImage = picked.type?.startsWith('image/') || picked.name?.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i);
    if (!isImage) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    if (picked.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 10MB.');
      return;
    }

    const url = URL.createObjectURL(picked);
    setFallbackFile(picked);
    setFallbackPreviewUrl(url);
    setFallbackMethod('CAMERA');
    event.target.value = '';
  }, []);

  // Handle fallback file input (gallery)
  const onFallbackGalleryChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const picked = event.target.files?.[0];
    if (!picked) return;

    const isImage = picked.type?.startsWith('image/') || picked.name?.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i);
    if (!isImage) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    if (picked.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 10MB.');
      return;
    }

    const url = URL.createObjectURL(picked);
    setFallbackFile(picked);
    setFallbackPreviewUrl(url);
    setFallbackMethod('GALLERY');
    event.target.value = '';
  }, []);

  // Auto-start camera on mount (if getUserMedia available)
  useEffect(() => {
    if (autoStart && hasGetUserMedia) {
      startCamera('auto');
    } else if (!hasGetUserMedia) {
      setMode('fallback');
    }

    // Cleanup on unmount
    return () => {
      stopCamera();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      if (fallbackPreviewUrl) URL.revokeObjectURL(fallbackPreviewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Determine if we have a preview to show (either mode)
  const hasPreview = (mode === 'preview' && previewUrl) || (mode === 'fallback' && fallbackPreviewUrl);

  return (
    <Card className="w-full max-w-md mx-auto max-h-[90vh] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Selfie para Verificação
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 overflow-y-auto flex-1">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>IMPORTANTE:</strong> A selfie deve mostrar seu rosto claramente junto com um documento de identidade (RG/CNH) ao lado do rosto para verificação.
          </AlertDescription>
        </Alert>

        {/* Camera/Preview Container */}
        <div className="relative bg-black rounded-lg overflow-hidden min-h-[320px] max-h-[50vh] flex items-center justify-center">
          
          {/* STREAM MODE - Live camera preview */}
          {mode === 'stream' && (
            <>
              <video
                ref={videoRef}
                autoPlay
                muted
                playsInline
                className="w-full h-full object-cover"
                style={{ transform: 'scaleX(-1)' }} // Mirror for selfie
              />
              
              {/* Loading overlay */}
              {!videoReady && !needsUserAction && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/70 text-white">
                  <div className="text-center">
                    <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
                    <p className="text-sm">Carregando câmera...</p>
                  </div>
                </div>
              )}
              
              {/* Needs user action overlay (iOS autoplay blocked) */}
              {needsUserAction && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/80 text-white p-4">
                  <Camera className="h-12 w-12 text-primary" />
                  <p className="text-sm text-center max-w-xs">
                    Toque no botão abaixo para ativar a câmera frontal.
                  </p>
                  <Button
                    type="button"
                    className="bg-primary hover:bg-primary/90 text-primary-foreground"
                    onClick={() => startCamera('user')}
                    disabled={starting}
                  >
                    {starting ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Ativando...
                      </>
                    ) : (
                      <>
                        <Camera className="mr-2 h-4 w-4" />
                        Ativar câmera
                      </>
                    )}
                  </Button>
                  
                  {/* Option to use fallback */}
                  <Button
                    type="button"
                    variant="ghost"
                    className="text-white/70 hover:text-white"
                    onClick={() => setMode('fallback')}
                  >
                    Usar câmera nativa
                  </Button>
                </div>
              )}
            </>
          )}

          {/* PREVIEW MODE - Captured image */}
          {mode === 'preview' && previewUrl && (
            <img
              src={previewUrl}
              alt="Selfie capturada"
              className="w-full h-full object-cover"
              style={{ transform: 'scaleX(-1)' }} // Mirror to match video
            />
          )}

          {/* FALLBACK MODE - Native camera/gallery inputs */}
          {mode === 'fallback' && !fallbackPreviewUrl && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              <Camera className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-sm text-muted-foreground text-center mb-2">
                Use a câmera do seu dispositivo ou escolha uma foto da galeria.
              </p>
              
              {/* Native camera button */}
              <label className="relative w-full cursor-pointer">
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={onFallbackSelfieChange}
                  className="absolute inset-0 w-full h-full opacity-[0.01] cursor-pointer"
                  style={{ zIndex: 10 }}
                  aria-label="Capturar selfie com câmera frontal"
                />
                <Button
                  asChild
                  size="lg"
                  className="w-full pointer-events-none bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <span>
                    <Camera className="mr-2 h-5 w-5" />
                    Tirar Selfie
                  </span>
                </Button>
              </label>

              {/* Gallery button */}
              <label className="relative w-full cursor-pointer">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onFallbackGalleryChange}
                  className="absolute inset-0 w-full h-full opacity-[0.01] cursor-pointer"
                  style={{ zIndex: 10 }}
                  aria-label="Selecionar imagem da galeria"
                />
                <Button asChild variant="outline" size="lg" className="w-full pointer-events-none">
                  <span>
                    <Upload className="mr-2 h-5 w-5" />
                    Enviar da Galeria
                  </span>
                </Button>
              </label>

              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} className="w-full mt-2">
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          )}

          {/* FALLBACK MODE - Preview from file input */}
          {mode === 'fallback' && fallbackPreviewUrl && (
            <img
              src={fallbackPreviewUrl}
              alt="Foto selecionada"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* Hidden canvas for capture */}
        <canvas ref={canvasRef} className="hidden" />

        {/* Action buttons */}
        {mode === 'stream' && videoReady && !needsUserAction && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
            <div className="flex gap-2 justify-center">
              {onCancel && (
                <Button type="button" onClick={onCancel} variant="outline" size="lg">
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
              <Button
                type="button"
                onClick={captureFrame}
                size="lg"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={!videoReady || starting}
              >
                <Camera className="mr-2 h-4 w-4" />
                Capturar
              </Button>
            </div>
          </div>
        )}

        {mode === 'preview' && previewUrl && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
            <div className="flex gap-2 justify-center">
              <Button type="button" onClick={reset} variant="outline" size="lg" disabled={confirming}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer
              </Button>
              <Button
                type="button"
                onClick={confirm}
                size="lg"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={confirming}
              >
                <Check className="mr-2 h-4 w-4" />
                {confirming ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}

        {mode === 'fallback' && fallbackPreviewUrl && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
            <div className="flex gap-2 justify-center">
              <Button type="button" onClick={reset} variant="outline" size="lg" disabled={confirming}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer
              </Button>
              <Button
                type="button"
                onClick={confirm}
                size="lg"
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground"
                disabled={confirming}
              >
                <Check className="mr-2 h-4 w-4" />
                {confirming ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}

        {/* Status text */}
        <p className="text-xs text-muted-foreground text-center">
          {mode === 'stream' && videoReady && '📹 Câmera ao vivo — posicione seu rosto e documento'}
          {mode === 'stream' && !videoReady && !needsUserAction && '⏳ Iniciando câmera...'}
          {mode === 'stream' && needsUserAction && '👆 Toque para ativar a câmera'}
          {mode === 'preview' && '✅ Foto capturada — verifique e confirme'}
          {mode === 'fallback' && !fallbackPreviewUrl && '📱 Escolha como enviar sua selfie'}
          {mode === 'fallback' && fallbackPreviewUrl && fallbackMethod === 'CAMERA' && '✅ Selfie capturada da câmera'}
          {mode === 'fallback' && fallbackPreviewUrl && fallbackMethod === 'GALLERY' && '✅ Imagem selecionada da galeria'}
        </p>
      </CardContent>
    </Card>
  );
};

export default CameraSelfie;
