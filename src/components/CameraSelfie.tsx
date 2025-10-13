import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RotateCcw, Check, X, Upload, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface CameraSelfieProps {
  onCapture: (imageBlob: Blob, uploadMethod: 'CAMERA' | 'GALLERY') => void;
  onCancel?: () => void;
  autoStart?: boolean;
}

export const CameraSelfie: React.FC<CameraSelfieProps> = ({ onCapture, onCancel, autoStart = false }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);
  const [uploadMethod, setUploadMethod] = useState<'CAMERA' | 'GALLERY' | null>(null);

  const startCamera = useCallback(async () => {
    try {
      console.log('Iniciando câmera...');
      setVideoReady(false);
      
      // Check if getUserMedia is available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Câmera não disponível neste dispositivo');
      }
      
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'user' }
        },
        audio: false
      });

      console.log('Stream obtido:', mediaStream);
      console.log('Video tracks:', mediaStream.getVideoTracks());

      // Apenas armazenar o stream e marcar como streaming
      // O useEffect abaixo cuidará de conectar ao elemento de vídeo
      setStream(mediaStream);
      setIsStreaming(true);
      setUploadMethod('CAMERA');
      
    } catch (error) {
      console.error('Error accessing camera:', error);
      let errorMessage = 'Erro ao acessar a câmera.';
      
      if (error instanceof Error) {
        if (error.name === 'NotAllowedError') {
          errorMessage = 'Permissão negada para acessar a câmera. Verifique as configurações do navegador.';
        } else if (error.name === 'NotFoundError') {
          errorMessage = 'Câmera não encontrada no dispositivo.';
        } else if (error.name === 'NotReadableError') {
          errorMessage = 'Câmera está sendo usada por outro aplicativo.';
        }
      }
      
      toast.error(errorMessage);
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
          console.log('Selfie captured successfully');
        } catch (error) {
          console.error('Error capturing photo:', error);
          toast.error('Erro ao capturar foto. Tente novamente.');
        }
      } else {
        console.error('Canvas context or video dimensions not available');
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
    if (uploadMethod === 'CAMERA') {
      startCamera();
    }
  }, [startCamera, uploadMethod]);

  const confirmPhoto = useCallback(() => {
    const imageToConfirm = capturedImage || uploadedImage;
    const method = uploadMethod;
    
    if (imageToConfirm && method) {
      try {
        if (method === 'CAMERA') {
          // Convert data URL to blob for camera capture
          const arr = imageToConfirm.split(',');
          const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
          const bstr = atob(arr[1]);
          let n = bstr.length;
          const u8arr = new Uint8Array(n);
          while (n--) u8arr[n] = bstr.charCodeAt(n);
          const blob = new Blob([u8arr], { type: mime });
          onCapture(blob, method);
        } else if (method === 'GALLERY' && fileInputRef.current?.files?.[0]) {
          // Use the original file for gallery upload
          onCapture(fileInputRef.current.files[0], method);
        }
      } catch (error) {
        console.error('Error confirming photo:', error);
        toast.error('Erro ao confirmar foto. Tente novamente.');
      }
    }
  }, [capturedImage, uploadedImage, uploadMethod, onCapture]);

  // Conectar o stream ao elemento de vídeo quando ambos estiverem disponíveis
  React.useEffect(() => {
    if (stream && videoRef.current && isStreaming) {
      const video = videoRef.current;
      console.log('Conectando stream ao elemento de vídeo...');
      
      video.srcObject = stream;
      
      const onLoaded = () => {
        console.log('Vídeo carregado - dimensões:', video.videoWidth, 'x', video.videoHeight);
        setVideoReady(true);
        video.play().then(() => {
          console.log('Vídeo iniciado com sucesso');
        }).catch((playError) => {
          console.error('Erro ao iniciar vídeo:', playError);
        });
      };
      
      const onError = (error: Event) => {
        console.error('Erro no elemento de vídeo:', error);
      };
      
      video.addEventListener('error', onError);
      
      if (video.readyState >= 2) {
        console.log('Vídeo já pronto, executando onLoaded');
        onLoaded();
      } else {
        console.log('Aguardando metadata do vídeo...');
        video.onloadedmetadata = onLoaded;
      }
      
      // Forçar play após um pequeno delay
      setTimeout(() => {
        if (video.paused) {
          console.log('Forçando play do vídeo...');
          video.play().catch((e) => console.log('Erro no play forçado:', e));
        }
      }, 500);

      return () => {
        video.removeEventListener('error', onError);
      };
    }
  }, [stream, isStreaming]);

  // Auto-start camera when component mounts/opened
  React.useEffect(() => {
    if (autoStart && !isStreaming && !capturedImage && !uploadedImage) {
      startCamera();
    }
  }, [autoStart, isStreaming, startCamera, capturedImage, uploadedImage]);

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
      if (uploadedImage) {
        URL.revokeObjectURL(uploadedImage);
      }
    };
  }, [stopCamera, capturedImage, uploadedImage]);

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
              <Button onClick={startCamera} size="lg" className="w-full">
                <Camera className="mr-2 h-5 w-5" />
                Usar Câmera
              </Button>
              <Button 
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

          {/* Sempre renderizar o vídeo, mas escondê-lo quando não estiver streaming */}
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
            onLoadedMetadata={() => {
              console.log('Video metadata carregado');
              const video = videoRef.current;
              if (video) {
                console.log('Dimensões do vídeo:', video.videoWidth, 'x', video.videoHeight);
              }
            }}
            onCanPlay={() => {
              console.log('Video pode ser reproduzido');
            }}
            onPlay={() => {
              console.log('Video iniciou a reprodução');
            }}
            onError={(e) => {
              console.error('Erro no elemento video:', e);
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

        <Input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          className="hidden"
        />

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2 justify-center">
          {isStreaming && (
            <>
              <Button 
                onClick={capturePhoto} 
                size="lg" 
                className="flex-1" 
                disabled={!videoReady}
              >
                <Camera className="mr-2 h-4 w-4" />
                {videoReady ? 'Capturar' : 'Carregando...'}
              </Button>
              {onCancel && (
                <Button variant="outline" onClick={onCancel}>
                  <X className="h-4 w-4" />
                </Button>
              )}
            </>
          )}

          {currentImage && (
            <>
              <Button onClick={retakePhoto} variant="outline" size="lg">
                <RotateCcw className="mr-2 h-4 w-4" />
                {uploadMethod === 'CAMERA' ? 'Refazer' : 'Escolher Outra'}
              </Button>
              <Button onClick={confirmPhoto} size="lg" className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Confirmar
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          {uploadMethod === 'CAMERA' 
            ? 'Selfie capturada da câmera' 
            : uploadMethod === 'GALLERY' 
            ? 'Imagem selecionada da galeria' 
            : 'Escolha como enviar sua selfie com documento'}
        </p>
      </CardContent>
    </Card>
  );
};

export default CameraSelfie;