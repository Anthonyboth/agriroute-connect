import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { CompanyInviteModal } from './CompanyInviteModal';
import { CompanyDriverManager } from './CompanyDriverManager';
import { Users, Truck, Package, MessageSquare, UserPlus, Trash2, BarChart } from 'lucide-react';
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
        <TabsList className="grid w-full grid-cols-5">
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
          <TabsTrigger value="reports">
            <Package className="h-4 w-4 mr-2" />
            Relatórios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="drivers" className="space-y-4">
          <CompanyDriverManager />
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

        <TabsContent value="reports">
          <Card>
            <CardContent className="pt-6 text-center text-muted-foreground">
              <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Relatórios em desenvolvimento</p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <CompanyInviteModal open={showInviteModal} onOpenChange={setShowInviteModal} />
    </div>
  );
};
