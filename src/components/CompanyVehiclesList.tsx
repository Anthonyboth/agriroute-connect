import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Truck, Edit, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { getVehicleTypeLabel } from '@/lib/vehicle-types';
import { StorageImage } from '@/components/ui/storage-image';

interface CompanyVehiclesListProps {
  companyId: string;
  onEdit: (vehicle: any) => void;
  onDelete: (vehicleId: string) => void;
}

const getStatusBadgeVariant = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'default';
    case 'PENDING':
      return 'secondary';
    case 'REJECTED':
      return 'destructive';
    default:
      return 'outline';
  }
};

const getStatusLabel = (status: string) => {
  switch (status) {
    case 'APPROVED':
      return 'Aprovado';
    case 'PENDING':
      return 'Pendente';
    case 'REJECTED':
      return 'Rejeitado';
    default:
      return status;
  }
};

export const CompanyVehiclesList = ({ companyId, onEdit, onDelete }: CompanyVehiclesListProps) => {
  const { data: vehicles, isLoading } = useQuery({
    queryKey: ['company-vehicles-list', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_company_vehicle', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  if (isLoading) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground">Carregando veículos...</p>
      </div>
    );
  }

  if (!vehicles || vehicles.length === 0) {
    return (
      <div className="text-center py-8 border-2 border-dashed rounded-lg">
        <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
        <p className="font-semibold mb-2">Nenhum veículo cadastrado</p>
        <p className="text-sm text-muted-foreground">
          Use o formulário acima para cadastrar seu primeiro veículo.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {vehicles.map((vehicle) => (
        <Card key={vehicle.id} className="border-2 hover:shadow-md transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex justify-between items-start">
              <div className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                <div>
                  <CardTitle className="text-base">
                    {vehicle.license_plate || 'Sem placa'}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {getVehicleTypeLabel(vehicle.vehicle_type)}
                  </CardDescription>
                </div>
              </div>
              <Badge variant={getStatusBadgeVariant(vehicle.status)}>
                {getStatusLabel(vehicle.status)}
              </Badge>
            </div>
          </CardHeader>

          <CardContent className="space-y-4">
            {/* Fotos do veículo */}
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
                {vehicle.vehicle_photos.length > 4 && (
                  <div className="flex items-center justify-center text-xs text-muted-foreground">
                    +{vehicle.vehicle_photos.length - 4}
                  </div>
                )}
              </div>
            )}

            {/* Especificações */}
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div className="space-y-1">
                <span className="text-muted-foreground">Capacidade:</span>
                <p className="font-medium">{vehicle.max_capacity_tons || 'N/A'}t</p>
              </div>
              <div className="space-y-1">
                <span className="text-muted-foreground">Eixos:</span>
                <p className="font-medium">{vehicle.axle_count || 'N/A'}</p>
              </div>
            </div>

            {/* Documentos */}
            {vehicle.vehicle_documents && Array.isArray(vehicle.vehicle_documents) && vehicle.vehicle_documents.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {vehicle.vehicle_documents.slice(0, 2).map((doc: string, i: number) => (
                  <Button
                    key={i}
                    variant="outline"
                    size="sm"
                    asChild
                    className="h-7 text-xs"
                  >
                    <a href={doc} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3 w-3 mr-1" />
                      Doc {i + 1}
                    </a>
                  </Button>
                ))}
                {vehicle.vehicle_documents.length > 2 && (
                  <Badge variant="secondary" className="text-xs">
                    +{vehicle.vehicle_documents.length - 2} docs
                  </Badge>
                )}
              </div>
            )}

            {/* Especificações adicionais */}
            {vehicle.vehicle_specifications && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {vehicle.vehicle_specifications}
              </p>
            )}

            {/* Botões de ação */}
            <div className="flex gap-2 pt-2 border-t">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  onEdit(vehicle);
                  toast.info(`Veículo ${vehicle.license_plate} carregado para edição`, {
                    description: 'O formulário acima está pronto para edição'
                  });
                }}
                className="flex-1"
                disabled={vehicle.status === 'REJECTED'}
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onDelete(vehicle.id)}
                className="flex-1"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Excluir
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
