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

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, serviceId]);
    } else {
      setSelectedServices(prev => prev.filter(id => id !== serviceId));
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
    if (selectedServices.length === 0) {
      toast.error('Você deve selecionar pelo menos um tipo de serviço');
      return;
    }
    
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ service_types: selectedServices })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Tipos de serviço atualizados com sucesso!');
    } catch (error: any) {
      console.error('Erro ao atualizar tipos de serviço:', error);
      toast.error('Erro ao salvar configurações. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const hasChanges = JSON.stringify(selectedServices.sort()) !== JSON.stringify((profile?.service_types || []).sort());

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

        {/* Botões */}
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => setSelectedServices(profile?.service_types || [])}
            disabled={!hasChanges || loading}
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleSave} 
            disabled={!hasChanges || loading}
            className="gradient-primary"
          >
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};