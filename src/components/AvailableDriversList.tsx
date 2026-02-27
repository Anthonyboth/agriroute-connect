import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Badge } from '@/components/ui/badge';
import { useAvailableDrivers } from '@/hooks/useAvailableDrivers';
import { DriverDetailsModal } from './driver-details/DriverDetailsModal';
import { Search, Star, UserPlus, Eye, Mail, Phone } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface AvailableDriversListProps {
  companyId: string;
}

export const AvailableDriversList = ({ companyId }: AvailableDriversListProps) => {
  const { availableDrivers, isLoading, inviteDriver, isInviting } = useAvailableDrivers(companyId);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedDriver, setSelectedDriver] = useState<any | null>(null);

  // Filtrar motoristas por busca (apenas por nome, PII mascarado na view segura)
  const filteredDrivers = availableDrivers?.filter((driver: any) => {
    const search = searchTerm.toLowerCase();
    return driver.full_name?.toLowerCase().includes(search);
  });

  const handleInvite = (driverId: string) => {
    inviteDriver(driverId);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-64" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
        <Input
          placeholder="Buscar por nome..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Contador */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredDrivers?.length || 0} motorista(s) disponível(is)
        </p>
      </div>

      {/* Lista de Motoristas */}
      {filteredDrivers && filteredDrivers.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredDrivers.map((driver: any) => (
            <Card 
              key={driver.id} 
              className="hover:shadow-lg transition-all cursor-pointer group"
              onClick={() => setSelectedDriver(driver)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar className="h-16 w-16 ring-2 ring-primary/10">
                      <SignedAvatarImage src={driver.profile_photo_url} alt={driver.full_name} />
                      <AvatarFallback className="text-lg bg-primary/10">
                        {driver.full_name?.charAt(0) || '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-base group-hover:text-primary transition-colors">
                        {driver.full_name || 'Nome não informado'}
                      </h3>
                      {driver.rating > 0 && (
                        <div className="flex items-center gap-1 mt-1">
                          <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                          <span className="text-sm font-medium">
                            {driver.rating.toFixed(1)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            ({driver.total_ratings})
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                  <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/20">
                    Disponível
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-3">
                {/* Nota: Dados de contato (email/phone) protegidos - só visíveis após afiliação */}


                {/* Ações */}
                <div className="flex gap-2 pt-2" onClick={(e) => e.stopPropagation()}>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => setSelectedDriver(driver)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Perfil
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    className="flex-1"
                    onClick={() => handleInvite(driver.id)}
                    disabled={isInviting}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    Convidar
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-12 text-center">
            <UserPlus className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Nenhum motorista disponível</h3>
            <p className="text-muted-foreground">
              {searchTerm 
                ? 'Nenhum motorista encontrado com esse filtro.' 
                : 'Não há motoristas autônomos disponíveis no momento.'}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Modal de Detalhes */}
      {selectedDriver && (
        <DriverDetailsModal
          driver={selectedDriver}
          companyId={companyId}
          open={!!selectedDriver}
          onOpenChange={(open) => !open && setSelectedDriver(null)}
        />
      )}
    </div>
  );
};
