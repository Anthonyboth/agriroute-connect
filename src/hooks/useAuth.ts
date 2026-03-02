import React, { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react';
import { devLog } from '@/lib/devLogger';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryWithTimeout } from '@/lib/query-utils';
import { clearSupabaseAuthStorage } from '@/utils/authRecovery';
import { getCachedProfile, setCachedProfile, clearCachedProfile } from '@/lib/profile-cache';
import { incrementAuthListeners, decrementAuthListeners, incrementSignOutCalls } from '@/debug/authDebug';
import { clearSmartCache } from '@/hooks/useSmartQuery';
import AutomaticApprovalService from '@/components/AutomaticApproval';
export interface UserProfile {
  id: string;
  user_id: string;
  email?: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'ADMIN' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA'; // derivado de active_mode para compatibilidade
  roles: string[]; // Array de roles do user_roles (ex: admin)
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  active_mode?: string | null;
  selfie_url?: string;
  document_photo_url?: string;
  cnh_photo_url?: string;
  truck_documents_url?: string;
  truck_photo_url?: string;
  license_plate_photo_url?: string;
  address_proof_url?: string;
  contact_phone?: string;
  location_enabled?: boolean;
  // Campos existentes adicionais
  farm_name?: string;
  farm_address?: string;
  cpf_cnpj?: string;
  rntrc?: string;
  antt_number?: string;
  cooperative?: string;
  rating?: number;
  // Novos campos de segurança
  cnh_expiry_date?: string;
  cnh_category?: string;
  document_validation_status?: string;
  cnh_validation_status?: string;
  rntrc_validation_status?: string;
  validation_notes?: string;
  emergency_contact_name?: string;
  emergency_contact_phone?: string;
  background_check_status?: string;
  rating_locked?: boolean;
  last_gps_update?: string;
  current_location_lat?: number;
  current_location_lng?: number;
  // Sistema de match inteligente
  service_types?: string[];
  // Localização base do usuário
  base_city_name?: string;
  base_state?: string;
  base_lat?: number;
  base_lng?: number;
  current_city_name?: string;
  current_state?: string;
}

// NOTE: Internal implementation. Use the exported `useAuth()` hook (context consumer) instead.
const useAuthInternal = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  const [profileError, setProfileError] = useState<{ code: string; message?: string; document?: string } | null>(null);
  
  // Prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);
  const lastFetchTimestamp = useRef<number>(0);
  const lastTimeoutAt = useRef<number>(0);
  const didInitialFetchRef = useRef(false);
  const lastErrorLogAt = useRef<number>(0); // ✅ Throttling de logs
  const FETCH_THROTTLE_MS = 2000;
  const TIMEOUT_COOLDOWN_MS = 60000; // 60s cooldown após timeout
  const ERROR_LOG_THROTTLE_MS = 60000; // 60s entre logs detalhados
  const hasFixedActiveModeRef = useRef(false); // ✅ Flag para evitar loop infinito
  const isSigningOutRef = useRef(false); // ✅ Single-flight guard para logout
  const autoCreateAttemptedRef = useRef(false); // ✅ P0 FIX: Anti-loop guard for create_additional_profile

  // ✅ Garantir regra de negócio: auto-approve (PRODUTOR/TRANSPORTADORA) só tenta 1x por perfil nesta sessão
  const autoApproveAttemptedRef = useRef<Set<string>>(new Set());

  // ✅ P0 FIX: Ref para rastrear último userId buscado e evitar refetches desnecessários
  const lastFetchedUserIdRef = useRef<string | null>(null);
  
  // Memoized fetch function to prevent recreation on every render
  const fetchProfile = useCallback(async (userId: string, force: boolean = false) => {
    // ✅ FIX: Quando force=true, limpar TODOS os gates e cooldowns primeiro
    if (force) {
      devLog('[useAuth] 🔄 Force refresh solicitado, limpando gates...');
      try {
        sessionStorage.removeItem('profile_fetch_cooldown_until');
        clearCachedProfile(userId);
      } catch {}
      // Reset refs para permitir fetch imediato
      lastFetchedUserIdRef.current = null;
      lastFetchTimestamp.current = 0;
      // ✅ FIX: Se fetchingRef estiver travado, resetar
      if (fetchingRef.current) {
        console.warn('[useAuth] ⚠️ fetchingRef estava travado, resetando para force refresh');
        fetchingRef.current = false;
      }
    }
    
    // ✅ CRÍTICO: Verificar se já buscamos este userId recentemente (anti-loop)
    if (!force && lastFetchedUserIdRef.current === userId && profile) {
      // ✅ Se for role auto-aprovada, nunca "travar" em status PENDING (mesmo que seja dado antigo em memória)
      const currentRole = (profile?.role || profile?.active_mode) as string | undefined;
      const isAutoApproveRole = currentRole === 'PRODUTOR' || currentRole === 'TRANSPORTADORA';
      if (isAutoApproveRole && profile?.status !== 'APPROVED') {
        // deixa continuar para revalidar no banco
      } else {
      if (import.meta.env.DEV) {
        console.log('[useAuth] ⏸️ Já buscamos perfil para este userId, ignorando');
      }
      setLoading(false);
      return;
      }
    }
    
    // ✅ CRÍTICO: Verificar cache ANTES de qualquer gate/early return
    if (!force) {
      const cachedProfile = getCachedProfile(userId);
      if (cachedProfile) {
        // ✅ Hotfix: nunca confiar em cache quando status não está APPROVED.
        // Motivo: status é volátil (aprovação pode mudar no backend) e, se o app iniciar usando cache PENDING,
        // pode ficar “travado” na tela de Conta Pendente sem disparar um refetch.
        if (cachedProfile?.status !== 'APPROVED') {
          if (import.meta.env.DEV) {
            console.log('[ProfileCache] ⚠️ Cache com status não aprovado. Revalidando no banco.');
          }
          clearCachedProfile(userId);
          // Se houve timeout/cooldown anteriormente, removemos para permitir revalidação imediata.
          // Isso evita ficar preso em “Conta Pendente” por 60s quando o backend já está OK.
          try {
            sessionStorage.removeItem('profile_fetch_cooldown_until');
          } catch {}
        } else {
          // ✅ Cache aprovado é seguro usar para acelerar o boot
          setProfiles([cachedProfile]);
          setProfile(cachedProfile);
          setLoading(false); // ✅ Garante que loading seja false
          lastFetchedUserIdRef.current = userId;
          return;
        }
      }
    }
    
    // ✅ 1. GATE: Verificar cooldown persistente no sessionStorage
    const COOLDOWN_KEY = 'profile_fetch_cooldown_until';
    const cooldownUntil = parseInt(sessionStorage.getItem(COOLDOWN_KEY) || '0', 10);
    
    if (!force && cooldownUntil > Date.now()) {
      if (import.meta.env.DEV) {
        const remainingSec = Math.ceil((cooldownUntil - Date.now()) / 1000);
        console.log(`[useAuth] ⏸️ Cooldown ativo por mais ${remainingSec}s`);
      }
      setLoading(false);  // ✅ CRÍTICO: Setar loading=false mesmo durante cooldown
      return;
    }
    
    // ✅ FIX: Não bloquear quando force=true mesmo se fetchingRef estiver ativo
    if (!force && fetchingRef.current) return;
    if (!mountedRef.current) return;
    
    // Throttle: prevent too frequent calls
    const now = Date.now();
    
    // ✅ AUMENTADO: Throttle de 2s para 5s para evitar loops
    if (!force && now - lastFetchTimestamp.current < 5000) {
      if (import.meta.env.DEV) {
        console.log('[useAuth] Fetch throttled (5s)');
      }
      setLoading(false);  // ✅ CRÍTICO: Setar loading=false durante throttle
      return;
    }
    lastFetchTimestamp.current = now;
    
    fetchingRef.current = true;
    
    try {
      
      // SECURITY: Removed sensitive logging - user data should not be logged to console
      
      // ✅ Query otimizada: apenas campos necessários
      const profilesData = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select(`
              id, user_id, full_name, role,
              status, active_mode, service_types,
              base_city_name, base_state, base_city_id,
              created_at, updated_at,
              cooperative, rating,
              cnh_expiry_date, cnh_category,
              document_validation_status, cnh_validation_status,
              rntrc_validation_status, validation_notes,
              background_check_status, rating_locked,
              last_gps_update, current_location_lat, current_location_lng,
              base_lat, base_lng, current_city_name, current_state,
              selfie_url, location_enabled, farm_name
            `)
            .eq('user_id', userId);
          
          if (error) throw error;
          return data;
        },
        { 
          timeoutMs: 8000,  // ✅ Reduzido de 20s para 8s
          operationName: 'fetchProfile',
          retries: 0  // ✅ Sem retry - cooldown gerencia isso
        }
      );
      
      if (!mountedRef.current) return;
      
      if (profilesData && profilesData.length > 0) {
        // SECURITY: Removed sensitive logging
        
        // ✅ Buscar roles protegido com timeout e fallback
        const profilesWithRoles = await Promise.all(
          profilesData.map(async (p: any) => {
            try {
              const rolesData = await queryWithTimeout(
                async () => {
                  const { data, error } = await supabase
                    .from('user_roles')
                    .select('role')
                    .eq('user_id', p.user_id);

                  if (error) throw error;
                  return data;
                },
                {
                  timeoutMs: 5000,
                  operationName: 'fetchUserRoles',
                  retries: 0,
                }
              );

              const roles = rolesData?.map((r: any) => r.role) || [];
              // ✅ PRIORIZAR profiles.role (campo real) sobre active_mode
              const derivedRole = (p?.role || p?.active_mode || 'PRODUTOR') as any;

              return {
                ...p,
                roles,
                role: derivedRole,
                email: '',
              };
            } catch (error) {
              // ✅ Se falhar, continua com roles vazio (fallback silencioso)
              const now = Date.now();
              if (now - lastErrorLogAt.current > ERROR_LOG_THROTTLE_MS) {
                console.warn(`[useAuth] Erro ao buscar roles para ${p.user_id}:`, error);
                lastErrorLogAt.current = now;
              }

              // ✅ PRIORIZAR profiles.role (campo real) sobre active_mode
              const derivedRole = (p?.role || p?.active_mode || 'PRODUTOR') as any;

              return {
                ...p,
                roles: [],
                role: derivedRole,
                email: '',
              };
            }
          })
        );
        
        setProfiles(profilesWithRoles as UserProfile[]);
        
        // Verificar se há um perfil específico salvo no localStorage
        const savedProfileId = localStorage.getItem('current_profile_id');
        let activeProfile = profilesWithRoles[0]; // Default para o primeiro perfil
        
        if (savedProfileId) {
          const savedProfile = profilesWithRoles.find(p => p.id === savedProfileId);
          if (savedProfile) {
            activeProfile = savedProfile;
          }
        }
        
        setProfile(activeProfile as UserProfile);

        // ✅ REGRA DE NEGÓCIO (sempre): PRODUTOR e TRANSPORTADORA NÃO podem ficar pendentes.
        // Se o banco retornar PENDING (ou se estivermos com dados desatualizados), tentamos auto-aprovação e
        // atualizamos o estado local imediatamente para evitar a tela "Conta Pendente".
        const activeRole = (activeProfile?.role || activeProfile?.active_mode) as string | undefined;
        const isAutoApproveRole = activeRole === 'PRODUTOR' || activeRole === 'TRANSPORTADORA';
        if (isAutoApproveRole && activeProfile?.status !== 'APPROVED') {
          const profileKey = String(activeProfile?.id || `${userId}:${activeRole}`);
          if (!autoApproveAttemptedRef.current.has(profileKey)) {
            autoApproveAttemptedRef.current.add(profileKey);

            try {
              await AutomaticApprovalService.triggerApprovalProcess(activeProfile.id);
            } catch {
              // silencioso: se falhar por RLS/rede, o estado será corrigido no próximo fetch
            }

            // ✅ Forçar o app a seguir a regra de UX (não bloquear usuário auto-aprovado)
            const patchedProfiles = profilesWithRoles.map((p: any) =>
              p.id === activeProfile.id ? { ...p, status: 'APPROVED' } : p
            );
            const patchedActive = { ...activeProfile, status: 'APPROVED' };

            setProfiles(patchedProfiles as UserProfile[]);
            setProfile(patchedActive as UserProfile);

            // ✅ Evitar persistir status antigo no cache
            clearCachedProfile(userId);
          }
        }
        
        // ✅ Salvar no cache após sucesso
        // Observação: se auto-aprovação rodou acima, o cache já foi limpo e o state já foi patchado.
        // Persistimos o perfil ativo atual (seja ele original ou patchado).
        setCachedProfile(userId, isAutoApproveRole && activeProfile?.status !== 'APPROVED'
          ? { ...activeProfile, status: 'APPROVED' }
          : activeProfile);
        
        // ✅ P0 FIX: Marcar que já buscamos este userId
        lastFetchedUserIdRef.current = userId;
        
        // SECURITY: Removed sensitive profile data logging
      } else {
        setProfile(null);
        setProfiles([]);
        
        // ✅ P0 HOTFIX: NÃO chamar create_additional_profile automaticamente
        // A criação de perfil deve ser iniciada explicitamente pelo usuário via Auth.tsx
        devLog('[useAuth] Nenhum perfil encontrado - usuário pode criar via cadastro');
        setLoading(false);
      }
    } catch (error) {
      // ✅ Detectar se é timeout (auto-recovery cuida) → warn em vez de error
      const errMsg = String((error as any)?.message ?? '');
      const isTimeoutErr = (error as any)?.isTimeout === true || errMsg.includes('Timeout') || errMsg.includes('excedeu');
      
      // ✅ Throttling de logs: apenas log completo 1x por minuto
      const now = Date.now();
      if (now - lastErrorLogAt.current > ERROR_LOG_THROTTLE_MS) {
        if (isTimeoutErr) {
          // ✅ Timeout → warn (auto-recovery trata, não deve gerar alerta Telegram)
          console.warn('[useAuth] Timeout ao buscar perfil - auto-recovery ativo:', errMsg);
        } else {
          console.error('[useAuth] Erro ao buscar perfil (completo):', error);
        }
        lastErrorLogAt.current = now;
      } else {
        if (import.meta.env.DEV) {
          console.warn('[useAuth] Erro ao buscar perfil (throttled)');
        }
      }
      
      if (!mountedRef.current) return;
      
      // ✅ Detectar timeout e ativar cooldown PERSISTENTE
      const errorMessage = errMsg;
      const isTimeout = isTimeoutErr || errorMessage.includes('demorou');
      
      if (isTimeout) {
        lastTimeoutAt.current = Date.now();
        
        // ✅ Ativar cooldown de 60s no sessionStorage (persistente)
        const COOLDOWN_KEY = 'profile_fetch_cooldown_until';
        const cooldownUntil = Date.now() + 60000;  // 60 segundos
        sessionStorage.setItem(COOLDOWN_KEY, String(cooldownUntil));
        
        console.warn('[useAuth] ⏱️ Timeout detectado. Cooldown de 60s ativado (persistente).');
      }
      
      // CRÍTICO: Detectar recursão infinita em RLS e parar o loop
      const errorCode = (error as any)?.code;
      const isInfiniteRecursion = errorCode === '42P17' || errorMessage.includes('infinite recursion detected in policy');
      
      if (isInfiniteRecursion) {
        console.error('[useAuth] ⚠️ Recursão infinita detectada em RLS policy. Sistema aguardando correção...');
        setProfileError({
          code: 'RLS_RECURSION',
          message: 'Erro de configuração detectado. Aguarde alguns instantes e recarregue a página.'
        });
        setProfile(null);
        setProfiles([]);
        setLoading(false);
        return; // Parar o loop aqui
      }
      
      setProfile(null);
      setProfiles([]);

      // Handle auth errors without logging sensitive data
      const status = (error as any)?.status ?? errorCode ?? (error as any)?.context?.response?.status ?? null;
      if (status === 401 || status === 403 || errorMessage.includes('sub claim')) {
        try {
          localStorage.removeItem('current_profile_id');
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
        try { clearSupabaseAuthStorage(); } catch {}
        setUser(null);
        setSession(null);
      }
    } finally {
      // CRÍTICO: Sempre resetar fetchingRef, mesmo em caso de erro
      fetchingRef.current = false;
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  // ✅ P0 HOTFIX: tryAutoCreateProfile foi REMOVIDO
  // A criação de perfil agora é feita APENAS via:
  // - Auth.tsx (cadastro manual)
  // - AddProfileModal.tsx (perfil adicional)
  // NÃO deve ser chamada automaticamente ao abrir home/modal

  const clearProfileError = () => {
    setProfileError(null);
  };

  const retryProfileCreation = async (newDocument: string) => {
    if (!user) return;
    
    try {
      setLoading(true);
      setProfileError(null);
      
      await supabase.auth.updateUser({
        data: { document: newDocument, cpf_cnpj: newDocument }
      });
      
      // ✅ P0 HOTFIX: Redirecionar para /auth?mode=signup para criação manual
      // tryAutoCreateProfile foi removido - criação deve ser explícita
      window.location.href = '/auth?mode=signup';
    } catch (error) {
      console.error('[useAuth] Erro ao retentar criação:', error);
      setProfileError({
        code: 'RETRY_FAILED',
        message: 'Erro ao tentar novamente. Tente outro documento.'
      });
      setLoading(false);
    }
  };

  // ✅ AUTOCORREÇÃO: Corrigir motoristas afiliados com active_mode errado (apenas uma vez)
  useEffect(() => {
    const fixAffiliatedDriverActiveMode = async () => {
      // ✅ Executar apenas uma vez por sessão
      if (hasFixedActiveModeRef.current) return;
      
      if (profile?.role === 'MOTORISTA_AFILIADO' && profile?.active_mode === 'TRANSPORTADORA') {
        if (import.meta.env.DEV) {
          console.log('🔧 Corrigindo active_mode de motorista afiliado...');
        }
        hasFixedActiveModeRef.current = true; // ✅ Marcar como executado
        
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ active_mode: null })
            .eq('id', profile.id);

          if (error) {
            if (import.meta.env.DEV) {
              console.error('Erro ao corrigir active_mode:', error);
            }
          } else {
            if (import.meta.env.DEV) {
              console.log('✅ active_mode corrigido');
            }
            // Atualizar estado local para evitar redirects
            setProfile((p) => p ? { ...p, active_mode: null } : p);
          }
        } catch (error) {
          if (import.meta.env.DEV) {
            console.error('Erro ao corrigir active_mode:', error);
          }
        }
      }
    };

    fixAffiliatedDriverActiveMode();
  }, [profile?.id, profile?.role]); // ✅ Removido profile?.active_mode das dependências

  // ✅ Resetar flag quando usuário trocar
  useEffect(() => {
    hasFixedActiveModeRef.current = false;
  }, [profile?.id]);

  useEffect(() => {
    mountedRef.current = true;
    
    // ✅ DEV: Instrumentação para validar listener único
    incrementAuthListeners();
    
    // Set up auth state listener (only once)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        // ✅ ETAPA 4: Limpar cooldown e forçar fetch no SIGNED_IN
        if (event === 'SIGNED_IN' && session?.user) {
          if (import.meta.env.DEV) {
            console.log('🟢 [useAuth] SIGNED_IN event - limpando cooldown e forçando fetch');
          }
          sessionStorage.removeItem('profile_fetch_cooldown_until');
          
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (uuidRegex.test(session.user.id)) {
            fetchProfile(session.user.id, true); // force = true
          }
          setInitialized(true);
          return;
        }

        // ✅ P0 FIX: Correção de redirecionamento indevido
        // Só processar como logout REAL quando for evento SIGNED_OUT explícito
        // JWT expirado/inválido (INITIAL_SESSION, TOKEN_REFRESHED) deve tentar renovar silenciosamente
        if (!session) {
          // ✅ CRÍTICO: Diferenciar logout real vs falha temporária de JWT
          const isExplicitSignOut = event === 'SIGNED_OUT';
          const isInitialWithNoSession = event === 'INITIAL_SESSION';
          const isTokenRefreshFailure = event === 'TOKEN_REFRESHED';
          
          // ✅ Se é carregamento inicial sem sessão (usuário não logado), apenas limpar estado
          // NÃO redirecionar - o usuário pode estar na landing page
          if (isInitialWithNoSession || isTokenRefreshFailure) {
            if (import.meta.env.DEV) {
              console.log(`[useAuth] ${event} sem sessão - limpando estado (sem redirect)`);
            }
            setProfile(null);
            setProfiles([]);
            setInitialized(true);
            setLoading(false);
            autoCreateAttemptedRef.current = false;
            // NÃO limpar storage aqui - pode ser falha temporária
            return;
          }
          
          // ✅ SIGNED_OUT explícito: usuário realmente clicou em sair
          if (isExplicitSignOut) {
            if (import.meta.env.DEV) {
              console.log('[useAuth] SIGNED_OUT explícito - limpando tudo e redirecionando');
            }
            clearSupabaseAuthStorage();
            setProfile(null);
            setProfiles([]);
            setInitialized(true);
            setLoading(false);
            autoCreateAttemptedRef.current = false;

            const onAuthPage = window.location.pathname === '/auth';
            const onPublicPage = ['/', '/sobre', '/privacidade', '/termos', '/cookies', '/ajuda', '/status', '/carreiras', '/imprensa', '/services'].includes(window.location.pathname);
            
            // Só redirecionar se NÃO estiver em página pública/auth
            if (!onAuthPage && !onPublicPage) {
              try {
                const path = window.location.pathname + window.location.search + window.location.hash;
                localStorage.setItem('redirect_after_login', path);
              } catch {}
              setTimeout(() => {
                window.location.replace('/');
              }, 0);
            }
          }
          return;
        }
        
        if (session?.user) {
          // Validate UUID format
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(session.user.id)) {
            setProfile(null);
            setLoading(false);
            return;
          }
          
          fetchProfile(session.user.id);
        } else {
          setProfile(null);
          setProfiles([]);
          setLoading(false);
        }
        
        setInitialized(true);
      }
    );

    // Check for existing session (apenas uma vez)
    if (!didInitialFetchRef.current) {
      didInitialFetchRef.current = true;
      
      supabase.auth.getSession().then(({ data: { session } }) => {
        if (!mountedRef.current) return;
        
        if (session?.user) {
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(session.user.id)) {
            setProfile(null);
            setLoading(false);
            setInitialized(true);
            return;
          }
          
          setSession(session);
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setLoading(false);
          setInitialized(true);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      // ✅ DEV: Decrementar contador de listeners
      decrementAuthListeners();
    };
  }, [fetchProfile]);

  // Subscribe to profile changes for the current user id only (resilient to WebSocket failures)
  useEffect(() => {
    if (!session?.user?.id) return;

    let debounceTimer: NodeJS.Timeout;
    let retryTimer: NodeJS.Timeout;
    let retryCount = 0;
    const MAX_RETRIES = 5;
    let currentChannel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    const createChannel = () => {
      if (cancelled) return;

      // Remove canal anterior se existir
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch {}
      }

      currentChannel = supabase
        .channel(`profile_changes_${Date.now()}`)
        .on('postgres_changes', {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
          filter: `user_id=eq.${session.user.id}`
        }, (payload) => {
          if (!mountedRef.current || fetchingRef.current) return;
          
          const newProfile = payload.new as any;
          if (profile?.id === newProfile?.id) {
            const hasSignificantChange = 
              profile?.status !== newProfile?.status ||
              profile?.role !== newProfile?.role ||
              profile?.active_mode !== newProfile?.active_mode;
            
            if (!hasSignificantChange) {
              if (import.meta.env.DEV) {
                console.log('[Realtime] Perfil não mudou significativamente, ignorando');
              }
              return;
            }
          }
          
          clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => {
            if (!mountedRef.current) return;
            fetchProfile(newProfile.user_id, true);
          }, 2000);
        })
        .subscribe((status) => {
          if (cancelled) return;

          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn(`[Realtime] Perfil: ${status} (tentativa ${retryCount + 1}/${MAX_RETRIES})`);
            
            // ✅ AUTO-RECONNECT com backoff exponencial
            if (retryCount < MAX_RETRIES && !cancelled) {
              retryCount++;
              const delay = Math.min(2000 * Math.pow(2, retryCount - 1), 30000); // 2s, 4s, 8s, 16s, 30s
              console.log(`[Realtime] Reconectando em ${delay / 1000}s...`);
              clearTimeout(retryTimer);
              retryTimer = setTimeout(() => {
                if (!cancelled && mountedRef.current) {
                  createChannel();
                }
              }, delay);
            } else if (retryCount >= MAX_RETRIES) {
              console.warn('[Realtime] Máximo de tentativas atingido. App continua sem realtime.');
            }
          } else if (status === 'SUBSCRIBED') {
            retryCount = 0; // Reset ao conectar com sucesso
            console.log('[Realtime] Perfil: conectado com sucesso');
          }
        });
    };

    createChannel();

    return () => {
      cancelled = true;
      clearTimeout(debounceTimer);
      clearTimeout(retryTimer);
      if (currentChannel) {
        try { supabase.removeChannel(currentChannel); } catch {}
      }
    };
  }, [session?.user?.id, fetchProfile]);

  // Cleanup ref on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // fetchProfile is now defined above as a useCallback hook

  const signOut = async () => {
    // ✅ Guard single-flight: evita execuções duplicadas
    if (isSigningOutRef.current) {
      if (import.meta.env.DEV) {
        console.log('[Auth] signOut já em execução, ignorando chamada duplicada');
      }
      return;
    }
    isSigningOutRef.current = true;
    
    // ✅ DEV: Incrementar contador de signOut calls
    incrementSignOutCalls();
    
    try {
      // Limpar todos os dados do usuário no logout para segurança
      // Dados de sessão e contexto do usuário
      const userDataKeys = [
        'current_profile_id',
        'current_company_id',
        'redirect_after_login',
        // Dados de cache e drafts do usuário
        'saved_freight_searches',
        'agriroute_nfe_offline_cache',
        'freight_draft_data',
        'freight_attachments_metadata',
        'mural_dismissed_at',
        'profile_fetch_cooldown_until',
      ];
      
      userDataKeys.forEach(key => {
        try {
          localStorage.removeItem(key);
        } catch (e) {
          console.warn(`Failed to remove localStorage key: ${key}`, e);
        }
      });

      // Verificar sessão atual antes de deslogar
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;

      if (!hasSession) {
        await supabase.auth.signOut({ scope: 'local' });
      } else {
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      }

      // Garantir limpeza do estado local
      clearSmartCache(); // ✅ Limpar todo o cache global de requests
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfiles([]);
      // ✅ P0 FIX: Reset auto-create guard on sign out
      autoCreateAttemptedRef.current = false;
      
      // ❌ REMOVIDO: Nenhum toast aqui - logout silencioso
      // Redirect será feito pelo listener onAuthStateChange
    } catch (error) {
      // Último recurso: limpar localmente para não travar o usuário
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      clearSmartCache();
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfiles([]);
      // ✅ P0 FIX: Reset auto-create guard on sign out (catch branch)
      autoCreateAttemptedRef.current = false;
      // ❌ REMOVIDO: Nenhum toast de erro - logout silencioso
    }
    // ✅ NÃO resetar isSigningOutRef - o redirect vai recarregar a página
  };

  const switchProfile = useCallback((profileId: string) => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile) {
      setProfile(selectedProfile);
      localStorage.setItem('current_profile_id', profileId);
    }
  }, [profiles]);

  // Força revalidação no banco (ignora cache/throttles quando necessário)
  const refreshProfile = useCallback(async () => {
    if (!user?.id) return;
    await fetchProfile(user.id, true);
  }, [user?.id, fetchProfile]);

  // Fetch transport company status when profile is TRANSPORTADORA
  useEffect(() => {
    const fetchCompanyStatus = async () => {
      if (!profile) {
        setCompanyStatus(null);
        return;
      }

      const isTransportadora = profile.role === 'TRANSPORTADORA' || profile.active_mode === 'TRANSPORTADORA';
      
      if (!isTransportadora) {
        setCompanyStatus(null);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('transport_companies')
          .select('status')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if (error) throw error;
        setCompanyStatus(data?.status || null);
      } catch (error) {
        // SECURITY: Log error type only, no sensitive data
        console.error('[useAuth] Erro ao buscar status da transportadora');
        setCompanyStatus(null);
      }
    };

    fetchCompanyStatus();
  }, [profile?.id, profile?.role, profile?.active_mode]);

  const isAuthenticated = !!user;
  const isTransportadora = profile?.role === 'TRANSPORTADORA' || profile?.active_mode === 'TRANSPORTADORA';
  const isApproved = profile?.status === 'APPROVED' || (isTransportadora && companyStatus === 'APPROVED');
  const isAdmin = profile?.roles?.includes('admin') || profile?.role === 'ADMIN'; // Verificar ambos por compatibilidade
  const hasMultipleProfiles = profiles.length > 1;

  // Helper para verificar se tem um role específico
  const hasRole = useCallback((role: string) => {
    return profile?.roles?.includes(role) || false;
  }, [profile]);

  // Helper para verificar se tem pelo menos um dos roles
  const hasAnyRole = useCallback((roles: string[]) => {
    return roles.some(role => profile?.roles?.includes(role));
  }, [profile]);

  return {
    user,
    session,
    profile,
    profiles,
    loading,
    isAuthenticated,
    isApproved,
    isAdmin,
    hasMultipleProfiles,
    profileError,
    signOut,
    switchProfile,
    refreshProfile,
    clearProfileError,
    retryProfileCreation,
    companyStatus,
    hasRole,
    hasAnyRole
  };
};

type AuthContextValue = ReturnType<typeof useAuthInternal>;

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const value = useAuthInternal();
  // Avoid JSX in .ts file (this file is not .tsx)
  return React.createElement(AuthContext.Provider, { value }, children);
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
};