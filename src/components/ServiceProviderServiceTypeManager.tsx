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
import { getProviderVisibleServices, CATEGORY_LABELS } from '@/lib/service-types';

const SERVICE_PROVIDER_TYPES = getProviderVisibleServices();

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

  const groupedServices = SERVICE_PROVIDER_TYPES.reduce((acc, service) => {
    if (!acc[service.category]) {
      acc[service.category] = [];
    }
    acc[service.category].push(service);
    return acc;
  }, {} as Record<string, any[]>);

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
        {/* Sistema de Match Inteligente Info */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="h-4 w-4 text-primary" />
            <span className="font-semibold text-primary">Sistema de Match Inteligente</span>
          </div>
          <p className="text-sm text-muted-foreground">
            Apenas solicitações compatíveis com seus tipos de serviço aparecerão no seu dashboard. 
            Isso garante que você veja apenas oportunidades relevantes.
          </p>
        </div>


        {/* Lista de Tipos de Serviços por Categoria */}
        <div className="space-y-6">
          {Object.entries(groupedServices).map(([category, services]) => (
            <div key={category} className="space-y-3">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold text-foreground">
                  {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
                </h3>
                <Badge variant="outline" className="text-xs">
                  {services.filter(s => selectedServices.includes(s.id)).length}/{services.length}
                </Badge>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {services.map((serviceType) => {
                  const isSelected = selectedServices.includes(serviceType.id);
                  const IconComponent = serviceType.icon;
                  
                  return (
                    <div 
                      key={serviceType.id}
                      className={`relative flex items-start space-x-3 p-3 rounded-lg border transition-all duration-200 cursor-pointer hover:shadow-sm ${
                        isSelected 
                          ? 'bg-primary/5 border-primary/30 shadow-sm' 
                          : 'bg-card border-border hover:border-primary/20'
                      }`}
                      onClick={() => handleServiceToggle(serviceType.id, !isSelected)}
                    >
                      <Checkbox
                        id={serviceType.id}
                        checked={isSelected}
                        onCheckedChange={(checked) => handleServiceToggle(serviceType.id, checked as boolean)}
                        className="mt-0.5"
                      />
                      
                      <div className="flex-1 min-w-0">
                        <Label 
                          htmlFor={serviceType.id} 
                          className="flex items-center gap-2 cursor-pointer text-sm font-medium"
                        >
                          <IconComponent className="h-4 w-4 text-primary flex-shrink-0" />
                          <span className="truncate">{serviceType.label}</span>
                        </Label>
                        {serviceType.description && (
                          <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                            {serviceType.description}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Resumo de Seleção */}
        {selectedServices.length > 0 && (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">
                {selectedServices.length} {selectedServices.length === 1 ? 'serviço selecionado' : 'serviços selecionados'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedServices.map(serviceId => {
                const service = SERVICE_PROVIDER_TYPES.find(s => s.id === serviceId);
                return service ? (
                  <Badge key={serviceId} variant="secondary" className="text-xs">
                    {service.label}
                  </Badge>
                ) : null;
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