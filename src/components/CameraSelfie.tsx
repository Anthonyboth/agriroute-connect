import React, { useRef, useState, useCallback, useId } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RotateCcw, Check, X, Upload, AlertTriangle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface CameraSelfieProps {
  onCapture: (imageBlob: Blob, uploadMethod: 'CAMERA' | 'GALLERY') => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

export const CameraSelfie: React.FC<CameraSelfieProps> = ({ onCapture, onCancel, autoStart = false }) => {
  const nativeSelfieInputId = useId();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null); // Input com capture="user" para selfie
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'CAMERA' | 'GALLERY' | null>(null);
  const [useNativeCapture, setUseNativeCapture] = useState(false);

  /**
   * P0 FIX (robustez máxima):
   * - Em iOS/Android (webview/PWA), programmatic .click() em <input type=file> pode ser bloqueado.
   * - Usar <label htmlFor="..."> é o caminho mais confiável (browser trata como gesto do usuário).
   * Mantemos o .click() como fallback (não depende de async).
   */
  const handleNativeCameraClick = useCallback(() => {
    console.log('📸 SELFIE_CAPTURE_CLICK - Label/HTMLFor + fallback click');
    if (cameraInputRef.current) {
      // Fallback síncrono (alguns navegadores ainda aceitam)
      cameraInputRef.current.click();
    }
  }, []);

  // Handler para quando arquivo é selecionado via input nativo
  const handleNativeCameraCapture = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    
    if (file) {
      console.log('📸 FILE_SELECTED - Arquivo capturado:', file.name, file.type, file.size);
      
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setCapturedImage(result);
          setUploadMethod('CAMERA');
          toast.success('Selfie capturada com sucesso!');
        };
        reader.onerror = () => {
          console.error('❌ Erro ao ler arquivo');
          toast.error('Erro ao processar imagem. Tente novamente.');
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Por favor, selecione uma imagem válida.');
      }
    } else {
      console.log('📸 CAPTURE_CANCELLED - Usuário cancelou');
    }
    
    // Reset input para permitir selecionar mesmo arquivo novamente
    event.target.value = '';
  }, []);

  const startCamera = useCallback(async () => {
    try {
      console.log('📹 Tentando iniciar getUserMedia...');
      setVideoReady(false);
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        console.log('⚠️ getUserMedia não disponível, usando fallback nativo');
        setUseNativeCapture(true);
        return;
      }
      
      toast.info('Solicitando permissão da câmera...');
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'user' }
        },
        audio: false
      });

      console.log('✅ Stream obtido:', mediaStream);
      toast.success('Permissão concedida!');

      setStream(mediaStream);
      setIsStreaming(true);
      setUploadMethod('CAMERA');
      
    } catch (error) {
      console.error('❌ Erro no getUserMedia:', error);
      
      // FALLBACK: Se getUserMedia falhar, usar input nativo
      console.log('🔄 Fallback para input nativo com capture="user"');
      setUseNativeCapture(true);
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          toast.error('Permissão de câmera negada. Use o botão abaixo para capturar.', {
            duration: 4000
          });
        } else if (error.name === 'NotFoundError') {
          toast.error('Câmera não encontrada. Use o botão abaixo para capturar.');
        } else if (error.name === 'NotReadableError') {
          toast.error('Câmera em uso por outro app. Use o botão abaixo.');
        } else {
          toast.error('Erro na câmera. Use o botão abaixo para capturar.');
        }
      }
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
      setVideoReady(false);
    }
  }, [stream]);

  const capturePhoto = useCallback(() => {
    if (!videoReady) {
      toast.message('Aguarde', { description: 'A câmera está carregando...' });
      return;
    }
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');

      if (context && video.videoWidth && video.videoHeight) {
        try {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          context.drawImage(video, 0, 0, video.videoWidth, video.videoHeight);
          const imageDataUrl = canvas.toDataURL('image/jpeg', 0.9);
          setCapturedImage(imageDataUrl);
          setUploadMethod('CAMERA');
          stopCamera();
          console.log('✅ Selfie capturada via getUserMedia');
        } catch (error) {
          console.error('❌ Erro ao capturar foto:', error);
          toast.error('Erro ao capturar foto. Tente novamente.');
        }
      } else {
        console.error('❌ Canvas context ou dimensões do vídeo não disponíveis');
        toast.error('Erro ao preparar câmera. Tente reiniciar.');
      }
    }
  }, [stopCamera, videoReady]);

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const result = e.target?.result as string;
          setUploadedImage(result);
          setUploadMethod('GALLERY');
        };
        reader.readAsDataURL(file);
      } else {
        toast.error('Por favor, selecione um arquivo de imagem válido.');
      }
    }
  }, []);

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    setUploadedImage(null);
    setUploadMethod(null);
    if (!useNativeCapture && uploadMethod === 'CAMERA') {
      startCamera();
    }
  }, [startCamera, uploadMethod, useNativeCapture]);

  const confirmPhoto = useCallback(() => {
    const imageToConfirm = capturedImage || uploadedImage;
    const method = uploadMethod;
    
    if (imageToConfirm && method) {
      try {
        // Convert data URL to blob
        const arr = imageToConfirm.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const blob = new Blob([u8arr], { type: mime });
        onCapture(blob, method);
      } catch (error) {
        console.error('❌ Erro ao confirmar foto:', error);
        toast.error('Erro ao confirmar foto. Tente novamente.');
      }
    }
  }, [capturedImage, uploadedImage, uploadMethod, onCapture]);

  // Conectar o stream ao elemento de vídeo quando ambos estiverem disponíveis
  React.useEffect(() => {
    if (stream && videoRef.current && isStreaming) {
      const video = videoRef.current;
      console.log('🎥 Conectando stream ao elemento de vídeo...');
      
      video.srcObject = stream;
      
      const onLoaded = () => {
        console.log('✅ Vídeo carregado - dimensões:', video.videoWidth, 'x', video.videoHeight);
        setVideoReady(true);
        video.play().then(() => {
          console.log('▶️ Vídeo iniciado com sucesso');
        }).catch((playError) => {
          console.error('❌ Erro ao iniciar vídeo:', playError);
        });
      };
      
      const onError = (error: Event) => {
        console.error('❌ Erro no elemento de vídeo:', error);
      };
      
      video.addEventListener('error', onError);
      
      if (video.readyState >= 2) {
        onLoaded();
      } else {
        video.onloadedmetadata = onLoaded;
      }
      
      // Forçar play após um pequeno delay
      setTimeout(() => {
        if (video.paused) {
          video.play().catch((e) => console.log('⚠️ Erro no play forçado:', e));
        }
      }, 500);

      return () => {
        video.removeEventListener('error', onError);
      };
    }
  }, [stream, isStreaming]);

  // Auto-start: tentar getUserMedia, se falhar usa fallback nativo
  React.useEffect(() => {
    if (autoStart && !isStreaming && !capturedImage && !uploadedImage && !useNativeCapture) {
      startCamera();
    }
  }, [autoStart, isStreaming, startCamera, capturedImage, uploadedImage, useNativeCapture]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const currentImage = capturedImage || uploadedImage;
  const showOptions = !isStreaming && !currentImage;

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

        <div className="relative bg-muted rounded-lg overflow-hidden min-h-[300px] max-h-[50vh]">
          {showOptions && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              {/* P0 FIX: Botão primário usa input nativo com capture="user" */}
              <Button asChild size="lg" className="w-full">
                <label
                  htmlFor={nativeSelfieInputId}
                  onClick={handleNativeCameraClick}
                  className="cursor-pointer"
                >
                  <Smartphone className="mr-2 h-5 w-5" />
                  Tirar Selfie (Câmera Frontal)
                </label>
              </Button>
              
              {/* Se getUserMedia funcionou antes, mostrar opção de usar preview */}
              {!useNativeCapture && (
                <Button 
                  type="button"
                  onClick={startCamera} 
                  variant="outline"
                  size="lg" 
                  className="w-full"
                >
                  <Camera className="mr-2 h-5 w-5" />
                  Usar Preview ao Vivo
                </Button>
              )}
              
              <Button 
                type="button"
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                size="lg" 
                className="w-full"
              >
                <Upload className="mr-2 h-5 w-5" />
                Enviar da Galeria
              </Button>
            </div>
          )}

          {/* Vídeo para getUserMedia (quando disponível) */}
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
            style={{ 
              display: isStreaming ? 'block' : 'none',
              backgroundColor: '#000',
              minHeight: '200px'
            }}
          />
          
          {isStreaming && !videoReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50 text-white">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto mb-2"></div>
                <p>Carregando câmera...</p>
              </div>
            </div>
          )}

          {currentImage && (
            <img
              src={currentImage}
              alt="Selfie capturada"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        {/* P0 FIX: Input nativo para câmera frontal (selfie) - posição absolute para funcionar em todos browsers */}
        <input
          ref={cameraInputRef}
          id={nativeSelfieInputId}
          type="file"
          accept="image/*"
          capture="user"
          onChange={handleNativeCameraCapture}
          style={{
            // FIX: manter o input dentro do viewport (iOS pode bloquear quando está "recortado")
            position: 'fixed',
            top: 1,
            left: 1,
            width: '1px',
            height: '1px',
            padding: 0,
            overflow: 'hidden',
            whiteSpace: 'nowrap',
            border: 0,
            opacity: 0.01, // NÃO zero - alguns browsers bloqueiam click em opacity:0
            pointerEvents: 'none',
            zIndex: 10002,
          }}
          aria-label="Capturar selfie com câmera frontal"
        />

        {/* Input para galeria */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="sr-only"
          aria-label="Selecionar imagem da galeria"
        />

        <canvas ref={canvasRef} className="hidden" />

        <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
          <div className="flex gap-2 justify-center">
            {isStreaming && (
              <>
                <Button 
                  type="button"
                  onClick={capturePhoto} 
                  size="lg" 
                  className="flex-1" 
                  disabled={!videoReady}
                >
                  <Camera className="mr-2 h-4 w-4" />
                  {videoReady ? 'Capturar' : 'Carregando...'}
                </Button>
                {onCancel && (
                  <Button type="button" variant="outline" onClick={onCancel}>
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </>
            )}

            {currentImage && (
              <>
                <Button type="button" onClick={retakePhoto} variant="outline" size="lg">
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Refazer
                </Button>
                <Button type="button" onClick={confirmPhoto} size="lg" className="flex-1">
                  <Check className="mr-2 h-4 w-4" />
                  Confirmar
                </Button>
              </>
            )}
            
            {showOptions && onCancel && (
              <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
                <X className="mr-2 h-4 w-4" />
                Cancelar
              </Button>
            )}
          </div>
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {uploadMethod === 'CAMERA' 
            ? '✅ Selfie capturada da câmera' 
            : uploadMethod === 'GALLERY' 
            ? '✅ Imagem selecionada da galeria' 
            : 'Escolha como enviar sua selfie com documento'}
        </p>
      </CardContent>
    </Card>
  );
};

export default CameraSelfie;