import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Truck, TrendingUp, Car, Settings, MessageCircle, Loader2, AlertCircle } from "lucide-react";
import { useDriverDetailsData } from "@/hooks/useDriverDetailsData";
import { DriverInfoTab } from "./DriverInfoTab";
import { DriverLocationTab } from "./DriverLocationTab";
import { DriverFreightsTab } from "./DriverFreightsTab";
import { DriverPerformanceTab } from "./DriverPerformanceTab";
import { DriverVehiclesTab } from "./DriverVehiclesTab";
import { DriverSettingsTab } from "./DriverSettingsTab";
import { DriverChatTab } from "./DriverChatTab";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

interface DriverDetailsModalProps {
  driver: any | null;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DriverDetailsModal = ({
  driver,
  companyId,
  open,
  onOpenChange,
}: DriverDetailsModalProps) => {
  const driverProfileId = driver?.driver_profile_id || null;

  // ✅ Hook centralizado — resolve perfil via RPC, afiliação, chat e currentUserId
  const {
    profile,
    affiliation,
    unreadChatCount,
    currentUserId,
    isLoading,
    error,
    refetchAll,
  } = useDriverDetailsData({
    driverProfileId,
    companyId,
    enabled: open && !!driverProfileId,
  });

  if (!driverProfileId) return null;

  // Montar objeto combinado para as tabs que ainda esperam `driverData`
  // Prioriza dados do hook (RPC) sobre dados passados via props
  const enrichedDriverData = {
    // Dados de afiliação
    ...driver,
    driver_profile_id: driverProfileId,
    status: affiliation?.status || driver?.status,
    can_accept_freights: affiliation?.can_accept_freights ?? driver?.can_accept_freights,
    can_manage_vehicles: affiliation?.can_manage_vehicles ?? driver?.can_manage_vehicles,
    // Perfil completo do motorista (via RPC)
    driver: profile || driver?.driver || {},
    driver_profile: profile,
  };

  const driverName = profile?.full_name || driver?.driver?.full_name || 'Motorista';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Motorista</DialogTitle>
          <DialogDescription>
            Visualize informações completas, localização, fretes, performance e configurações de{' '}
            <strong>{driverName}</strong>.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando dados do motorista...</span>
          </div>
        ) : error && !profile ? (
          <Card className="border-destructive/50">
            <CardContent className="flex flex-col items-center justify-center py-8 gap-3">
              <AlertCircle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive font-medium">Erro ao carregar dados do motorista</p>
              <p className="text-xs text-muted-foreground text-center max-w-md">
                {error.message || 'Verifique suas permissões ou tente novamente.'}
              </p>
              <Button variant="outline" size="sm" onClick={refetchAll}>
                Tentar Novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="w-full overflow-x-auto flex items-center justify-start gap-1 p-1 h-auto">
              <TabsTrigger value="info" className="shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <User className="h-4 w-4" />
                <span>Info</span>
              </TabsTrigger>
              <TabsTrigger value="location" className="shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <MapPin className="h-4 w-4" />
                <span>Local</span>
              </TabsTrigger>
              <TabsTrigger value="freights" className="shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <Truck className="h-4 w-4" />
                <span>Fretes</span>
              </TabsTrigger>
              <TabsTrigger value="performance" className="shrink-0 min-w-[104px] gap-1.5 text-[11px]">
                <TrendingUp className="h-4 w-4" />
                <span>Performance</span>
              </TabsTrigger>
              <TabsTrigger value="vehicles" className="shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <Car className="h-4 w-4" />
                <span>Veículos</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <Settings className="h-4 w-4" />
                <span>Config</span>
              </TabsTrigger>
              <TabsTrigger value="chat" className="relative shrink-0 min-w-[92px] gap-1.5 text-[11px]">
                <MessageCircle className="h-4 w-4" />
                <span>Chat</span>
                {unreadChatCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs absolute -top-1 -right-1">
                    {unreadChatCount}
                  </Badge>
                )}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="info" className="mt-4">
              <DriverInfoTab driverData={enrichedDriverData} companyId={companyId} />
            </TabsContent>
            <TabsContent value="location" className="mt-4">
              <DriverLocationTab driverProfileId={driverProfileId} companyId={companyId} />
            </TabsContent>
            <TabsContent value="freights" className="mt-4">
              <DriverFreightsTab driverProfileId={driverProfileId} companyId={companyId} />
            </TabsContent>
            <TabsContent value="performance" className="mt-4">
              <DriverPerformanceTab 
                driverProfileId={driverProfileId} 
                rating={profile?.rating ?? null}
                totalRatings={profile?.total_ratings ?? null}
              />
            </TabsContent>
            <TabsContent value="vehicles" className="mt-4">
              <DriverVehiclesTab driverProfileId={driverProfileId} companyId={companyId} />
            </TabsContent>
            <TabsContent value="settings" className="mt-4">
              <DriverSettingsTab driverData={enrichedDriverData} companyId={companyId} />
            </TabsContent>
            <TabsContent value="chat" className="mt-4">
              <DriverChatTab 
                driverProfileId={driverProfileId} 
                companyId={companyId}
                chatEnabledAt={affiliation?.chat_enabled_at}
                currentUserId={currentUserId || undefined}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
