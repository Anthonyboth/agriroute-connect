import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { getCargoTypeLabel, CARGO_TYPES, CARGO_CATEGORIES, getCargoTypesByCategory } from '@/lib/cargo-types';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectGroup, SelectLabel } from '@/components/ui/select';
import { FreightCard } from '@/components/FreightCard';
import { FreightShareCard } from '@/components/FreightShareCard';
import { Brain, Filter, RefreshCw, Search, Zap, Package, Truck, Wrench, MapPin, MessageSquare, Clock, DollarSign, Bike } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';

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
  onCountsChange?: (counts: { total: number; highUrgency: number }) => void;
}

export const SmartFreightMatcher: React.FC<SmartFreightMatcherProps> = ({
  onFreightAction,
  onCountsChange
}) => {
  const { profile, user } = useAuth();
  const { isAffiliated, companyId } = useCompanyDriver();
  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [towingRequests, setTowingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargoType, setSelectedCargoType] = useState<string>('all');
  const [hasActiveCities, setHasActiveCities] = useState<boolean | null>(null);

  useEffect(() => {
    if (profile?.id) {
      fetchCompatibleFreights();
    }
  }, [profile]);

  useEffect(() => {
    // Limpar e recarregar quando os tipos de serviço mudarem
    setCompatibleFreights([]);
    setTowingRequests([]);
    if (profile?.id) {
      fetchCompatibleFreights();
    }
  }, [JSON.stringify(profile?.service_types)]);

  // Realtime: Ouvir mudanças em user_cities e recarregar fretes automaticamente
  useEffect(() => {
    if (!profile?.id || !user?.id) return;

    const channel = supabase
      .channel('user-cities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_cities',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          console.log('user_cities mudou:', payload);
          toast.info('Suas cidades de atendimento foram atualizadas. Recarregando fretes...');
          fetchCompatibleFreights();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id, user?.id]);

  // Normalizar tipo de serviço
  const normalizeServiceType = (type: string): string => {
    if (type === 'CARGA_FREIGHT') return 'CARGA';
    if (type === 'GUINCHO_FREIGHT') return 'GUINCHO';
    if (type === 'FRETE_MOTO') return 'MOTO';
    return type;
  };

  const allowedTypesFromProfile = React.useMemo(() => {
    const types = Array.from(new Set(
      (Array.isArray(profile?.service_types) ? (profile?.service_types as unknown as string[]) : [])
        .map((t) => normalizeServiceType(String(t)))
    )).filter((t) => ['CARGA', 'GUINCHO', 'MUDANCA', 'MOTO'].includes(t));
    console.log('🔎 allowedTypesFromProfile:', types);
    return types;
  }, [profile?.service_types]);
  
  const fetchCompatibleFreights = async () => {
    if (!profile?.id) return;

    setLoading(true);
    try {
      console.log('🔍 Buscando fretes compatíveis para driver:', profile.id);

      if (allowedTypesFromProfile.length === 0) {
        console.warn('Sem tipos de serviço configurados. Nada a exibir.');
        toast.info('Configure seus tipos de serviço para ver fretes.');
        setCompatibleFreights([]);
        setTowingRequests([]);
        setLoading(false);
        return;
      }
      
      // Primeiro executar o matching espacial baseado nas áreas de serviço
      const { data: { session } } = await supabase.auth.getSession();
      const { data: spatialData, error: spatialError } = await supabase.functions.invoke(
        'driver-spatial-matching',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
          }
        }
      );

      if (spatialError) {
        console.warn('Erro no matching espacial:', spatialError);
      } else {
        console.log('Matching espacial executado:', spatialData);
      }

      // Buscar fretes compatíveis usando RPC exclusiva (APENAS fretes, nunca serviços)
    const { data, error } = await supabase.rpc(
      'get_freights_for_driver', // RPC exclusiva com separação de tipos
      { p_driver_id: profile.id }
    );

      if (error) {
        console.error('Erro ao carregar fretes compatíveis (RPC):', error);
        // Fallback: buscar por cidades de atendimento ativas (user_cities)
        try {
          const { data: uc } = await supabase
            .from('user_cities')
            .select('city_id, cities(name, state)')
            .eq('user_id', user!.id)
            .eq('is_active', true)
            .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

          const cityIds = (uc || []).map((u: any) => u.city_id).filter(Boolean);
          const cityNames = (uc || []).map((u: any) => ({ 
            city: u.cities?.name, 
            state: u.cities?.state 
          })).filter((c: any) => c.city && c.state);

          if (cityIds.length === 0 && cityNames.length === 0) {
            setHasActiveCities(false);
            toast.info('Configure suas cidades de atendimento para ver fretes compatíveis.');
            setCompatibleFreights([]);
            setTowingRequests([]);
            return;
          }

          let freightsByCity: any[] = [];

          // Tentar buscar por city_id primeiro
          if (cityIds.length > 0) {
            const { data: cityIdFreights, error: fbErr } = await supabase
              .from('freights')
              .select('*')
              .eq('status', 'OPEN')
              .or(`origin_city_id.in.(${cityIds.join(',')}),destination_city_id.in.(${cityIds.join(',')})`)
              .order('created_at', { ascending: false })
              .limit(200);

            if (!fbErr && cityIdFreights) {
              freightsByCity = cityIdFreights;
            }
          }

          // FALLBACK SECUNDÁRIO: Se não achou por ID, buscar por nome/estado
          if (freightsByCity.length === 0 && cityNames.length > 0) {
            console.log('[SmartFreightMatcher] Fallback secundário: busca por nome/estado');
            
            // Construir OR conditions para cada cidade
            const orConditions: string[] = [];
            for (const { city, state } of cityNames) {
              orConditions.push(`and(origin_city.ilike.%${city}%,origin_state.ilike.%${state}%)`);
              orConditions.push(`and(destination_city.ilike.%${city}%,destination_state.ilike.%${state}%)`);
            }
            
            const { data: nameFreights } = await supabase
              .from('freights')
              .select('*')
              .eq('status', 'OPEN')
              .or(orConditions.join(','))
              .order('created_at', { ascending: false })
              .limit(200);
              
            if (nameFreights) {
              freightsByCity = nameFreights;
            }
          }

           const allowedTypes = Array.from(new Set(
             (Array.isArray(profile?.service_types) ? (profile?.service_types as unknown as string[]) : [])
               .map((t) => normalizeServiceType(String(t)))
           )).filter((t) => ['CARGA', 'GUINCHO', 'MUDANCA', 'MOTO'].includes(t));

          // Mapear para o formato esperado pela UI
          const mapped: CompatibleFreight[] = (freightsByCity || [])
            .map((f: any) => ({
              freight_id: f.id,
              cargo_type: f.cargo_type,
              weight: f.weight || 0,
              origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
              destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
              pickup_date: f.pickup_date,
              delivery_date: f.delivery_date,
              price: f.price || 0,
              urgency: (f.urgency || 'LOW') as string,
              status: f.status,
              service_type: normalizeServiceType(f.service_type),
              distance_km: f.match_distance_m ? Math.round((f.match_distance_m / 1000) * 10) / 10 : 0,
              minimum_antt_price: f.minimum_antt_price || 0,
              required_trucks: f.required_trucks || 1,
              accepted_trucks: f.accepted_trucks || 0,
              available_slots: f.available_slots || (f.required_trucks - f.accepted_trucks) || 1,
              is_partial_booking: f.is_partial_booking || false,
              created_at: f.created_at,
            }))
            .filter((f) => allowedTypes.length === 0 || allowedTypes.includes(f.service_type));

          setCompatibleFreights(mapped);
          
          // Emit count immediately for fallback
          const highUrgency = mapped.filter(f => f.urgency === 'HIGH').length;
          onCountsChange?.({ total: mapped.length, highUrgency });
          
          toast.success(`${mapped.length} fretes compatíveis encontrados pelas suas cidades configuradas!`);
        } catch (fbError: any) {
          console.error('Fallback por cidades falhou:', fbError);
          toast.error('Erro ao carregar fretes. Tente novamente.');
          setCompatibleFreights([]);
        }
        return;
      }

      console.log(`RPC retornou ${data?.length || 0} fretes`);
      
      // Normalizar tipos de serviço nos fretes retornados e garantir freight_id
      const normalizedData = (data || []).map((f: any) => ({
        ...f,
        freight_id: f.freight_id ?? f.id,
        service_type: normalizeServiceType(f.service_type)
      }));

      // Filtrar pelos tipos de serviço que o motorista presta (CARGA, GUINCHO, MUDANCA, MOTO)
      const allowedTypes = Array.from(new Set(
        (Array.isArray(profile?.service_types) ? (profile?.service_types as unknown as string[]) : [])
          .map((t) => normalizeServiceType(String(t)))
      )).filter((t) => ['CARGA', 'GUINCHO', 'MUDANCA', 'MOTO'].includes(t));

      // Primeiro filtro por tipo de serviço
      let filteredByType = allowedTypes.length === 0 
        ? normalizedData 
        : normalizedData.filter((f: any) => allowedTypes.includes(f.service_type));

      // Filtro adicional por cidades ATIVAS do motorista (garantia contra dados antigos)
      const { data: ucActive } = await supabase
        .from('user_cities')
        .select('cities(name, state)')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

      const activeCities = (ucActive || []).length > 0;
      setHasActiveCities(activeCities);

      if (activeCities) {
        const allowedCities = new Set(
          (ucActive || [])
            .map((u: any) => `${String(u.cities?.name || '').toLowerCase()}|${String(u.cities?.state || '').toLowerCase()}`)
        );

        filteredByType = filteredByType.filter((f: any) => {
          const oKey = `${String(f.origin_city || '').toLowerCase()}|${String(f.origin_state || '').toLowerCase()}`;
          const dKey = `${String(f.destination_city || '').toLowerCase()}|${String(f.destination_state || '').toLowerCase()}`;
          return allowedCities.has(oKey) || allowedCities.has(dKey);
        });
      } else {
        console.warn('Sem cidades de atendimento ativas. Nada a exibir.');
        toast.info('Configure suas cidades de atendimento para ver fretes.');
        setCompatibleFreights([]);
        setTowingRequests([]);
        setLoading(false);
        return;
      }
      
      console.log(`Após filtros: ${filteredByType.length} fretes compatíveis`, {
        allowedTypes,
        totalFromRPC: data?.length || 0,
        afterFilter: filteredByType.length
      });
      
      setCompatibleFreights(filteredByType);
      
      // Emit count immediately after setting freights
      const highUrgency = filteredByType.filter((f: any) => f.urgency === 'HIGH').length;
      onCountsChange?.({ total: filteredByType.length, highUrgency });

      // Buscar chamados de serviço (GUINCHO/MUDANCA) abertos e sem prestador atribuído
      if (allowedTypes.some(t => t === 'GUINCHO' || t === 'MUDANCA')) {
        const { data: sr, error: srErr } = await supabase
          .from('service_requests')
          .select('*')
          .in('service_type', allowedTypes.filter(t => t === 'GUINCHO' || t === 'MUDANCA'))
          .eq('status', 'OPEN')
          .is('provider_id', null)
          .order('created_at', { ascending: true });
        if (srErr) throw srErr;
        setTowingRequests(sr || []);
        
        // Update count with towing requests
        const currentHighUrgency = filteredByType.filter((f: any) => f.urgency === 'HIGH').length;
        onCountsChange?.({ total: filteredByType.length + (sr?.length || 0), highUrgency: currentHighUrgency });
      } else {
        setTowingRequests([]);
      }
      // Notificação de novos matches (rate limiting: 5 minutos)
      if (spatialData?.created > 0 || filteredByType.length > 0) {
        const lastNotificationKey = `lastMatchNotification_${profile.id}`;
        const lastNotification = localStorage.getItem(lastNotificationKey);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (!lastNotification || (now - parseInt(lastNotification)) > fiveMinutes) {
          localStorage.setItem(lastNotificationKey, now.toString());
          if (spatialData?.created > 0) {
            toast.success(`${spatialData.created} novos matches espaciais criados!`);
          }
          if (filteredByType.length > 0) {
            toast.success(`${filteredByType.length} fretes compatíveis encontrados via suas cidades configuradas!`);
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar fretes compatíveis:', error);
      toast.error('Erro ao carregar fretes. Tente novamente.');
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

        // Obter perfil de motorista do usuário
        const driverProfileId = await (async () => {
          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return null;
          const { data, error } = await supabase
            .from('profiles')
            .select('id, role')
            .eq('user_id', user.id)
            .in('role', ['MOTORISTA', 'MOTORISTA_AFILIADO'])
            .limit(1);
          if (error) throw error;
          return data?.[0]?.id ?? profile.id;
        })();
        if (!driverProfileId) {
          toast.error('Você precisa de um perfil de Motorista para enviar propostas.');
          return;
        }

        // Verificar se já existe proposta ativa (PENDING/ACCEPTED)
        const { data: existing, error: existingError } = await supabase
          .from('freight_proposals')
          .select('status')
          .eq('freight_id', freightId)
          .eq('driver_id', driverProfileId)
          .maybeSingle();
        if (existingError) throw existingError;
        if (existing && (existing.status === 'PENDING' || existing.status === 'ACCEPTED')) {
          toast.info(
            existing.status === 'PENDING'
              ? 'Você já enviou uma proposta para este frete. Aguarde a resposta do produtor.'
              : 'Sua proposta já foi aceita pelo produtor.'
          );
          return;
        }

        // Inserir nova proposta (apenas se não existir ativa)
        const { error } = await supabase
          .from('freight_proposals')
          .insert({
            freight_id: freightId,
            driver_id: driverProfileId,
            proposed_price: freight.price,
            status: 'PENDING',
            message: action === 'accept' ? 'Aceito o frete pelo valor anunciado.' : null,
          });

        if (error) throw error;
        
        toast.success(action === 'accept' ? 'Solicitação para aceitar o frete enviada!' : 'Proposta enviada com sucesso!');
        fetchCompatibleFreights(); // Atualizar lista
      } catch (error: any) {
        showErrorToast(toast, 'Erro ao processar ação', error);
      }
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

  // Filtrar chamados de serviço (GUINCHO/MUDANCA)
  const filteredRequests = towingRequests.filter((r: any) => {
    const matchesSearch = !searchTerm ||
      (r.location_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (r.problem_description || '').toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  // Notificar contagens ao pai (DriverDashboard)
  useEffect(() => {
    if (!onCountsChange) return;
    
    const total = filteredFreights.length + filteredRequests.length;
    const highUrgency = filteredFreights.filter(f => f.urgency === 'HIGH').length;
    
    onCountsChange({ total, highUrgency });
  }, [filteredFreights, filteredRequests, onCountsChange]);

  const getServiceTypeBadge = (serviceType: string) => {
    switch (serviceType) {
      case 'CARGA':
        return (
          <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1">
            <Package className="h-3 w-3" />
            Carga
          </Badge>
        );
      case 'MUDANCA':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1">
            <Truck className="h-3 w-3" />
            Mudança
          </Badge>
        );
      case 'GUINCHO':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1">
            <Wrench className="h-3 w-3" />
            Guincho
          </Badge>
        );
      case 'MOTO':
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-200 flex items-center gap-1">
            <Bike className="h-3 w-3" />
            Moto
          </Badge>
        );
      default:
        return <Badge variant="secondary">{serviceType}</Badge>;
    }
  };

  // Agrupar tipos de carga por categoria para melhor visualização
  const getCargosByServiceType = (serviceTypes: string[]) => {
    if (!serviceTypes || serviceTypes.length === 0) return [];
    
    const relevantCargos = CARGO_TYPES.filter(cargo => {
      if (serviceTypes.includes('CARGA') && cargo.category === 'rural') return true;
      if (serviceTypes.includes('CARGA') && cargo.category === 'carga_viva') return true;
      if (serviceTypes.includes('MUDANCA') && cargo.category === 'outros') return true;
      if (serviceTypes.includes('GUINCHO') && cargo.category === 'outros') return true;
      return false;
    });
    
    return relevantCargos;
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
            Fretes selecionados automaticamente com base nas suas áreas de atendimento e tipos de serviço configurados. O sistema analisa geograficamente os fretes disponíveis dentro do seu raio de atuação.
          </CardDescription>
        </CardHeader>

        <CardContent>
          {/* Informações do Motorista */}
          {profile?.service_types && (
            <div className="bg-secondary/30 p-4 rounded-lg mb-6">
              <h4 className="font-semibold mb-2">Seus Tipos de Serviço Ativos:</h4>
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from(new Set((profile.service_types as unknown as string[]).map((t) => normalizeServiceType(String(t)))))
                  .map((serviceType: string) => (
                    <div key={serviceType}>{getServiceTypeBadge(serviceType)}</div>
                  ))}
              </div>
            </div>
          )}

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

              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    const { data: { session } } = await supabase.auth.getSession();
                    await supabase.functions.invoke('driver-spatial-matching', {
                      method: 'POST',
                      headers: {
                        'Authorization': session?.access_token ? `Bearer ${session.access_token}` : ''
                      }
                    });
                    toast.success('Áreas atualizadas e matches recalculados!');
                    await fetchCompatibleFreights();
                  } catch (e: any) {
                    console.error('Forçar atualização falhou', e);
                    toast.error('Falha ao forçar atualização.');
                  }
                }}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <MapPin className="h-4 w-4" />
                Forçar atualização de áreas
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

          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <div className="text-2xl font-bold text-primary">{filteredFreights.length + filteredRequests.length}</div>
              <div className="text-sm text-muted-foreground">Fretes Compatíveis</div>
            </div>
            <div className="text-center p-4 bg-secondary/30 rounded-lg">
              <div className="text-2xl font-bold">{filteredFreights.filter(f => f.urgency === 'HIGH').length + filteredRequests.filter((r:any)=>r.urgency==='HIGH' || r.is_emergency).length}</div>
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
        ) : (filteredFreights.length + filteredRequests.length) === 0 ? (
          <Card>
            <CardContent className="text-center py-8">
              <Brain className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
              <h3 className="font-semibold mb-2">Nenhum frete compatível encontrado</h3>
              <p className="text-muted-foreground mb-4">
                {allowedTypesFromProfile.length === 0
                  ? 'Você não tem tipos de serviço ativos. Configure-os em "Tipos de Serviço".'
                  : hasActiveCities === false
                    ? 'Você não tem cidades de atendimento configuradas. Configure em "Configurar Região".'
                    : 'Não há fretes disponíveis no momento que correspondam aos seus critérios.'}
              </p>
              <div className="space-y-2 text-sm text-muted-foreground mb-4">
                <p>✓ Verifique se suas cidades de atendimento estão configuradas</p>
                <p>✓ Confirme seus tipos de serviço (Carga, Guincho, Mudança)</p>
                <p>✓ Aguarde novos fretes serem cadastrados</p>
              </div>
              <Button variant="outline" onClick={fetchCompatibleFreights}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Verificar Novamente
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* Fretes padrão */}
            {filteredFreights.length > 0 && (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredFreights.map((freight) => (
                  <div key={freight.freight_id} className="relative h-full">
                    <FreightCard
                      freight={{
                        id: freight.freight_id,
                        cargo_type: freight.cargo_type,
                        weight: (freight.weight / 1000),
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
                      isAffiliatedDriver={isAffiliated}
                      driverCompanyId={companyId}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Chamados de Guincho/Mudança */}
            {filteredRequests.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-semibold">Chamados de Guincho/Mudança</h4>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredRequests.map((r: any) => (
                    <Card key={r.id} className="freight-card-standard border-l-4 border-l-orange-500 min-h-[600px] flex flex-col">
                      <CardHeader className="pb-3 flex-shrink-0">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-2">
                            {r.service_type === 'GUINCHO' ? (
                              <Wrench className="h-5 w-5 text-orange-600" />
                            ) : (
                              <Truck className="h-5 w-5 text-blue-600" />
                            )}
                            <div>
                              <CardTitle className="text-base">
                                {r.service_type === 'GUINCHO' ? 'Guincho' : 'Mudança/Frete Urbano'}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                {r.is_emergency && (
                                  <Badge variant="destructive" className="text-xs">Emergência</Badge>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-3 flex-1 flex flex-col justify-between overflow-y-auto">
                        <div className="space-y-2">
                          <div className="flex items-start gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                            <div>
                              <p className="text-sm font-medium">Local</p>
                              <p className="text-sm text-muted-foreground">{r.location_address}</p>
                            </div>
                          </div>
                          {r.problem_description && (
                            <div className="flex items-start gap-2">
                              <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                              <div>
                                <p className="text-sm font-medium">Descrição</p>
                                <p className="text-sm text-muted-foreground">{r.problem_description}</p>
                              </div>
                            </div>
                          )}
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            Há {Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60))} min
                          </div>
                          {r.estimated_price && (
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                              <DollarSign className="h-4 w-4 text-green-600" />
                              <span className="text-sm font-medium text-green-700 dark:text-green-300">
                                Valor: R$ {r.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}
                        </div>
                        <Button className="w-full" size="sm" onClick={async () => {
                          try {
                            if (!profile?.id) return;
                            const { error } = await supabase
                              .from('service_requests')
                              .update({ provider_id: profile.id, status: 'ACCEPTED', accepted_at: new Date().toISOString() })
                              .eq('id', r.id)
                              .eq('status', 'OPEN');
                            if (error) throw error;
                            toast.success('Solicitação aceita com sucesso!');
                            setTowingRequests(prev => prev.filter((x:any) => x.id !== r.id));
                          } catch (e:any) {
                            console.error('Erro ao aceitar solicitação:', e);
                            toast.error('Erro ao aceitar solicitação');
                          }
                        }}>
                          Aceitar Solicitação
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};