import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'ADMIN' | 'PRESTADOR_SERVICOS';
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
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

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('Auth state change:', event, session?.user?.id);
        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          // Validar se o user.id é um UUID válido
          const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
          if (!uuidRegex.test(session.user.id)) {
            console.error('Invalid UUID format for user.id:', session.user.id);
            setProfile(null);
            setLoading(false);
            return;
          }

          // Use setTimeout to prevent auth callback deadlock
          setTimeout(() => {
            fetchProfile(session.user.id);
          }, 0);
        } else {
          setProfile(null);
          setProfiles([]);
          setLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Existing session check:', session?.user?.id);
      // Only process if no session was already handled by the listener
      if (!user && session?.user) {
        setSession(session);
        setUser(session?.user ?? null);
        
        // Validar se o user.id é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(session.user.id)) {
          console.error('Invalid UUID format for user.id in existing session:', session.user.id);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Fetch profile for existing session
        fetchProfile(session.user.id);
      } else if (!session?.user) {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (userId: string) => {
    try {
      console.log('Fetching profiles for user:', userId);
      const { data: profilesData, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId);
      
      if (error) {
        console.error('Profiles fetch error:', error);
        setProfile(null);
        setProfiles([]);
      } else if (profilesData && profilesData.length > 0) {
        console.log('Profiles fetched successfully:', profilesData);
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
        console.log('Active profile set:', activeProfile);
      } else {
        console.log('No profiles found, attempting auto-create from metadata');
        setProfile(null);
        setProfiles([]);
        
        // Tentar criar perfil automaticamente a partir dos metadados do usuário
        try {
          const { data: { user } } = await supabase.auth.getUser();
          if (user) {
            const meta = (user as any).user_metadata || {};
            const roleMeta = (meta.role as any);
            const resolvedRole = (roleMeta === 'PRODUTOR' || roleMeta === 'MOTORISTA' || roleMeta === 'PRESTADOR_SERVICOS') ? roleMeta : 'PRODUTOR';
            const newProfile = {
              user_id: user.id,
              full_name: meta.full_name || '',
              phone: meta.phone || '',
              document: meta.document || '',
              cpf_cnpj: meta.document || '',
              role: resolvedRole,
              status: 'PENDING' as any,
            };
            console.log('Attempting to create profile:', newProfile);
            const { data: inserted, error: insertError } = await supabase
              .from('profiles')
              .insert(newProfile)
              .select('*')
              .single();
            if (!insertError && inserted) {
              console.log('Profile auto-created successfully:', inserted);
              setProfiles([inserted as any]);
              setProfile(inserted as any);
            } else if (insertError) {
              console.error('Auto-create profile failed:', insertError);
              // Se falhar por conflito, pode ser que já existe
              if (insertError.code === '23505') {
                console.log('Profile already exists, refetching...');
                setTimeout(() => fetchProfile(user.id), 1000);
              }
            }
          }
        } catch (e) {
          console.error('Error during auto-create profile:', e);
        }
      }
    } catch (error) {
      console.error('Error fetching profiles:', error);
      setProfile(null);
      setProfiles([]);

      // Clear stale/invalid sessions to satisfy RLS (auth.uid()) on profiles
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
      setLoading(false);
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting logout process...');
      // Limpar perfil salvo no logout
      localStorage.removeItem('current_profile_id');

      // Verificar sessão atual antes de deslogar
      const { data } = await supabase.auth.getSession();
      const hasSession = !!data.session;
      console.log('Current session exists:', hasSession);

      if (!hasSession) {
        console.log('No active session. Clearing local auth state.');
        await supabase.auth.signOut({ scope: 'local' });
      } else {
        console.log('Signing out globally...');
        const { error } = await supabase.auth.signOut({ scope: 'global' });
        if (error) {
          console.error('Logout error (global). Falling back to local signout:', error);
          await supabase.auth.signOut({ scope: 'local' });
        }
      }

      // Garantir limpeza do estado local
      setUser(null);
      setSession(null);
      setProfile(null);
      setProfiles([]);
      console.log('Logout successful');
    } catch (error) {
      console.error('Error during logout:', error);
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

  const isAuthenticated = !!user;
  const isApproved = profile?.status === 'APPROVED';
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