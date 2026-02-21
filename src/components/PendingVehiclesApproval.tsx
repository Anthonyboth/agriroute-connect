import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, Truck } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

interface PendingVehiclesApprovalProps {
  companyId: string;
}

export const PendingVehiclesApproval: React.FC<PendingVehiclesApprovalProps> = ({ companyId }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Buscar veículos pendentes sem join direto com profiles (CLS bloqueia)
  const { data: pendingVehicles } = useQuery({
    queryKey: ['pending-vehicles', companyId],
    queryFn: async () => {
      const { data: vehiclesData, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .eq('status', 'PENDING')
        .eq('is_company_vehicle', false)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Buscar nomes dos motoristas via profiles_secure (contorna CLS)
      const driverIds = [...new Set((vehiclesData || []).map((v: any) => v.driver_id).filter(Boolean))];
      let driversMap: Record<string, string> = {};
      if (driverIds.length > 0) {
        const { data: drivers } = await supabase
          .from('profiles_secure')
          .select('id, full_name')
          .in('id', driverIds);
        driversMap = (drivers || []).reduce((acc: Record<string, string>, d: any) => {
          acc[d.id] = d.full_name;
          return acc;
        }, {});
      }

      return (vehiclesData || []).map((v: any) => ({
        ...v,
        driver: { full_name: driversMap[v.driver_id] || 'Motorista' },
      }));
    },
  });

  const approveMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: 'APPROVED', updated_at: new Date().toISOString() })
        .eq('id', vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "✅ Veículo aprovado",
        description: "O veículo foi aprovado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ['pending-vehicles'] });
      queryClient.invalidateQueries({ queryKey: ['company-vehicle-assignments'] });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: async (vehicleId: string) => {
      const { error } = await supabase
        .from('vehicles')
        .update({ status: 'REJECTED', updated_at: new Date().toISOString() })
        .eq('id', vehicleId);

      if (error) throw error;
    },
    onSuccess: () => {
      toast({
        title: "Veículo rejeitado",
        description: "O veículo foi rejeitado.",
        variant: "destructive",
      });
      queryClient.invalidateQueries({ queryKey: ['pending-vehicles'] });
    },
  });

  if (!pendingVehicles || pendingVehicles.length === 0) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Veículos Pendentes de Aprovação
          <Badge variant="secondary">{pendingVehicles.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingVehicles.map((vehicle) => (
          <div key={vehicle.id} className="border rounded-lg p-4 space-y-3">
            <div className="flex items-start justify-between">
              <div>
                <h4 className="font-semibold text-lg">{vehicle.license_plate}</h4>
                <p className="text-sm text-muted-foreground">
                  Motorista: {vehicle.driver?.full_name}
                </p>
                <p className="text-xs text-muted-foreground">
                  {vehicle.vehicle_type} • {vehicle.max_capacity_tons}t • {vehicle.axle_count} eixos
                </p>
              </div>
              <Badge variant="secondary">Pendente</Badge>
            </div>

            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => approveMutation.mutate(vehicle.id)}
                disabled={approveMutation.isPending}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={() => rejectMutation.mutate(vehicle.id)}
                disabled={rejectMutation.isPending}
                className="flex-1"
              >
                <XCircle className="h-4 w-4 mr-2" />
                Rejeitar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
};
