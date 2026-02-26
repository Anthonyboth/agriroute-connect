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

      // Buscar snapshot seguro via Edge Function quando houver contexto de frete
      // (garante acesso consistente a dados públicos, fotos assinadas e métricas agregadas)
      let resolvedProfile: any = profileData;
      let participantSnapshot: any = null;

      if (freightId) {
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

        if (!fnError && fnData?.success) {
          participantSnapshot = fnData;
          if (fnData?.profile) {
            resolvedProfile = fnData.profile;
          }
        }
      }

      if (!resolvedProfile) {
        setProfile(null);
        return;
      }

      // Buscar contagem de fretes completados e rating real
      let completedFreights = 0;
      let realRating = resolvedProfile.rating || 0;
      let realTotalRatings = resolvedProfile.total_ratings || 0;

      if (userType === 'driver') {
        if (typeof participantSnapshot?.completed_freights === 'number') {
          completedFreights = participantSnapshot.completed_freights;
        } else {
          // Fallback sem contexto de frete: incluir concluídos em fretes e serviços
          const [directResult, assignmentResult, serviceResult] = await Promise.all([
            supabase
              .from('freights')
              .select('*', { count: 'exact', head: true })
              .eq('driver_id', userId)
              .in('status', ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']),
            supabase
              .from('freight_assignments')
              .select('*', { count: 'exact', head: true })
              .eq('driver_id', userId)
              .in('status', ['DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']),
            supabase
              .from('service_requests')
              .select('*', { count: 'exact', head: true })
              .eq('provider_id', userId)
              .in('status', ['COMPLETED', 'completed']),
          ]);

          completedFreights =
            (directResult.count || 0) +
            (assignmentResult.count || 0) +
            (serviceResult.count || 0);
        }
      } else {
        // Para produtores, "Fretes Contratados" = todos os fretes que tiveram motorista aceito
        const { count } = await supabase
          .from('freights')
          .select('*', { count: 'exact', head: true })
          .eq('producer_id', userId)
          .in('status', ['ACCEPTED', 'IN_TRANSIT', 'LOADING', 'LOADED', 'DELIVERED', 'DELIVERED_PENDING_CONFIRMATION', 'COMPLETED']);
        completedFreights = count || 0;
      }

      // Calcular rating real a partir de freight_ratings (fonte de verdade)
      const { data: ratingsData } = await supabase
        .from('freight_ratings')
        .select('rating')
        .eq('rated_user_id', userId);

      if (ratingsData && ratingsData.length > 0) {
        realTotalRatings = ratingsData.length;
        realRating = ratingsData.reduce((sum, r) => sum + (r.rating || 0), 0) / ratingsData.length;
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
        average_rating: realRating,
        total_ratings: realTotalRatings,
        is_verified: resolvedProfile.status === 'APPROVED'
      });

      // Para motoristas, buscar veículo e fotos
      if (userType === 'driver') {
        // Priorizar snapshot vindo da Edge Function (URLs já assinadas com validação de participação)
        if (participantSnapshot?.vehicle) {
          setVehicle(participantSnapshot.vehicle);
          setVehiclePhotos(Array.isArray(participantSnapshot.vehicle_photos) ? participantSnapshot.vehicle_photos : []);
          return;
        }

        // Fallback sem freightId: buscar veículo e fotos via cliente
        const { data: vehicleData } = await supabase
          .from('vehicles')
          .select('id, vehicle_type, license_plate, max_capacity_tons')
          .eq('driver_id', userId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (vehicleData) {
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

          const { data: photosData } = await supabase
            .from('vehicle_photo_history')
            .select('id, photo_url, photo_type, created_at')
            .eq('vehicle_id', vehicleData.id)
            .order('created_at', { ascending: false })
            .limit(6);

          const normalizedPhotos: VehiclePhoto[] = (photosData || []).map((photo: any) => ({
            id: photo.id,
            photo_url: photo.photo_url,
            photo_type: photo.photo_type,
            created_at: photo.created_at,
          }));

          setVehiclePhotos(normalizedPhotos);
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
