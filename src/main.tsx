import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

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
}

createRoot(document.getElementById("root")!).render(<App />);
