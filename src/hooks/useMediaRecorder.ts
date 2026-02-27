import { useState, useRef, useCallback } from 'react';

type RecordingType = 'audio' | 'video';

interface UseMediaRecorderOptions {
  onRecordingComplete: (file: File, type: 'IMAGE' | 'FILE' | 'VIDEO' | 'AUDIO') => Promise<boolean>;
}

interface UseMediaRecorderResult {
  isRecording: boolean;
  recordingType: RecordingType | null;
  recordingDuration: number;
  startAudioRecording: () => Promise<void>;
  startVideoRecording: () => Promise<void>;
  stopRecording: () => void;
  cancelRecording: () => void;
  videoPreviewRef: React.RefObject<HTMLVideoElement | null>;
}

export function useMediaRecorder({ onRecordingComplete }: UseMediaRecorderOptions): UseMediaRecorderResult {
  const [isRecording, setIsRecording] = useState(false);
  const [recordingType, setRecordingType] = useState<RecordingType | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const videoPreviewRef = useRef<HTMLVideoElement | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (videoPreviewRef.current) {
      videoPreviewRef.current.srcObject = null;
    }
    mediaRecorderRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setRecordingType(null);
    setRecordingDuration(0);
  }, []);

  const startTimer = useCallback(() => {
    setRecordingDuration(0);
    timerRef.current = setInterval(() => {
      setRecordingDuration(prev => prev + 1);
    }, 1000);
  }, []);

  const getSupportedMimeType = (type: RecordingType): string => {
    if (type === 'audio') {
      const audioTypes = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'];
      for (const mimeType of audioTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
      }
      return 'audio/webm';
    } else {
      const videoTypes = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
      for (const mimeType of videoTypes) {
        if (MediaRecorder.isTypeSupported(mimeType)) return mimeType;
      }
      return 'video/webm';
    }
  };

  const checkPermission = useCallback(async (type: RecordingType): Promise<boolean> => {
    try {
      const name = type === 'audio' ? 'microphone' : 'camera';
      const result = await navigator.permissions.query({ name: name as PermissionName });
      if (result.state === 'denied') {
        return false;
      }
      return true;
    } catch {
      // permissions.query not supported, proceed with getUserMedia
      return true;
    }
  }, []);

  const startRecording = useCallback(async (type: RecordingType) => {
    // Check permission first to avoid noisy errors
    const hasPermission = await checkPermission(type);
    if (!hasPermission) {
      const device = type === 'audio' ? 'microfone' : 'câmera';
      throw new Error(`Permissão de ${device} negada. Verifique as configurações do navegador.`);
    }

    try {
      const constraints: MediaStreamConstraints = type === 'audio'
        ? { audio: { echoCancellation: true, noiseSuppression: true } }
        : { 
            audio: { echoCancellation: true, noiseSuppression: true }, 
            video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 720 } } 
          };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      // Preview de vídeo
      if (type === 'video' && videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      const mimeType = getSupportedMimeType(type);
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = async () => {
        const chunks = [...chunksRef.current];
        if (chunks.length === 0) {
          cleanup();
          return;
        }

        const blob = new Blob(chunks, { type: mimeType });
        const ext = type === 'audio' ? 'webm' : 'webm';
        const fileName = `${type}_${Date.now()}.${ext}`;
        const file = new File([blob], fileName, { type: mimeType });

        cleanup();
        
        const messageType = type === 'audio' ? 'AUDIO' : 'VIDEO';
        await onRecordingComplete(file, messageType);
      };

      recorder.start(1000); // Chunks a cada 1s
      setIsRecording(true);
      setRecordingType(type);
      startTimer();
    } catch (err: any) {
      console.warn(`[MediaRecorder] Permissão ${type} negada ou indisponível:`, err.name);
      cleanup();
      
      if (err.name === 'NotAllowedError') {
        throw new Error(`Permissão de ${type === 'audio' ? 'microfone' : 'câmera'} negada. Verifique as configurações do navegador.`);
      } else if (err.name === 'NotFoundError') {
        throw new Error(`${type === 'audio' ? 'Microfone' : 'Câmera'} não encontrado(a).`);
      } else {
        throw new Error(`Erro ao acessar ${type === 'audio' ? 'microfone' : 'câmera'}.`);
      }
    }
  }, [cleanup, startTimer, onRecordingComplete, checkPermission]);

  const startAudioRecording = useCallback(async () => {
    await startRecording('audio');
  }, [startRecording]);

  const startVideoRecording = useCallback(async () => {
    await startRecording('video');
  }, [startRecording]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const cancelRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.ondataavailable = null;
      mediaRecorderRef.current.onstop = null;
      mediaRecorderRef.current.stop();
    }
    cleanup();
  }, [cleanup]);

  return {
    isRecording,
    recordingType,
    recordingDuration,
    startAudioRecording,
    startVideoRecording,
    stopRecording,
    cancelRecording,
    videoPreviewRef,
  };
}
