/**
 * useParticipantProfile.ts
 * 
 * Hook para buscar dados públicos de perfil de um participante (produtor ou motorista).
 * Inclui estatísticas, fotos de veículo para motoristas, e informações não sensíveis.
 */

import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PublicProfileData {
  id: string;
  full_name: string;
  avatar_url?: string;
  role: string;
  created_at: string;
  completed_freights: number;
  average_rating: number;
  total_ratings: number;
  city?: string;
  state?: string;
  is_verified?: boolean;
}

export interface VehicleData {
  id: string;
  type: string;
  plate_masked: string; // Ex: ABC-****
  capacity_kg?: number;
  model?: string;
  year?: number;
}

export interface VehiclePhoto {
  id: string;
  photo_url: string;
  photo_type: string;
  created_at: string;
}

interface UseParticipantProfileResult {
  profile: PublicProfileData | null;
  vehicle: VehicleData | null;
  vehiclePhotos: VehiclePhoto[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
}

export const useParticipantProfile = (
  userId: string | null | undefined,
  userType: 'driver' | 'producer',
  freightId?: string | null
): UseParticipantProfileResult => {
  const [profile, setProfile] = useState<PublicProfileData | null>(null);
  const [vehicle, setVehicle] = useState<VehicleData | null>(null);
  const [vehiclePhotos, setVehiclePhotos] = useState<VehiclePhoto[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    if (!userId) return;

    setIsLoading(true);
    setError(null);

    try {
      // Buscar perfil básico usando a view segura para proteção de PII
      // ✅ CORREÇÃO: profiles_secure não tem colunas 'role', 'selfie_url', 'active_mode' (mascaradas por segurança)
      // Colunas disponíveis: id, full_name, profile_photo_url, rating, total_ratings, status, created_at
      const { data: profileData, error: profileError } = await (supabase as any)
        .from('profiles_secure')
        .select('id, full_name, profile_photo_url, created_at, rating, total_ratings, status')
        .eq('id', userId)
        .maybeSingle();

      if (profileError) throw profileError;

      // Se a view segura não retornar (RLS/visibilidade), tentar fallback via Edge Function
      // (o Edge Function valida que o usuário logado é participante do frete antes de retornar dados públicos)
      let resolvedProfile: any = profileData;
      if (!resolvedProfile && freightId) {
        const { data: fnData, error: fnError } = await supabase.functions.invoke(
          'get-participant-public-profile',
          {
            body: {
              freight_id: freightId,
              participant_profile_id: userId,
              participant_type: userType,
            },
          }
        );

        if (fnError) throw fnError;
        if (fnData?.success && fnData?.profile) {
          resolvedProfile = fnData.profile;
        }
      }

      if (!resolvedProfile) {
        setProfile(null);
        return;
      }

      // Buscar contagem de fretes completados
      let completedFreights = 0;
      if (userType === 'driver') {
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', userId)
          .in('status', ['DELIVERED', 'COMPLETED']);
        completedFreights = count || 0;
      } else {
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('producer_id', userId)
          .in('status', ['DELIVERED', 'COMPLETED']);
        completedFreights = count || 0;
      }

      // Avatar URL - usar apenas profile_photo_url (selfie_url não está disponível na view segura)
      const avatarUrl = resolvedProfile.profile_photo_url;

      setProfile({
        id: resolvedProfile.id,
        full_name: resolvedProfile.full_name,
        avatar_url: avatarUrl || undefined,
        role: userType === 'driver' ? 'MOTORISTA' : 'PRODUTOR', // Inferir role do tipo passado
        created_at: resolvedProfile.created_at,
        completed_freights: completedFreights,
        average_rating: resolvedProfile.rating || 0,
        total_ratings: resolvedProfile.total_ratings || 0,
        is_verified: resolvedProfile.status === 'APPROVED'
      });

      // Para motoristas, buscar veículo e fotos
      if (userType === 'driver') {
        // Buscar veículo principal
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('id, vehicle_type, license_plate, max_capacity_tons')
          .eq('driver_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vehicleData) {
          // Mascarar placa (ex: ABC-1234 -> ABC-****)
          const plate = vehicleData.license_plate || '';
          const plateMasked = plate.length > 4 
            ? plate.substring(0, 4) + '****'
            : plate.substring(0, Math.max(0, plate.length - 2)) + '**';

          setVehicle({
            id: vehicleData.id,
            type: vehicleData.vehicle_type || 'Não informado',
            plate_masked: plateMasked,
            capacity_kg: vehicleData.max_capacity_tons ? vehicleData.max_capacity_tons * 1000 : undefined,
            model: undefined,
            year: undefined
          });

          // Buscar fotos do veículo
          const { data: photosData } = await supabase
            .from('vehicle_photo_history')
            .select('id, photo_url, photo_type, created_at')
            .eq('vehicle_id', vehicleData.id)
            .order('created_at', { ascending: false })
            .limit(6);

          setVehiclePhotos((photosData as VehiclePhoto[]) || []);
        } else {
          setVehicle(null);
          setVehiclePhotos([]);
        }
      }

    } catch (err: any) {
      console.error('Erro ao buscar perfil público:', err);
      setError(err.message || 'Erro ao carregar perfil');
      setProfile(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (userId) {
      fetchProfile();
    } else {
      setProfile(null);
      setVehicle(null);
      setVehiclePhotos([]);
    }
  }, [userId, userType]);

  return {
    profile,
    vehicle,
    vehiclePhotos,
    isLoading,
    error,
    refetch: fetchProfile
  };
};
