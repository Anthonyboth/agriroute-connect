/**
 * src/hooks/useProfileEdit.ts
 *
 * Hook dedicado para edição de perfil do usuário.
 * Extrai toda a lógica de estado, hydrate, save, upload de foto
 * do antigo UserProfileModal.
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

export interface ProfileFormData {
  full_name: string;
  phone: string;
  contact_phone: string;
  cpf_cnpj: string;
  farm_name: string;
  farm_address: string;
  cooperative: string;
  rntrc: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export interface AddressFormData {
  street: string;
  number: string;
  complement: string;
  neighborhood: string;
  city: string;
  state: string;
  zip: string;
}

const EMPTY_PROFILE: ProfileFormData = {
  full_name: '',
  phone: '',
  contact_phone: '',
  cpf_cnpj: '',
  farm_name: '',
  farm_address: '',
  cooperative: '',
  rntrc: '',
  emergency_contact_name: '',
  emergency_contact_phone: '',
};

const EMPTY_ADDRESS: AddressFormData = {
  street: '',
  number: '',
  complement: '',
  neighborhood: '',
  city: '',
  state: '',
  zip: '',
};

export function useProfileEdit() {
  const { profile: authProfile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [currentPhotoPath, setCurrentPhotoPath] = useState('');
  const [profileData, setProfileData] = useState<ProfileFormData>(EMPTY_PROFILE);
  const [addressData, setAddressData] = useState<AddressFormData>(EMPTY_ADDRESS);
  const [ratingDistribution, setRatingDistribution] = useState<{ star_rating: number; count: number }[]>([]);

  const hydratedRef = useRef(false);

  // ── Hydrate from database ──────────────────────────────────────────
  const hydrate = useCallback(async () => {
    if (!authProfile?.id) return;
    setLoading(true);
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) return;

      const { data: fresh, error } = await supabase
        .from('profiles')
        .select(`
          id, user_id, full_name, phone, contact_phone, cpf_cnpj,
          farm_name, farm_address, cooperative, rntrc,
          emergency_contact_name, emergency_contact_phone,
          address_street, address_number, address_complement,
          address_neighborhood, address_city, address_state, address_zip,
          profile_photo_url, rating, total_ratings, created_at
        `)
        .eq('id', authProfile.id)
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!error && fresh) {
        setProfileData({
          full_name: fresh.full_name || '',
          phone: fresh.phone || '',
          contact_phone: fresh.contact_phone || '',
          cpf_cnpj: fresh.cpf_cnpj || '',
          farm_name: fresh.farm_name || '',
          farm_address: fresh.farm_address || '',
          cooperative: fresh.cooperative || '',
          rntrc: fresh.rntrc || '',
          emergency_contact_name: fresh.emergency_contact_name || '',
          emergency_contact_phone: fresh.emergency_contact_phone || '',
        });
        setAddressData({
          street: fresh.address_street || '',
          number: fresh.address_number || '',
          complement: fresh.address_complement || '',
          neighborhood: fresh.address_neighborhood || '',
          city: fresh.address_city || '',
          state: fresh.address_state || '',
          zip: fresh.address_zip || '',
        });
        setCurrentPhotoPath(fresh.profile_photo_url || '');
      }
    } catch (err) {
      console.warn('useProfileEdit: hydrate failed', err);
    } finally {
      setLoading(false);
    }
  }, [authProfile?.id]);

  useEffect(() => {
    if (authProfile?.id && !hydratedRef.current) {
      hydratedRef.current = true;
      hydrate();
    }
  }, [authProfile?.id, hydrate]);

  // ── Fetch rating distribution ──────────────────────────────────────
  useEffect(() => {
    if (!authProfile?.id) return;
    const fetchRatings = async () => {
      try {
        const { data } = await supabase.rpc('get_user_rating_distribution', { p_user_id: authProfile.id });
        setRatingDistribution(data || []);
      } catch {
        setRatingDistribution([]);
      }
    };
    fetchRatings();
  }, [authProfile?.id]);

  // ── Field handlers ─────────────────────────────────────────────────
  const handleFieldChange = useCallback((name: string, value: string) => {
    setProfileData(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleAddressChange = useCallback((field: keyof AddressFormData, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }));
  }, []);

  // ── Save ────────────────────────────────────────────────────────────
  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!authProfile?.user_id) {
      toast({ title: 'Erro', description: 'Sessão inválida. Faça login novamente.', variant: 'destructive' });
      return false;
    }
    setSaving(true);
    try {
      const { data: updated, error } = await supabase
        .from('profiles')
        .update({
          full_name: profileData.full_name,
          phone: profileData.phone,
          contact_phone: profileData.contact_phone,
          farm_name: profileData.farm_name,
          farm_address: profileData.farm_address,
          cooperative: profileData.cooperative,
          emergency_contact_name: profileData.emergency_contact_name,
          emergency_contact_phone: profileData.emergency_contact_phone,
          address_street: addressData.street,
          address_number: addressData.number,
          address_complement: addressData.complement,
          address_neighborhood: addressData.neighborhood,
          address_city: addressData.city,
          address_state: addressData.state,
          address_zip: addressData.zip,
        })
        .eq('user_id', authProfile.user_id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updated) throw new Error('Atualização não aplicada. Verifique permissões.');

      toast({ title: 'Perfil atualizado', description: 'Suas informações foram salvas.' });
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      return true;
    } catch (err: any) {
      console.error('useProfileEdit: save failed', err);
      toast({ title: 'Erro ao salvar', description: err?.message || 'Tente novamente.', variant: 'destructive' });
      return false;
    } finally {
      setSaving(false);
    }
  }, [authProfile?.user_id, profileData, addressData, toast, queryClient]);

  // ── Photo upload ───────────────────────────────────────────────────
  const handlePhotoChange = useCallback(async (file: File) => {
    const errorMonitoring = ErrorMonitoringService.getInstance();
    setPhotoUploading(true);
    try {
      if (!file.type.startsWith('image/')) throw new Error('Selecione uma imagem válida.');
      if (file.size > 10 * 1024 * 1024) throw new Error('Imagem muito grande (máx 10MB).');

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Sessão inválida.');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const randomSuffix = crypto?.randomUUID?.()?.slice(0, 8) || Math.random().toString(36).slice(2, 10);
      const filePath = `${authUser.id}/profile_${Date.now()}_${randomSuffix}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: false, contentType: file.type, cacheControl: '3600' });
      if (uploadError) throw uploadError;

      const stablePath = `profile-photos/${filePath}`;

      let targetProfileId = authProfile?.id;
      const { data: ownedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', targetProfileId || '')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!ownedProfile) {
        const { data: fallback } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser.id)
          .order('updated_at', { ascending: false })
          .limit(1);
        targetProfileId = fallback?.[0]?.id;
      }
      if (!targetProfileId) throw new Error('Perfil não encontrado.');

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: stablePath })
        .eq('id', targetProfileId)
        .eq('user_id', authUser.id)
        .select('id, profile_photo_url')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedProfile) throw new Error('Atualização não aplicada.');

      setCurrentPhotoPath(stablePath);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({ title: 'Foto atualizada', description: 'Sua foto de perfil foi salva.' });
    } catch (err: any) {
      const msg = err?.message || 'Erro ao atualizar foto.';
      console.error('useProfileEdit: photo upload failed', err);
      await errorMonitoring.captureError(new Error(msg), {
        source: 'profile_photo_upload',
        functionName: 'handlePhotoChange',
        module: 'useProfileEdit',
        userFacing: true,
      });
      toast({ title: 'Erro ao atualizar foto', description: msg, variant: 'destructive' });
    } finally {
      setPhotoUploading(false);
    }
  }, [authProfile?.id, queryClient, toast]);

  // ── Remove photo ───────────────────────────────────────────────────
  const handleRemovePhoto = useCallback(async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Sessão inválida');

      const { error } = await supabase
        .from('profiles')
        .update({ profile_photo_url: null })
        .eq('id', authProfile?.id || '')
        .eq('user_id', authUser.id)
        .select('id')
        .maybeSingle();

      if (error) throw error;

      setCurrentPhotoPath('');
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      toast({ title: 'Foto removida' });
    } catch (err: any) {
      toast({ title: 'Erro ao remover foto', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    }
  }, [authProfile?.id, queryClient, toast]);

  // ── Delete account ─────────────────────────────────────────────────
  const handleDeleteAccount = useCallback(async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');
      if (error) throw error;
      if (data?.success) {
        await supabase.auth.signOut();
        toast({ title: 'Conta excluída', description: 'Todos os seus dados foram removidos.' });
        window.location.href = '/';
      } else {
        throw new Error(data?.error || 'Erro desconhecido');
      }
    } catch (err: any) {
      toast({ title: 'Erro ao excluir conta', description: err?.message || 'Tente novamente.', variant: 'destructive' });
    } finally {
      setIsDeleting(false);
    }
  }, [toast]);

  // ── Missing fields ─────────────────────────────────────────────────
  const missingFields: string[] = [];
  if (!profileData.cpf_cnpj) missingFields.push('CPF/CNPJ');
  if (!profileData.phone && !profileData.contact_phone) missingFields.push('Telefone WhatsApp');
  if (!currentPhotoPath) missingFields.push('Foto de perfil');

  return {
    // State
    profileData,
    addressData,
    currentPhotoPath,
    loading,
    saving,
    photoUploading,
    isDeleting,
    missingFields,
    ratingDistribution,
    authProfile,
    // Actions
    handleFieldChange,
    handleAddressChange,
    handleSave,
    handlePhotoChange,
    handleRemovePhoto,
    handleDeleteAccount,
    hydrate,
  };
}
