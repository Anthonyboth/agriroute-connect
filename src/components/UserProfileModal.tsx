import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, User, MapPin, Phone, Mail, Calendar, Award } from 'lucide-react';
import { ProfilePhotoUpload } from '@/components/ProfilePhotoUpload';
import { StructuredAddressForm } from '@/components/StructuredAddressForm';
import { formatAddress, Address } from '@/lib/address-utils';
import { CompanyModeToggle } from '@/components/CompanyModeToggle';

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
  const [loading, setLoading] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [ratingDistribution, setRatingDistribution] = useState<{ star_rating: number; count: number }[]>([]);
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    contact_phone: '',
    farm_name: '',
    farm_address: '',
    cooperative: '',
    emergency_contact_name: '',
    emergency_contact_phone: '',
    address_street: '',
    address_number: '',
    address_complement: '',
    address_neighborhood: '',
    address_city: '',
    address_state: '',
    address_zip: '',
  });

  useEffect(() => {
    if (user) {
      setProfileData({
        full_name: user.full_name || '',
        phone: user.phone || '',
        contact_phone: user.contact_phone || '',
        farm_name: user.farm_name || '',
        farm_address: user.farm_address || '',
        cooperative: user.cooperative || '',
        emergency_contact_name: user.emergency_contact_name || '',
        emergency_contact_phone: user.emergency_contact_phone || '',
        address_street: user.address_street || '',
        address_number: user.address_number || '',
        address_complement: user.address_complement || '',
        address_neighborhood: user.address_neighborhood || '',
        address_city: user.address_city || '',
        address_state: user.address_state || '',
        address_zip: user.address_zip || '',
      });
      fetchRatingDistribution();
    }
  }, [user]);

  const fetchRatingDistribution = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await supabase.rpc('get_user_rating_distribution', {
        p_user_id: user.id
      });

      if (error) throw error;
      
      setRatingDistribution(data || []);
    } catch (error) {
      console.error('Erro ao buscar distribuição de avaliações:', error);
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
          address_street: profileData.address_street,
          address_number: profileData.address_number,
          address_complement: profileData.address_complement,
          address_neighborhood: profileData.address_neighborhood,
          address_city: profileData.address_city,
          address_state: profileData.address_state,
          address_zip: profileData.address_zip,
        })
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      
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

  const handlePhotoUploadComplete = async (url: string) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ profile_photo_url: url })
        .eq('user_id', user.user_id);

      if (error) throw error;
      
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

  const handleAddressChange = (address: Address) => {
    setProfileData({
      ...profileData,
      address_street: address.street || '',
      address_number: address.number || '',
      address_complement: address.complement || '',
      address_neighborhood: address.neighborhood || '',
      address_city: address.city || '',
      address_state: address.state || '',
      address_zip: address.zip || '',
    });
  };

  const getUserInitials = (name: string) => {
    return name?.split(' ').map(n => n[0]).join('').toUpperCase() || '?';
  };

  const getRoleBadge = (role: string) => {
    return role === 'PRODUTOR' ? 'Produtor' : 'Motorista';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'bg-green-100 text-green-800';
      case 'PENDING': return 'bg-yellow-100 text-yellow-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'APPROVED': return 'Aprovado';
      case 'PENDING': return 'Pendente';
      case 'REJECTED': return 'Rejeitado';
      default: return status;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <div className="flex flex-col items-center gap-2">
              <Avatar className="h-12 w-12">
                <AvatarImage src={user?.profile_photo_url} />
                <AvatarFallback className="gradient-primary text-primary-foreground">
                  {getUserInitials(user?.full_name)}
                </AvatarFallback>
              </Avatar>
              {editMode && (
                <ProfilePhotoUpload
                  currentPhotoUrl={user?.profile_photo_url || ''}
                  onUploadComplete={handlePhotoUploadComplete}
                  userName={user?.full_name || ''}
                  size="sm"
                />
              )}
            </div>
            <div>
              <h2 className="text-xl font-bold">{user?.full_name}</h2>
              <div className="flex items-center gap-2">
                <Badge variant="secondary">
                  {getRoleBadge(user?.role)}
                </Badge>
                <Badge className={getStatusColor(user?.status)}>
                  {getStatusText(user?.status)}
                </Badge>
              </div>
            </div>
          </DialogTitle>
          <DialogDescription>
            Visualize e edite as informações do seu perfil
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-y-auto max-h-[70vh] pr-2">
          {/* Coluna da esquerda - Informações básicas */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Informações Pessoais
                </CardTitle>
                <Button
                  variant={editMode ? "destructive" : "outline"}
                  size="sm"
                  onClick={() => setEditMode(!editMode)}
                >
                  {editMode ? 'Cancelar' : 'Editar'}
                </Button>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    {editMode ? (
                      <Input
                        value={profileData.full_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, full_name: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.full_name || 'Não informado'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Telefone
                    </Label>
                    {editMode ? (
                      <Input
                        type="tel"
                        value={profileData.phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, phone: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.phone || 'Não informado'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone de Contato</Label>
                    {editMode ? (
                      <Input
                        type="tel"
                        value={profileData.contact_phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, contact_phone: e.target.value }))}
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.contact_phone || 'Não informado'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>CPF/CNPJ</Label>
                    <p className="text-sm text-muted-foreground">{user?.cpf_cnpj || 'Não informado'}</p>
                  </div>
                </div>

                {user?.role === 'PRODUTOR' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Nome da Fazenda</Label>
                      {editMode ? (
                        <Input
                          value={profileData.farm_name}
                          onChange={(e) => setProfileData(prev => ({ ...prev, farm_name: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{user?.farm_name || 'Não informado'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Endereço da Fazenda
                      </Label>
                      {editMode ? (
                        <Input
                          value={profileData.farm_address}
                          onChange={(e) => setProfileData(prev => ({ ...prev, farm_address: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{user?.farm_address || 'Não informado'}</p>
                      )}
                    </div>
                  </div>
                )}

                {user?.role === 'MOTORISTA' && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                    <div className="space-y-2">
                      <Label>Cooperativa</Label>
                      {editMode ? (
                        <Input
                          value={profileData.cooperative}
                          onChange={(e) => setProfileData(prev => ({ ...prev, cooperative: e.target.value }))}
                        />
                      ) : (
                        <p className="text-sm text-muted-foreground">{user?.cooperative || 'Não informado'}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>RNTRC</Label>
                      <p className="text-sm text-muted-foreground">{user?.rntrc || 'Não informado'}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="space-y-2">
                    <Label>Contato de Emergência</Label>
                    {editMode ? (
                      <Input
                        value={profileData.emergency_contact_name}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergency_contact_name: e.target.value }))}
                        placeholder="Nome do contato"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.emergency_contact_name || 'Não informado'}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone de Emergência</Label>
                    {editMode ? (
                      <Input
                        type="tel"
                        value={profileData.emergency_contact_phone}
                        onChange={(e) => setProfileData(prev => ({ ...prev, emergency_contact_phone: e.target.value }))}
                        placeholder="Telefone do contato"
                      />
                    ) : (
                      <p className="text-sm text-muted-foreground">{user?.emergency_contact_phone || 'Não informado'}</p>
                    )}
                  </div>
                </div>

                {/* Endereço Estruturado */}
                <div className="pt-4 border-t">
                  <Label className="flex items-center gap-2 mb-3">
                    <MapPin className="h-4 w-4" />
                    Endereço
                  </Label>
                  {editMode ? (
                    <StructuredAddressForm
                      value={{
                        street: profileData.address_street,
                        number: profileData.address_number,
                        complement: profileData.address_complement,
                        neighborhood: profileData.address_neighborhood,
                        city: profileData.address_city,
                        state: profileData.address_state,
                        zip: profileData.address_zip,
                      }}
                      onChange={handleAddressChange}
                      disabled={loading}
                    />
                  ) : (
                    <div className="text-sm text-muted-foreground whitespace-pre-line">
                      {formatAddress({
                        street: user?.address_street,
                        number: user?.address_number,
                        complement: user?.address_complement,
                        neighborhood: user?.address_neighborhood,
                        city: user?.address_city,
                        state: user?.address_state,
                        zip: user?.address_zip,
                      }) || 'Endereço não cadastrado'}
                    </div>
                  )}
                </div>

                {editMode && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSave} disabled={loading}>
                      {loading ? 'Salvando...' : 'Salvar Alterações'}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Coluna da direita - Estatísticas e avaliações */}
          <div className="space-y-6">
            {user?.role === 'MOTORISTA' && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-sm font-medium">Modo de Trabalho</CardTitle>
                </CardHeader>
                <CardContent>
                  <CompanyModeToggle 
                    currentMode={user?.active_mode || 'MOTORISTA'}
                    onModeChange={() => {
                      // Recarregar após mudança de modo
                      window.location.reload();
                    }}
                  />
                </CardContent>
              </Card>
            )}
            
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  Avaliações
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary mb-2">
                    {user?.rating ? user.rating.toFixed(1) : '0.0'}
                  </div>
                  <StarRating 
                    rating={user?.rating || 0} 
                    size="lg" 
                    className="justify-center"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    {user?.total_ratings || 0} avaliações
                  </p>
                </div>

                {/* Distribuição Real de Estrelas */}
                <div className="space-y-2">
                  {[5, 4, 3, 2, 1].map((stars) => {
                    const starData = ratingDistribution.find(r => r.star_rating === stars);
                    const count = starData?.count || 0;
                    const percentage = user?.total_ratings > 0 
                      ? (count / user.total_ratings) * 100 
                      : 0;
                    
                    return (
                      <div key={stars} className="flex items-center gap-2">
                        <span className="text-sm w-16">{stars} estrelas</span>
                        <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-yellow-400 transition-all"
                            style={{ width: `${percentage}%` }}
                          />
                        </div>
                        <span className="text-sm text-muted-foreground w-8">{count}</span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Informações Gerais
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Membro desde</span>
                  <span className="text-sm font-medium">
                    {user?.created_at ? new Date(user.created_at).toLocaleDateString('pt-BR') : 'N/A'}
                  </span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Última atualização</span>
                  <span className="text-sm font-medium">
                    {user?.updated_at ? new Date(user.updated_at).toLocaleDateString('pt-BR') : 'N/A'}
                  </span>
                </div>

                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Localização ativa</span>
                  <Badge variant={user?.location_enabled ? "default" : "secondary"}>
                    {user?.location_enabled ? 'Sim' : 'Não'}
                  </Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;