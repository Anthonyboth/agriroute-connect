/**
 * UserProfileModal.tsx
 * 
 * Modal de perfil do usuário redesenhado com UX premium.
 * Layout responsivo com 2 colunas (desktop) e 1 coluna (mobile).
 * 
 * Correções críticas:
 * - Foto salva como relative path (não signed URL)
 * - Ratings não exibem dados falsos quando 0
 * - Campos vazios ocultados em modo visualização
 * - Camera button sempre visível no avatar
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { User, Phone, Shield, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ErrorMonitoringService } from '@/services/errorMonitoringService';

import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ProfileInfoCard, personalInfoFields, producerFields, driverFields, emergencyFields } from '@/components/profile/ProfileInfoCard';
import { ProfileStatsCard } from '@/components/profile/ProfileStatsCard';
import { ProfileAddressCard } from '@/components/profile/ProfileAddressCard';
import { ProfileDangerZone } from '@/components/profile/ProfileDangerZone';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

// Mask CPF/CNPJ for display: ***123***-45 or **123**-0001-**
const maskCpfCnpj = (value: string): string => {
  if (!value) return '';
  const digits = value.replace(/\D/g, '');
  if (digits.length === 11) {
    // CPF: ***.XXX.***-XX (show middle 3 digits only)
    return `***.${digits.slice(3, 6)}.***-${digits.slice(9)}`;
  }
  if (digits.length === 14) {
    // CNPJ: **XXX***/0001-**
    return `**.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-**`;
  }
  return value;
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [ratingDistribution, setRatingDistribution] = useState<{ star_rating: number; count: number }[]>([]);
  const [currentPhotoPath, setCurrentPhotoPath] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  
  const lastFetchedUserId = useRef<string | null>(null);
  const lastFetchedAt = useRef<number>(0);
  const lastErrorLogAt = useRef<number>(0);

  const [profileData, setProfileData] = useState<Record<string, string>>({
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
  });

  const [addressData, setAddressData] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip: '',
  });

  const applyProfileSource = (source: any) => {
    setProfileData({
      full_name: source?.full_name || '',
      phone: source?.phone || '',
      contact_phone: source?.contact_phone || '',
      cpf_cnpj: source?.cpf_cnpj || '',
      farm_name: source?.farm_name || '',
      farm_address: source?.farm_address || '',
      cooperative: source?.cooperative || '',
      rntrc: source?.rntrc || '',
      emergency_contact_name: source?.emergency_contact_name || '',
      emergency_contact_phone: source?.emergency_contact_phone || '',
    });
    setAddressData({
      street: source?.address_street || '',
      number: source?.address_number || '',
      complement: source?.address_complement || '',
      neighborhood: source?.address_neighborhood || '',
      city: source?.address_city || '',
      state: source?.address_state || '',
      zip: source?.address_zip || '',
    });
    setCurrentPhotoPath(source?.profile_photo_url || '');
  };

  useEffect(() => {
    if (user) applyProfileSource(user);
  }, [user]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;

    let isMounted = true;

    const hydrateProfileFromDatabase = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data: freshProfile, error } = await supabase
          .from('profiles')
          .select(`
            id, user_id, full_name, phone, contact_phone, cpf_cnpj,
            farm_name, farm_address, cooperative, rntrc,
            emergency_contact_name, emergency_contact_phone,
            address_street, address_number, address_complement,
            address_neighborhood, address_city, address_state, address_zip,
            profile_photo_url
          `)
          .eq('id', user.id)
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (!error && freshProfile && isMounted) {
          applyProfileSource(freshProfile);
        }
      } catch (error) {
        if (import.meta.env.DEV) {
          console.warn('Falha ao hidratar perfil completo no modal:', error);
        }
      }
    };

    void hydrateProfileFromDatabase();

    return () => {
      isMounted = false;
    };
  }, [isOpen, user?.id]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;
    
    const now = Date.now();
    const shouldFetch = lastFetchedUserId.current !== user.id || (now - lastFetchedAt.current > 60000);
    
    if (shouldFetch) {
      lastFetchedUserId.current = user.id;
      lastFetchedAt.current = now;
      fetchRatingDistribution();
    }
  }, [user?.id, isOpen]);

  const fetchRatingDistribution = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_user_rating_distribution', {
        p_user_id: user.id
      });

      if (error) throw error;
      setRatingDistribution(data || []);
    } catch (error) {
      const now = Date.now();
      if (now - lastErrorLogAt.current > 60000) {
        console.warn('Erro ao buscar distribuição de avaliações:', error);
        lastErrorLogAt.current = now;
      }
      setRatingDistribution([]);
    }
  };

  const handleSave = async () => {
    setLoading(true);
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
        .eq('user_id', user.user_id)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!updated) throw new Error('Atualização não aplicada (0 linhas). Verifique permissões RLS.');

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      
      setEditMode(false);
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast({
        title: "Erro ao atualizar perfil",
        description: "Não foi possível atualizar o perfil. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  /**
   * CRITICAL FIX: Save RELATIVE PATH to DB, not signed URL.
   * The signed URL expires in 24h; the relative path is permanent.
   * Display uses useSignedImageUrl hook to resolve at render time.
   */
  const handlePhotoChange = async (file: File) => {
    const errorMonitoring = ErrorMonitoringService.getInstance();
    setPhotoUploading(true);

    try {
      if (!file.type.startsWith('image/')) {
        throw new Error('Selecione um arquivo de imagem válido.');
      }

      if (file.size > 10 * 1024 * 1024) {
        throw new Error('Imagem muito grande. O limite é 10MB.');
      }

      const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
      if (authError || !authUser) throw new Error('Sessão inválida. Faça login novamente.');

      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const randomSuffix = typeof crypto?.randomUUID === 'function' ? crypto.randomUUID().slice(0, 8) : `${Math.random().toString(36).slice(2, 10)}`;
      const filePath = `${authUser.id}/profile_${Date.now()}_${randomSuffix}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: '3600',
        });

      if (uploadError) throw uploadError;

      // ✅ Save RELATIVE PATH (stable) — NOT signed URL (expires)
      // Format: profile-photos/{userId}/profile_{timestamp}.ext
      const stablePath = `profile-photos/${filePath}`;

      let targetProfileId = user?.id as string | undefined;

      const { data: ownedProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', targetProfileId || '')
        .eq('user_id', authUser.id)
        .maybeSingle();

      if (!ownedProfile) {
        const { data: fallbackProfiles, error: fallbackError } = await supabase
          .from('profiles')
          .select('id')
          .eq('user_id', authUser.id)
          .order('updated_at', { ascending: false })
          .limit(1);

        if (fallbackError) throw fallbackError;
        targetProfileId = fallbackProfiles?.[0]?.id;
      }

      if (!targetProfileId) {
        throw new Error('Perfil não encontrado para atualizar a foto.');
      }

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: stablePath })
        .eq('id', targetProfileId)
        .eq('user_id', authUser.id)
        .select('id, profile_photo_url')
        .maybeSingle();

      if (updateError) throw updateError;
      if (!updatedProfile) {
        throw new Error('Atualização não aplicada (0 linhas). Verifique permissões de perfil.');
      }
      
      setCurrentPhotoPath(stablePath);
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });
      
      toast({
        title: 'Foto atualizada',
        description: 'Sua foto de perfil foi atualizada com sucesso!',
      });
    } catch (error: any) {
      const message = error?.message || 'Não foi possível atualizar a foto.';
      console.error('Error updating photo:', error);

      await errorMonitoring.captureError(
        new Error(message),
        {
          source: 'profile_photo_upload',
          functionName: 'handlePhotoChange',
          module: 'UserProfileModal',
          userFacing: true,
        }
      );

      toast({
        title: 'Erro ao atualizar foto',
        description: message,
        variant: 'destructive',
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const handleRemovePhoto = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) throw new Error('Sessão inválida');

      const { data: updatedProfile, error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: null })
        .eq('id', user.id)
        .eq('user_id', authUser.id)
        .select('id')
        .maybeSingle();

      if (updateError) throw updateError;

      setCurrentPhotoPath('');
      await queryClient.invalidateQueries({ queryKey: ['profile'] });
      await queryClient.invalidateQueries({ queryKey: ['user'] });

      toast({
        title: 'Foto removida',
        description: 'Sua foto de perfil foi removida.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao remover foto',
        description: error?.message || 'Tente novamente.',
        variant: 'destructive',
      });
    }
  };

  const handleFieldChange = (name: string, value: string) => {
    setProfileData(prev => ({ ...prev, [name]: value }));
  };

  const handleAddressChange = (field: keyof typeof addressData, value: string) => {
    setAddressData(prev => ({ ...prev, [field]: value }));
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke('delete-user-account');
      
      if (error) throw error;
      
      if (data?.success) {
        await supabase.auth.signOut();
        toast({
          title: "Conta excluída",
          description: "Sua conta e todos os seus dados foram excluídos permanentemente.",
        });
        window.location.href = '/';
      } else {
        throw new Error(data?.error || 'Erro desconhecido ao excluir conta');
      }
    } catch (error: any) {
      console.error('Erro ao excluir conta:', error);
      toast({
        title: "Erro ao excluir conta",
        description: error.message || "Não foi possível excluir sua conta. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setIsDeleting(false);
    }
  };

  // Completeness CTA
  const missingFields: string[] = [];
  if (!profileData.cpf_cnpj) missingFields.push('CPF/CNPJ');
  if (!profileData.phone && !profileData.contact_phone) missingFields.push('Telefone WhatsApp');
  if (!currentPhotoPath) missingFields.push('Foto de perfil');

  // Display data with masked CPF/CNPJ
  const displayData = {
    ...profileData,
    cpf_cnpj: editMode ? profileData.cpf_cnpj : maskCpfCnpj(profileData.cpf_cnpj),
  };

  const roleSpecificFields = user?.role === 'PRODUTOR' ? producerFields : driverFields;

  // Check if role-specific fields have any data
  const hasRoleData = roleSpecificFields.some(f => !!profileData[f.name]);
  // Check if emergency fields have any data
  const hasEmergencyData = emergencyFields.some(f => !!profileData[f.name]);
  // Check if address has any data
  const hasAddressData = Object.values(addressData).some(v => !!v);

  // Location string for header
  const locationParts = [addressData.city, addressData.state].filter(Boolean);
  const locationString = locationParts.length > 0 ? locationParts.join('/') : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-4xl h-[calc(100dvh-1rem)] sm:h-auto sm:max-h-[90vh] p-0 flex flex-col overflow-x-hidden overflow-y-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Perfil de {user?.full_name}</DialogTitle>
            <DialogDescription>Visualize e edite suas informações pessoais</DialogDescription>
          </DialogHeader>

          <div className="flex-shrink-0">
            <ProfileHeader
              fullName={user?.full_name || ''}
              role={user?.role || ''}
              status={user?.status || ''}
              photoUrl={currentPhotoPath}
              isEditing={editMode}
              isSaving={loading}
              isPhotoUploading={photoUploading}
              onEditToggle={() => setEditMode(!editMode)}
              onSave={handleSave}
              onPhotoChange={handlePhotoChange}
              onRemovePhoto={handleRemovePhoto}
              location={locationString}
              memberSince={user?.created_at}
            />
          </div>

          <div 
            className="flex-1 min-h-0 overflow-y-auto overscroll-contain scroll-pb-40"
            style={{ WebkitOverflowScrolling: 'touch' }}
          >
            <div className="px-4 sm:px-6 pb-6" style={{ paddingBottom: 'max(7rem, env(safe-area-inset-bottom, 1.5rem))' }}>
              
              {/* Completeness CTA */}
              {!editMode && missingFields.length > 0 && (
                <div className="mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-primary flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Complete seu perfil</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Faltam: {missingFields.join(', ')}
                    </p>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                <div className="lg:col-span-2 space-y-4">
                  <ProfileInfoCard
                    title="Informações Pessoais"
                    icon={<User className="h-4 w-4 text-primary" />}
                    fields={personalInfoFields}
                    data={editMode ? profileData : displayData}
                    isEditing={editMode}
                    onChange={handleFieldChange}
                    hideEmpty={!editMode}
                  />

                  {(editMode || hasRoleData) && roleSpecificFields.length > 0 && (
                    <ProfileInfoCard
                      title={user?.role === 'PRODUTOR' ? 'Dados da Fazenda' : 'Dados Profissionais'}
                      icon={<Shield className="h-4 w-4 text-primary" />}
                      fields={roleSpecificFields}
                      data={profileData}
                      isEditing={editMode}
                      onChange={handleFieldChange}
                      hideEmpty={!editMode}
                    />
                  )}

                  {(editMode || hasEmergencyData) && (
                    <ProfileInfoCard
                      title="Contato de Emergência"
                      icon={<Phone className="h-4 w-4 text-primary" />}
                      fields={emergencyFields}
                      data={profileData}
                      isEditing={editMode}
                      onChange={handleFieldChange}
                      hideEmpty={!editMode}
                    />
                  )}

                  {(editMode || hasAddressData) && (
                    <ProfileAddressCard
                      address={addressData}
                      isEditing={editMode}
                      onChange={handleAddressChange}
                    />
                  )}

                  <div className="lg:hidden">
                    <ProfileDangerZone
                      onDeleteAccount={handleDeleteAccount}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>

                <div className="space-y-4">
                  <ProfileStatsCard
                    rating={user?.rating || 0}
                    totalRatings={user?.total_ratings || 0}
                    memberSince={user?.created_at}
                    totalServices={0}
                    ratingDistribution={ratingDistribution}
                  />

                  <div className="hidden lg:block">
                    <ProfileDangerZone
                      onDeleteAccount={handleDeleteAccount}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
