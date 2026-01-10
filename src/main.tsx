import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { installAutoRecoveryHandlers, clearRecoveryCounters } from './utils/pwaRecovery'

// Instalar handlers de auto-recuperação para erros de chunk/PWA ANTES de qualquer coisa
installAutoRecoveryHandlers();

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

createRoot(document.getElementById("root")!).render(<App />);
