import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Settings, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';

export const ServiceProviderServiceTypeManager: React.FC = () => {
  const { profile } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (profile?.service_types) {
      setSelectedServices(profile.service_types);
      setInitialLoading(false);
    } else {
      // Se não tem service_types definidos, não seleciona nenhum por padrão
      setSelectedServices([]);
      setInitialLoading(false);
    }
  }, [profile]);

  const saveServices = async (services: string[]) => {
    if (!profile) return;

    if (services.length === 0) {
      toast.error('Você deve selecionar pelo menos um tipo de serviço');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ service_types: services })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Tipo de serviço atualizado!');
    } catch (error: any) {
      console.error('Erro ao atualizar tipos de serviço:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    const updated = checked
      ? [...selectedServices, serviceId]
      : selectedServices.filter(id => id !== serviceId);
    setSelectedServices(updated);
    saveServices(updated);
  };

  if (initialLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-secondary rounded w-1/3"></div>
            <div className="space-y-3">
              <div className="h-8 bg-secondary rounded"></div>
              <div className="h-8 bg-secondary rounded"></div>
              <div className="h-8 bg-secondary rounded"></div>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Tipos de Serviço
        </CardTitle>
        <CardDescription>
          Configure quais tipos de serviços você oferece. Isso afeta quais solicitações aparecerão para você.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <ServiceCatalogGrid
          mode="provider"
          selectedServices={selectedServices}
          onServiceToggle={handleServiceToggle}
          showCheckboxes={true}
          title="Serviços Disponíveis"
          description="Selecione todos os serviços que você está qualificado para oferecer. Apenas solicitações compatíveis aparecerão no seu dashboard."
        />

        {/* Aviso */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Importante</span>
          </div>
          <p className="text-yellow-600 text-sm mt-1">
            Ao alterar seus tipos de serviço, apenas solicitações compatíveis aparecerão no seu dashboard. 
            Certifique-se de selecionar todos os tipos que você oferece.
          </p>
        </div>

        {/* Indicador de salvamento automático */}
        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            Salvando...
          </div>
        )}
      </CardContent>
    </Card>
  );
};