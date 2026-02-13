import { supabase } from "@/integrations/supabase/client";
import type { AutoCorrectionResult } from "@/types/errorTypes";
import { devLog } from "@/lib/devLogger";

export class ErrorAutoCorrector {
  private static instance: ErrorAutoCorrector;

  static getInstance(): ErrorAutoCorrector {
    if (!ErrorAutoCorrector.instance) {
      ErrorAutoCorrector.instance = new ErrorAutoCorrector();
    }
    return ErrorAutoCorrector.instance;
  }

  async correctError(error: Error): Promise<AutoCorrectionResult> {
    devLog('[ErrorAutoCorrector] Tentando corrigir erro:', error.message);

    // Timeout/Network errors
    if (this.isNetworkTimeout(error)) {
      return await this.retryWithBackoff(async () => {
        await this.reconnectSupabase();
      }, 'Retry with reconnection', 3);
    }

    // 401 Unauthorized
    if (this.isUnauthorized(error)) {
      return await this.handleUnauthorized();
    }

    // Cache corrupto
    if (this.isCacheError(error)) {
      return this.clearLocalCache();
    }

    // State inconsistente (React Query)
    if (this.isStateError(error)) {
      return this.resetQueryCache();
    }

    // Erro genérico
    return {
      attempted: false,
      action: 'Nenhuma correção automática disponível',
      success: false
    };
  }

  private isNetworkTimeout(error: Error): boolean {
    return error.message.toLowerCase().includes('timeout') ||
           error.message.toLowerCase().includes('network') ||
           error.message.toLowerCase().includes('fetch failed');
  }

  private isUnauthorized(error: Error): boolean {
    return error.message.includes('401') ||
           error.message.toLowerCase().includes('unauthorized') ||
           error.message.toLowerCase().includes('jwt');
  }

  private isCacheError(error: Error): boolean {
    return error.message.toLowerCase().includes('cache') ||
           error.message.toLowerCase().includes('storage');
  }

  private isStateError(error: Error): boolean {
    return error.message.toLowerCase().includes('state') ||
           error.message.toLowerCase().includes('query');
  }

  async retryWithBackoff(
    fn: () => Promise<void>,
    action: string,
    maxRetries = 3
  ): Promise<AutoCorrectionResult> {
    for (let i = 0; i < maxRetries; i++) {
      try {
        await fn();
        devLog(`[ErrorAutoCorrector] ${action} - Sucesso na tentativa ${i + 1}`);
        return {
          attempted: true,
          action: `${action} (tentativa ${i + 1}/${maxRetries})`,
          success: true
        };
      } catch (error) {
        devLog(`[ErrorAutoCorrector] ${action} - Falha na tentativa ${i + 1}`);
        if (i < maxRetries - 1) {
          const delay = Math.pow(2, i) * 1000; // 1s, 2s, 4s
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    return {
      attempted: true,
      action: `${action} (${maxRetries} tentativas)`,
      success: false
    };
  }

  async handleUnauthorized(): Promise<AutoCorrectionResult> {
    devLog('[ErrorAutoCorrector] Tentando refresh de sessão');
    
    try {
      const { data, error } = await supabase.auth.refreshSession();
      
      if (error || !data.session) {
        window.location.href = '/auth';
        return {
          attempted: true,
          action: 'Refresh de sessão falhou, redirecionando para login',
          success: false
        };
      }

      return {
        attempted: true,
        action: 'Refresh de sessão bem-sucedido',
        success: true
      };
    } catch (error) {
      return {
        attempted: true,
        action: 'Erro ao tentar refresh de sessão',
        success: false
      };
    }
  }

  clearLocalCache(): AutoCorrectionResult {
    devLog('[ErrorAutoCorrector] Limpando cache local');
    
    try {
      const supabaseKeys = Object.keys(localStorage).filter(key => 
        key.startsWith('sb-')
      );
      
      Object.keys(localStorage).forEach(key => {
        if (!supabaseKeys.includes(key)) {
          localStorage.removeItem(key);
        }
      });

      sessionStorage.clear();

      return {
        attempted: true,
        action: 'Cache local limpo (exceto sessão)',
        success: true
      };
    } catch (error) {
      return {
        attempted: true,
        action: 'Erro ao limpar cache local',
        success: false
      };
    }
  }

  resetQueryCache(): AutoCorrectionResult {
    devLog('[ErrorAutoCorrector] Resetando React Query cache');
    
    try {
      window.location.reload();
      
      return {
        attempted: true,
        action: 'Página recarregada para resetar estado',
        success: true
      };
    } catch (error) {
      return {
        attempted: true,
        action: 'Erro ao recarregar página',
        success: false
      };
    }
  }

  async reconnectSupabase(): Promise<void> {
    devLog('[ErrorAutoCorrector] Tentando reconectar Supabase');
    
    const { data, error } = await supabase.auth.getSession();
    if (error) {
      throw new Error('Falha ao reconectar Supabase');
    }
  }
}
