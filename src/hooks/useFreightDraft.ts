import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';

// PROBLEMA 9 CORRIGIDO: Incluir currentStep na interface
interface DraftData {
  data: any;
  currentStep: number; // Etapa atual do wizard
  savedAt: string;
  expiresAt: string;
}

export const useFreightDraft = (userId: string | undefined, enabled: boolean = true) => {
  const [draft, setDraft] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedStep, setSavedStep] = useState<number>(1); // Etapa salva

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
          setSavedStep(parsed.currentStep || 1); // Recuperar etapa salva
          console.log('[useFreightDraft] Draft loaded from step:', parsed.currentStep || 1);
        } else {
          // Expirou, limpar
          localStorage.removeItem(key);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
    }
  }, [userId, enabled, getDraftKey]);

  // PROBLEMA 9: Salvar draft COM currentStep
  const saveDraft = useCallback((data: any, currentStep: number = 1) => {
    if (!enabled || !userId) return;

    const key = getDraftKey();
    if (!key) return;

    try {
      const draftData: DraftData = {
        data,
        currentStep, // Salvar etapa atual
        savedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 horas
      };

      localStorage.setItem(key, JSON.stringify(draftData));
      setHasDraft(true);
      setLastSaved(new Date());
      setSavedStep(currentStep);
      
      console.log('[useFreightDraft] Draft saved at step:', currentStep);
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
    setSavedStep(1);
    
    console.log('[useFreightDraft] Draft cleared');
  }, [userId, getDraftKey]);

  // PROBLEMA 9: Restaurar draft retornando dados E etapa
  const restoreDraft = useCallback(() => {
    if (!draft) return null;
    
    console.log('[useFreightDraft] Restoring draft with step:', savedStep);
    
    return {
      data: draft,
      currentStep: savedStep
    };
  }, [draft, savedStep]);

  return {
    draft,
    hasDraft,
    lastSaved,
    savedStep, // Expor etapa salva
    saveDraft,
    clearDraft,
    restoreDraft,
  };
};
