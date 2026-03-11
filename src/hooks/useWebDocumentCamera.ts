import { useCallback, useEffect, useRef, useState } from 'react';
import { compressImage } from '@/utils/imageProcessing';

interface UseWebDocumentCameraOptions {
  facingMode?: 'environment' | 'user';
  width?: number;
  height?: number;
}

const getCameraErrorMessage = (error: unknown): string => {
  if (!(error instanceof Error)) {
    return 'Não foi possível acessar a câmera.';
  }

  switch (error.name) {
    case 'NotAllowedError':
      return 'Permissão de câmera negada. Autorize o acesso à câmera no navegador.';
    case 'NotFoundError':
      return 'Nenhuma câmera foi encontrada neste dispositivo.';
    case 'NotReadableError':
      return 'A câmera já está em uso por outro aplicativo.';
    case 'OverconstrainedError':
      return 'A câmera não suporta as configurações solicitadas.';
    case 'SecurityError':
      return 'A câmera só funciona em conexão segura (HTTPS).';
    default:
      return 'Não foi possível abrir a câmera. Tente novamente.';
  }
};

export function useWebDocumentCamera({
  facingMode = 'environment',
  width = 1920,
  height = 1080,
}: UseWebDocumentCameraOptions = {}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isCapturing, setIsCapturing] = useState(false);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamVersion, setStreamVersion] = useState(0);

  // Track readiness in a ref so capturePhoto can read it synchronously inside the wait loop
  const isVideoReadyRef = useRef(false);
  useEffect(() => {
    isVideoReadyRef.current = isVideoReady;
  }, [isVideoReady]);

  const isSupported =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === 'function';

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const closeCamera = useCallback(() => {
    setIsOpen(false);
    setIsVideoReady(false);
    isVideoReadyRef.current = false;
    setErrorMessage(null);
    stopStream();
  }, [stopStream]);

  const openCamera = useCallback(async () => {
    if (!isSupported) {
      const message = 'Seu navegador não suporta captura direta de câmera.';
      setErrorMessage(message);
      throw new Error(message);
    }

    setIsStarting(true);
    setIsVideoReady(false);
    isVideoReadyRef.current = false;
    setErrorMessage(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facingMode },
          width: { ideal: width },
          height: { ideal: height },
        },
        audio: false,
      });

      streamRef.current = stream;
      setIsOpen(true);
      setStreamVersion((prev) => prev + 1);
    } catch (error) {
      const message = getCameraErrorMessage(error);
      setErrorMessage(message);
      stopStream();
      throw new Error(message);
    } finally {
      setIsStarting(false);
    }
  }, [facingMode, height, isSupported, stopStream, width]);

  // Attach video stream and listen for readiness events
  useEffect(() => {
    if (!isOpen || !streamRef.current || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;

    const markReady = () => {
      console.log('[Camera] Video stream ready');
      setIsVideoReady(true);
      isVideoReadyRef.current = true;
    };

    // Listen to multiple events to cover all browsers
    videoElement.addEventListener('loadeddata', markReady, { once: true });
    videoElement.addEventListener('canplay', markReady, { once: true });
    videoElement.addEventListener('playing', markReady, { once: true });

    void videoElement.play().catch(() => {
      setErrorMessage('Toque novamente em "Abrir Câmera" para ativar o vídeo.');
    });

    return () => {
      videoElement.removeEventListener('loadeddata', markReady);
      videoElement.removeEventListener('canplay', markReady);
      videoElement.removeEventListener('playing', markReady);
    };
  }, [isOpen, streamVersion]);

  /**
   * Wait for video readiness with a timeout instead of failing instantly.
   */
  const waitForVideoReady = useCallback(async (timeout = 2500): Promise<boolean> => {
    if (isVideoReadyRef.current) return true;

    const start = Date.now();
    while (!isVideoReadyRef.current && Date.now() - start < timeout) {
      await new Promise((r) => setTimeout(r, 100));
    }
    return isVideoReadyRef.current;
  }, []);

  const capturePhoto = useCallback(
    async (fileNamePrefix: string): Promise<File> => {
      const videoElement = videoRef.current;

      if (!videoElement) {
        throw new Error('Elemento de vídeo não encontrado.');
      }

      // Wait up to 2.5s for readiness instead of failing immediately
      const ready = await waitForVideoReady(2500);
      if (!ready || videoElement.readyState < 2) {
        throw new Error('camera_warming_up');
      }

      setIsCapturing(true);

      try {
        const canvas = document.createElement('canvas');
        canvas.width = videoElement.videoWidth || width;
        canvas.height = videoElement.videoHeight || height;

        const context = canvas.getContext('2d');
        if (!context) {
          throw new Error('Não foi possível processar a imagem capturada.');
        }

        context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

        const blob = await new Promise<Blob | null>((resolve) => {
          canvas.toBlob(resolve, 'image/jpeg', 0.92);
        });

        if (!blob || blob.size === 0) {
          throw new Error('A captura retornou uma imagem vazia.');
        }

        // Compress through the unified pipeline
        const compressed = await compressImage(blob, { maxWidth: 1280, quality: 0.8 });
        console.log('[Camera] Web capture compressed:', { from: blob.size, to: compressed.size });

        return new File([compressed], `${fileNamePrefix}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      } finally {
        setIsCapturing(false);
      }
    },
    [height, width, waitForVideoReady]
  );

  useEffect(() => {
    return () => {
      stopStream();
    };
  }, [stopStream]);

  return {
    videoRef,
    isSupported,
    isOpen,
    isStarting,
    isCapturing,
    isVideoReady,
    errorMessage,
    openCamera,
    closeCamera,
    capturePhoto,
  };
}
