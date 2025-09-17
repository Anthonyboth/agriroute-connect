import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { FreightCard } from '@/components/FreightCard';
import { Brain, Filter, RefreshCw, Search, Zap } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface CompatibleFreight {
  freight_id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: string;
  status: string;
  service_type: string;
  distance_km: number;
  minimum_antt_price: number;
  required_trucks: number;
  accepted_trucks: number;
  created_at: string;
}

interface SmartFreightMatcherProps {
  onFreightAction?: (freightId: string, action: string) => void;
}

export const SmartFreightMatcher: React.FC<SmartFreightMatcherProps> = ({
  onFreightAction
}) => {
  const { profile } = useAuth();
  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState('all');
  const [serviceTypeFilter, setServiceTypeFilter] = useState('all');

  useEffect(() => {
    if (profile?.id) {
      fetchCompatibleFreights();
    }
  }, [profile]);

  const fetchCompatibleFreights = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.rpc(
        'get_compatible_freights_for_driver',
        { p_driver_id: profile.id }
      );

      if (error) throw error;
      setCompatibleFreights(data || []);
    } catch (error: any) {
      console.error('Erro ao buscar fretes compatíveis:', error);
      toast.error('Erro ao carregar fretes: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleFreightAction = async (freightId: string, action: string) => {
    if (onFreightAction) {
      onFreightAction(freightId, action);
    } else if ((action === 'propose' || action === 'accept') && profile?.id) {
      try {
        const freight = compatibleFreights.find(f => f.freight_id === freightId);
        if (!freight) return;

        // Usar upsert para evitar erro de constraint única
        const { error } = await supabase
          .from('freight_proposals')
          .upsert({
            freight_id: freightId,
            driver_id: profile.id,
            proposed_price: freight.price,
            status: 'PENDING',
            message: action === 'accept' ? 'Aceito o frete pelo valor anunciado.' : null,
          }, {
            onConflict: 'freight_id,driver_id'
          });

        if (error) throw error;
        
        toast.success(action === 'accept' ? 'Solicitação para aceitar o frete enviada!' : 'Proposta enviada com sucesso!');
        fetchCompatibleFreights(); // Atualizar lista
      } catch (error: any) {
        console.error('Erro ao enviar proposta:', error);
        toast.error('Erro ao processar ação: ' + (error.message || 'Tente novamente'));
      }
    }
  };

  // Filtrar fretes baseado nos critérios
  const filteredFreights = compatibleFreights.filter(freight => {
    const matchesSearch = 
      freight.cargo_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freight.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freight.destination_address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesUrgency = urgencyFilter === 'all' || freight.urgency === urgencyFilter;
    const matchesServiceType = serviceTypeFilter === 'all' || freight.service_type === serviceTypeFilter;

    return matchesSearch && matchesUrgency && matchesServiceType;
  });

  const getServiceTypeBadge = (serviceType: string) => {
    switch (serviceType) {
      case 'CARGA':
        return <Badge className="bg-primary/10 text-primary border-primary/20">Rural</Badge>;
      case 'MUDANCA':
        return <Badge className="bg-blue-100 text-blue-800 border-blue-200">Mudança</Badge>;
      case 'GUINCHO':
        return <Badge className="bg-orange-100 text-orange-800 border-orange-200">Guincho</Badge>;
      default:
        return <Badge variant="secondary">{serviceType}</Badge>;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'HIGH':
        return 'text-red-600';
      case 'MEDIUM':
        return 'text-yellow-600';
      case 'LOW':
        return 'text-green-600';
      default:
        return 'text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Match Inteligente de Fretes
            <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20">
              <Zap className="mr-1 h-3 w-3" />
              IA
            </Badge>
          </CardTitle>
          <CardDescription>
            Fretes selecionados automaticamente com base nos seus tipos de serviço configurados
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Informações do Motorista */}
          {profile?.service_types && (
            <div className="bg-secondary/30 p-4 rounded-lg mb-6">
              <h4 className="font-semibold mb-2">Seus Tipos de Serviço Ativos:</h4>
              <div className="flex flex-wrap gap-2">
                {profile.service_types.map((serviceType: string) => (
                  <div key={serviceType}>
                    {getServiceTypeBadge(serviceType)}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Filtros */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por origem, destino ou carga..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={urgencyFilter} onValueChange={setUrgencyFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Urgência" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as urgências</SelectItem>
                <SelectItem value="HIGH">Alta</SelectItem>
                <SelectItem value="MEDIUM">Média</SelectItem>
                <SelectItem value="LOW">Baixa</SelectItem>
              </SelectContent>
            </Select>

            <Select value={serviceTypeFilter} onValueChange={setServiceTypeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Tipo de Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os tipos</SelectItem>
                <SelectItem value="CARGA">Rural</SelectItem>
                <SelectItem value="MUDANCA">Frete Urbano</SelectItem>
                <SelectItem value="GUINCHO">Guincho</SelectItem>
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              onClick={fetchCompatibleFreights}
              disabled={loading}
              className="flex items-center gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Atualizar
            </Button>
          </div>

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{filteredFreights.length}</div>
              <div className="text-sm text-muted-foreground">Fretes Compatíveis</div>
            </div>
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold">{filteredFreights.filter(f => f.urgency === 'HIGH').length}</div>
              <div className="text-sm text-muted-foreground">Alta Urgência</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Fretes */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Carregando fretes compatíveis...</p>
          </div>
        ) : filteredFreights.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhum frete compatível encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {compatibleFreights.length === 0 
                  ? 'Não há fretes disponíveis no momento que correspondam aos seus tipos de serviço.'
                  : 'Tente ajustar os filtros para encontrar mais fretes.'
                }
              </p>
              <Button variant="outline" onClick={fetchCompatibleFreights}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar Novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filteredFreights.map((freight) => (
              <div key={freight.freight_id} className="relative">
                <FreightCard
                  freight={{
                    id: freight.freight_id,
                    cargo_type: freight.cargo_type,
                    weight: freight.weight,
                    origin_address: freight.origin_address,
                    destination_address: freight.destination_address,
                    pickup_date: freight.pickup_date,
                    delivery_date: freight.delivery_date,
                    price: freight.price,
                    urgency: freight.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
                    status: 'OPEN' as const,
                    distance_km: freight.distance_km,
                    minimum_antt_price: freight.minimum_antt_price,
                    required_trucks: freight.required_trucks,
                    accepted_trucks: freight.accepted_trucks,
                    service_type: freight.service_type as 'CARGA' | 'GUINCHO' | 'MUDANCA',
                  }}
                  onAction={(action) => handleFreightAction(freight.freight_id, action)}
                  showActions={true}
                />
                
                {/* badges removidos */}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};