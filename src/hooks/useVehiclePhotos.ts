import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface VehiclePhoto {
  id: string;
  vehicle_id: string;
  photo_url: string;
  photo_type: string;
  is_visible: boolean;
  uploaded_at: string;
  removed_at: string | null;
  created_at: string;
}

export const PHOTO_TYPES = [
  { value: 'placa', label: 'Foto da Placa' },
  { value: 'lateral', label: 'Vista Lateral' },
  { value: 'frontal', label: 'Vista Frontal' },
  { value: 'traseira', label: 'Vista Traseira' },
  { value: 'carroceria', label: 'Carroceria' },
  { value: 'equipamento', label: 'Equipamentos' },
  { value: 'geral', label: 'Outras Fotos' },
];

export const useVehiclePhotos = (vehicleId: string | undefined) => {
  const queryClient = useQueryClient();

  // Buscar fotos visíveis do veículo
  const { data: photos = [], isLoading, refetch } = useQuery({
    queryKey: ['vehicle-photos', vehicleId],
    queryFn: async (): Promise<VehiclePhoto[]> => {
      if (!vehicleId) return [];

      const { data, error } = await supabase
        .from('vehicle_photo_history')
        .select('*')
        .eq('vehicle_id', vehicleId)
        .eq('is_visible', true)
        .order('uploaded_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar fotos:', error);
        throw error;
      }

      return (data || []) as VehiclePhoto[];
    },
    enabled: !!vehicleId,
  });

  // Adicionar nova foto
  const addPhoto = useMutation({
    mutationFn: async ({ photoUrl, photoType = 'geral' }: { photoUrl: string; photoType?: string }) => {
      if (!vehicleId) throw new Error('Vehicle ID is required');

      const { data, error } = await supabase
        .from('vehicle_photo_history')
        .insert({
          vehicle_id: vehicleId,
          photo_url: photoUrl,
          photo_type: photoType,
          is_visible: true,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-photos', vehicleId] });
      toast.success('Foto adicionada com sucesso!');
    },
    onError: (error) => {
      console.error('Erro ao adicionar foto:', error);
      toast.error('Erro ao adicionar foto');
    },
  });

  // Soft delete - marcar como não visível
  const removePhoto = useMutation({
    mutationFn: async (photoId: string) => {
      const { error } = await supabase
        .from('vehicle_photo_history')
        .update({
          is_visible: false,
          removed_at: new Date().toISOString(),
        })
        .eq('id', photoId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicle-photos', vehicleId] });
      toast.success('Foto removida do álbum');
    },
    onError: (error) => {
      console.error('Erro ao remover foto:', error);
      toast.error('Erro ao remover foto');
    },
  });

  // Contar fotos por tipo
  const getPhotoCountByType = (type: string) => {
    return photos.filter(p => p.photo_type === type).length;
  };

  return {
    photos,
    isLoading,
    refetch,
    addPhoto,
    removePhoto,
    getPhotoCountByType,
    totalPhotos: photos.length,
  };
};
