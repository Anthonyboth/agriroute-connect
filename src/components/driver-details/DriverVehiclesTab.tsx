import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Truck, Building2, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StorageImage } from "@/components/ui/storage-image";

interface DriverVehiclesTabProps {
  driverProfileId: string;
  companyId: string;
}

const getStatusBadge = (status: string | null) => {
  switch (status) {
    case 'APPROVED': return <Badge className="bg-green-500/20 text-green-700 border-green-500/30">Aprovado</Badge>;
    case 'PENDING': return <Badge variant="secondary" className="bg-yellow-500/20 text-yellow-700 border-yellow-500/30">Pendente</Badge>;
    case 'REJECTED': return <Badge variant="destructive">Rejeitado</Badge>;
    default: return <Badge variant="outline">{status || 'N/A'}</Badge>;
  }
};

export const DriverVehiclesTab = ({ driverProfileId, companyId }: DriverVehiclesTabProps) => {
  // 1. Veículos atribuídos pela empresa (company_vehicle_assignments)
  const { data: assignments, isLoading: loadingAssignments } = useQuery({
    queryKey: ['driver-vehicle-assignments', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          *,
          vehicle:vehicle_id(
            id,
            license_plate,
            vehicle_type,
            axle_count,
            max_capacity_tons,
            status,
            vehicle_photo_url,
            is_company_vehicle
          )
        `)
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId)
        .is('removed_at', null)
        .order('assigned_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // 2. Veículos próprios do motorista (vehicles.driver_id)
  const { data: ownVehicles, isLoading: loadingOwn } = useQuery({
    queryKey: ['driver-own-vehicles', driverProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverProfileId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // 3. Veículos da empresa atribuídos ao motorista (vehicles.assigned_driver_id)
  const { data: assignedVehicles, isLoading: loadingAssigned } = useQuery({
    queryKey: ['driver-assigned-vehicles', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('assigned_driver_id', driverProfileId)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const isLoading = loadingAssignments || loadingOwn || loadingAssigned;

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  const safeAssignments = assignments || [];
  const safeOwnVehicles = ownVehicles || [];
  const safeAssignedVehicles = assignedVehicles || [];

  // Deduplicate: remove own vehicles that already appear in assignments
  const assignedVehicleIds = new Set(safeAssignments.map((a: any) => a.vehicle_id));
  const filteredOwn = safeOwnVehicles.filter((v: any) => !assignedVehicleIds.has(v.id));
  const filteredAssigned = safeAssignedVehicles.filter((v: any) => !assignedVehicleIds.has(v.id));

  const totalVehicles = safeAssignments.length + filteredOwn.length + filteredAssigned.length;

  if (totalVehicles === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Car className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum veículo vinculado</p>
          <p className="text-sm text-muted-foreground mt-2">
            Este motorista ainda não tem veículos atribuídos pela empresa nem veículos próprios cadastrados.
          </p>
        </CardContent>
      </Card>
    );
  }

  const VehicleCard = ({ vehicle, source, isPrimary, assignedAt, notes }: {
    vehicle: any;
    source: 'company' | 'own' | 'assigned';
    isPrimary?: boolean;
    assignedAt?: string;
    notes?: string;
  }) => (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            {vehicle.vehicle_type?.includes('TRUCK') || vehicle.vehicle_type?.includes('BITREM') || vehicle.vehicle_type?.includes('RODOTREM') ? (
              <Truck className="h-5 w-5" />
            ) : (
              <Car className="h-5 w-5" />
            )}
            {vehicle.license_plate || 'Sem placa'}
          </CardTitle>
          <div className="flex items-center gap-2">
            {source === 'company' && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" /> Empresa
              </Badge>
            )}
            {source === 'own' && (
              <Badge variant="outline" className="gap-1">
                <User className="h-3 w-3" /> Próprio
              </Badge>
            )}
            {source === 'assigned' && (
              <Badge variant="outline" className="gap-1">
                <Building2 className="h-3 w-3" /> Designado
              </Badge>
            )}
            {isPrimary && <Badge variant="default">Principal</Badge>}
            {getStatusBadge(vehicle.status)}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
          <div>
            <p className="text-muted-foreground">Tipo</p>
            <p className="font-medium">{vehicle.vehicle_type?.replace(/_/g, ' ') || 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Capacidade</p>
            <p className="font-medium">{vehicle.max_capacity_tons ? `${vehicle.max_capacity_tons}t` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Eixos</p>
            <p className="font-medium">{vehicle.axle_count || 'N/A'}</p>
          </div>
          {assignedAt && (
            <div>
              <p className="text-muted-foreground">Atribuído em</p>
              <p className="font-medium">
                {new Date(assignedAt).toLocaleDateString('pt-BR')}
              </p>
            </div>
          )}
        </div>

        {vehicle.vehicle_photo_url && (
          <div className="pt-2">
            <StorageImage 
              src={vehicle.vehicle_photo_url} 
              alt="Foto do veículo" 
              className="h-24 object-cover rounded cursor-pointer hover:opacity-80 transition-opacity"
            />
          </div>
        )}

        {notes && (
          <div className="pt-2 border-t">
            <p className="text-sm text-muted-foreground">Observações</p>
            <p className="text-sm mt-1">{notes}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Veículos do Motorista</h3>
        <Badge variant="secondary">{totalVehicles} veículo{totalVehicles !== 1 ? 's' : ''}</Badge>
      </div>

      {/* Veículos atribuídos pela empresa */}
      {safeAssignments.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Atribuídos pela Empresa
          </h4>
          {safeAssignments.map((assignment: any) => (
            <VehicleCard
              key={assignment.id}
              vehicle={assignment.vehicle}
              source="company"
              isPrimary={assignment.is_primary}
              assignedAt={assignment.assigned_at}
              notes={assignment.notes}
            />
          ))}
        </div>
      )}

      {/* Veículos designados ao motorista */}
      {filteredAssigned.length > 0 && (
        <div className="space-y-3">
          {safeAssignments.length > 0 && <Separator />}
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Veículos Designados
          </h4>
          {filteredAssigned.map((vehicle: any) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} source="assigned" />
          ))}
        </div>
      )}

      {/* Veículos próprios do motorista */}
      {filteredOwn.length > 0 && (
        <div className="space-y-3">
          {(safeAssignments.length > 0 || filteredAssigned.length > 0) && <Separator />}
          <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <User className="h-4 w-4" /> Veículos Próprios
          </h4>
          {filteredOwn.map((vehicle: any) => (
            <VehicleCard key={vehicle.id} vehicle={vehicle} source="own" />
          ))}
        </div>
      )}
    </div>
  );
};
