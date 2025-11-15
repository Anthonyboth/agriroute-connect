import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { FreightCard } from '@/components/FreightCard';
import { Brain, Filter, RefreshCw, Search, Zap, Package, Users, TrendingUp, Clock, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getCargoTypesByCategory } from '@/lib/cargo-types';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { useLastUpdate } from '@/hooks/useLastUpdate';
import { normalizeFreightStatus, isOpenStatus } from '@/lib/freight-status';

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

interface CompanySmartFreightMatcherProps {
  onTabChange?: (tab: string) => void;
}

export const CompanySmartFreightMatcher: React.FC<CompanySmartFreightMatcherProps> = ({ onTabChange }) => {
  const { profile } = useAuth();
  const { drivers, company } = useTransportCompany();
  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargoType, setSelectedCargoType] = useState<string>('all');
  const [matchingStats, setMatchingStats] = useState({ total: 0, matched: 0, assigned: 0 });
  const [lastUpdateTime, setLastUpdateTime] = useState<Date | null>(null);
  
  const timeAgo = useLastUpdate(lastUpdateTime);

  const fetchCompatibleFreights = useCallback(async () => {
    if (!company?.id) return;

    setLoading(true);
    try {
      console.log('🔍 [FRETES I.A] Buscando fretes para company:', company.id);
      
      // Query mais restrita: buscar apenas fretes realmente disponíveis
      const { data: freightsData, error: freightsError } = await supabase
        .from('freights')
        .select(`
          id, cargo_type, weight, origin_address, destination_address, origin_city, origin_state,
          destination_city, destination_state, pickup_date, delivery_date, price, urgency, status,
          distance_km, minimum_antt_price, service_type, required_trucks, accepted_trucks, created_at,
          producer:profiles!freights_producer_id_fkey(nome_completo, phone, email),
          driver:profiles!freights_driver_id_fkey(nome_completo, phone)
        `)
        .is('company_id', null)
        .in('status', ['OPEN', 'ACCEPTED', 'IN_NEGOTIATION'])
        .order('created_at', { ascending: false });

      if (freightsError) throw freightsError;

      console.log('📦 [FRETES I.A] ' + (freightsData?.length || 0) + ' fretes retornados do banco');

      // Filtrar fretes com vagas disponíveis
      const normalizedFreights: CompatibleFreight[] = [];
      let discardedByStatus = 0;
      let discardedNoSlots = 0;

      for (const freight of freightsData || []) {
        // Verificar se o status é realmente aberto
        const normalizedStatus = normalizeFreightStatus(freight.status);
        const isOpen = isOpenStatus(normalizedStatus);
        
        if (!isOpen) {
          console.log(`❌ [FRETES I.A] Frete ${freight.id.substring(0, 8)} descartado: status ${freight.status} não está aberto`);
          discardedByStatus++;
          continue;
        }

        const requiredTrucks = freight.required_trucks || 1;
        const acceptedTrucks = freight.accepted_trucks || 0;
        const hasAvailableSlots = acceptedTrucks < requiredTrucks;

        if (!hasAvailableSlots) {
          console.log(`❌ [FRETES I.A] Frete ${freight.id.substring(0, 8)} descartado: sem vagas (${acceptedTrucks}/${requiredTrucks})`);
          discardedNoSlots++;
          continue;
        }

        normalizedFreights.push({
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
          required_trucks: requiredTrucks,
          accepted_trucks: acceptedTrucks,
          created_at: freight.created_at
        });
      }

      console.log(`✅ [FRETES I.A] ${normalizedFreights.length} fretes compatíveis após filtros`);
      console.log(`📊 [FRETES I.A] Descartados: ${discardedByStatus} por status, ${discardedNoSlots} sem vagas`);

      setCompatibleFreights(normalizedFreights);
      setMatchingStats({
        total: freightsData?.length || 0,
        matched: normalizedFreights.length,
        assigned: drivers?.length || 0
      });
      setLastUpdateTime(new Date());
    } catch (error: any) {
      console.error('Erro ao buscar fretes compatíveis:', {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        raw: error
      });
      toast.error('Erro ao carregar fretes compatíveis');
    } finally {
      setLoading(false);
    }
  }, [company?.id, drivers?.length]);

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

      toast.success('Frete atribuído ao motorista com sucesso!', {
        description: 'Veja seus fretes em andamento',
        duration: 5000,
        action: {
          label: 'Ver Agora',
          onClick: () => {
            // ✅ FASE 7: Trigger navigation para tab "active"
            console.log('🔄 [SmartFreightMatcher] Disparando navegação para tab active');
            window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'active' }));
          }
        }
      });
      fetchCompatibleFreights();
    } catch (error: any) {
      console.error('Erro ao atribuir frete:', error);
      toast.error('Erro ao atribuir frete ao motorista');
    }
  };

  // Filtrar fretes (disponibilidade já garantida na normalização)
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
                  data-testid="search-freights-input"
                  placeholder="Buscar por origem, destino ou carga..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>

              <Button
                data-testid="refresh-freights-button"
                variant="outline"
                onClick={fetchCompatibleFreights}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                {timeAgo ? (
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {timeAgo}
                  </span>
                ) : 'Atualizar'}
              </Button>
            </div>

            {/* Filtro de Tipo de Carga */}
            <div className="w-full md:w-80">
              <Select value={selectedCargoType} onValueChange={setSelectedCargoType}>
                <SelectTrigger data-testid="cargo-type-filter">
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
          <div data-testid="matching-stats" className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
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
            {filteredFreights.map((freight) => {
              // ✅ Validação de segurança
              if (!freight?.freight_id || !freight?.cargo_type) {
                console.warn('[CompanySmartFreightMatcher] Frete inválido ignorado:', freight);
                return null;
              }
              
              return (
                <div key={freight.freight_id} className="relative overflow-hidden">
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
                    showActions
                    canAcceptFreights={true}
                    isAffiliatedDriver={false}
                    onAction={() => {
                      fetchCompatibleFreights();
                    }}
                  />
                  <div className="mt-2 flex gap-2 flex-wrap">
                    <Badge className="flex-1 justify-center whitespace-nowrap" variant="outline">
                      <Package className="h-3 w-3 mr-1 flex-shrink-0" />
                      Atribuir a Motorista
                    </Badge>
                    {freight.required_trucks > 1 && (
                      <Badge className="bg-blue-50 text-blue-700 border-blue-200 whitespace-nowrap">
                        {freight.accepted_trucks}/{freight.required_trucks} caminhões
                      </Badge>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
