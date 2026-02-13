/**
 * PWA Auto-Recovery System
 * 
 * Detecta erros de chunk/módulo dinâmico (típicos após atualização do app)
 * e executa limpeza automática de cache + reload para recuperar o app.
 */

const RECOVERY_KEY = 'pwa_recovery_count';
const RECOVERY_TS_KEY = 'pwa_recovery_last_ts';
const RECOVERY_REASON_KEY = 'pwa_last_recovery_reason';
const MAX_RECOVERIES = 2;
const RECOVERY_WINDOW_MS = 5 * 60 * 1000; // 5 minutos

/**
 * Detecta se o erro é relacionado a chunk/módulo dinâmico
 */
export function isChunkLoadError(error: unknown): boolean {
  if (!error) return false;
  
  const errorString = error instanceof Error 
    ? `${error.name} ${error.message} ${error.stack || ''}`
    : String(error);
  
  const patterns = [
    /ChunkLoadError/i,
    /Loading chunk .* failed/i,
    /Failed to fetch dynamically imported module/i,
    /Importing a module script failed/i,
    /error loading dynamically imported module/i,
    /Failed to load module script/i,
    /Unable to preload CSS/i,
    // Erro de sintaxe em chunk (quando HTML é retornado no lugar de JS)
    /Unexpected token '<'/i,
    // ✅ Detectar URLs de source code que não deveriam existir em produção
    /\/src\/.*\.ts/i,
    /\/src\/.*\.tsx/i,
  ];
  
  return patterns.some(pattern => pattern.test(errorString));
}

/**
 * Verifica se podemos tentar recuperação (evita loop infinito)
 */
function canAttemptRecovery(): boolean {
  try {
    const countStr = sessionStorage.getItem(RECOVERY_KEY);
    const tsStr = sessionStorage.getItem(RECOVERY_TS_KEY);
    
    const count = countStr ? parseInt(countStr, 10) : 0;
    const lastTs = tsStr ? parseInt(tsStr, 10) : 0;
    const now = Date.now();
    
    // Reset counter if outside recovery window
    if (now - lastTs > RECOVERY_WINDOW_MS) {
      sessionStorage.setItem(RECOVERY_KEY, '0');
      return true;
    }
    
    return count < MAX_RECOVERIES;
  } catch {
    return true; // Se sessionStorage falhar, tenta mesmo assim
  }
}

/**
 * Incrementa o contador de tentativas de recuperação
 */
function incrementRecoveryCount(): number {
  try {
    const countStr = sessionStorage.getItem(RECOVERY_KEY);
    const count = (countStr ? parseInt(countStr, 10) : 0) + 1;
    sessionStorage.setItem(RECOVERY_KEY, String(count));
    sessionStorage.setItem(RECOVERY_TS_KEY, String(Date.now()));
    return count;
  } catch {
    return 1;
  }
}

/**
 * Adiciona cache-bust à URL para forçar reload limpo
 */
function addCacheBust(url: string): string {
  const urlObj = new URL(url, window.location.origin);
  urlObj.searchParams.set('__recover', String(Date.now()));
  return urlObj.toString();
}

/**
 * Executa hard reset do PWA: desregistra SW, limpa caches, recarrega
 */
export async function hardResetPWA(reason: string): Promise<void> {
  console.warn('[PWA Recovery] Iniciando hard reset:', reason);
  
  if (!canAttemptRecovery()) {
    console.error('[PWA Recovery] Máximo de tentativas atingido. Exibindo fallback.');
    throw new Error('MAX_RECOVERY_ATTEMPTS');
  }
  
  const attempt = incrementRecoveryCount();
  if (import.meta.env.DEV) console.log(`[PWA Recovery] Tentativa ${attempt}/${MAX_RECOVERIES}`);
  
  try {
    // Salvar razão para diagnóstico
    localStorage.setItem(RECOVERY_REASON_KEY, JSON.stringify({
      reason,
      timestamp: new Date().toISOString(),
      url: window.location.href,
      attempt
    }));
    
    // 1. Desregistrar todos os Service Workers
    if ('serviceWorker' in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map(reg => {
        if (import.meta.env.DEV) console.log('[PWA Recovery] Desregistrando SW:', reg.scope);
        return reg.unregister();
      }));
    }
    
    // 2. Limpar todos os caches
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(cacheNames.map(name => {
        if (import.meta.env.DEV) console.log('[PWA Recovery] Deletando cache:', name);
        return caches.delete(name);
      }));
    }
    
    // 3. Limpar storage relacionado ao PWA (opcional, mas ajuda)
    try {
      localStorage.removeItem('workbox-expiration');
    } catch {}
    
    if (import.meta.env.DEV) console.log('[PWA Recovery] Limpeza concluída. Recarregando...');
    
    // 4. Recarregar com cache-bust
    window.location.replace(addCacheBust(window.location.href));
    
  } catch (error) {
    console.error('[PWA Recovery] Erro durante reset:', error);
    // Fallback: reload simples
    window.location.reload();
  }
}

/**
 * Estado para evitar múltiplas execuções simultâneas
 */
let isRecovering = false;

/**
 * Handler para erros de chunk - executa recuperação se necessário
 */
async function handleChunkError(error: unknown): Promise<void> {
  if (isRecovering) return;
  
  if (isChunkLoadError(error)) {
    isRecovering = true;
    
    try {
      await hardResetPWA('chunk_load_error');
    } catch (e) {
      if (e instanceof Error && e.message === 'MAX_RECOVERY_ATTEMPTS') {
        // Exibir UI de fallback manual
        showManualRecoveryUI();
      }
    }
  }
}

/**
 * Exibe UI simples para recuperação manual quando auto-recovery falha
 */
function showManualRecoveryUI(): void {
  // Só exibe se não houver outro fallback já visível
  if (document.getElementById('pwa-recovery-fallback')) return;
  
  const fallbackDiv = document.createElement('div');
  fallbackDiv.id = 'pwa-recovery-fallback';
  fallbackDiv.innerHTML = `
    <div style="
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.9);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 99999;
      font-family: system-ui, -apple-system, sans-serif;
    ">
      <div style="
        background: #1a1a1a;
        border: 1px solid #333;
        border-radius: 12px;
        padding: 32px;
        max-width: 400px;
        text-align: center;
        color: #fff;
      ">
        <div style="font-size: 48px; margin-bottom: 16px;">⚠️</div>
        <h2 style="margin: 0 0 12px; font-size: 20px;">Problema de Atualização</h2>
        <p style="margin: 0 0 24px; color: #999; font-size: 14px; line-height: 1.5;">
          Detectamos um problema com o cache do app. A recuperação automática não funcionou.
        </p>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          <button onclick="location.reload()" style="
            padding: 12px 24px;
            background: #16a34a;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            🔄 Recarregar Página
          </button>
          <button onclick="
            navigator.serviceWorker?.getRegistrations().then(r => Promise.all(r.map(x => x.unregister())));
            caches?.keys().then(k => Promise.all(k.map(x => caches.delete(x))));
            setTimeout(() => location.reload(), 500);
          " style="
            padding: 12px 24px;
            background: #333;
            color: #fff;
            border: 1px solid #555;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 600;
            cursor: pointer;
          ">
            🧹 Limpar Cache do App
          </button>
          <button onclick="
            const info = {
              userAgent: navigator.userAgent,
              url: location.href,
              timestamp: new Date().toISOString(),
              swController: !!navigator.serviceWorker?.controller,
              lastRecovery: localStorage.getItem('pwa_last_recovery_reason')
            };
            navigator.clipboard?.writeText(JSON.stringify(info, null, 2));
            this.textContent = '✓ Copiado!';
          " style="
            padding: 12px 24px;
            background: transparent;
            color: #999;
            border: 1px solid #444;
            border-radius: 8px;
            font-size: 14px;
            cursor: pointer;
          ">
            📋 Copiar Diagnóstico
          </button>
        </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(fallbackDiv);
}

/**
 * Instala handlers globais para auto-recuperação
 */
export function installAutoRecoveryHandlers(): void {
  // Handler para erros síncronos
  window.addEventListener('error', (event) => {
    handleChunkError(event.error || event.message);
  });
  
  // Handler para promises rejeitadas (imports dinâmicos)
  window.addEventListener('unhandledrejection', (event) => {
    handleChunkError(event.reason);
  });
  
  console.debug('[PWA Recovery] Handlers de auto-recuperação instalados');
}

/**
 * Verifica se o app está controlado por um Service Worker
 */
export function hasActiveServiceWorker(): boolean {
  return !!(navigator.serviceWorker?.controller);
}

/**
 * Obtém informações de diagnóstico para debugging
 */
export async function getDiagnosticInfo(): Promise<Record<string, unknown>> {
  const info: Record<string, unknown> = {
    timestamp: new Date().toISOString(),
    url: window.location.href,
    userAgent: navigator.userAgent,
    hasSW: 'serviceWorker' in navigator,
    swController: !!navigator.serviceWorker?.controller,
    lastRecoveryReason: null,
    cacheNames: [],
    recoveryCount: sessionStorage.getItem(RECOVERY_KEY) || '0'
  };
  
  try {
    const reason = localStorage.getItem(RECOVERY_REASON_KEY);
    info.lastRecoveryReason = reason ? JSON.parse(reason) : null;
  } catch {}
  
  try {
    if ('caches' in window) {
      info.cacheNames = await caches.keys();
    }
  } catch {}
  
  return info;
}

/**
 * Limpa os contadores de recuperação (usar após sucesso)
 */
export function clearRecoveryCounters(): void {
  try {
    sessionStorage.removeItem(RECOVERY_KEY);
    sessionStorage.removeItem(RECOVERY_TS_KEY);
  } catch {}
}
