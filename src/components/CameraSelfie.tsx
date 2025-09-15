import React, { useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Camera, RotateCcw, Check, X } from 'lucide-react';
import { toast } from 'sonner';

interface CameraSelfieProps {
  onCapture: (imageBlob: Blob) => void;
  onCancel?: () => void;
}

export const CameraSelfie: React.FC<CameraSelfieProps> = ({ onCapture, onCancel }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [videoReady, setVideoReady] = useState(false);

  const startCamera = useCallback(async () => {
    try {
      setVideoReady(false);
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: { ideal: 'user' }
        },
        audio: false
      });

      const video = videoRef.current;
      if (video) {
        video.srcObject = mediaStream;
        setStream(mediaStream);
        setIsStreaming(true);
        
        const onLoaded = () => {
          setVideoReady(true);
          // Ensure playback is started
          video.play().catch(() => {});
        };
        if (video.readyState >= 2) {
          onLoaded();
        } else {
          video.onloadedmetadata = onLoaded;
        }
      }
    } catch (error) {
      console.error('Error accessing camera:', error);
      toast.error('Erro ao acessar a câmera. Verifique as permissões.');
    }
  }, []);

  const stopCamera = useCallback(() => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setIsStreaming(false);
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

  const retakePhoto = useCallback(() => {
    setCapturedImage(null);
    startCamera();
  }, [startCamera]);

  const confirmPhoto = useCallback(() => {
    if (capturedImage) {
      try {
        // Convert data URL to blob without fetch for broader compatibility
        const arr = capturedImage.split(',');
        const mime = arr[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while (n--) u8arr[n] = bstr.charCodeAt(n);
        const blob = new Blob([u8arr], { type: mime });
        onCapture(blob);
      } catch (error) {
        console.error('Error confirming photo:', error);
        toast.error('Erro ao confirmar foto. Tente novamente.');
      }
    }
  }, [capturedImage, onCapture]);

  React.useEffect(() => {
    return () => {
      stopCamera();
      if (capturedImage) {
        URL.revokeObjectURL(capturedImage);
      }
    };
  }, [stopCamera, capturedImage]);

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Tirar Selfie
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="relative bg-muted rounded-lg overflow-hidden aspect-[4/3]">
          {!isStreaming && !capturedImage && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Button onClick={startCamera} size="lg">
                <Camera className="mr-2 h-5 w-5" />
                Iniciar Câmera
              </Button>
            </div>
          )}

          {isStreaming && (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover"
            />
          )}

          {capturedImage && (
            <img
              src={capturedImage}
              alt="Selfie capturada"
              className="w-full h-full object-cover"
            />
          )}
        </div>

        <canvas ref={canvasRef} className="hidden" />

        <div className="flex gap-2 justify-center">
          {isStreaming && (
            <>
              <Button onClick={capturePhoto} size="lg" className="flex-1" disabled={!videoReady} aria-disabled={!videoReady}>
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

          {capturedImage && (
            <>
              <Button onClick={retakePhoto} variant="outline" size="lg">
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer
              </Button>
              <Button onClick={confirmPhoto} size="lg" className="flex-1">
                <Check className="mr-2 h-4 w-4" />
                Confirmar
              </Button>
            </>
          )}
        </div>

        <p className="text-xs text-muted-foreground text-center">
          A selfie deve ser tirada diretamente da câmera para verificação de identidade
        </p>
      </CardContent>
    </Card>
  );
};

export default CameraSelfie;