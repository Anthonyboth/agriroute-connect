import { useEffect, useRef } from 'react';

interface NotificationSoundProps {
  unreadCount: number;
}

export const NotificationSound: React.FC<NotificationSoundProps> = ({ unreadCount }) => {
  const prevCountRef = useRef<number>(unreadCount);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Criar elemento de áudio se não existir
    if (!audioRef.current) {
      audioRef.current = new Audio('/sounds/notification.mp3');
      audioRef.current.volume = 0.5; // Volume moderado
    }
  }, []);

  useEffect(() => {
    const prevCount = prevCountRef.current;
    
    // Tocar som apenas quando contador AUMENTA (nova notificação)
    if (unreadCount > prevCount && unreadCount > 0) {
      console.log('[NotificationSound] Nova notificação detectada, tocando som...');
      
      audioRef.current?.play().catch((error) => {
        // Ignorar erro se autoplay bloqueado pelo navegador
        if (error.name !== 'NotAllowedError') {
          console.error('[NotificationSound] Erro ao tocar som:', error);
        }
      });
    }
    
    // Atualizar referência
    prevCountRef.current = unreadCount;
  }, [unreadCount]);

  return null; // Componente invisível
};
