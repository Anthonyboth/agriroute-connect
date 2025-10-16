import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeviceManager } from './DeviceManager';
import { Shield, Smartphone, Settings } from 'lucide-react';

interface DeviceManagerModalProps {
  open: boolean;
  onClose: () => void;
}

export const DeviceManagerModal = ({ open, onClose }: DeviceManagerModalProps) => {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Smartphone className="h-5 w-5" />
            Gerenciador de Dispositivos
          </DialogTitle>
          <DialogDescription>
            Gerencie permissões e dispositivos conectados à sua conta
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="permissions" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Settings className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
          </TabsList>

          <TabsContent value="permissions" className="mt-6">
            <DeviceManager />
          </TabsContent>

          <TabsContent value="security" className="mt-6">
            <div className="space-y-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Dicas de Segurança</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>• Revogue o acesso de dispositivos que você não reconhece</li>
                  <li>• Mantenha suas permissões atualizadas</li>
                  <li>• Use dispositivos confiáveis para acessar sua conta</li>
                  <li>• Desative permissões que não estão em uso</li>
                </ul>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
