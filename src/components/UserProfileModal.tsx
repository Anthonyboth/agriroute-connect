/**
 * UserProfileModal.tsx
 * 
 * Modal de perfil do usuário redesenhado estilo Facebook.
 * Layout responsivo com 2 colunas (desktop) e 1 coluna (mobile).
 * 
 * Características:
 * - Header com foto de capa e avatar
 * - Cards com sombras sutis e bordas arredondadas
 * - Modo visualização/edição com transição suave
 * - Totalmente responsivo
 */

import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { User, Phone, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

// Novos componentes modulares
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
  const [currentPhotoUrl, setCurrentPhotoUrl] = useState<string>('');
  const [isDeleting, setIsDeleting] = useState(false);
  
  // Refs para controle de fetch
  const lastFetchedUserId = useRef<string | null>(null);
  const lastFetchedAt = useRef<number>(0);
  const lastErrorLogAt = useRef<number>(0);

  // Estado do formulário
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

  // Estado do endereço
  const [addressData, setAddressData] = useState({
    street: '',
    number: '',
    complement: '',
    neighborhood: '',
    city: '',
    state: '',
    zip: '',
  });

  // Inicializar dados quando user muda
  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        contact_phone: user.contact_phone || '',
        cpf_cnpj: user.cpf_cnpj || '',
        farm_name: user.farm_name || '',
        farm_address: user.farm_address || '',
        cooperative: user.cooperative || '',
        rntrc: user.rntrc || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || '',
      });
      setAddressData({
        street: user.address_street || '',
        number: user.address_number || '',
        complement: user.address_complement || '',
        neighborhood: user.address_neighborhood || '',
        city: user.address_city || '',
        state: user.address_state || '',
        zip: user.address_zip || '',
      });
      setCurrentPhotoUrl(user.profile_photo_url || '');
    }
  }, [user?.id]);

  // Carregar rating distribution com throttle
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
      const { error } = await supabase
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
        .eq('user_id', user.user_id);

      if (error) throw error;

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

  const handlePhotoChange = async (file: File) => {
    try {
      // Upload da foto
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('profile-photos')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      // Generate signed URL (bucket is private)
      const { data: signedData, error: signError } = await supabase.storage
        .from('profile-photos')
        .createSignedUrl(filePath, 86400); // 24h

      const photoUrl = signedData?.signedUrl;
      if (signError || !photoUrl) throw signError || new Error('Erro ao gerar URL da foto');

      // Atualizar perfil com nova URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ profile_photo_url: photoUrl })
        .eq('user_id', user.user_id);

      if (updateError) throw updateError;
      
      setCurrentPhotoUrl(photoUrl);
      
      toast({
        title: "Foto atualizada",
        description: "Sua foto de perfil foi atualizada com sucesso!",
      });
    } catch (error: any) {
      console.error('Error updating photo:', error);
      toast({
        title: "Erro ao atualizar foto",
        description: "Não foi possível atualizar a foto.",
        variant: "destructive",
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
      // ✅ Apple App Store 5.1.1(v): Exclusão completa via edge function (deleta dados + auth.users)
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

  // Determinar campos baseado no role
  const roleSpecificFields = user?.role === 'PRODUTOR' ? producerFields : driverFields;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0 flex flex-col overflow-hidden">
          {/* Header invisível para acessibilidade */}
          <DialogHeader className="sr-only">
            <DialogTitle>Perfil de {user?.full_name}</DialogTitle>
            <DialogDescription>Visualize e edite suas informações pessoais</DialogDescription>
          </DialogHeader>

          {/* Profile Header com foto e info básica */}
          <div className="flex-shrink-0">
            <ProfileHeader
              fullName={user?.full_name || ''}
              email={user?.email}
              role={user?.role || ''}
              status={user?.status || ''}
              photoUrl={currentPhotoUrl}
              isEditing={editMode}
              isSaving={loading}
              onEditToggle={() => setEditMode(!editMode)}
              onSave={handleSave}
              onPhotoChange={handlePhotoChange}
            />
          </div>

          {/* Conteúdo principal com scroll - ScrollArea para compatibilidade iOS */}
          <ScrollArea className="flex-1 min-h-0">
            <div className="px-4 sm:px-6 pb-6" style={{ paddingBottom: 'max(1.5rem, env(safe-area-inset-bottom, 1.5rem))' }}>
              {/* Layout de 2 colunas (desktop) / 1 coluna (mobile) */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 lg:gap-6">
                {/* Coluna da Esquerda - 70% (lg:col-span-2) */}
                <div className="lg:col-span-2 space-y-4">
                  {/* Informações Pessoais */}
                  <ProfileInfoCard
                    title="Informações Pessoais"
                    icon={<User className="h-4 w-4 text-primary" />}
                    fields={personalInfoFields}
                    data={profileData}
                    isEditing={editMode}
                    onChange={handleFieldChange}
                  />

                  {/* Campos específicos por role */}
                  {roleSpecificFields.length > 0 && (
                    <ProfileInfoCard
                      title={user?.role === 'PRODUTOR' ? 'Dados da Fazenda' : 'Dados Profissionais'}
                      icon={<Shield className="h-4 w-4 text-primary" />}
                      fields={roleSpecificFields}
                      data={profileData}
                      isEditing={editMode}
                      onChange={handleFieldChange}
                    />
                  )}

                  {/* Contato de Emergência */}
                  <ProfileInfoCard
                    title="Contato de Emergência"
                    icon={<Phone className="h-4 w-4 text-primary" />}
                    fields={emergencyFields}
                    data={profileData}
                    isEditing={editMode}
                    onChange={handleFieldChange}
                  />

                  {/* Endereço */}
                  <ProfileAddressCard
                    address={addressData}
                    isEditing={editMode}
                    onChange={handleAddressChange}
                  />

                  {/* Zona de Perigo - apenas no mobile (aparece no final) */}
                  <div className="lg:hidden">
                    <ProfileDangerZone
                      onDeleteAccount={handleDeleteAccount}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>

                {/* Coluna da Direita - 30% (lg:col-span-1) */}
                <div className="space-y-4">
                  {/* Stats e Avaliações */}
                  <ProfileStatsCard
                    rating={user?.rating || 0}
                    totalRatings={user?.total_ratings || 0}
                    memberSince={user?.created_at}
                    totalServices={0}
                    ratingDistribution={ratingDistribution}
                  />

                  {/* Zona de Perigo - apenas no desktop */}
                  <div className="hidden lg:block">
                    <ProfileDangerZone
                      onDeleteAccount={handleDeleteAccount}
                      isDeleting={isDeleting}
                    />
                  </div>
                </div>
              </div>
            </div>
          </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
