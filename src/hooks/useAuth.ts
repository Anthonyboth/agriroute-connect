import { useState, useEffect } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  phone: string;
  document: string;
  role: 'PRODUTOR' | 'MOTORISTA' | 'ADMIN';
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
}

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
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

          // Fetch user profile
          setTimeout(async () => {
            try {
              console.log('Fetching profile for user:', session.user.id);
              const { data: profileData, error } = await supabase
                .from('profiles')
                .select('*')
                .eq('user_id', session.user.id)
                .single();
              
              if (error) {
                console.error('Profile fetch error:', error);
                // Se não encontrou perfil, não é necessariamente um erro
                if (error.code === 'PGRST116') {
                  console.log('Profile not found, user may need to complete registration');
                  setProfile(null);
                } else {
                  throw error;
                }
              } else {
                console.log('Profile fetched successfully:', profileData);
                setProfile(profileData);
              }
            } catch (error) {
              console.error('Error fetching profile:', error);
              setProfile(null);
            } finally {
              setLoading(false);
            }
          }, 0);
        } else {
          setProfile(null);
          setLoading(false);
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      console.log('Existing session check:', session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        // Validar se o user.id é um UUID válido
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(session.user.id)) {
          console.error('Invalid UUID format for user.id in existing session:', session.user.id);
          setProfile(null);
          setLoading(false);
          return;
        }

        // Fetch user profile
        setTimeout(async () => {
          try {
            console.log('Fetching profile for existing session user:', session.user.id);
            const { data: profileData, error } = await supabase
              .from('profiles')
              .select('*')
              .eq('user_id', session.user.id)
              .single();
            
            if (error) {
              console.error('Profile fetch error in existing session:', error);
              // Se não encontrou perfil, não é necessariamente um erro
              if (error.code === 'PGRST116') {
                console.log('Profile not found for existing user, may need to complete registration');
                setProfile(null);
              } else {
                throw error;
              }
            } else {
              console.log('Profile fetched successfully for existing session:', profileData);
              setProfile(profileData);
            }
          } catch (error) {
            console.error('Error fetching profile in existing session:', error);
            setProfile(null);
          } finally {
            setLoading(false);
          }
        }, 0);
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAuthenticated = !!user;
  const isApproved = profile?.status === 'APPROVED';
  const isAdmin = profile?.role === 'ADMIN';

  return {
    user,
    session,
    profile,
    loading,
    isAuthenticated,
    isApproved,
    isAdmin,
    signOut
  };
};