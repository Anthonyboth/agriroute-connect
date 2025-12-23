import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Camera, Star, Calendar, CheckCircle } from 'lucide-react';

interface ProfileEditCardProps {
  fullName: string;
  email?: string;
  role?: string;
  status?: string;
  photoUrl?: string;
  rating?: number;
  totalServices?: number;
  memberSince?: string;
  onPhotoChange?: (file: File) => void;
}

const getRoleLabel = (role?: string) => {
  const roleMap: Record<string, string> = {
    'MOTORISTA': 'Motorista',
    'PRODUTOR': 'Produtor',
    'PRESTADOR_SERVICOS': 'Prestador',
    'TRANSPORTADORA': 'Transportadora',
    'ADMIN': 'Administrador'
  };
  return roleMap[role || ''] || role || 'Usuário';
};

const getStatusLabel = (status?: string) => {
  const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    'approved': { label: 'Aprovado', variant: 'default' },
    'pending': { label: 'Pendente', variant: 'secondary' },
    'rejected': { label: 'Rejeitado', variant: 'destructive' },
    'active': { label: 'Ativo', variant: 'default' }
  };
  return statusMap[status || ''] || { label: status || 'Ativo', variant: 'outline' as const };
};

export const ProfileEditCard: React.FC<ProfileEditCardProps> = ({
  fullName,
  email,
  role,
  status,
  photoUrl,
  rating = 0,
  totalServices = 0,
  memberSince,
  onPhotoChange
}) => {
  const initials = fullName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const statusInfo = getStatusLabel(status);
  const memberYear = memberSince ? new Date(memberSince).getFullYear() : new Date().getFullYear();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && onPhotoChange) {
      onPhotoChange(file);
    }
  };

  return (
    <Card className="overflow-hidden">
      <div className="h-20 bg-gradient-to-r from-primary to-primary/80" />
      <CardContent className="pt-0 -mt-10">
        <div className="text-center">
          <div className="relative inline-block">
            <Avatar className="h-20 w-20 border-4 border-background shadow-lg">
              <AvatarImage src={photoUrl} alt={fullName} />
              <AvatarFallback className="text-lg font-bold bg-primary text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            {onPhotoChange && (
              <label className="absolute bottom-0 right-0 p-1.5 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors shadow-md">
                <Camera className="h-4 w-4" />
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>
            )}
          </div>

          <h2 className="mt-3 text-lg font-bold">{fullName}</h2>
          {email && <p className="text-sm text-muted-foreground">{email}</p>}

          <div className="mt-3 flex items-center justify-center gap-2 flex-wrap">
            <Badge variant="secondary">{getRoleLabel(role)}</Badge>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-xl font-bold text-primary">{totalServices}</div>
            <div className="text-xs text-muted-foreground">Serviços</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-xl font-bold text-yellow-600 flex items-center justify-center gap-1">
              {rating.toFixed(1)}
              <Star className="h-3 w-3 fill-yellow-400" />
            </div>
            <div className="text-xs text-muted-foreground">Avaliação</div>
          </div>
          <div className="p-2 rounded-lg bg-muted/50">
            <div className="text-xl font-bold text-muted-foreground">{memberYear}</div>
            <div className="text-xs text-muted-foreground">Desde</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
