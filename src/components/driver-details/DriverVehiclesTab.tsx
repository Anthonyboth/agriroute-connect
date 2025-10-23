import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Car, Truck } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverVehiclesTabProps {
  driverProfileId: string;
  companyId: string;
}

export const DriverVehiclesTab = ({ driverProfileId, companyId }: DriverVehiclesTabProps) => {
  const { data: assignments, isLoading } = useQuery({
    queryKey: ['driver-vehicles', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          *,
          vehicle:vehicle_id(
            id,
            plate,
            model,
            brand,
            year,
            vehicle_type
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

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!assignments || assignments.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Car className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum veículo vinculado</p>
          <p className="text-sm text-muted-foreground mt-2">
            Este motorista ainda não tem veículos atribuídos
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Veículos Atribuídos</h3>
        <Badge variant="secondary">{assignments.length} veículos</Badge>
      </div>

      {assignments.map((assignment: any) => (
        <Card key={assignment.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                {assignment.vehicle.vehicle_type === 'TRUCK' ? (
                  <Truck className="h-5 w-5" />
                ) : (
                  <Car className="h-5 w-5" />
                )}
                {assignment.vehicle.brand} {assignment.vehicle.model}
              </CardTitle>
              {assignment.is_primary && (
                <Badge variant="default">Principal</Badge>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-muted-foreground">Placa</p>
                <p className="font-medium">{assignment.vehicle.plate}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Ano</p>
                <p className="font-medium">{assignment.vehicle.year || 'N/A'}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Tipo</p>
                <p className="font-medium">{assignment.vehicle.vehicle_type}</p>
              </div>
              <div>
                <p className="text-muted-foreground">Atribuído em</p>
                <p className="font-medium">
                  {new Date(assignment.assigned_at).toLocaleDateString('pt-BR')}
                </p>
              </div>
            </div>

            {assignment.notes && (
              <div className="pt-2 border-t">
                <p className="text-sm text-muted-foreground">Observações</p>
                <p className="text-sm mt-1">{assignment.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
