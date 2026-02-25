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
              <TabsTrigger value="info" aria-label="Informações" className="shrink-0 min-w-[108px] gap-2 text-xs">
                <User className="h-4 w-4" />
                Info
              </TabsTrigger>
              <TabsTrigger value="location" aria-label="Localização" className="shrink-0 min-w-[108px] gap-2 text-xs">
                <MapPin className="h-4 w-4" />
                Local
              </TabsTrigger>
              <TabsTrigger value="freights" aria-label="Fretes" className="shrink-0 min-w-[108px] gap-2 text-xs">
                <Truck className="h-4 w-4" />
                Fretes
              </TabsTrigger>
              <TabsTrigger value="performance" aria-label="Performance" className="shrink-0 min-w-[124px] gap-2 text-xs">
                <TrendingUp className="h-4 w-4" />
                Performance
              </TabsTrigger>
              <TabsTrigger value="vehicles" aria-label="Veículos" className="shrink-0 min-w-[112px] gap-2 text-xs">
                <Car className="h-4 w-4" />
                Veículos
              </TabsTrigger>
              <TabsTrigger value="settings" aria-label="Configurações" className="shrink-0 min-w-[120px] gap-2 text-xs">
                <Settings className="h-4 w-4" />
                Config
              </TabsTrigger>
              <TabsTrigger value="chat" aria-label="Chat" className="relative shrink-0 min-w-[100px] gap-2 text-xs">
                <MessageCircle className="h-4 w-4" />
                Chat
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
