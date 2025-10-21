import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'

// Runtime guard: monkey-patch removeChild to ignore NotFoundError thrown when other code
// tries to remove a node that is no longer a child. This is an emergency mitigation
// to stop transient DOM NotFoundError from crashing UI while we fix root causes.
if (typeof window !== 'undefined') {
  (window as any).__domErrors = (window as any).__domErrors || [];

  // Capture global errors (existing behavior)
  window.addEventListener('error', (e) => {
    const msg = String(e?.message || '');
    if (msg.includes('insertBefore') || msg.includes('removeChild')) {
      (window as any).__domErrors.push(msg);
    }
  });

  // Monkey-patch Node.prototype.removeChild to swallow NotFoundError (safe fallback)
  try {
    const originalRemoveChild = Node.prototype.removeChild;
    let warned = false;
    // @ts-ignore
    Node.prototype.removeChild = function (child: Node) {
      try {
        // @ts-ignore
        return originalRemoveChild.call(this, child);
      } catch (err: any) {
        // If it's a NotFoundError because node is not a child, swallow and log once
        if (err && (err.name === 'NotFoundError' || err.message?.includes('removeChild') || err.message?.includes('The node to be removed is not a child of this node'))) {
          if (!warned) {
            console.warn('[DOM_PATCH] Ignoring NotFoundError from removeChild to avoid transient crash', err.message);
            warned = true;
          }
          return child;
        }
        throw err;
      }
    };
  } catch (e) {
    console.warn('[DOM_PATCH] Could not patch removeChild:', e);
  }
}

createRoot(document.getElementById("root")!).render(<App />);