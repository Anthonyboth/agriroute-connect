import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";

if (typeof window !== 'undefined') {
  (window as any).__domErrors = (window as any).__domErrors || [];
  window.addEventListener('error', (e) => {
    const msg = String(e?.message || '');
    if (msg.includes('insertBefore') || msg.includes('removeChild')) {
      (window as any).__domErrors.push(msg);
    }
  });
}

createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Toaster />
    <Sonner />
  </>
);
