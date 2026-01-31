import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { User, MapPin, Truck, TrendingUp, Car, Settings, MessageCircle, Loader2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAffiliatedDriverProfile } from "@/hooks/useAffiliatedDriverProfile";
import { DriverInfoTab } from "./DriverInfoTab";
import { DriverLocationTab } from "./DriverLocationTab";
import { DriverFreightsTab } from "./DriverFreightsTab";
import { DriverPerformanceTab } from "./DriverPerformanceTab";
import { DriverVehiclesTab } from "./DriverVehiclesTab";
import { DriverSettingsTab } from "./DriverSettingsTab";
import { DriverChatTab } from "./DriverChatTab";

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

  // ✅ Buscar perfil completo via RPC (resolve problema de RLS)
  const { driverProfile, isLoading: isLoadingProfile } = useAffiliatedDriverProfile({
    driverProfileId,
    companyId,
    enabled: open && !!driverProfileId,
  });

  // Contar mensagens não lidas
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['driver-chat-unread', companyId, driverProfileId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return 0;
      const { count } = await supabase
        .from('company_driver_chats')
        .select('*', { count: 'exact', head: true })
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .eq('sender_type', 'DRIVER')
        .eq('is_read', false);
      return count || 0;
    },
    enabled: !!driverProfileId && !!companyId && open,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: false,
  });

  // Buscar chat_enabled_at
  const { data: driverData } = useQuery({
    queryKey: ['driver-chat-enabled', companyId, driverProfileId],
    queryFn: async () => {
      if (!driverProfileId || !companyId) return null;
      const { data } = await supabase
        .from('company_drivers')
        .select('chat_enabled_at')
        .eq('company_id', companyId)
        .eq('driver_profile_id', driverProfileId)
        .single();
      return data;
    },
    enabled: !!driverProfileId && !!companyId && open,
  });

  if (!driverProfileId) return null;

  // Montar objeto combinado para o DriverInfoTab
  // Prioriza dados do hook (RPC) sobre dados passados via props
  const enrichedDriverData = {
    ...driver,
    driver: driverProfile || driver?.driver || {},
    driver_profile: driverProfile,
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Motorista</DialogTitle>
          <DialogDescription>
            Visualize informações completas, localização, fretes, performance e configurações do motorista.
          </DialogDescription>
        </DialogHeader>

        {isLoadingProfile ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Carregando dados do motorista...</span>
          </div>
        ) : (
          <Tabs defaultValue="info" className="w-full">
            <TabsList className="grid w-full grid-cols-7">
              <TabsTrigger value="info"><User className="h-4 w-4" /><span className="hidden sm:inline ml-2">Info</span></TabsTrigger>
              <TabsTrigger value="location"><MapPin className="h-4 w-4" /><span className="hidden sm:inline ml-2">Local</span></TabsTrigger>
              <TabsTrigger value="freights"><Truck className="h-4 w-4" /><span className="hidden sm:inline ml-2">Fretes</span></TabsTrigger>
              <TabsTrigger value="performance"><TrendingUp className="h-4 w-4" /><span className="hidden sm:inline ml-2">Perf</span></TabsTrigger>
              <TabsTrigger value="vehicles"><Car className="h-4 w-4" /><span className="hidden sm:inline ml-2">Veíc</span></TabsTrigger>
              <TabsTrigger value="settings"><Settings className="h-4 w-4" /><span className="hidden sm:inline ml-2">Config</span></TabsTrigger>
              <TabsTrigger value="chat" className="relative">
                <MessageCircle className="h-4 w-4" />
                <span className="hidden sm:inline ml-2">Chat</span>
                {unreadCount > 0 && (
                  <Badge variant="destructive" className="ml-1 h-5 min-w-5 p-0 flex items-center justify-center text-xs absolute -top-1 -right-1">
                    {unreadCount}
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
              <DriverFreightsTab driverProfileId={driverProfileId} />
            </TabsContent>
            <TabsContent value="performance" className="mt-4">
              <DriverPerformanceTab driverProfileId={driverProfileId} />
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
                chatEnabledAt={driverData?.chat_enabled_at}
              />
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
};
