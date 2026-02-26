import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Edit, Trash2, CheckCircle, Clock, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { StorageImage } from '@/components/ui/storage-image';

interface CompanyFleetVehicleListProps {
  companyId: string;
  onRefresh?: () => void;
}

export const CompanyFleetVehicleList = ({ companyId, onRefresh }: CompanyFleetVehicleListProps) => {
  const { data: vehicles, isLoading, refetch } = useQuery({
    queryKey: ['company-fleet-vehicles', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_company_vehicle', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const handleRemoveVehicle = async (vehicleId: string) => {
    if (!confirm('Tem certeza que deseja remover este veículo?')) return;

    try {
      const { error } = await supabase
        .from('vehicles')
        .delete()
        .eq('id', vehicleId);

      if (error) throw error;

      toast.success('Veículo removido com sucesso');
      refetch();
      onRefresh?.();
    } catch (error: any) {
      console.error('Erro ao remover veículo:', error);
      toast.error(error.message || 'Erro ao remover veículo');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      'APPROVED': 'Aprovado',
      'PENDING': 'Pendente',
      'REJECTED': 'Rejeitado',
      'ACTIVE': 'Ativo',
      'INACTIVE': 'Inativo'
    };
    const label = statusLabels[status] || status;
    
    switch (status) {
      case 'APPROVED':
        return (
          <Badge className="bg-green-500 hover:bg-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            {label}
          </Badge>
        );
      case 'PENDING':
        return (
          <Badge className="bg-yellow-500 hover:bg-yellow-600">
            <Clock className="mr-1 h-3 w-3" />
            {label}
          </Badge>
        );
      case 'REJECTED':
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            {label}
          </Badge>
        );
      default:
        return <Badge variant="secondary">{label}</Badge>;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Veículos da Frota</CardTitle>
          <CardDescription>Carregando...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Veículos da Frota</CardTitle>
          <CardDescription>Nenhum veículo cadastrado ainda</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Cadastre veículos usando o formulário acima para começar a aceitar fretes.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Veículos da Frota</h3>
          <p className="text-sm text-muted-foreground">
            Total: {vehicles.length} veículo{vehicles.length !== 1 ? 's' : ''}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()}>
          Atualizar
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id}>
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <Truck className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle className="text-base">
                      {vehicle.license_plate || 'Sem placa'}
                    </CardTitle>
                    <CardDescription className="text-xs">
                      {vehicle.vehicle_type || 'Tipo não especificado'}
                    </CardDescription>
                  </div>
                </div>
                {getStatusBadge(vehicle.status)}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {vehicle.vehicle_photos && Array.isArray(vehicle.vehicle_photos) && vehicle.vehicle_photos.length > 0 && (
                <div className="grid grid-cols-4 gap-2">
                  {vehicle.vehicle_photos.slice(0, 4).map((photo: string, i: number) => (
                    <div key={i} className="relative aspect-square rounded overflow-hidden border">
                      <StorageImage
                        src={photo}
                        alt={`Foto ${i + 1}`}
                        className="h-full w-full"
                        fallbackClassName="h-full w-full"
                      />
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-muted-foreground">Eixos:</span>
                  <p className="font-medium">{vehicle.axle_count || 'N/A'}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Capacidade:</span>
                  <p className="font-medium">{vehicle.max_capacity_tons || 'N/A'}t</p>
                </div>
              </div>

              {vehicle.status === 'PENDING' && (
                <p className="text-xs text-yellow-600">
                  Aguardando aprovação do administrador
                </p>
              )}

              {vehicle.status === 'REJECTED' && (
                <p className="text-xs text-red-600">
                  Veículo rejeitado pela administração
                </p>
              )}

              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  disabled={vehicle.status === 'REJECTED'}
                >
                  <Edit className="mr-1 h-3 w-3" />
                  Editar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleRemoveVehicle(vehicle.id)}
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
};
