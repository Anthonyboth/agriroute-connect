import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Settings, CheckCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getClientVisibleServices } from '@/lib/service-types';

const SERVICE_TYPES = getClientVisibleServices();

export const ServiceTypeManager: React.FC = () => {
  const { profile } = useAuth();
  const [selectedServices, setSelectedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    if (profile?.service_types) {
      setSelectedServices(profile.service_types);
      setInitialLoading(false);
    } else {
      // Se não tem service_types definidos, considera CARGA como padrão
      setSelectedServices(['CARGA']);
      setInitialLoading(false);
    }
  }, [profile]);

  const handleServiceToggle = (serviceId: string, checked: boolean) => {
    if (checked) {
      setSelectedServices(prev => [...prev, serviceId]);
    } else {
      // Não permite desmarcar todos os serviços
      if (selectedServices.length > 1) {
        setSelectedServices(prev => prev.filter(id => id !== serviceId));
      } else {
        toast.error('Você deve ter pelo menos um tipo de serviço selecionado');
      }
    }
  };

  const handleSave = async () => {
    if (!profile) return;
    
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

  const hasChanges = JSON.stringify(selectedServices.sort()) !== JSON.stringify((profile?.service_types || ['CARGA']).sort());

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
        {/* Sistema de Match Inteligente Info */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">Sistema de Match Inteligente</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Apenas fretes compatíveis com seus tipos de serviço aparecerão no seu dashboard. 
            Isso garante que você veja apenas oportunidades relevantes.
          </p>
        </div>

        {/* Seleção de Tipos de Serviço */}
        <div className="space-y-4">
          <Label className="text-base font-semibold">Tipos de Serviço que Você Oferece:</Label>
          
          {SERVICE_TYPES.map((serviceType) => {
            const IconComponent = serviceType.icon;
            const isSelected = selectedServices.includes(serviceType.id);
            
            return (
              <div key={serviceType.id} className="space-y-2">
                <div className="flex items-center space-x-3">
                  <Checkbox
                    id={serviceType.id}
                    checked={isSelected}
                    onCheckedChange={(checked) => handleServiceToggle(serviceType.id, checked as boolean)}
                  />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-3">
                      <IconComponent className="h-5 w-5 text-muted-foreground" />
                      <Label htmlFor={serviceType.id} className="font-medium cursor-pointer">
                        {serviceType.label}
                      </Label>
                      {isSelected && (
                        <Badge className={serviceType.color}>
                          Ativo
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground pl-8">
                      {serviceType.description}
                    </p>
                  </div>
                </div>
                {serviceType.id !== SERVICE_TYPES[SERVICE_TYPES.length - 1].id && (
                  <Separator className="my-2" />
                )}
              </div>
            );
          })}
        </div>

        {/* Resumo Selecionado */}
        {selectedServices.length > 0 && (
          <div className="bg-secondary/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-2">Seus Tipos de Serviço Ativos:</h4>
            <div className="flex flex-wrap gap-2">
              {selectedServices.map(serviceId => {
                const serviceType = SERVICE_TYPES.find(s => s.id === serviceId);
                if (!serviceType) return null;
                
                return (
                  <Badge key={serviceId} className={serviceType.color}>
                    {serviceType.label}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Botões */}
        <div className="flex justify-end gap-3">
          <Button 
            variant="outline" 
            onClick={() => setSelectedServices(profile?.service_types || ['CARGA'])}
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