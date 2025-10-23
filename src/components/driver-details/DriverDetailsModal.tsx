import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { User, MapPin, Truck, TrendingUp, Car, Settings } from "lucide-react";
import { DriverInfoTab } from "./DriverInfoTab";
import { DriverLocationTab } from "./DriverLocationTab";
import { DriverFreightsTab } from "./DriverFreightsTab";
import { DriverPerformanceTab } from "./DriverPerformanceTab";
import { DriverVehiclesTab } from "./DriverVehiclesTab";
import { DriverSettingsTab } from "./DriverSettingsTab";

interface DriverDetailsModalProps {
  driverProfileId: string | null;
  companyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const DriverDetailsModal = ({
  driverProfileId,
  companyId,
  open,
  onOpenChange,
}: DriverDetailsModalProps) => {
  if (!driverProfileId) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detalhes do Motorista</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="info" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="info" className="flex items-center gap-2">
              <User className="h-4 w-4" />
              <span className="hidden sm:inline">Informações</span>
            </TabsTrigger>
            <TabsTrigger value="location" className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              <span className="hidden sm:inline">Localização</span>
            </TabsTrigger>
            <TabsTrigger value="freights" className="flex items-center gap-2">
              <Truck className="h-4 w-4" />
              <span className="hidden sm:inline">Fretes</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="vehicles" className="flex items-center gap-2">
              <Car className="h-4 w-4" />
              <span className="hidden sm:inline">Veículos</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              <span className="hidden sm:inline">Config</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="info" className="mt-4">
            <DriverInfoTab driverProfileId={driverProfileId} />
          </TabsContent>

          <TabsContent value="location" className="mt-4">
            <DriverLocationTab driverProfileId={driverProfileId} />
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
            <DriverSettingsTab driverProfileId={driverProfileId} companyId={companyId} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
