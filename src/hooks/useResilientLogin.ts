/**
 * useResilientLogin - Hook robusto para autenticação com fallbacks e notificação Telegram
 * 
 * Objetivo: Garantir que o login NUNCA falhe silenciosamente e sempre redirecione
 * para o dashboard correto, com notificações automáticas de erros para monitoramento.
 */

import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isValidDocument, normalizeDocument } from '@/utils/document';
import { clearCachedProfile } from '@/lib/profile-cache';
import { saveProfileToAutofill } from '@/lib/autofill-storage';
import AutomaticApprovalService from '@/components/AutomaticApproval';
import { getDefaultRouteForProfile } from '@/security/panelAccessGuard';
import { resolvePostAuthRoute } from '@/lib/route-after-auth';

const SUPABASE_URL = "https://shnvtxejjecbnztdbbbl.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg";

export interface LoginResult {
  success: boolean;
  error?: string;
  userId?: string;
  profileId?: string;
  role?: string;
  redirectTo?: string;
  requiresProfileSelection?: boolean;
  profiles?: any[];
}

interface LoginStep {
  step: string;
  status: 'pending' | 'success' | 'error';
  error?: string;
  timestamp: number;
}

async function sleep(ms: number) {
  await new Promise((r) => setTimeout(r, ms));
}

/**
 * Garantir que o session token foi persistido (evita “login OK mas volta pro /auth” após redirect).
 */
async function ensureSessionPersisted(maxAttempts: number = 6): Promise<boolean> {
  for (let i = 0; i < maxAttempts; i++) {
    const { data: { session } } = await supabase.auth.getSession();
    if (session?.user) return true;
    await sleep(75 + i * 75);
  }
  return false;
}

/**
 * Notificar erro de login no Telegram para monitoramento
 */
async function notifyLoginErrorToTelegram(
  loginField: string,
  error: string,
  steps: LoginStep[],
  context?: Record<string, any>
): Promise<void> {
  try {
    // Mascarar dados sensíveis
    const maskedLogin = loginField.includes('@') 
      ? loginField.replace(/(.{2}).*(@.*)/, '$1***$2')
      : loginField.replace(/(.{3}).*(.{2})/, '$1***$2');
    
    await fetch(`${SUPABASE_URL}/functions/v1/telegram-error-notifier`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': SUPABASE_ANON_KEY,
        'X-Skip-Error-Monitoring': 'true'
      },
      body: JSON.stringify({
        errorType: 'AUTH',
        errorCategory: 'CRITICAL',
        errorMessage: `Login Failed: ${error}`,
        route: '/auth',
        metadata: {
          loginField: maskedLogin,
          steps: steps.map(s => ({
            step: s.step,
            status: s.status,
            error: s.error,
            duration: s.timestamp
          })),
          context,
          userAgent: navigator.userAgent.substring(0, 100),
          timestamp: new Date().toISOString()
        }
      })
    });
    console.log('🔔 [ResilientLogin] Notificação enviada ao Telegram');
  } catch (e) {
    console.debug('[ResilientLogin] Falha ao notificar Telegram (não crítico):', e);
  }
}

/**
 * Hostnames do painel administrativo (subdomínio dedicado)
 */
const ADMIN_HOSTNAMES = [
  'painel-2025.agriroute-connect.com.br',
  'www.painel-2025.agriroute-connect.com.br',
];

/**
 * Determinar rota de dashboard baseado na role do perfil.
 * Se o hostname for do painel admin, redireciona para /admin-v2.
 * Delega para panelAccessGuard — fonte única de verdade.
 */
function getDashboardRoute(role: string): string {
  // ✅ HOSTNAME GATE: Se no subdomínio admin, sempre ir para /admin-v2
  if (ADMIN_HOSTNAMES.includes(window.location.hostname)) {
    return '/admin-v2';
  }
  return getDefaultRouteForProfile({ role });
}

export function useResilientLogin() {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<LoginStep[]>([]);
  const navigate = useNavigate();

  const addStep = useCallback((step: string, status: 'pending' | 'success' | 'error', error?: string) => {
    setSteps(prev => [...prev, { step, status, error, timestamp: Date.now() }]);
  }, []);

  /**
   * Login com email/documento e senha
   * Retorna resultado estruturado com informações para redirecionamento
   */
  const login = useCallback(async (
    loginField: string,
    password: string
  ): Promise<LoginResult> => {
    setLoading(true);
    setSteps([]);
    const startTime = Date.now();
    
    console.log('🔵 [ResilientLogin] Iniciando login...');
    
    try {
      let emailToUse = loginField.trim();
      
      // ========== STEP 1: Resolver email se for documento ==========
      if (!loginField.includes('@')) {
        addStep('Validando documento', 'pending');
        
        if (!isValidDocument(loginField)) {
          addStep('Validando documento', 'error', 'Documento inválido');
          setLoading(false);
          return { success: false, error: 'CPF/CNPJ inválido. Verifique e tente novamente.' };
        }
        
        addStep('Buscando email via documento', 'pending');
        
        const normalizedDoc = normalizeDocument(loginField);
        const { data: foundEmail, error: rpcError } = await supabase
          .rpc('get_email_by_document', { p_doc: normalizedDoc });
        
        if (rpcError) {
          addStep('Buscando email via documento', 'error', rpcError.message);
          await notifyLoginErrorToTelegram(loginField, `RPC Error: ${rpcError.message}`, steps);
          setLoading(false);
          return { success: false, error: 'Erro ao buscar documento. Tente novamente.' };
        }
        
        if (!foundEmail) {
          addStep('Buscando email via documento', 'error', 'Não encontrado');
          setLoading(false);
          return { success: false, error: 'CPF/CNPJ não encontrado. Verifique ou cadastre-se.' };
        }
        
        emailToUse = foundEmail;
        addStep('Buscando email via documento', 'success');
        console.log('🟢 [ResilientLogin] Email encontrado via documento');
      }
      
      // ========== STEP 2: Autenticar com Supabase Auth ==========
      addStep('Autenticando credenciais', 'pending');
      
      const { error: authError, data: authData } = await supabase.auth.signInWithPassword({
        email: emailToUse,
        password
      });
      
      if (authError) {
        addStep('Autenticando credenciais', 'error', authError.message);
        
        const msg = authError.message || '';
        let userFriendlyError = msg;
        
        if (msg.includes('Invalid login credentials')) {
          userFriendlyError = 'E-mail/Documento ou senha incorretos';
        } else if (msg.toLowerCase().includes('email not confirmed')) {
          userFriendlyError = 'Email não confirmado. Verifique sua caixa de entrada.';
        }
        
        // Notificar apenas erros inesperados (não credenciais inválidas)
        if (!msg.includes('Invalid login credentials')) {
          await notifyLoginErrorToTelegram(loginField, msg, steps);
        }
        
        setLoading(false);
        return { success: false, error: userFriendlyError };
      }
      
      addStep('Autenticando credenciais', 'success');
      console.log('🟢 [ResilientLogin] Autenticação bem-sucedida');

      // ✅ Usar user diretamente do signInWithPassword (evita chamada extra getUser)
      const user = authData?.user;
      
      if (!user) {
        addStep('Obtendo dados do usuário', 'error', 'Usuário não retornado pelo login');
        setLoading(false);
        return { success: false, error: 'Erro ao obter dados do usuário.' };
      }
      
      addStep('Obtendo dados do usuário', 'success');

      // ✅ CRÍTICO: evitar tela de "Conta Pendente" por cache antigo após auto-aprovação
      try {
        clearCachedProfile(user.id);
      } catch {
        // ignore
      }

      // Limpar cooldowns de fetch de perfil
      sessionStorage.removeItem('profile_fetch_cooldown_until');

      // Helper: tenta navegação SPA primeiro, e faz hard redirect como fallback
      const safeRedirect = (to: string) => {
        try {
          navigate(to, { replace: true });
        } catch {
          // ignore
        }
        // Fallback: se continuar no /auth, forçar hard redirect
        setTimeout(() => {
          if (window.location.pathname === '/auth') {
            window.location.href = to;
          }
        }, 150);
      };
      
      // ========== STEP 4: Buscar perfis com retry ==========
      addStep('Carregando perfil', 'pending');
      
      let userProfiles: any[] | null = null;
      let profilesError: any = null;
      
      // Retry até 2 vezes com delay curto
      for (let attempt = 1; attempt <= 2; attempt++) {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, user_id, full_name, role, status, active_mode')
          .eq('user_id', user.id);
        
        if (!error && data && data.length > 0) {
          userProfiles = data;
          break;
        }
        
        profilesError = error;
        
        if (attempt < 2) {
          console.log(`🔄 [ResilientLogin] Retry ${attempt}/2 para buscar perfil...`);
          await new Promise(r => setTimeout(r, 200));
        }
      }
      
      if (profilesError) {
        addStep('Carregando perfil', 'error', profilesError.message);
        
        // ✅ FALLBACK CRÍTICO: Usar user_metadata do JWT para determinar rota
        console.log('🟡 [ResilientLogin] Usando fallback via user_metadata');
        
        const userMeta = user.user_metadata;
        const fallbackRole = userMeta?.role || userMeta?.active_mode || 'PRODUTOR';
        // ⛔ NEVER route to dashboard without security gates — safe fallback only
        const fallbackRoute = '/complete-profile';
        
        // Notificar erro mas permitir navegação via fallback
        await notifyLoginErrorToTelegram(loginField, `Profile fetch failed: ${profilesError.message}`, steps, {
          fallbackRole,
          fallbackRoute,
          userMetadata: { role: userMeta?.role }
        });
        
        setLoading(false);
        toast.success('Login realizado!');
        
        // Redirecionar via fallback
        console.log(`🟢 [ResilientLogin] Fallback redirect para: ${fallbackRoute}`);
        safeRedirect(fallbackRoute);
        
        return { 
          success: true, 
          userId: user.id,
          role: fallbackRole,
          redirectTo: fallbackRoute
        };
      }
      
      addStep('Carregando perfil', 'success');
      
      // ========== STEP 5: Processar perfis e determinar redirecionamento ==========
      if (!userProfiles || userProfiles.length === 0) {
        addStep('Verificando perfis', 'error', 'Nenhum perfil encontrado');
        
        // Usuário sem perfil - redirecionar para criação
        toast.warning('Perfil não encontrado. Complete seu cadastro.');
        safeRedirect('/complete-profile');
        setLoading(false);
        return { 
          success: true, 
          userId: user.id, 
          redirectTo: '/complete-profile',
          error: 'Perfil não encontrado. Complete seu cadastro.'
        };
      }
      
      // Múltiplos perfis - retornar para seleção
      if (userProfiles.length > 1) {
        addStep('Múltiplos perfis detectados', 'success');
        setLoading(false);
        
        return {
          success: true,
          userId: user.id,
          requiresProfileSelection: true,
          profiles: userProfiles
        };
      }
      
      // ========== STEP 6: Perfil único - redirecionar diretamente ==========
      const targetProfile = userProfiles[0];
      const targetRole = targetProfile.role || targetProfile.active_mode || 'PRODUTOR';

      // ✅ REGRA DE NEGÓCIO: PRODUTOR e TRANSPORTADORA devem ser aprovados automaticamente
      if ((targetRole === 'PRODUTOR' || targetRole === 'TRANSPORTADORA') && targetProfile.status !== 'APPROVED') {
        addStep('Aprovação automática', 'pending');
        try {
          await AutomaticApprovalService.triggerApprovalProcess(targetProfile.id);
          await sleep(250);
          clearCachedProfile(user.id);
          addStep('Aprovação automática', 'success');
        } catch (e: any) {
          addStep('Aprovação automática', 'error', e?.message || 'Falha ao aprovar automaticamente');
          await notifyLoginErrorToTelegram(loginField, `Auto-approve failed: ${e?.message || 'unknown'}`, steps, {
            targetRole,
            profileId: targetProfile.id,
          });
        }
      }

      // ✅ CRITICAL FIX: Buscar dados completos do perfil para os gates de segurança
      // (selfie_url, document_photo_url, status atualizado pós-auto-aprovação)
      addStep('Verificando gates de segurança', 'pending');
      
      const { data: fullProfile } = await supabase
        .from('profiles')
        .select('id, role, status, selfie_url, document_photo_url, force_password_change')
        .eq('id', targetProfile.id)
        .single();

      // ✅ GATE UNIVERSAL: Usar resolvePostAuthRoute para aplicar os mesmos gates
      // que routeAfterAuth (documentos obrigatórios, aprovação admin para MOTORISTA)
      let targetRoute: string;
      
      if (fullProfile) {
        targetRoute = await resolvePostAuthRoute({
          id: fullProfile.id,
          role: fullProfile.role || 'PRODUTOR',
          status: fullProfile.status || 'PENDING',
          selfie_url: fullProfile.selfie_url,
          document_photo_url: fullProfile.document_photo_url,
          force_password_change: fullProfile.force_password_change ?? false,
        });
      } else {
        // ⛔ NEVER route to dashboard without security gates — safe fallback only
        targetRoute = '/complete-profile';
      }

      // ✅ HOSTNAME GATE: Se no subdomínio admin, override para /admin-v2
      if (ADMIN_HOSTNAMES.includes(window.location.hostname)) {
        targetRoute = '/admin-v2';
      }
      
      addStep('Verificando gates de segurança', 'success');
      
      // Salvar profile ativo
      localStorage.setItem('current_profile_id', targetProfile.id);
      
      addStep('Preparando redirecionamento', 'success');
      
      const totalTime = Date.now() - startTime;
      console.log(`🟢 [ResilientLogin] Login completo em ${totalTime}ms -> ${targetRoute}`);
      
      setLoading(false);
      toast.success('Login realizado!');
      
      // ✅ Salvar dados do perfil para autofill futuro (não salva senha)
      saveProfileToAutofill(targetProfile);
      
      // ✅ REDIRECIONAMENTO GARANTIDO (SPA + hard redirect fallback)
      safeRedirect(targetRoute);
      
      return {
        success: true,
        userId: user.id,
        profileId: targetProfile.id,
        role: targetRole,
        redirectTo: targetRoute
      };
      
    } catch (error: any) {
      const errorMessage = error?.message || 'Erro desconhecido';
      addStep('Erro fatal', 'error', errorMessage);
      
      console.error('🔴 [ResilientLogin] Erro fatal:', error);
      
      // Sempre notificar erros fatais
      await notifyLoginErrorToTelegram(loginField, errorMessage, steps);
      
      setLoading(false);
      return { success: false, error: 'Erro no login. Tente novamente.' };
    }
  }, [addStep, navigate]);

  /**
   * Selecionar perfil específico após login com múltiplos perfis
   */
  const selectProfile = useCallback(async (profile: any) => {
    localStorage.setItem('current_profile_id', profile.id);
    
    const targetRole = profile.role || profile.active_mode || 'PRODUTOR';
    
    // ✅ CRITICAL FIX: Buscar perfil completo e aplicar gates de segurança
    const { data: fullProfile } = await supabase
      .from('profiles')
      .select('id, role, status, selfie_url, document_photo_url')
      .eq('id', profile.id)
      .single();

    let targetRoute: string;
    
    if (fullProfile) {
      targetRoute = await resolvePostAuthRoute({
        id: fullProfile.id,
        role: fullProfile.role || 'PRODUTOR',
        status: fullProfile.status || 'PENDING',
        selfie_url: fullProfile.selfie_url,
        document_photo_url: fullProfile.document_photo_url,
      });
    } else {
      // ⛔ NEVER route to dashboard without security gates — safe fallback only
      targetRoute = '/complete-profile';
    }
    
    // ✅ HOSTNAME GATE: Se no subdomínio admin, ir para /admin-v2
    const finalRoute = ADMIN_HOSTNAMES.includes(window.location.hostname) ? '/admin-v2' : targetRoute;
    
    console.log(`🟢 [ResilientLogin] Perfil selecionado: ${targetRole} -> ${finalRoute}`);

    try {
      navigate(finalRoute, { replace: true });
    } finally {
      setTimeout(() => {
        if (window.location.pathname === '/auth') {
          window.location.href = finalRoute;
        }
      }, 150);
    }
  }, [navigate]);

  return {
    login,
    selectProfile,
    loading,
    steps
  };
}
