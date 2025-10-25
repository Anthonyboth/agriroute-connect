import { useEffect, useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { AlertTriangle, LogIn, RefreshCw } from 'lucide-react';

export function AppHealthOverlay() {
  const [showOverlay, setShowOverlay] = useState(false);
  const mountTimeRef = useRef(Date.now());
  const hasRenderedRef = useRef(false);

  useEffect(() => {
    // Aguardar 5 segundos para verificar se a app pintou algo
    const timer = setTimeout(() => {
      if (!hasRenderedRef.current) {
        console.warn('[AppHealthOverlay] Nenhuma rota renderizou em 5s, mostrando fallback');
        setShowOverlay(true);
      }
    }, 5000);

    // Listener global para saber quando a app pintou
    const handleAppPainted = () => {
      hasRenderedRef.current = true;
      setShowOverlay(false);
    };

    window.addEventListener('app:painted', handleAppPainted);

    return () => {
      clearTimeout(timer);
      window.removeEventListener('app:painted', handleAppPainted);
    };
  }, []);

  if (!showOverlay) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-background/95 backdrop-blur-sm flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6 text-center">
        <AlertTriangle className="h-16 w-16 text-warning mx-auto animate-pulse" />
        <div className="space-y-2">
          <h2 className="text-2xl font-bold">Carregando...</h2>
          <p className="text-muted-foreground">
            Estamos revalidando sua sessão. Se isso demorar, tente as opções abaixo:
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Button
            onClick={() => window.location.href = '/auth'}
            variant="default"
            className="gap-2"
          >
            <LogIn className="h-4 w-4" />
            Entrar
          </Button>
          <Button
            onClick={() => window.location.reload()}
            variant="outline"
            className="gap-2"
          >
            <RefreshCw className="h-4 w-4" />
            Recarregar
          </Button>
        </div>
      </div>
    </div>
  );
}
