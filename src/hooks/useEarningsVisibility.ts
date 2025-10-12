import { useState, useEffect, useCallback } from 'react';

const STORAGE_KEY = 'earnings_visibility';

export function useEarningsVisibility(defaultVisible = false) {
  const [visible, setVisible] = useState<boolean>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw === null) return defaultVisible;
      return raw === 'true';
    } catch {
      return defaultVisible;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(visible));
    } catch {}
  }, [visible]);

  const toggle = useCallback(() => setVisible(v => !v), []);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY && e.newValue != null) {
        setVisible(e.newValue === 'true');
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  return { visible, setVisible, toggle };
}
