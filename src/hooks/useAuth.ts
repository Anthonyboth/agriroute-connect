import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryWithTimeout } from '@/lib/query-utils';
import { clearSupabaseAuthStorage } from '@/utils/authRecovery';
import { toast } from 'sonner';
import { withLockOrJoin } from '@/utils/globalLocks';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'ADMIN' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA'; // Mantido por compatibilidade
  roles: string[]; // NOVO: Array de roles do user_roles
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  active_mode?: string | null; // Mantido por compatibilidade
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

export const useAuth = () => {
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
  const FETCH_THROTTLE_MS = 2000;
  const TIMEOUT_COOLDOWN_MS = 20000; // 20s cooldown após timeout
  const hasFixedActiveModeRef = useRef(false); // ✅ Flag para evitar loop infinito

  // Memoized fetch function to prevent recreation on every render
  const fetchProfile = useCallback(async (userId: string, force: boolean = false) => {
    const lockKey = `fetchProfile:${userId}`;
    const startTime = Date.now();
    
    // ✅ GLOBAL LOCK COM JOIN: Prevenir múltiplas chamadas simultâneas
    const result = await withLockOrJoin(lockKey, async () => {
      if (fetchingRef.current || !mountedRef.current) return;
      
      // Throttle: prevent too frequent calls
      const now = Date.now();
      
      // ✅ Cooldown após timeout: aguardar 20s antes de nova tentativa
      if (lastTimeoutAt.current > 0 && now - lastTimeoutAt.current < TIMEOUT_COOLDOWN_MS) {
        if (import.meta.env.DEV) {
          console.log('[useAuth] Cooldown ativo após timeout. Aguarde...');
        }
        return;
      }
      
      if (!force && now - lastFetchTimestamp.current < FETCH_THROTTLE_MS) {
        if (import.meta.env.DEV) {
          console.log('[useAuth] Fetch throttled');
        }
        return;
      }
      lastFetchTimestamp.current = now;
      
      fetchingRef.current = true;
      
      try {
        // ✅ OTIMIZAÇÃO: Seleção enxuta + single row
        const profilesData = await queryWithTimeout(
          async () => {
            const { data, error } = await supabase
              .from('profiles')
              .select('id,user_id,full_name,phone,document,role,status,active_mode,selfie_url,email,cpf_cnpj,farm_name,rating')
              .eq('user_id', userId)
              .limit(10);
            
            if (error) throw error;
            return data;
          },
          { 
            timeoutMs: 25000, // ✅ Timeout aumentado
            operationName: 'fetchProfile',
            retries: 1, // ✅ Um único retry
            retryDelayMs: 1000
          }
        );
        
        if (!mountedRef.current) return;
        
        if (profilesData && profilesData.length > 0) {
          // ✅ OTIMIZAÇÃO: Buscar todas as roles de uma vez
          const userIds = [...new Set(profilesData.map(p => p.user_id))];
          const { data: allRolesData } = await supabase
            .from('user_roles')
            .select('user_id, role')
            .in('user_id', userIds);
          
          // Criar mapa de roles por user_id
          const rolesMap = new Map<string, string[]>();
          allRolesData?.forEach(r => {
            const existing = rolesMap.get(r.user_id) || [];
            existing.push(r.role);
            rolesMap.set(r.user_id, existing);
          });
          
          const profilesWithRoles = profilesData.map((p: any) => ({
            ...p,
            roles: rolesMap.get(p.user_id) || []
          }));
          
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
          
          const duration = Date.now() - startTime;
          console.log(`[useAuth] ✅ Perfil carregado em ${duration}ms`);
        } else {
          setProfile(null);
          setProfiles([]);
          
          // Auto-create profile only once
          await tryAutoCreateProfile(userId);
        }
      } catch (error) {
        console.error('[useAuth] Erro ao buscar perfil:', error);
        
        if (!mountedRef.current) return;
        
        // ✅ Detectar timeout e ativar cooldown + FALLBACK
        const errorMessage = String((error as any)?.message ?? '');
        const isTimeout = errorMessage.includes('Timeout') || errorMessage.includes('excedeu');
        
        if (isTimeout) {
          lastTimeoutAt.current = Date.now();
          console.warn('[useAuth] ⏱️ Timeout detectado. Tentando fallback com refreshSession...');
          
          // ✅ FALLBACK: Refresh da sessão e retry
          try {
            const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
            
            if (!refreshError && refreshData.session) {
              console.log('[useAuth] 🔄 Sessão renovada. Reexecutando query...');
              
              // Retry com sessão renovada
              const { data: retryData, error: retryError } = await supabase
                .from('profiles')
                .select('id,user_id,full_name,phone,document,role,status,active_mode,selfie_url,email,cpf_cnpj,farm_name,rating')
                .eq('user_id', userId)
                .limit(10);
              
              if (!retryError && retryData && retryData.length > 0) {
                // Buscar roles
                const userIds = [...new Set(retryData.map(p => p.user_id))];
                const { data: allRolesData } = await supabase
                  .from('user_roles')
                  .select('user_id, role')
                  .in('user_id', userIds);
                
                const rolesMap = new Map<string, string[]>();
                allRolesData?.forEach(r => {
                  const existing = rolesMap.get(r.user_id) || [];
                  existing.push(r.role);
                  rolesMap.set(r.user_id, existing);
                });
                
                const profilesWithRoles = retryData.map((p: any) => ({
                  ...p,
                  roles: rolesMap.get(p.user_id) || []
                }));
                
                setProfiles(profilesWithRoles as UserProfile[]);
                setProfile(profilesWithRoles[0] as UserProfile);
                
                const duration = Date.now() - startTime;
                console.log(`[useAuth] ✅ Perfil carregado via fallback em ${duration}ms`);
                return; // Sucesso no fallback
              }
            }
          } catch (fallbackError) {
            console.error('[useAuth] ❌ Fallback também falhou:', fallbackError);
          }
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
    }, 25000, 1500); // Timeout do lock, timeout do join
    
    // Resultado null = join timeout ou erro - não logar (silencioso)
  }, []);

  const tryAutoCreateProfile = async (userId: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mountedRef.current) return;
      
      const meta = (user as any).user_metadata || {};
      const roleMeta = (meta.role as any);
      const resolvedRole = (roleMeta === 'PRODUTOR' || roleMeta === 'MOTORISTA' || roleMeta === 'MOTORISTA_AFILIADO' || roleMeta === 'PRESTADOR_SERVICOS' || roleMeta === 'TRANSPORTADORA') ? roleMeta : 'PRODUTOR';
      
      const newProfile = {
        user_id: user.id,
        full_name: meta.full_name || '',
        phone: meta.phone || '',
        document: meta.document || '',
        cpf_cnpj: meta.document || '',
        role: resolvedRole,
        status: 'PENDING' as any,
      };
      
      const { data: inserted, error: insertError } = await supabase
        .from('profiles')
        .insert(newProfile)
        .select('*')
        .single();
        
      if (!mountedRef.current) return;
      
      if (!insertError && inserted) {
        setProfiles([inserted as any]);
        setProfile(inserted as any);
        setProfileError(null);
      } else if (insertError?.code === '23505') {
        // Document already in use - set error and stop the loop
        // SECURITY: Removed document logging
        setProfileError({
          code: 'DOCUMENT_IN_USE',
          message: 'Este CPF/CNPJ já está cadastrado no sistema',
          document: meta.document
        });
        setLoading(false);
      }
    } catch (e) {
      console.error('[useAuth] Erro ao criar perfil:', e);
      setLoading(false);
    }
  };

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
      
      await tryAutoCreateProfile(user.id);
    } catch (error) {
      console.error('[useAuth] Erro ao retentar criação:', error);
      setProfileError({
        code: 'RETRY_FAILED',
        message: 'Erro ao tentar novamente. Tente outro documento.'
      });
    } finally {
      setLoading(false);
    }
  };

  // ✅ AUTOCORREÇÃO: Corrigir motoristas afiliados com active_mode errado (apenas uma vez)
  useEffect(() => {
    const fixAffiliatedDriverActiveMode = async () => {
      // ✅ Executar apenas uma vez por sessão
      if (hasFixedActiveModeRef.current) return;
      
      if (profile?.role === 'MOTORISTA_AFILIADO' && profile?.active_mode === 'TRANSPORTADORA') {
        console.log('🔧 Corrigindo active_mode de motorista afiliado...');
        hasFixedActiveModeRef.current = true; // ✅ Marcar como executado
        
        try {
          const { error } = await supabase
            .from('profiles')
            .update({ active_mode: null })
            .eq('id', profile.id);

          if (error) {
            console.error('Erro ao corrigir active_mode:', error);
          } else {
            console.log('✅ active_mode corrigido');
            // Atualizar estado local para evitar redirects
            setProfile((p) => p ? { ...p, active_mode: null } : p);
          }
        } catch (error) {
          console.error('Erro ao corrigir active_mode:', error);
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
    
    // Set up auth state listener (only once)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);

        // Correção de sessão inválida: quando o refresh falha e o Supabase não entrega session
        if (!session) {
          // Evitar chamadas Supabase aqui (deadlock prevention)
          clearSupabaseAuthStorage();
          setProfile(null);
          setProfiles([]);
          setInitialized(true);
          setLoading(false);

          const onAuthPage = window.location.pathname === '/auth';
          const shouldForceLogin = event === 'SIGNED_OUT' || event === 'TOKEN_REFRESHED';

          if (shouldForceLogin && !onAuthPage) {
            try {
              const path = window.location.pathname + window.location.search + window.location.hash;
              localStorage.setItem('redirect_after_login', path);
            } catch {}
            setTimeout(() => {
              try { toast.error('Sua sessão expirou. Faça login novamente.'); } catch {}
              window.location.replace('/auth');
            }, 0);
          }
          // USER_UPDATED sem session: não redirecionar, aguardar próximo evento
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

    // Check for existing session (apenas uma vez, sem duplicar fetchProfile)
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
          // ✅ NÃO chamar fetchProfile aqui - onAuthStateChange já chamará com INITIAL_SESSION
        } else {
          setLoading(false);
          setInitialized(true);
        }
      });
    }

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  // Subscribe to profile changes for the current user id only (resilient to WebSocket failures)
  useEffect(() => {
    if (!session?.user?.id) return;

    let debounceTimer: NodeJS.Timeout;
    
    const channel = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: `user_id=eq.${session.user.id}`
      }, (payload) => {
        if (!mountedRef.current || fetchingRef.current) return;
        
        // ✅ Debounce: aguardar 500ms para evitar múltiplas chamadas
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          if (!mountedRef.current) return;
          const newProfile = payload.new as UserProfile;
          fetchProfile(newProfile.user_id, true);
        }, 500);
      })
      .subscribe((status) => {
        // ✅ Tratamento resiliente de erros do WebSocket (não bloqueante)
        if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          if (import.meta.env.DEV) {
            console.warn('[Realtime] Perfil: status=', status, '(conexão em tempo real indisponível)');
          }
          
          // Cooldown de 15 minutos para evitar spam de notificações
          const key = 'realtime_warn_shown_at';
          const now = Date.now();
          const last = parseInt(sessionStorage.getItem(key) || '0', 10);
          const cooldown = 15 * 60 * 1000; // 15 minutos
          
          if (now - last > cooldown) {
            try {
              toast.message('Conexão em tempo real indisponível. Você ainda pode usar o app normalmente.', {
                id: 'realtime-warning'
              });
              sessionStorage.setItem(key, String(now));
            } catch {}
          }
        } else if (status === 'SUBSCRIBED') {
          if (import.meta.env.DEV) {
            console.log('[Realtime] Perfil: conectado com sucesso');
          }
        }
      });

    return () => {
      clearTimeout(debounceTimer);
      // ✅ Garantir cleanup mesmo se WebSocket falhou
      try {
        supabase.removeChannel(channel);
      } catch (e) {
        if (import.meta.env.DEV) {
          console.warn('[Realtime] Erro ao remover canal:', e);
        }
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
    try {
      // Limpar perfil salvo no logout
      localStorage.removeItem('current_profile_id');

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
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfiles([]);
    } catch (error) {
      // Último recurso: limpar localmente para não travar o usuário
      try {
        await supabase.auth.signOut({ scope: 'local' });
      } catch {}
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfiles([]);
      // Não relança erro para evitar bloquear o fluxo do usuário
    }
  };

  const switchProfile = (profileId: string) => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (selectedProfile) {
      setProfile(selectedProfile);
      localStorage.setItem('current_profile_id', profileId);
    }
  };

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
    clearProfileError,
    retryProfileCreation,
    companyStatus,
    hasRole,
    hasAnyRole
  };
};