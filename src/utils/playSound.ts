/**
 * Utilitário para reproduzir sons de feedback
 */

export const playSound = (soundPath: string, volume = 0.5) => {
  try {
    const audio = new Audio(soundPath);
    audio.volume = volume;
    audio.play().catch((e) => {
      // Ignorar erros de autoplay bloqueado pelo navegador
      if (e.name !== 'NotAllowedError') {
        console.debug('Erro ao tocar som:', e);
      }
    });
  } catch (e) {
    console.debug('Erro ao criar áudio:', e);
  }
};

/** Som para abrir central de notificações */
export const playSoundNotification = () => playSound('/sounds/notification.mp3', 0.4);

/** Som para botão de suporte WhatsApp */
export const playSoundSupport = () => playSound('/sounds/support.mp3', 0.5);
