import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Truck, Settings2 } from "lucide-react";

interface DriverSettingsTabProps {
  driverProfileId: string;
  companyId: string;
}

export const DriverSettingsTab = ({ driverProfileId, companyId }: DriverSettingsTabProps) => {
  const queryClient = useQueryClient();

  const { data: permissions, isLoading } = useQuery({
    queryKey: ['driver-permissions', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_drivers')
        .select('can_accept_freights, can_manage_vehicles')
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .single();

      if (error) throw error;
      return data;
    },
  });

  const updatePermission = useMutation({
    mutationFn: async ({ field, value }: { field: string; value: boolean }) => {
      const { error } = await supabase
        .from('company_drivers')
        .update({ [field]: value })
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-permissions', driverProfileId, companyId] });
      toast.success('Permissão atualizada com sucesso');
    },
    onError: (error) => {
      toast.error('Erro ao atualizar permissão: ' + error.message);
    },
  });

  if (isLoading) {
    return <Skeleton className="h-64 w-full" />;
  }

  if (!permissions) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Settings2 className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Configurações não disponíveis</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Permissões do Motorista</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="accept-freights" className="text-base flex items-center gap-2">
                <Truck className="h-4 w-4" />
                Aceitar Fretes
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite que o motorista aceite ofertas de frete diretamente
              </p>
            </div>
            <Switch
              id="accept-freights"
              checked={permissions.can_accept_freights || false}
              onCheckedChange={(checked) =>
                updatePermission.mutate({ field: 'can_accept_freights', value: checked })
              }
              disabled={updatePermission.isPending}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="manage-vehicles" className="text-base flex items-center gap-2">
                <Settings2 className="h-4 w-4" />
                Gerenciar Veículos
              </Label>
              <p className="text-sm text-muted-foreground">
                Permite que o motorista gerencie seus próprios veículos
              </p>
            </div>
            <Switch
              id="manage-vehicles"
              checked={permissions.can_manage_vehicles || false}
              onCheckedChange={(checked) =>
                updatePermission.mutate({ field: 'can_manage_vehicles', value: checked })
              }
              disabled={updatePermission.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Afiliação</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Este motorista está afiliado à sua transportadora e pode trabalhar em fretes de sua empresa.
            As configurações acima controlam o nível de autonomia do motorista dentro do sistema.
          </p>
        </CardContent>
      </Card>
    </div>
  );
};
