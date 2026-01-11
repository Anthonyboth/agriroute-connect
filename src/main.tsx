import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installAutoRecoveryHandlers, clearRecoveryCounters } from './utils/pwaRecovery'
import { isLovablePreviewHost } from './utils/isLovablePreviewHost'

// Instalar handlers de auto-recuperação para erros de chunk/PWA ANTES de qualquer coisa
installAutoRecoveryHandlers();

async function ensureFreshPreviewBuild() {
  // Em Preview, um Service Worker antigo pode “prender” uma versão anterior do app.
  // Aqui forçamos 1 limpeza + reload (apenas 1x por aba) para garantir sempre a versão atual.
  const KEY = 'lovable_preview_fresh_v1';
  if (!isLovablePreviewHost()) return;
  if (sessionStorage.getItem(KEY) === '1') return;

  try {
    sessionStorage.setItem(KEY, '1');

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map(r => r.unregister()));
    }

    if ('caches' in window) {
      const names = await caches.keys();
      await Promise.all(names.map(n => caches.delete(n)));
    }

    // Reload com cache-bust para garantir que o HTML e chunks venham da rede
    const url = new URL(window.location.href);
    url.searchParams.set('__preview', String(Date.now()));
    window.location.replace(url.toString());
  } catch {
    // Se falhar, deixa seguir normalmente
  }
}

// Bootstrap controlado para permitir limpeza/reload antes do mount
void (async () => {
  await ensureFreshPreviewBuild();

  if (typeof window !== 'undefined') {
    (window as any).__domErrors = (window as any).__domErrors || [];
    window.addEventListener('error', (e) => {
      const msg = String(e?.message || '');
      const err = e?.error;

      // Ignorar NotFoundError de removeChild/insertBefore (tratados por ErrorBoundaries)
      if (
        err?.name === 'NotFoundError' &&
        (msg.includes('insertBefore') || msg.includes('removeChild'))
      ) {
        console.debug('[main] NotFoundError DOM ignorado (tratado por boundary):', msg);
        return;
      }

      // Registrar outros erros DOM
      if (msg.includes('insertBefore') || msg.includes('removeChild')) {
        (window as any).__domErrors.push(msg);
      }
    });

    // Marcar que o app montou com sucesso (para watchdog)
    window.addEventListener('DOMContentLoaded', () => {
      // Se chegou aqui sem erros de chunk, limpar contadores de recuperação
      setTimeout(() => {
        if (document.getElementById('root')?.children.length > 0) {
          clearRecoveryCounters();
          (window as any).__APP_MOUNTED__ = true;
        }
      }, 3000);
    });
  }

  createRoot(document.getElementById('root')!).render(<App />);
})();
