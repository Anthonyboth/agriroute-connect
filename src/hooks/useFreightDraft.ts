import { useState, useEffect, useCallback } from 'react';

// Incluir currentStep na interface
interface DraftData {
  data: any;
  currentStep: number;
  savedAt: string;
  expiresAt: string;
}

/**
 * useFreightDraft
 * - Mantém um rascunho do wizard de frete no localStorage por usuário.
 * - `showDraftPrompt` indica se existe um rascunho ANTERIOR (carregado do storage) que deve ser oferecido ao usuário.
 * - Auto-saves durante a sessão NÃO devem reexibir o prompt.
 */
export const useFreightDraft = (userId: string | undefined, enabled: boolean = true) => {
  const [draft, setDraft] = useState<any>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [savedStep, setSavedStep] = useState<number>(1);
  const [showDraftPrompt, setShowDraftPrompt] = useState(false);

  const getDraftKey = useCallback(() => {
    return userId ? `freight-draft-${userId}` : null;
  }, [userId]);

  // Carregar draft ao montar/abrir
  useEffect(() => {
    if (!enabled || !userId) return;

    const key = getDraftKey();
    if (!key) return;

    try {
      const stored = localStorage.getItem(key);
      if (!stored) {
        setHasDraft(false);
        setDraft(null);
        setLastSaved(null);
        setSavedStep(1);
        setShowDraftPrompt(false);
        return;
      }

      const parsed: DraftData = JSON.parse(stored);
      const expiresAt = new Date(parsed.expiresAt);

      if (expiresAt > new Date()) {
        setDraft(parsed.data);
        setHasDraft(true);
        setLastSaved(new Date(parsed.savedAt));
        setSavedStep(parsed.currentStep || 1);
        setShowDraftPrompt(true);
        console.log('[useFreightDraft] Draft loaded from step:', parsed.currentStep || 1);
      } else {
        localStorage.removeItem(key);
        setHasDraft(false);
        setDraft(null);
        setLastSaved(null);
        setSavedStep(1);
        setShowDraftPrompt(false);
      }
    } catch (error) {
      console.error('Erro ao carregar rascunho:', error);
      // Se corrompido, limpar
      try {
        localStorage.removeItem(key);
      } catch {
        // ignore
      }
      setHasDraft(false);
      setDraft(null);
      setLastSaved(null);
      setSavedStep(1);
      setShowDraftPrompt(false);
    }
  }, [userId, enabled, getDraftKey]);

  // Salvar draft COM currentStep
  const saveDraft = useCallback(
    (data: any, currentStep: number = 1) => {
      if (!enabled || !userId) return;

      const key = getDraftKey();
      if (!key) return;

      try {
        const draftData: DraftData = {
          data,
          currentStep,
          savedAt: new Date().toISOString(),
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        };

        localStorage.setItem(key, JSON.stringify(draftData));

        // Manter estado sincronizado para o botão "Restaurar" funcionar mesmo na mesma sessão
        setDraft(data);
        setHasDraft(true);
        setLastSaved(new Date());
        setSavedStep(currentStep);

        // IMPORTANTE: NÃO reabrir prompt durante autosave da sessão
        // (showDraftPrompt permanece como está)

        console.log('[useFreightDraft] Draft saved at step:', currentStep);
      } catch (error) {
        console.error('Erro ao salvar rascunho:', error);
      }
    },
    [userId, enabled, getDraftKey]
  );

  const dismissDraftPrompt = useCallback(() => {
    setShowDraftPrompt(false);
  }, []);

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
    setShowDraftPrompt(false);

    console.log('[useFreightDraft] Draft cleared');
  }, [userId, getDraftKey]);

  // Restaurar draft retornando dados E etapa
  const restoreDraft = useCallback(() => {
    if (!draft) return null;

    console.log('[useFreightDraft] Restoring draft with step:', savedStep);

    return {
      data: draft,
      currentStep: savedStep,
    };
  }, [draft, savedStep]);

  return {
    draft,
    hasDraft,
    showDraftPrompt,
    lastSaved,
    savedStep,
    saveDraft,
    clearDraft,
    restoreDraft,
    dismissDraftPrompt,
  };
};

