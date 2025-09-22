import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Settings, 
  CheckCircle, 
  AlertTriangle,
  Stethoscope,
  Wrench,
  Leaf,
  Users,
  TestTube,
  Droplets,
  Wheat,
  Truck,
  Package,
  MapPin,
  Zap,
  Key,
  Fuel,
  Plane,
  Wrench as RepairIcon,
  Shield,
  MoreHorizontal
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface ServiceProviderServiceType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'technical' | 'agricultural' | 'logistics';
}

const SERVICE_PROVIDER_TYPES: ServiceProviderServiceType[] = [
  // Serviços Técnicos
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Assistência Técnica Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'technical'
  },
  {
    id: 'MANUTENCAO_EQUIPAMENTOS',
    label: 'Manutenção de Equipamentos',
    description: 'Manutenção e reparo de tratores e implementos agrícolas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'technical'
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos em geral de veículos e equipamentos',
    icon: RepairIcon,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'technical'
  },
  {
    id: 'ELETRICISTA_AUTOMOTIVO',
    label: 'Eletricista Automotivo',
    description: 'Sistema elétrico completo de veículos',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'technical'
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracheiro',
    description: 'Troca e reparo de pneus',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'technical'
  },
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'technical'
  },
  {
    id: 'CONSULTORIA_RURAL',
    label: 'Consultoria Rural',
    description: 'Consultoria especializada em gestão rural e produtividade',
    icon: Users,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical'
  },
  {
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'technical'
  },
  // Serviços Agrícolas
  {
    id: 'ANALISE_SOLO',
    label: 'Análise de Solo',
    description: 'Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'agricultural'
  },
  {
    id: 'PULVERIZACAO',
    label: 'Pulverização',
    description: 'Aplicação de defensivos e fertilizantes foliares',
    icon: Droplets,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'agricultural'
  },
  {
    id: 'PULVERIZACAO_DRONE',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'agricultural'
  },
  {
    id: 'COLHEITA_PLANTIO',
    label: 'Colheita e Plantio',
    description: 'Serviços de colheita mecanizada e plantio especializado',
    icon: Wheat,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'agricultural'
  },
  {
    id: 'ADUBACAO_CALCARIO',
    label: 'Adubação e Calagem',
    description: 'Aplicação de fertilizantes e correção do pH do solo',
    icon: Leaf,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    category: 'agricultural'
  },
  // Serviços de Logística
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'logistics'
  },
  {
    id: 'COMBUSTIVEL',
    label: 'Combustível',
    description: 'Entrega de combustível',
    icon: Fuel,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'logistics'
  },
  {
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'logistics'
  },
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros tipos de serviços especializados',
    icon: MoreHorizontal,
    color: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    category: 'technical'
  }
];

const CATEGORY_LABELS = {
  technical: 'Serviços Técnicos',
  agricultural: 'Serviços Agrícolas',
  logistics: 'Logística e Armazenagem'
};

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
      toast.error('Erro ao salvar: ' + error.message);
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
  }, {} as Record<string, ServiceProviderServiceType[]>);

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

        {/* Seleção de Tipos de Serviço por Categoria */}
        <div className="space-y-6">
          <Label className="text-base font-semibold">Tipos de Serviço que Você Oferece:</Label>
          
          {Object.entries(groupedServices).map(([category, services]) => (
            <div key={category} className="space-y-4">
              <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {CATEGORY_LABELS[category as keyof typeof CATEGORY_LABELS]}
              </h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {services.map((serviceType) => {
                  const IconComponent = serviceType.icon;
                  const isSelected = selectedServices.includes(serviceType.id);
                  
                  return (
                    <div key={serviceType.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                      <div className="flex items-start space-x-3">
                        <Checkbox
                          id={serviceType.id}
                          checked={isSelected}
                          onCheckedChange={(checked) => handleServiceToggle(serviceType.id, checked as boolean)}
                          className="mt-1"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-3">
                            <IconComponent className="h-5 w-5 text-muted-foreground" />
                            <Label htmlFor={serviceType.id} className="font-medium cursor-pointer leading-none">
                              {serviceType.label}
                            </Label>
                            {isSelected && (
                              <Badge className={serviceType.color}>
                                Ativo
                              </Badge>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">
                            {serviceType.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Resumo Selecionado */}
        {selectedServices.length > 0 && (
          <div className="bg-secondary/30 p-4 rounded-lg">
            <h4 className="font-semibold mb-3">Seus Tipos de Serviço Ativos:</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {selectedServices.map(serviceId => {
                const serviceType = SERVICE_PROVIDER_TYPES.find(s => s.id === serviceId);
                if (!serviceType) return null;
                
                return (
                  <Badge key={serviceId} className={`${serviceType.color} justify-start`}>
                    <serviceType.icon className="h-3 w-3 mr-1" />
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