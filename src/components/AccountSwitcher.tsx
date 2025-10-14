import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Truck, Leaf, User, ArrowLeftRight, Lock, Loader2, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Profile {
  id: string;
  role: 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'PRODUTOR' | 'ADMIN' | 'PRESTADOR_SERVICOS' | 'TRANSPORTADORA';
  full_name: string;
  status: string;
  profile_photo_url?: string;
}

interface AccountSwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentProfile: Profile | null;
  onCreateProfile?: () => void;
}

export const AccountSwitcher: React.FC<AccountSwitcherProps> = ({
  isOpen,
  onClose,
  currentProfile,
  onCreateProfile
}) => {
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState('');
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [loadingProfiles, setLoadingProfiles] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (isOpen) {
      fetchUserProfiles();
      setPassword(''); // Limpar senha ao abrir
    }
  }, [isOpen]);

  const fetchUserProfiles = async () => {
    try {
      setLoadingProfiles(true);
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;

      const { data: userProfiles, error } = await supabase
        .from('profiles')
        .select('id, role, full_name, status, profile_photo_url')
        .eq('user_id', user.id);

      if (error) throw error;

      // Filtrar apenas perfis de MOTORISTA, MOTORISTA_AFILIADO, PRODUTOR e TRANSPORTADORA
      const filteredProfiles = (userProfiles || []).filter(p => 
        p.role === 'MOTORISTA' || p.role === 'MOTORISTA_AFILIADO' || p.role === 'PRODUTOR' || p.role === 'TRANSPORTADORA'
      );
      setProfiles(filteredProfiles);
    } catch (error) {
      console.error('Error fetching profiles:', error);
      toast.error('Erro ao carregar perfis');
    } finally {
      setLoadingProfiles(false);
    }
  };

  const handleAccountSwitch = async () => {
    if (!selectedProfileId || !password) {
      toast.error('Selecione uma conta e digite sua senha');
      return;
    }

    setLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user?.email) {
        toast.error('Usuário não encontrado');
        return;
      }

      // Verificar senha
      const { error: authError } = await supabase.auth.signInWithPassword({
        email: user.email,
        password
      });

      if (authError) {
        toast.error('Senha incorreta');
        return;
      }

      // Buscar o perfil selecionado
      const selectedProfile = profiles.find(p => p.id === selectedProfileId);
      
      if (!selectedProfile) {
        toast.error('Perfil não encontrado');
        return;
      }

      // Limpar dados locais se necessário
      localStorage.setItem('current_profile_id', selectedProfileId);
      
      toast.success(`Conta alterada para ${selectedProfile.role === 'MOTORISTA' ? 'Motorista' : 'Produtor'}`);
      
      // Redirecionar para o dashboard apropriado
      switch (selectedProfile.role) {
        case 'MOTORISTA':
          navigate('/dashboard/driver');
          break;
        case 'PRODUTOR':
          navigate('/dashboard/producer');
          break;
        default:
          navigate('/');
      }
      
      onClose();
      
    } catch (error) {
      console.error('Error switching account:', error);
      toast.error('Erro ao alternar conta');
    } finally {
      setLoading(false);
      setPassword('');
    }
  };

  const getRoleIcon = (role: string) => {
    return role === 'MOTORISTA' ? <Truck className="w-5 h-5" /> : <Leaf className="w-5 h-5" />;
  };

  const getRoleLabel = (role: string) => {
    return role === 'MOTORISTA' ? 'Motorista' : 'Produtor';
  };

  const getRoleColor = (role: string) => {
    return role === 'MOTORISTA' ? 'bg-accent' : 'bg-success';
  };

  const availableProfiles = profiles.filter(p => p.id !== currentProfile?.id);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowLeftRight className="w-5 h-5" />
            Alternar Conta
          </DialogTitle>
          <DialogDescription>
            Selecione qual conta você deseja usar e confirme com sua senha
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conta atual */}
          {currentProfile && (
            <Card className="border-primary">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm text-muted-foreground">Conta Atual</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-full text-primary-foreground ${getRoleColor(currentProfile.role)}`}>
                    {getRoleIcon(currentProfile.role)}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{currentProfile.full_name}</p>
                    <Badge variant="outline" className="mt-1">
                      {getRoleLabel(currentProfile.role)}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Contas disponíveis */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Alternar para:</Label>
            
            {loadingProfiles ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="w-6 h-6 animate-spin" />
              </div>
            ) : availableProfiles.length > 0 ? (
              <div className="space-y-2">
                {availableProfiles.map((profile) => (
                  <Card 
                    key={profile.id}
                    className={`cursor-pointer transition-colors hover:bg-accent ${
                      selectedProfileId === profile.id ? 'border-primary bg-accent' : ''
                    }`}
                    onClick={() => setSelectedProfileId(profile.id)}
                  >
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-full text-primary-foreground ${getRoleColor(profile.role)}`}>
                          {getRoleIcon(profile.role)}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{profile.full_name}</p>
                          <div className="flex items-center gap-2 mt-1">
                            <Badge variant="outline">
                              {getRoleLabel(profile.role)}
                            </Badge>
                            {profile.status === 'APPROVED' && (
                              <Badge variant="secondary" className="text-xs bg-success/10 text-success">
                                Aprovado
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="p-4">
                <div className="text-center space-y-4">
                  <User className="w-8 h-8 mx-auto opacity-50" />
                  <div>
                    <p className="text-sm font-medium mb-1">Não há outras contas disponíveis</p>
                    <p className="text-xs text-muted-foreground">
                      Você pode criar uma conta adicional como {currentProfile?.role === 'MOTORISTA' ? 'Produtor' : 'Motorista'}
                    </p>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={() => {
                      onClose();
                      onCreateProfile?.();
                    }}
                    className="w-full"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Criar Conta {currentProfile?.role === 'MOTORISTA' ? 'de Produtor' : 'de Motorista'}
                  </Button>
                </div>
              </Card>
            )}
          </div>

          {/* Campo de senha */}
          {availableProfiles.length > 0 && (
            <div className="space-y-2">
              <Label htmlFor="password" className="flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Confirme sua senha
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite sua senha atual"
                disabled={loading}
              />
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-2 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1" disabled={loading}>
              Cancelar
            </Button>
            {availableProfiles.length > 0 && (
              <Button 
                onClick={handleAccountSwitch} 
                className="flex-1"
                disabled={loading || !selectedProfileId || !password}
              >
                {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
                Alternar Conta
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};