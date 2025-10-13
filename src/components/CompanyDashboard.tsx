import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanyInviteModal } from './CompanyInviteModal';
import { Users, Truck, Package, MessageSquare, UserPlus, Trash2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export const CompanyDashboard: React.FC = () => {
  const { company, drivers, isLoadingDrivers, removeDriver } = useTransportCompany();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [driverToRemove, setDriverToRemove] = useState<string | null>(null);

  if (!company) return null;

  const handleRemoveDriver = async () => {
    if (!driverToRemove) return;
    await removeDriver(driverToRemove);
    setDriverToRemove(null);
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            {company.company_name}
          </CardTitle>
          <CardDescription>
            CNPJ: {company.company_cnpj}
            {company.status === 'PENDING' && (
              <Badge variant="outline" className="ml-2">Aguardando Aprovação</Badge>
            )}
            {company.status === 'APPROVED' && (
              <Badge variant="default" className="ml-2">Aprovado</Badge>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      <Tabs defaultValue="drivers" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="drivers">
            <Users className="h-4 w-4 mr-2" />
            Motoristas
          </TabsTrigger>
          <TabsTrigger value="fleet">
            <Truck className="h-4 w-4 mr-2" />
            Frota
          </TabsTrigger>
          <TabsTrigger value="freights">
            <Package className="h-4 w-4 mr-2" />
            Fretes
          </TabsTrigger>
          <TabsTrigger value="chat">
            <MessageSquare className="h-4 w-4 mr-2" />
            Chat Interno
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold">Motoristas Afiliados</h3>
            <Button onClick={() => setShowInviteModal(true)}>
              <UserPlus className="h-4 w-4 mr-2" />
              Convidar Motorista
            </Button>
          </div>

          {isLoadingDrivers ? (
            <p className="text-muted-foreground text-center py-8">Carregando motoristas...</p>
          ) : drivers && drivers.length > 0 ? (
            <div className="grid gap-4">
              {drivers.map((cd: any) => (
                <Card key={cd.id}>
                  <CardContent className="pt-6">
                    <div className="flex justify-between items-start">
                      <div className="space-y-1">
                        <h4 className="font-semibold">{cd.driver?.full_name}</h4>
                        <p className="text-sm text-muted-foreground">{cd.driver?.email}</p>
                        <p className="text-sm text-muted-foreground">{cd.driver?.phone}</p>
                        {cd.driver?.rating > 0 && (
                          <div className="flex items-center gap-1 text-sm">
                            <span>⭐ {cd.driver.rating.toFixed(1)}</span>
                            <span className="text-muted-foreground">({cd.driver.total_ratings} avaliações)</span>
                          </div>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => setDriverToRemove(cd.driver_profile_id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <p className="text-muted-foreground mb-4">Nenhum motorista afiliado ainda</p>
                <Button onClick={() => setShowInviteModal(true)}>
                  <UserPlus className="h-4 w-4 mr-2" />
                  Convidar Primeiro Motorista
                </Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="fleet">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Truck className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Gestão de frota em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="freights">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Gestão de fretes em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="chat">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <MessageSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Chat interno em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CompanyInviteModal open={showInviteModal} onOpenChange={setShowInviteModal} />

      <AlertDialog open={!!driverToRemove} onOpenChange={() => setDriverToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover Motorista</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este motorista da sua transportadora?
              Ele não terá mais acesso aos fretes da empresa.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveDriver}>
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};
