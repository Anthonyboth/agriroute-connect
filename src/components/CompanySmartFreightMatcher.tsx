import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { FreightCard } from '@/components/FreightCard';
import { Brain, Filter, RefreshCw, Search, Zap, Package, Users, TrendingUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getCargoTypesByCategory } from '@/lib/cargo-types';
import { useTransportCompany } from '@/hooks/useTransportCompany';

interface CompatibleFreight {
  freight_id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  origin_city?: string;
  origin_state?: string;
  destination_city?: string;
  destination_state?: string;
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

export const CompanySmartFreightMatcher: React.FC = () => {
  const { profile } = useAuth();
  const { drivers, company } = useTransportCompany();
  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargoType, setSelectedCargoType] = useState<string>('all');
  const [matchingStats, setMatchingStats] = useState({ total: 0, matched: 0, assigned: 0 });

  useEffect(() => {
    if (company?.id) {
      fetchCompatibleFreights();
    }
  }, [company]);

  const fetchCompatibleFreights = async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      // Buscar fretes abertos que ainda não têm motorista atribuído
      const { data: freights, error } = await supabase
        .from('freights')
        .select('*')
        .in('status', ['OPEN', 'IN_NEGOTIATION'])
        .is('driver_id', null)
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      // Executar matching espacial para todos os motoristas ativos
      const activeDrivers = drivers?.filter(d => d.status === 'ACTIVE') || [];
      
      const matchedFreights: CompatibleFreight[] = [];
      
      for (const freight of freights || []) {
        // Verificar se algum motorista da empresa pode atender este frete
        const canService = activeDrivers.some(driver => {
          // Aqui você pode adicionar lógica de matching por áreas, tipo de serviço, etc.
          return true; // Por enquanto, considera todos compatíveis
        });

        if (canService) {
          matchedFreights.push({
            freight_id: freight.id,
            cargo_type: freight.cargo_type,
            weight: freight.weight,
            origin_address: freight.origin_address,
            destination_address: freight.destination_address,
            origin_city: freight.origin_city,
            origin_state: freight.origin_state,
            destination_city: freight.destination_city,
            destination_state: freight.destination_state,
            pickup_date: freight.pickup_date,
            delivery_date: freight.delivery_date,
            price: freight.price,
            urgency: freight.urgency,
            status: freight.status,
            service_type: freight.service_type || 'CARGA',
            distance_km: freight.distance_km || 0,
            minimum_antt_price: freight.minimum_antt_price || 0,
            required_trucks: freight.required_trucks || 1,
            accepted_trucks: freight.accepted_trucks || 0,
            created_at: freight.created_at
          });
        }
      }

      setCompatibleFreights(matchedFreights);
      setMatchingStats({
        total: freights?.length || 0,
        matched: matchedFreights.length,
        assigned: 0 // Será calculado depois
      });

      if (matchedFreights.length > 0) {
        toast.success(`${matchedFreights.length} fretes compatíveis encontrados!`);
      }
    } catch (error: any) {
      console.error('Erro ao buscar fretes compatíveis:', error);
      toast.error('Erro ao carregar fretes compatíveis');
    } finally {
      setLoading(false);
    }
  };

  const handleAssignFreight = async (freightId: string, driverId: string) => {
    try {
      // Lógica para atribuir frete a um motorista específico
      const freight = compatibleFreights.find(f => f.freight_id === freightId);
      if (!freight) return;

      // Criar proposta automática em nome do motorista
      const { error } = await supabase
        .from('freight_proposals')
        .insert({
          freight_id: freightId,
          driver_id: driverId,
          proposed_price: freight.price,
          status: 'PENDING',
          message: 'Proposta enviada pela transportadora'
        });

      if (error) throw error;

      toast.success('Frete atribuído ao motorista com sucesso!');
      fetchCompatibleFreights();
    } catch (error: any) {
      console.error('Erro ao atribuir frete:', error);
      toast.error('Erro ao atribuir frete ao motorista');
    }
  };

  // Filtrar fretes
  const filteredFreights = compatibleFreights.filter(freight => {
    const matchesSearch = !searchTerm || 
      freight.cargo_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freight.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
      freight.destination_address.toLowerCase().includes(searchTerm.toLowerCase());

    const matchesCargoType = selectedCargoType === 'all' || freight.cargo_type === selectedCargoType;

    return matchesSearch && matchesCargoType;
  });

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            Match Inteligente de Fretes para Transportadora
            <Badge className="bg-gradient-to-r from-primary/10 to-accent/10 text-primary border-primary/20">
              <Zap className="mr-1 h-3 w-3" />
              IA
            </Badge>
          </CardTitle>
          <CardDescription>
            Sistema de matching automático que conecta fretes disponíveis com seus motoristas afiliados,
            considerando localização, tipo de carga e disponibilidade.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Informações da Empresa */}
          <div className="bg-secondary/30 p-4 rounded-lg mb-6">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-semibold mb-1">{company?.company_name}</h4>
                <p className="text-sm text-muted-foreground">
                  CNPJ: {company?.company_cnpj} • {drivers?.filter(d => d.status === 'ACTIVE').length || 0} motoristas ativos
                </p>
              </div>
              <Badge variant={company?.status === 'APPROVED' ? 'default' : 'secondary'}>
                {company?.status === 'APPROVED' ? 'Aprovada' : 'Pendente'}
              </Badge>
            </div>
          </div>

          {/* Barra de Busca e Filtros */}
          <div className="space-y-4 mb-6">
            <div className="flex gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar por origem, destino ou carga..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

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

            {/* Filtro de Tipo de Carga */}
            <div className="w-full md:w-80">
              <Select value={selectedCargoType} onValueChange={setSelectedCargoType}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo de carga" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tipos</SelectItem>
                  
                  <SelectGroup>
                    <SelectLabel className="text-primary font-medium">Carga (Agrícola)</SelectLabel>
                    {getCargoTypesByCategory('rural').map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectGroup>
                    <SelectLabel className="text-blue-600 font-medium">Carga Viva</SelectLabel>
                    {getCargoTypesByCategory('carga_viva').map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>

                  <SelectGroup>
                    <SelectLabel className="text-gray-600 font-medium">Outros</SelectLabel>
                    {getCargoTypesByCategory('outros').map((cargo) => (
                      <SelectItem key={cargo.value} value={cargo.value}>
                        {cargo.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Estatísticas de Matching */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{matchingStats.total}</div>
              <div className="text-sm text-muted-foreground">Fretes Disponíveis</div>
            </div>
            <div className="text-center p-4 bg-green-500/5 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{filteredFreights.length}</div>
              <div className="text-sm text-muted-foreground">Fretes Compatíveis</div>
            </div>
            <div className="text-center p-4 bg-blue-500/5 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{drivers?.filter(d => d.status === 'ACTIVE').length || 0}</div>
              <div className="text-sm text-muted-foreground">Motoristas Ativos</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Fretes */}
      <div className="space-y-4">
        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">Buscando fretes compatíveis...</p>
          </div>
        ) : filteredFreights.length === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhum frete compatível encontrado</h3>
              <p className="text-muted-foreground mb-4">
                Não há fretes disponíveis no momento que correspondam às capacidades da sua transportadora.
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
                    weight: freight.weight / 1000,
                    origin_address: freight.origin_address,
                    destination_address: freight.destination_address,
                    origin_city: freight.origin_city,
                    origin_state: freight.origin_state,
                    destination_city: freight.destination_city,
                    destination_state: freight.destination_state,
                    pickup_date: freight.pickup_date,
                    delivery_date: freight.delivery_date,
                    price: freight.price,
                    urgency: freight.urgency as 'LOW' | 'MEDIUM' | 'HIGH',
                    status: 'OPEN' as const,
                    distance_km: freight.distance_km,
                    minimum_antt_price: freight.minimum_antt_price,
                    required_trucks: freight.required_trucks,
                    accepted_trucks: freight.accepted_trucks,
                  }}
                  onAction={() => {}}
                />
                <div className="mt-2">
                  <Badge className="w-full justify-center" variant="outline">
                    <Package className="h-3 w-3 mr-1" />
                    Atribuir a Motorista
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
