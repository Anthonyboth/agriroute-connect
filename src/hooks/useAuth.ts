import { useState, useEffect, useRef, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { queryWithTimeout } from '@/lib/query-utils';

interface UserProfile {
  id: string;
  user_id: string;
  email: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'ADMIN' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';
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

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [companyStatus, setCompanyStatus] = useState<string | null>(null);
  
  // Prevent multiple simultaneous fetches
  const fetchingRef = useRef(false);
  const mountedRef = useRef(true);

  // Memoized fetch function to prevent recreation on every render
  const fetchProfile = useCallback(async (userId: string) => {
    if (fetchingRef.current || !mountedRef.current) return;
    
    fetchingRef.current = true;
    
    try {
      console.log('[useAuth] Buscando perfil para userId:', userId);
      
      const profilesData = await queryWithTimeout(
        async () => {
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('user_id', userId);
          
          if (error) throw error;
          return data;
        },
        { 
          timeoutMs: 8000, 
          operationName: 'fetchProfile',
          retries: 1
        }
      );
      
      if (!mountedRef.current) return;
      
      if (profilesData && profilesData.length > 0) {
        setProfiles(profilesData);
        
        // Verificar se há um perfil específico salvo no localStorage
        const savedProfileId = localStorage.getItem('current_profile_id');
        let activeProfile = profilesData[0]; // Default para o primeiro perfil
        
        if (savedProfileId) {
          const savedProfile = profilesData.find(p => p.id === savedProfileId);
          if (savedProfile) {
            activeProfile = savedProfile;
          }
        }
        
        setProfile(activeProfile);
      } else {
        setProfile(null);
        setProfiles([]);
        
        // Auto-create profile only once
        await tryAutoCreateProfile(userId);
      }
    } catch (error) {
      console.error('[useAuth] Erro ao buscar perfil:', error);
      
      if (!mountedRef.current) return;
      setProfile(null);
      setProfiles([]);

      // Handle auth errors
      const status = (error as any)?.status ?? (error as any)?.code ?? (error as any)?.context?.response?.status ?? null;
      const message = String((error as any)?.message ?? '');
      if (status === 401 || status === 403 || message.includes('sub claim')) {
        try {
          localStorage.removeItem('current_profile_id');
          await supabase.auth.signOut({ scope: 'local' });
        } catch {}
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
      } else if (insertError?.code === '23505') {
        // Profile already exists, refetch once
        setTimeout(() => {
          if (mountedRef.current) {
            fetchProfile(user.id);
          }
        }, 500);
      }
    } catch (e) {
      // Silent fail - profile creation will be handled by CompleteProfile page
    }
  };

  useEffect(() => {
    mountedRef.current = true;
    
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;
        
        setSession(session);
        setUser(session?.user ?? null);
        
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

    // Check for existing session
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

    // Subscribe to profile changes (active_mode updates)
    const profileChannel = supabase
      .channel('profile_changes')
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'profiles',
        filter: session?.user ? `user_id=eq.${session.user.id}` : undefined
      }, (payload) => {
        if (!mountedRef.current) return;
        const newProfile = payload.new as UserProfile;
        if (newProfile.active_mode !== profile?.active_mode) {
          fetchProfile(newProfile.user_id);
        }
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
      profileChannel.unsubscribe();
    };
  }, [fetchProfile, session?.user, profile?.active_mode]);

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
        console.error('[useAuth] Erro ao buscar status da transportadora:', error);
        setCompanyStatus(null);
      }
    };

    fetchCompanyStatus();
  }, [profile?.id, profile?.role, profile?.active_mode]);

  const isAuthenticated = !!user;
  const isTransportadora = profile?.role === 'TRANSPORTADORA' || profile?.active_mode === 'TRANSPORTADORA';
  const isApproved = profile?.status === 'APPROVED' || (isTransportadora && companyStatus === 'APPROVED');
  const isAdmin = profile?.role === 'ADMIN';
  const hasMultipleProfiles = profiles.length > 1;

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
    signOut,
    switchProfile
  };
};