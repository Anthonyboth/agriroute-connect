import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Settings, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { ServiceCatalogGrid } from './ServiceCatalogGrid';
import { setCachedProfile } from '@/lib/profile-cache';

export const ServiceProviderServiceTypeManager: React.FC = () => {
  const { profile, user, refreshProfile } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Guard: prevent useEffect from overwriting local state during/after a save
  const savingRef = useRef(false);
  const lastSavedRef = useRef<number>(0);
  const SAVE_GUARD_MS = 5000;

  useEffect(() => {
    // Don't overwrite local state if we just saved
    if (savingRef.current) return;
    if (Date.now() - lastSavedRef.current < SAVE_GUARD_MS) return;

    if (profile?.service_types) {
      setSelectedServices(profile.service_types);
      setInitialLoading(false);
    } else {
      setSelectedServices([]);
      setInitialLoading(false);
    }
  }, [profile]);

  const saveServices = useCallback(async (services: string[]) => {
    if (!profile || !user) return;

    if (services.length === 0) {
      toast.error('Você deve selecionar pelo menos um tipo de serviço');
      return;
    }

    savingRef.current = true;
    setLoading(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ service_types: services })
        .eq('id', profile.id);

      if (error) throw error;

      // Optimistic cache update
      const updatedProfile = { ...profile, service_types: services };
      setCachedProfile(user.id, updatedProfile);
      sessionStorage.removeItem('profile_fetch_cooldown_until');

      lastSavedRef.current = Date.now();
      savingRef.current = false;

      // Refresh profile in background - won't overwrite due to save guard
      refreshProfile();

      toast.success('Tipo de serviço atualizado!');
    } catch (error: any) {
      console.error('Erro ao atualizar tipos de serviço:', error);
      toast.error('Erro ao salvar. Tente novamente.');

      // Revert to profile data on error
      savingRef.current = false;
      if (profile?.service_types) {
        setSelectedServices(profile.service_types);
      }
    } finally {
      setLoading(false);
    }
  }, [profile, user, refreshProfile]);

  const handleServiceToggle = useCallback((serviceId: string, checked: boolean) => {
    setSelectedServices(prev => {
      let updated: string[];
      if (checked) {
        if (prev.includes(serviceId)) return prev;
        updated = [...prev, serviceId];
      } else {
        if (prev.length <= 1) {
          toast.error('Você deve selecionar pelo menos um tipo de serviço');
          return prev;
        }
        updated = prev.filter(id => id !== serviceId);
      }

      saveServices(updated);
      return updated;
    });
  }, [saveServices]);

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
