/**
 * BootstrapFallback - Fallback UI quando o bootstrap falha
 * 
 * REGRA CRÍTICA:
 * - NUNCA pode existir "tela vazia" sem ação
 * - SEMPRE exibir botões de recuperação
 * - Spinner verde AgriRoute enquanto recuperando
 */

import React from 'react';
import { AppSpinner } from '@/components/ui/AppSpinner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { AlertTriangle, RefreshCw, LogOut, Wifi, WifiOff } from 'lucide-react';
import { clearSupabaseAuthStorage } from '@/utils/authRecovery';

interface BootstrapFallbackProps {
  /** Etapa onde o bootstrap falhou */
  failedStep?: string;
  /** Tempo decorrido em ms */
  elapsedMs?: number;
  /** Erro específico (se houver) */
  error?: string;
  /** Callback para tentar novamente */
  onRetry?: () => void;
  /** Se está online */
  isOnline?: boolean;
  /** Timings por step (para detalhes técnicos) */
  stepTimings?: Record<string, number>;
}

export const BootstrapFallback: React.FC<BootstrapFallbackProps> = ({
  failedStep = 'desconhecida',
  elapsedMs,
  error,
  onRetry,
  isOnline = navigator.onLine,
  stepTimings = {},
}) => {
  const [isRecovering, setIsRecovering] = React.useState(false);

  const handleRetry = () => {
    setIsRecovering(true);
    
    // Limpar cooldown de profile para permitir novo fetch
    try {
      sessionStorage.removeItem('profile_fetch_cooldown_until');
    } catch {}
    
    if (onRetry) {
      onRetry();
      // Resetar estado após um tempo para permitir nova tentativa se falhar
      setTimeout(() => setIsRecovering(false), 3000);
    } else {
      // Fallback: reload simples
      window.location.reload();
    }
  };

  const handleLogout = async () => {
    setIsRecovering(true);
    try {
      // ✅ Chamar supabase.auth.signOut primeiro
      const { supabase } = await import('@/integrations/supabase/client');
      await supabase.auth.signOut({ scope: 'local' });
      
      // Limpar storage de auth
      clearSupabaseAuthStorage();
      
      // Limpar todos os caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      
      // Ir para login
      window.location.href = '/auth';
    } catch {
      window.location.href = '/auth';
    }
  };

  const handleClearAndReload = async () => {
    setIsRecovering(true);
    try {
      // Limpar caches
      if ('caches' in window) {
        const names = await caches.keys();
        await Promise.all(names.map(n => caches.delete(n)));
      }
      
      // Limpar session storage
      try {
        sessionStorage.clear();
      } catch {}
      
      // Reload forçado
      window.location.reload();
    } catch {
      window.location.reload();
    }
  };

  if (isRecovering) {
    return <AppSpinner fullscreen />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="max-w-md w-full shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 p-3 bg-warning/10 rounded-full w-fit">
            {isOnline ? (
              <AlertTriangle className="h-10 w-10 text-warning" />
            ) : (
              <WifiOff className="h-10 w-10 text-destructive" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {isOnline ? 'Carregamento Lento' : 'Sem Conexão'}
          </CardTitle>
          <CardDescription>
            {isOnline 
              ? 'O aplicativo está demorando para carregar. Isso pode ser temporário.'
              : 'Verifique sua conexão com a internet e tente novamente.'
            }
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Info técnica (colapsável) */}
          {(failedStep || elapsedMs || error || Object.keys(stepTimings).length > 0) && (
            <details className="bg-muted rounded-lg p-3">
              <summary className="text-sm text-muted-foreground cursor-pointer">
                Detalhes técnicos
              </summary>
              <div className="mt-2 text-xs font-mono space-y-1 text-muted-foreground">
                {failedStep && <div>Etapa: {failedStep}</div>}
                {elapsedMs && <div>Tempo total: {Math.round(elapsedMs / 1000)}s</div>}
                {Object.keys(stepTimings).length > 0 && (
                  <div>
                    Timings: {Object.entries(stepTimings).map(([k, v]) => `${k}=${v}ms`).join(', ')}
                  </div>
                )}
                {error && <div>Erro: {error.slice(0, 100)}</div>}
              </div>
            </details>
          )}
          
          {/* Ações primárias */}
          <div className="grid gap-2">
            <Button onClick={handleRetry} className="w-full" disabled={!isOnline}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Tentar Novamente
            </Button>
            
            <Button variant="outline" onClick={handleClearAndReload} className="w-full">
              <Wifi className="h-4 w-4 mr-2" />
              Limpar Cache e Recarregar
            </Button>
            
            <Button variant="ghost" onClick={handleLogout} className="w-full text-muted-foreground">
              <LogOut className="h-4 w-4 mr-2" />
              Sair e Fazer Login Novamente
            </Button>
          </div>
          
          <p className="text-xs text-center text-muted-foreground pt-2">
            Se o problema persistir, entre em contato com o suporte.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default BootstrapFallback;
