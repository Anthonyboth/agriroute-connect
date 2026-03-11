import { useCallback, useEffect, useRef, useState } from 'react';

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [streamVersion, setStreamVersion] = useState(0);

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

  useEffect(() => {
    if (!isOpen || !streamRef.current || !videoRef.current) {
      return;
    }

    const videoElement = videoRef.current;
    videoElement.srcObject = streamRef.current;

    void videoElement.play().catch(() => {
      setErrorMessage('Toque novamente em “Abrir Câmera” para ativar o vídeo.');
    });
  }, [isOpen, streamVersion]);

  const capturePhoto = useCallback(
    async (fileNamePrefix: string): Promise<File> => {
      const videoElement = videoRef.current;

      if (!videoElement || videoElement.readyState < 2) {
        throw new Error('A câmera ainda não está pronta. Aguarde um instante.');
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

        return new File([blob], `${fileNamePrefix}_${Date.now()}.jpg`, { type: 'image/jpeg' });
      } finally {
        setIsCapturing(false);
      }
    },
    [height, width]
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
    errorMessage,
    openCamera,
    closeCamera,
    capturePhoto,
  };
}
