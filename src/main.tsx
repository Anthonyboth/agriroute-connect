import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installAutoRecoveryHandlers, clearRecoveryCounters } from './utils/pwaRecovery'
import { isLovablePreviewHost } from './utils/isLovablePreviewHost'

// Instalar handlers de auto-recuperação para erros de chunk/PWA ANTES de qualquer coisa
installAutoRecoveryHandlers();

/**
 * ✅ Preview Fresh Build System v2
 * 
 * Em Preview (lovableproject.com), Service Workers antigos podem "prender" versões antigas.
 * Esta versão:
 * 1. Permite múltiplas tentativas (até 3 em 5 minutos)
 * 2. Re-executa se detectar SW ativo controlando a página
 * 3. Sempre limpa caches antes de continuar
 */
const PREVIEW_ATTEMPTS_KEY = 'lovable_preview_attempts';
const PREVIEW_LAST_TS_KEY = 'lovable_preview_last_ts';
const MAX_PREVIEW_ATTEMPTS = 3;
const PREVIEW_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

async function ensureFreshPreviewBuild() {
  if (!isLovablePreviewHost()) return;

  try {
    const now = Date.now();
    const lastTs = parseInt(sessionStorage.getItem(PREVIEW_LAST_TS_KEY) || '0', 10);
    let attempts = parseInt(sessionStorage.getItem(PREVIEW_ATTEMPTS_KEY) || '0', 10);

    // Reset se fora da janela
    if (now - lastTs > PREVIEW_WINDOW_MS) {
      attempts = 0;
    }

    // Verificar se há SW controlando a página (indicativo de versão antiga potencial)
    const hasActiveSW = !!(navigator.serviceWorker?.controller);
    
    // ✅ NOVO: Verificar se há SWs registrados (mesmo que não estejam controlando)
    let hasRegisteredSW = false;
    if ('serviceWorker' in navigator) {
      try {
        const regs = await navigator.serviceWorker.getRegistrations();
        hasRegisteredSW = regs.length > 0;
      } catch {}
    }

    // Se não há SW ativo nem registrado, não há nada para limpar - seguir direto
    if (!hasActiveSW && !hasRegisteredSW) {
      console.log('[Preview] Sem SW ativo/registrado - continuando sem limpeza');
      return;
    }

    // Se já tentamos o máximo, seguir mesmo com SW
    if (attempts >= MAX_PREVIEW_ATTEMPTS) {
      console.log('[Preview] Max tentativas atingidas - continuando');
      return;
    }

    // Executar limpeza apenas se houver SW para limpar
    attempts++;
    sessionStorage.setItem(PREVIEW_ATTEMPTS_KEY, String(attempts));
    sessionStorage.setItem(PREVIEW_LAST_TS_KEY, String(now));

    console.log(`[Preview] Limpeza de cache (tentativa ${attempts}/${MAX_PREVIEW_ATTEMPTS}, activeSW=${hasActiveSW}, registeredSW=${hasRegisteredSW})`);

    // Desregistrar todos os SWs
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      if (regs.length > 0) {
        await Promise.all(regs.map(r => r.unregister()));
        console.log('[Preview] SWs desregistrados:', regs.length);
      }
    }

    // Limpar todos os caches
    if ('caches' in window) {
      const names = await caches.keys();
      if (names.length > 0) {
        await Promise.all(names.map(n => caches.delete(n)));
        console.log('[Preview] Caches limpos:', names.length);
      }
    }

    // Reload para aplicar limpeza
    if (attempts <= MAX_PREVIEW_ATTEMPTS) {
      const url = new URL(window.location.href);
      url.searchParams.set('__preview', String(now));
      console.log('[Preview] Recarregando para aplicar limpeza...');
      window.location.replace(url.toString());
      return;
    }
  } catch (error) {
    console.warn('[Preview] Erro na limpeza:', error);
    // Continua mesmo com erro
  }
}

/**
 * ✅ Registra o Service Worker APENAS em produção web (não no Preview nem no Capacitor)
 */
async function registerServiceWorker() {
  // Não registrar SW no Preview - evita cache de versões antigas
  if (isLovablePreviewHost()) {
    console.log('[SW] Preview detectado - SW não será registrado');
    return;
  }

  // Não registrar SW no Capacitor (localhost) - SWs não funcionam em WebView nativo
  const isCapacitorApp = window.location.hostname === 'localhost' || 
    window.location.protocol === 'capacitor:' ||
    !!(window as any).Capacitor;
  if (isCapacitorApp) {
    console.log('[SW] Capacitor/localhost detectado - SW não será registrado');
    return;
  }

  if ('serviceWorker' in navigator) {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/'
      });
      console.log('[SW] Registrado com sucesso:', registration.scope);
    } catch (error) {
      console.warn('[SW] Falha no registro:', error);
    }
  }
}

// ✅ FALLBACK GLOBAL: Garantir que splash NUNCA trave o app
// Esconde splash após 10s independente de React montar
if (typeof window !== 'undefined' && (window as any).Capacitor?.isNativePlatform?.()) {
  setTimeout(async () => {
    try {
      const { SplashScreen } = await import('@capacitor/splash-screen');
      await SplashScreen.hide({ fadeOutDuration: 300 });
      console.warn('[main] ⚠️ Fallback global de splash ativado');
    } catch {}
  }, 10000);
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
          
          // Registrar SW apenas em produção (após mount bem sucedido)
          registerServiceWorker();
        }
      }, 3000);
    });
  }

  createRoot(document.getElementById('root')!).render(<App />);
})();
