import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Truck, Settings2, LogOut, AlertTriangle, FileText } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useTransportCompany } from "@/hooks/useTransportCompany";
import { DriverDocumentRequestTab } from "./DriverDocumentRequestTab";

interface DriverSettingsTabProps {
  driverData: any;
  companyId: string;
}

export const DriverSettingsTab = ({ driverData, companyId }: DriverSettingsTabProps) => {
  const driverProfileId = driverData?.driver_profile_id;
  const queryClient = useQueryClient();
  const { leaveCompany, updateDriverAutonomyPermission } = useTransportCompany();

  const { data: permissions, isLoading, error: permissionsError } = useQuery({
    queryKey: ['driver-permissions', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_drivers')
        .select('can_accept_freights, can_manage_vehicles')
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE')
        .single();

      if (error) {
        console.error('[DriverSettings] Erro ao buscar permissões:', error);
        throw error;
      }
      if (import.meta.env.DEV) console.log('[DriverSettings] Permissões carregadas:', data);
      return data;
    },
  });

  // Usar driverData como fallback se permissions query falhar
  const effectivePermissions = permissions || {
    can_accept_freights: driverData?.can_accept_freights ?? false,
    can_manage_vehicles: driverData?.can_manage_vehicles ?? false,
  };

  // Buscar permissão de autonomia do tracking
  const { data: autonomyPermission } = useQuery({
    queryKey: ['driver-autonomy', driverProfileId, companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('affiliated_drivers_tracking')
        .select('can_accept_autonomous_freights')
        .eq('driver_profile_id', driverProfileId)
        .eq('company_id', companyId)
        .maybeSingle();

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

  return (
    <Tabs defaultValue="permissions" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="permissions">
          <Settings2 className="h-4 w-4 mr-2" />
          Permissões
        </TabsTrigger>
        <TabsTrigger value="documents">
          <FileText className="h-4 w-4 mr-2" />
          Documentos
        </TabsTrigger>
      </TabsList>

      <TabsContent value="permissions" className="mt-4">
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
              checked={effectivePermissions.can_accept_freights || false}
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
              checked={effectivePermissions.can_manage_vehicles || false}
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

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Fretes Autônomos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="autonomy-permission" className="text-base">
                Aceitar Fretes como Autônomo
              </Label>
              <p className="text-sm text-muted-foreground">
                Motorista pode aceitar fretes independentes, mas nunca terá 2 fretes simultâneos (regra da plataforma)
              </p>
            </div>
            <Switch
              id="autonomy-permission"
              checked={autonomyPermission?.can_accept_autonomous_freights ?? true}
              onCheckedChange={(checked) => 
                updateDriverAutonomyPermission.mutate({ 
                  driverProfileId, 
                  canAcceptAutonomous: checked 
                })
              }
              disabled={updateDriverAutonomyPermission.isPending}
            />
          </div>
        </CardContent>
      </Card>

      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Zona de Perigo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Desligar o motorista da transportadora irá remover seu acesso aos fretes da empresa. 
            O motorista poderá solicitar nova afiliação no futuro.
          </p>
          
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" className="w-full">
                <LogOut className="h-4 w-4 mr-2" />
                Desligar Motorista da Empresa
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Confirmar Desligamento</AlertDialogTitle>
                <AlertDialogDescription asChild>
                  <div className="text-sm text-muted-foreground">
                    Tem certeza que deseja desligar este motorista da transportadora?
                    <br /><br />
                    <strong>O que acontece:</strong>
                    <ul className="list-disc list-inside mt-2 space-y-1">
                      <li>O motorista perderá acesso aos fretes da empresa</li>
                      <li>Todos os dados históricos serão mantidos</li>
                      <li>O motorista pode solicitar re-afiliação no futuro</li>
                    </ul>
                  </div>
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction 
                  onClick={() => {
                    leaveCompany.mutate(driverProfileId);
                  }}
                  className="bg-destructive hover:bg-destructive/90"
                >
                  Confirmar Desligamento
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
        </div>
      </TabsContent>

      <TabsContent value="documents" className="mt-4">
        <DriverDocumentRequestTab 
          driverData={driverData} 
          companyId={companyId} 
        />
      </TabsContent>
    </Tabs>
  );
};
