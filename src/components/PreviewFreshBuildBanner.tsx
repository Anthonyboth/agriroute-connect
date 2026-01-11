/**
 * Banner para ambiente de Preview (lovableproject.com)
 * 
 * 1. Mostra um "Build Stamp" com timestamp para confirmar versão carregada
 * 2. Botão "Forçar Atualização" que limpa SW/caches e recarrega
 * 3. Só aparece em lovableproject.com
 */

import { useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { isLovablePreviewHost } from '@/utils/isLovablePreviewHost';

// Timestamp do build (gerado em tempo de build)
const BUILD_TIMESTAMP = new Date().toISOString().slice(0, 16).replace('T', ' ');

export function PreviewFreshBuildBanner() {
  const [isVisible, setIsVisible] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Só mostrar no Preview
  if (!isLovablePreviewHost()) {
    return null;
  }

  if (!isVisible) {
    return null;
  }

  const handleForceRefresh = async () => {
    setIsRefreshing(true);
    
    try {
      // 1. Desregistrar todos os Service Workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map(reg => reg.unregister()));
        console.log('[Preview] SWs desregistrados:', registrations.length);
      }

      // 2. Limpar todos os caches
      if ('caches' in window) {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map(name => caches.delete(name)));
        console.log('[Preview] Caches limpos:', cacheNames.length);
      }

      // 3. Limpar sessionStorage do controle de preview
      sessionStorage.removeItem('lovable_preview_fresh_v1');
      sessionStorage.removeItem('lovable_preview_attempts');

      // 4. Reload com cache-bust
      const url = new URL(window.location.href);
      url.searchParams.set('__preview', String(Date.now()));
      window.location.replace(url.toString());
    } catch (error) {
      console.error('[Preview] Erro ao forçar atualização:', error);
      // Fallback: reload simples
      window.location.reload();
    }
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-xs bg-background/95 backdrop-blur border border-border rounded-lg shadow-lg p-3 text-xs">
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5">
          <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
          <span className="font-medium text-foreground">Ambiente de Preview</span>
        </div>
        <button 
          onClick={() => setIsVisible(false)}
          className="text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
      
      <p className="text-muted-foreground mb-2">
        Build: <code className="bg-muted px-1 py-0.5 rounded text-[10px]">{BUILD_TIMESTAMP}</code>
      </p>
      
      <p className="text-muted-foreground mb-3">
        Se algo parecer desatualizado, force a atualização.
      </p>
      
      <button
        onClick={handleForceRefresh}
        disabled={isRefreshing}
        className="w-full flex items-center justify-center gap-1.5 bg-primary text-primary-foreground rounded-md py-1.5 px-3 font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
        {isRefreshing ? 'Atualizando...' : 'Forçar Atualização'}
      </button>
    </div>
  );
}
