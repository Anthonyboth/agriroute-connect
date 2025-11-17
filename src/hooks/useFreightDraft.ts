import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

interface DraftData {
  data: any;
  savedAt: string;
  expiresAt: string;
}

export const useFreightDraft = (userId: string | undefined, enabled: boolean = true) => {
  const [draft, setDraft] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);

  const getDraftKey = useCallback(() => {
    return userId ? `freight-draft-${userId}` : null;
  }, [userId]);

  // Carregar draft ao montar
  useEffect(() => {
    if (!enabled || !userId) return;

    const key = getDraftKey();
    if (!key) return;

    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        const parsed: DraftData = JSON.parse(stored);
        const expiresAt = new Date(parsed.expiresAt);
        
        if (expiresAt > new Date()) {
          setDraft(parsed.data);
          setHasDraft(true);
          setLastSaved(new Date(parsed.savedAt));
        } else {
          // Expirou, limpar
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
    }
  }, [userId, enabled, getDraftKey]);

  // Salvar draft
  const saveDraft = useCallback((data: any) => {
    if (!enabled || !userId) return;

    const key = getDraftKey();
    if (!key) return;

    try {
      const draftData: DraftData = {
        data,
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      };

      localStorage.setItem(key, JSON.stringify(draftData));
      setHasDraft(true);
      setLastSaved(new Date());
    } catch (error) {
      console.error('Erro ao salvar rascunho:', error);
    }
  }, [userId, enabled, getDraftKey]);

  // Limpar draft
  const clearDraft = useCallback(() => {
    if (!userId) return;

    const key = getDraftKey();
    if (!key) return;

    localStorage.removeItem(key);
    setDraft(null);
    setHasDraft(false);
    setLastSaved(null);
  }, [userId, getDraftKey]);

  // Restaurar draft
  const restoreDraft = useCallback(() => {
    return draft;
  }, [draft]);

  return {
    draft,
    hasDraft,
    lastSaved,
    saveDraft,
    clearDraft,
    restoreDraft,
  };
};
