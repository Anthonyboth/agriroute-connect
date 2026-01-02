import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Truck, Users, User, Briefcase, Building } from "lucide-react";

interface Profile {
  id: string;
  role: string;
  full_name: string;
  status: string;
}

interface ProfileSelectorModalProps {
  open: boolean;
  profiles: Profile[];
  onSelectProfile: (profileId: string, route: string) => void;
}

const getRoleLabel = (role: string): string => {
  const labels: Record<string, string> = {
    'MOTORISTA': 'Motorista Autônomo',
    'MOTORISTA_AFILIADO': 'Motorista Afiliado',
    'PRODUTOR': 'Produtor/Contratante',
    'PRESTADOR_SERVICOS': 'Prestador de Serviços',
    'TRANSPORTADORA': 'Transportadora'
  };
  return labels[role] || role;
};

const getIconForRole = (role: string) => {
  const iconClass = "h-6 w-6";
  const icons: Record<string, JSX.Element> = {
    'MOTORISTA': <Truck className={iconClass} />,
    'MOTORISTA_AFILIADO': <Users className={iconClass} />,
    'PRODUTOR': <User className={iconClass} />,
    'PRESTADOR_SERVICOS': <Briefcase className={iconClass} />,
    'TRANSPORTADORA': <Building className={iconClass} />
  };
  return icons[role] || <User className={iconClass} />;
};

const ROLE_TO_DASHBOARD: Record<string, string> = {
  'MOTORISTA': '/dashboard/driver',
  'MOTORISTA_AFILIADO': '/dashboard/driver',
  'PRODUTOR': '/dashboard/producer',
  'PRESTADOR_SERVICOS': '/dashboard/service-provider',
  'TRANSPORTADORA': '/dashboard/company'
};

export function ProfileSelectorModal({ open, profiles, onSelectProfile }: ProfileSelectorModalProps) {
  const handleSelectProfile = (profileId: string) => {
    const selectedProfile = profiles.find(p => p.id === profileId);
    if (!selectedProfile) return;
    
    const route = ROLE_TO_DASHBOARD[selectedProfile.role] || '/dashboard/producer';
    onSelectProfile(profileId, route);
  };

  return (
    <Dialog open={open} onOpenChange={() => {}} modal>
      <DialogContent className="sm:max-w-md" onInteractOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <DialogTitle>Escolha sua conta</DialogTitle>
          <DialogDescription>
            Você possui múltiplos perfis. Selecione com qual deseja entrar:
          </DialogDescription>
        </DialogHeader>
        
        <div className="grid gap-3 mt-4">
          {profiles.map(profile => (
            <Button
              key={profile.id}
              variant="outline"
              className="h-auto py-4 justify-start hover:bg-accent"
              onClick={() => handleSelectProfile(profile.id)}
            >
              <div className="flex items-center gap-3 w-full">
                <div className="flex-shrink-0 text-primary">
                  {getIconForRole(profile.role)}
                </div>
                
                <div className="flex-1 text-left">
                  <div className="font-semibold text-foreground">
                    {getRoleLabel(profile.role)}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {profile.full_name}
                  </div>
                </div>
                
                <Badge 
                  variant={profile.status === 'APPROVED' ? 'default' : 'secondary'}
                  className={profile.status === 'APPROVED' ? 'bg-success text-success-foreground' : ''}
                >
                  {profile.status === 'APPROVED' ? 'Ativo' : 'Pendente'}
                </Badge>
              </div>
            </Button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
