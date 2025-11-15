import { useState, useEffect } from 'react';

/**
 * Hook para rastrear tempo desde última atualização
 * Retorna string formatada como "há 3s", "há 2m", etc.
 */
export const useLastUpdate = (lastUpdateTime: Date | null) => {
  const [timeAgo, setTimeAgo] = useState<string>('');

  useEffect(() => {
    if (!lastUpdateTime) {
      setTimeAgo('');
      return;
    }

    const updateTimeAgo = () => {
      const now = new Date();
      const diffMs = now.getTime() - lastUpdateTime.getTime();
      const diffSeconds = Math.floor(diffMs / 1000);
      const diffMinutes = Math.floor(diffSeconds / 60);
      const diffHours = Math.floor(diffMinutes / 60);

      if (diffSeconds < 10) {
        setTimeAgo('agora');
      } else if (diffSeconds < 60) {
        setTimeAgo(`há ${diffSeconds}s`);
      } else if (diffMinutes < 60) {
        setTimeAgo(`há ${diffMinutes}m`);
      } else {
        setTimeAgo(`há ${diffHours}h`);
      }
    };

    // Update immediately
    updateTimeAgo();

    // Update every second
    const interval = setInterval(updateTimeAgo, 1000);

    return () => clearInterval(interval);
  }, [lastUpdateTime]);

  return timeAgo;
};
