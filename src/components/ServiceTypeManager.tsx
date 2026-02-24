import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertTriangle } from 'lucide-react';
import { Settings } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';
import { clearCachedProfile, setCachedProfile } from '@/lib/profile-cache';

// Normaliza IDs para canônicos
const toCanonical = (id: string): string => {
  if (id === 'CARGA_FREIGHT') return 'CARGA';
  if (id === 'GUINCHO_FREIGHT') return 'GUINCHO';
  return id;
};

export const ServiceTypeManager: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (profile?.service_types) {
      // Normalizar para canônicos ao carregar
      const canonical = profile.service_types.map(toCanonical);
      setSelectedServices(canonical);
      setInitialLoading(false);
    } else {
      // Se não tem service_types definidos, considera CARGA como padrão
      setSelectedServices(['CARGA']);
      setInitialLoading(false);
    }
  }, [profile]);

  const saveServices = async (services: string[]) => {
    if (!profile || !user) return;
    if (services.length === 0) {
      toast.error('Você deve ter pelo menos um tipo de serviço selecionado');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ service_types: services })
        .eq('id', profile.id);

      if (error) throw error;

      const updatedProfile = { ...profile, service_types: services };
      setCachedProfile(user.id, updatedProfile);
      sessionStorage.removeItem('profile_fetch_cooldown_until');
      await refreshProfile();
      
      toast.success('Tipo de serviço atualizado!');
    } catch (error: any) {
      console.error('Erro ao atualizar tipos de serviço:', error);
      toast.error('Erro ao salvar. Tente novamente.');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    const canonicalId = toCanonical(serviceId);
    
    let updated: string[];
    if (checked) {
      if (selectedServices.includes(canonicalId)) return;
      updated = [...selectedServices, canonicalId];
    } else {
      if (selectedServices.length <= 1) {
        toast.error('Você deve ter pelo menos um tipo de serviço selecionado');
        return;
      }
      updated = selectedServices.filter(id => id !== canonicalId);
    }
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
          Configure quais tipos de frete você aceita. Isso afeta quais fretes aparecerão para você.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        <ServiceCatalogGrid
          mode="driver"
          selectedServices={selectedServices}
          onServiceToggle={handleServiceToggle}
          showCheckboxes={true}
          title="Tipos de Frete"
          description="Selecione os tipos de frete que você aceita transportar. Apenas fretes compatíveis aparecerão no seu dashboard."
        />

        {/* Aviso */}
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
          <div className="flex items-center gap-2 text-yellow-700">
            <AlertTriangle className="h-4 w-4" />
            <span className="font-medium">Importante</span>
          </div>
          <p className="text-yellow-600 text-sm mt-1">
            Ao alterar seus tipos de serviço, apenas fretes compatíveis aparecerão no seu dashboard. 
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