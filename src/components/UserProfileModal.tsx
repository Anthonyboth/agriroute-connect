/**
 * UserProfileModal.tsx
 *
 * Modal de perfil simplificado — modo somente visualização.
 * Botão "Editar Perfil" navega para /profile/edit (tela full-screen).
 */

import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Edit2, MapPin, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSignedImageUrl } from '@/hooks/useSignedImageUrl';
import { ProfileStatsCard } from '@/components/profile/ProfileStatsCard';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: any;
}

const getRoleLabel = (role: string) => {
  const map: Record<string, string> = {
    MOTORISTA: 'Motorista',
    MOTORISTA_AFILIADO: 'Motorista Afiliado',
    PRODUTOR: 'Produtor',
    PRESTADOR_SERVICOS: 'Prestador de Serviços',
    TRANSPORTADORA: 'Transportadora',
    ADMIN: 'Administrador',
  };
  return map[role] || role || 'Usuário';
};

const getStatusInfo = (status: string) => {
  const map: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
    APPROVED: { label: '✓ Aprovado', variant: 'default' },
    approved: { label: '✓ Aprovado', variant: 'default' },
    PENDING: { label: 'Pendente', variant: 'secondary' },
    pending: { label: 'Pendente', variant: 'secondary' },
    REJECTED: { label: 'Rejeitado', variant: 'destructive' },
    rejected: { label: 'Rejeitado', variant: 'destructive' },
    ACTIVE: { label: '✓ Ativo', variant: 'default' },
    active: { label: '✓ Ativo', variant: 'default' },
  };
  return map[status] || { label: status || 'Ativo', variant: 'outline' as const };
};

const getInitials = (name: string) => {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
};

const maskCpfCnpj = (value: string): string => {
  if (!value) return '';
  const d = value.replace(/\D/g, '');
  if (d.length === 11) return `***.${d.slice(3, 6)}.***-${d.slice(9)}`;
  if (d.length === 14) return `**.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-**`;
  return value;
};

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user
}) => {
  const navigate = useNavigate();
  const [ratingDistribution, setRatingDistribution] = useState<{ star_rating: number; count: number }[]>([]);
  const [profileData, setProfileData] = useState<Record<string, string>>({});
  const [addressData, setAddressData] = useState({ city: '', state: '' });
  const [currentPhotoPath, setCurrentPhotoPath] = useState('');
  const lastFetchedUserId = useRef<string | null>(null);

  const { url: resolvedPhotoUrl } = useSignedImageUrl(currentPhotoPath);
  const statusInfo = getStatusInfo(user?.status || '');

  // Hydrate from DB on open
  useEffect(() => {
    if (!isOpen || !user?.id) return;
    let mounted = true;

    const hydrate = async () => {
      try {
        const { data: { user: authUser } } = await supabase.auth.getUser();
        if (!authUser) return;

        const { data } = await supabase
          .from('profiles')
          .select('full_name, phone, contact_phone, cpf_cnpj, profile_photo_url, address_city, address_state, farm_name, cooperative, rntrc')
          .eq('id', user.id)
          .eq('user_id', authUser.id)
          .maybeSingle();

        if (data && mounted) {
          setProfileData({
            full_name: data.full_name || '',
            phone: data.phone || '',
            contact_phone: data.contact_phone || '',
            cpf_cnpj: data.cpf_cnpj || '',
            farm_name: data.farm_name || '',
            cooperative: data.cooperative || '',
            rntrc: data.rntrc || '',
          });
          setAddressData({ city: data.address_city || '', state: data.address_state || '' });
          setCurrentPhotoPath(data.profile_photo_url || '');
        }
      } catch {}
    };

    hydrate();
    return () => { mounted = false; };
  }, [isOpen, user?.id]);

  // Fetch ratings
  useEffect(() => {
    if (!isOpen || !user?.id || lastFetchedUserId.current === user.id) return;
    lastFetchedUserId.current = user.id;

    const fetchRatings = async () => {
      try {
        const { data } = await supabase.rpc('get_user_rating_distribution', { p_user_id: user.id });
        setRatingDistribution(data || []);
      } catch {
        setRatingDistribution([]);
      }
    };
    fetchRatings();
  }, [user?.id, isOpen]);

  const handleGoToEdit = () => {
    onClose();
    setTimeout(() => navigate('/profile/edit'), 150);
  };

  const locationParts = [addressData.city, addressData.state].filter(Boolean);
  const locationString = locationParts.length > 0 ? locationParts.join('/') : null;

  const memberDateStr = user?.created_at
    ? format(new Date(user.created_at), "MMM/yyyy", { locale: ptBR })
    : null;

  const contextParts: string[] = [];
  if (locationString) contextParts.push(`📍 ${locationString}`);
  if (memberDateStr) contextParts.push(`Membro desde ${memberDateStr}`);

  // Missing fields CTA
  const missingFields: string[] = [];
  if (!profileData.cpf_cnpj) missingFields.push('CPF/CNPJ');
  if (!profileData.phone && !profileData.contact_phone) missingFields.push('Telefone');
  if (!currentPhotoPath) missingFields.push('Foto');

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="w-[calc(100vw-1rem)] sm:w-full sm:max-w-md p-0 overflow-x-hidden overflow-y-hidden max-h-[85vh] rounded-xl">
        <DialogHeader className="sr-only">
          <DialogTitle>Perfil de {user?.full_name}</DialogTitle>
          <DialogDescription>Visualize suas informações</DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto max-h-[85vh] overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          {/* Avatar + Info */}
          <div className="flex flex-col items-center pt-8 pb-4 px-6">
            <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
              <AvatarImage src={resolvedPhotoUrl || undefined} alt={user?.full_name} className="object-cover" />
              <AvatarFallback className="text-2xl font-bold bg-primary/10 text-primary">
                {getInitials(user?.full_name || '')}
              </AvatarFallback>
            </Avatar>

            <h2 className="mt-3 text-lg font-bold text-foreground text-center">
              {profileData.full_name || user?.full_name || 'Usuário'}
            </h2>

            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant="secondary" className="text-xs">{getRoleLabel(user?.role || '')}</Badge>
              <Badge variant={statusInfo.variant} className="text-xs">{statusInfo.label}</Badge>
            </div>

            {contextParts.length > 0 && (
              <p className="mt-1.5 text-xs text-muted-foreground text-center">
                {contextParts.join(' • ')}
              </p>
            )}

            {/* Edit button */}
            <Button
              onClick={handleGoToEdit}
              variant="outline"
              className="mt-4 w-full gap-2 font-semibold"
            >
              <Edit2 className="h-4 w-4" />
              Editar Perfil
            </Button>
          </div>

          {/* Completeness CTA */}
          {missingFields.length > 0 && (
            <div className="mx-6 mb-4 p-3 rounded-lg bg-primary/10 border border-primary/20 flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-foreground">Complete seu perfil</p>
                <p className="text-xs text-muted-foreground">Faltam: {missingFields.join(', ')}</p>
              </div>
            </div>
          )}

          {/* Quick info */}
          <div className="px-6 pb-2 space-y-2">
            {profileData.phone && (
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">WhatsApp</span>
                <span className="text-sm text-foreground">{profileData.phone}</span>
              </div>
            )}
            {profileData.cpf_cnpj && (
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">CPF/CNPJ</span>
                <span className="text-sm text-foreground">{maskCpfCnpj(profileData.cpf_cnpj)}</span>
              </div>
            )}
            {profileData.farm_name && (
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Fazenda</span>
                <span className="text-sm text-foreground">{profileData.farm_name}</span>
              </div>
            )}
            {profileData.cooperative && (
              <div className="flex justify-between py-2 border-b border-border/50">
                <span className="text-sm text-muted-foreground">Cooperativa</span>
                <span className="text-sm text-foreground">{profileData.cooperative}</span>
              </div>
            )}
          </div>

          {/* Ratings */}
          <div className="px-6 pb-6">
            <ProfileStatsCard
              rating={user?.rating || 0}
              totalRatings={user?.total_ratings || 0}
              memberSince={user?.created_at}
              ratingDistribution={ratingDistribution}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UserProfileModal;
