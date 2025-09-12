import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { StarRating } from '@/components/StarRating';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Camera, User, MapPin, Phone, Mail, Calendar, Award } from 'lucide-react';

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
  const [profileData, setProfileData] = useState({
    full_name: '',
    phone: '',
    contact_phone: '',
    farm_name: '',
    farm_address: '',
    cooperative: '',
    emergency_contact_name: '',
    emergency_contact_phone: ''
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
        emergency_contact_phone: user.emergency_contact_phone || ''
      });
    }
  }, [user]);

  const handleSave = async () => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('user_id', user.user_id);

      if (error) throw error;

      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram salvas com sucesso.",
      });
      
      setEditMode(false);
    } catch (error: any) {
      toast({
        title: "Erro ao atualizar perfil",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.avatar_url} />
              <AvatarFallback className="gradient-primary text-primary-foreground">
                {getUserInitials(user?.full_name)}
              </AvatarFallback>
            </Avatar>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
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

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>5 estrelas</span>
                    <span>0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>4 estrelas</span>
                    <span>0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>3 estrelas</span>
                    <span>0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>2 estrelas</span>
                    <span>0</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>1 estrela</span>
                    <span>0</span>
                  </div>
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