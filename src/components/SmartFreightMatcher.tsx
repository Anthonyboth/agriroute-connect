import React, { useState, useEffect, useTransition, useMemo, useRef, useCallback } from 'react';
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
import { useDriverPermissions } from '@/hooks/useDriverPermissions';
import { toast } from 'sonner';
import { showErrorToast } from '@/lib/error-handler';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { normalizeServiceType, getAllowedServiceTypesFromProfile, type CanonicalServiceType } from '@/lib/service-type-normalization';
import { subscriptionWithRetry } from '@/lib/query-utils';
import { debounce } from '@/lib/utils';
import { normalizeCity, normalizeCityState } from '@/utils/city-normalization';

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
  service_type: CanonicalServiceType;
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
  const { canAcceptFreights, mustUseChat, companyId: permissionCompanyId } = useDriverPermissions();
  const [compatibleFreights, setCompatibleFreights] = useState<CompatibleFreight[]>([]);
  const [towingRequests, setTowingRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCargoType, setSelectedCargoType] = useState<string>('all');
  const [matchingStats, setMatchingStats] = useState({ exactMatches: 0, fallbackMatches: 0, totalChecked: 0 });
  const [hasActiveCities, setHasActiveCities] = useState<boolean | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isPending, startTransition] = useTransition();
  const abortControllerRef = useRef<AbortController | null>(null);

  const isMountedRef = React.useRef(true);
  const updateLockRef = useRef(false);
  const fetchIdRef = useRef(0); // ✅ ID único para cada fetch
  
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);
  
  const allowedTypesFromProfile = React.useMemo(() => {
    return getAllowedServiceTypesFromProfile(profile);
  }, [profile?.role, profile?.service_types]);
  
  const fetchCompatibleFreights = useCallback(async () => {
    if (!profile?.id) return;
    
    // ✅ Verificar se já está rodando
    if (updateLockRef.current) {
      console.log('[SmartFreightMatcher] Fetch já em andamento, ignorando...');
      return;
    }
    
    // ✅ Incrementar ID do fetch
    const currentFetchId = ++fetchIdRef.current;
    updateLockRef.current = true;
    
    const isCompany = profile.role === 'TRANSPORTADORA';
    setLoading(true);
    
    // ✅ Cancelar fetch anterior se existir
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();
    
    try {
      console.log(`🔍 Buscando fretes para ${isCompany ? 'TRANSPORTADORA' : 'MOTORISTA'}:`, profile.id);
      console.log('🔧 Tipos permitidos:', allowedTypesFromProfile);

      // TRANSPORTADORA: carregar fretes diretamente, SEM chamar driver-spatial-matching
      if (isCompany) {
        console.log("📦 Modo TRANSPORTADORA: carregando fretes abertos diretamente");
        
        const { data: directFreights, error: directError } = await supabase
          .from('freights')
          .select('*')
          .in('status', ['OPEN', 'IN_NEGOTIATION'])
          .is('driver_id', null)
          .order('created_at', { ascending: false })
          .limit(100);

        if (directError) {
          console.error("❌ Erro ao carregar fretes para transportadora:", directError);
          toast.error('Erro ao carregar fretes.');
          setLoading(false);
          return;
        }

        if (directFreights) {
          console.log(`✅ ${directFreights.length} fretes brutos carregados para transportadora`);
          
          // Mapear para formato esperado
          const mapped: CompatibleFreight[] = directFreights.map((f: any) => ({
            freight_id: f.id,
            cargo_type: f.cargo_type,
            weight: f.weight || 0,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            origin_city: f.origin_city,
            origin_state: f.origin_state,
            destination_city: f.destination_city,
            destination_state: f.destination_state,
            pickup_date: f.pickup_date,
            delivery_date: f.delivery_date,
            price: f.price || 0,
            urgency: (f.urgency || 'LOW') as string,
            status: f.status,
            service_type: normalizeServiceType(f.service_type),
            distance_km: 0,
            minimum_antt_price: f.minimum_antt_price || 0,
            required_trucks: f.required_trucks || 1,
            accepted_trucks: f.accepted_trucks || 0,
            created_at: f.created_at,
          }));

          // Filtrar por tipo apenas se não for default "todos"
          const filtered = allowedTypesFromProfile.length === 4
            ? mapped // Todos os tipos permitidos
            : mapped.filter(f => allowedTypesFromProfile.includes(f.service_type));

          console.log(`✅ ${filtered.length} fretes após filtro de tipo`);
          // ✅ Verificar se este fetch ainda é válido
          if (currentFetchId === fetchIdRef.current && isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
            setCompatibleFreights(filtered);
            
            const highUrgency = filtered.filter(f => f.urgency === 'HIGH').length;
            onCountsChange?.({ total: filtered.length, highUrgency });
          }
          
          setLoading(false);
          setIsUpdating(false);
          updateLockRef.current = false;
          return;
        }
      }

      // MOTORISTA: usar fallback se sem config
      let effectiveTypes = allowedTypesFromProfile;
      if (!isCompany && allowedTypesFromProfile.length === 0) {
        console.info('ℹ️ Motorista sem tipos configurados → usando fallback [CARGA]');
        effectiveTypes = ['CARGA'];
        toast.info('Configure seus tipos de serviço nas configurações.', { duration: 3000 });
      }
      
      // Executar matching espacial para MOTORISTA
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
        console.warn('⚠️ Erro no matching espacial:', spatialError);
      } else {
        console.log('✅ Matching espacial executado:', spatialData);
      }

      // 1️⃣ PRIORIDADE: Usar fretes do matching espacial imediatamente
      let spatialFreights: CompatibleFreight[] = [];
      if (spatialData?.freights && Array.isArray(spatialData.freights)) {
        // ✅ Log de exclusões por service_type
        const beforeFilter = spatialData.freights.length;
        const excluded: any[] = [];
        
        spatialFreights = spatialData.freights
          .filter((f: any) => {
            const normalized = normalizeServiceType(f.service_type);
            const isAllowed = allowedTypesFromProfile.includes(normalized);
            if (!isAllowed) {
              excluded.push({
                id: f.id?.slice(0, 8),
                original: f.service_type,
                normalized,
                reason: 'Tipo não permitido para perfil'
              });
            }
            return isAllowed;
          })
          .map((f: any) => ({
            freight_id: f.id || f.freight_id,
            cargo_type: f.cargo_type,
            weight: f.weight || 0,
            origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
            destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
            origin_city: f.origin_city,
            origin_state: f.origin_state,
            destination_city: f.destination_city,
            destination_state: f.destination_state,
            pickup_date: String(f.pickup_date || ''),
            delivery_date: String(f.delivery_date || ''),
            price: f.price || 0,
            urgency: (f.urgency || 'LOW') as string,
            status: f.status,
            service_type: normalizeServiceType(f.service_type),
            distance_km: f.distance_km || 0,
            minimum_antt_price: f.minimum_antt_price || 0,
            required_trucks: f.required_trucks || 1,
            accepted_trucks: f.accepted_trucks || 0,
            created_at: f.created_at,
          }));
        
        console.log(`📦 Spatial matching retornou ${spatialFreights.length} fretes`);
        if (excluded.length > 0) {
          console.log(`🔍 [SmartFreightMatcher] ${excluded.length} fretes excluídos por service_type:`, excluded);
        }
        
        // ✅ Log de contagem por cidade (origem/destino)
        const cityCounts: Record<string, number> = {};
        spatialFreights.forEach((f: CompatibleFreight) => {
          const originKey = `${f.origin_city}|${f.origin_state}`;
          const destKey = `${f.destination_city}|${f.destination_state}`;
          cityCounts[originKey] = (cityCounts[originKey] || 0) + 1;
          cityCounts[destKey] = (cityCounts[destKey] || 0) + 1;
        });
        console.log(`📊 [SmartFreightMatcher] Fretes por cidade (origem/destino):`, cityCounts);
        
        // ✅ Verificar se este fetch ainda é válido
        if (currentFetchId === fetchIdRef.current && isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
          setCompatibleFreights(spatialFreights);
          const highUrgency = spatialFreights.filter(f => f.urgency === 'HIGH').length;
          onCountsChange?.({ total: spatialFreights.length, highUrgency });
        }
      }

      // 2️⃣ TENTAR RPC: Se funcionar, combinar com espacial (deduplicar)
      const { data, error: rpcError } = await supabase.rpc(
        'get_freights_for_driver',
        { p_driver_id: profile.id }
      );

      if (rpcError) {
        console.warn('⚠️ RPC falhou (não bloqueante):', rpcError);
        // Continuar com fretes do matching espacial
        // Buscar fallback por cidades apenas se spatial também está vazio
        if (spatialFreights.length === 0) {
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
              if (isMountedRef.current) {
                setHasActiveCities(false);
                toast.info('Configure suas cidades de atendimento para ver fretes compatíveis.');
                setCompatibleFreights(spatialFreights); // Manter fretes do spatial
                setTowingRequests([]);
                setLoading(false);
              }
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

            // Mapear para o formato esperado pela UI
            const fallbackMapped: CompatibleFreight[] = (freightsByCity || [])
              .map((f: any) => ({
                freight_id: f.id,
                cargo_type: f.cargo_type,
                weight: f.weight || 0,
                origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
                destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
                origin_city: f.origin_city,
                origin_state: f.origin_state,
                destination_city: f.destination_city,
                destination_state: f.destination_state,
                pickup_date: String(f.pickup_date || ''),
                delivery_date: String(f.delivery_date || ''),
                price: f.price || 0,
                urgency: (f.urgency || 'LOW') as string,
                status: f.status,
                service_type: normalizeServiceType(f.service_type),
                distance_km: f.match_distance_m ? Math.round((f.match_distance_m / 1000) * 10) / 10 : 0,
                minimum_antt_price: f.minimum_antt_price || 0,
                required_trucks: f.required_trucks || 1,
                accepted_trucks: f.accepted_trucks || 0,
                created_at: f.created_at,
              }))
              .filter((f) => allowedTypesFromProfile.length === 0 || allowedTypesFromProfile.includes(f.service_type));

            // Combinar spatial com fallback e deduplicar
            const combined = [...spatialFreights, ...fallbackMapped];
            const uniqueMap = new Map<string, CompatibleFreight>();
            combined.forEach(f => {
              if (!uniqueMap.has(f.freight_id)) {
                uniqueMap.set(f.freight_id, f);
              }
            });
            const final = Array.from(uniqueMap.values());
            
            // ✅ Verificar se este fetch ainda é válido
            if (currentFetchId === fetchIdRef.current && isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
              setCompatibleFreights(final);
              
              // Emit count
              const highUrgency = final.filter(f => f.urgency === 'HIGH').length;
              onCountsChange?.({ total: final.length, highUrgency });
              
              console.log(`✅ ${final.length} fretes após combinar spatial + fallback`);
              toast.success(`${final.length} fretes compatíveis encontrados!`);
            }
          } catch (fbError: any) {
            console.error('Fallback por cidades falhou:', fbError);
            // Manter fretes do spatial mesmo com erro no fallback
            if (isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
              startTransition(() => {
                setCompatibleFreights(spatialFreights);
              });
            }
          }
        }
        if (isMountedRef.current) setLoading(false);
        return;
      }

      // RPC sucesso: combinar com spatial
      console.log(`✅ RPC retornou ${data?.length || 0} fretes`);
      
      // Normalizar tipos de serviço nos fretes retornados e garantir freight_id
      const normalizedData = (data || []).map((f: any) => ({
        ...f,
        freight_id: f.freight_id ?? f.id,
        service_type: normalizeServiceType(f.service_type),
        pickup_date: String(f.pickup_date || ''),
        delivery_date: String(f.delivery_date || ''),
        required_trucks: f.required_trucks || 1,
        accepted_trucks: f.accepted_trucks || 0
      }));

      console.log(`📊 Usando allowedTypesFromProfile consistente:`, allowedTypesFromProfile);

      // Primeiro filtro por tipo de serviço usando allowedTypesFromProfile
      let filteredByType = allowedTypesFromProfile.length === 0 
        ? normalizedData 
        : normalizedData.filter((f: any) => {
            const included = allowedTypesFromProfile.includes(f.service_type);
            if (!included) {
              console.log(`🚫 Frete ${f.freight_id} descartado por tipo: ${f.service_type} não está em`, allowedTypesFromProfile);
            }
            return included;
          });

      // Filtro adicional por cidades ATIVAS do motorista (garantia contra dados antigos)
      const { data: ucActive } = await supabase
        .from('user_cities')
        .select('cities(name, state)')
        .eq('user_id', user!.id)
        .eq('is_active', true)
        .in('type', ['MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO']);

      const activeCities = (ucActive || []).length > 0;
      setHasActiveCities(activeCities);

      // Extrair cidade/estado de address como fallback
      const extractCityStateFromAddress = (address: string): { city: string; state: string } => {
        if (!address) return { city: '', state: '' };
        
        // Tentar extrair cidade e estado do formato "Cidade - UF" ou "Cidade, UF"
        const match = address.match(/([^,\-]+)[\,\-]?\s*([A-Z]{2})\s*$/i);
        if (match) {
          return {
            city: normalizeCity(match[1].trim()),
            state: match[2].trim().toUpperCase()
          };
        }
        
        // Fallback: pegar última parte antes de vírgula
        const parts = address.split(',').map(p => p.trim());
        const cityPart = parts[parts.length - 1] || parts[0];
        return { city: normalizeCity(cityPart), state: '' };
      };

      // Reset stats
      setMatchingStats({ exactMatches: 0, fallbackMatches: 0, totalChecked: 0 });

      if (activeCities) {
        const allowedCities = new Set(
          (ucActive || [])
            .map((u: any) => {
              const cityName = String(u.cities?.name || '').trim().toLowerCase();
              const state = String(u.cities?.state || '').trim().toUpperCase();
              return `${cityName}|${state}`;
            })
        );

        // ✅ FILTRO MAIS PERMISSIVO: Matching em 3 níveis
        // Nível 1: Match exato cidade|estado
        // Nível 2: Match por ESTADO (origem OU destino no mesmo estado)
        // Nível 3: Match por CIDADE (nome de cidade, ignorando estado)
        
        console.log(`🗺️ Cidades ativas do motorista:`, Array.from(allowedCities));
        
        // Extrair estados das cidades ativas
        const allowedStates = new Set(
          Array.from(allowedCities)
            .map(key => key.split('|')[1])
            .filter(Boolean)
        );
        console.log(`🗺️ Estados ativos do motorista:`, Array.from(allowedStates));

        let exactMatches = 0;
        let stateMatches = 0;
        let fallbackMatches = 0;
        
        filteredByType = filteredByType.filter((f: any) => {
          let oKey = normalizeCityState(f.origin_city || '', f.origin_state || '');
          let dKey = normalizeCityState(f.destination_city || '', f.destination_state || '');
          
          // Fallback: tentar extrair de addresses se city/state estão vazios
          if (!f.origin_city || !f.origin_state) {
            const extracted = extractCityStateFromAddress(f.origin_address);
            if (extracted.city) {
              oKey = normalizeCityState(extracted.city, extracted.state);
              console.log(`🔄 Origem extraída: ${oKey} (frete ${f.freight_id})`);
            }
          }
          
          if (!f.destination_city || !f.destination_state) {
            const extracted = extractCityStateFromAddress(f.destination_address);
            if (extracted.city) {
              dKey = normalizeCityState(extracted.city, extracted.state);
              console.log(`🔄 Destino extraído: ${dKey} (frete ${f.freight_id})`);
            }
          }

          // ✅ NÍVEL 1: Match exato cidade|estado
          let included = allowedCities.has(oKey) || allowedCities.has(dKey);
          let matchType: 'exact' | 'state' | 'fallback' | 'none' = included ? 'exact' : 'none';

          // ✅ NÍVEL 2: Match por ESTADO (muito mais permissivo)
          if (!included) {
            const originState = oKey.split('|')[1];
            const destState = dKey.split('|')[1];
            
            const stateMatch = allowedStates.has(originState) || allowedStates.has(destState);
            
            if (stateMatch) {
              console.log(`✅ Frete ${f.freight_id} incluído via ESTADO (origem=${originState}, destino=${destState})`);
              included = true;
              matchType = 'state';
            }
          }

          // ✅ NÍVEL 3: Fallback por cidade (sem estado)
          if (!included) {
            const allowedCityNames = new Set(
              Array.from(allowedCities).map(key => key.split('|')[0])
            );
            
            const originCityOnly = oKey.split('|')[0];
            const destCityOnly = dKey.split('|')[0];
            
            const fallbackMatch = allowedCityNames.has(originCityOnly) || 
                                  allowedCityNames.has(destCityOnly);
            
            if (fallbackMatch) {
              console.log(`✅ Frete ${f.freight_id} incluído via CIDADE (sem estado)`);
              included = true;
              matchType = 'fallback';
            }
          }
          
          // Atualizar estatísticas
          if (matchType === 'exact') {
            exactMatches++;
          } else if (matchType === 'state') {
            stateMatches++;
          } else if (matchType === 'fallback') {
            fallbackMatches++;
          }
          
          if (!included) {
            console.log(`🚫 Frete ${f.freight_id} descartado: origem=${oKey}, destino=${dKey}`);
          }
          
          return included;
        });

        // Atualizar estatísticas de uma vez
        setMatchingStats({
          exactMatches,
          fallbackMatches: stateMatches + fallbackMatches,
          totalChecked: filteredByType.length + exactMatches + stateMatches + fallbackMatches
        });
        
        console.log(`📊 Matching: ${exactMatches} exato(s), ${stateMatches} estado(s), ${fallbackMatches} fallback(s)`);
      } else {
        console.warn('Sem cidades de atendimento ativas. Nada a exibir.');
        toast.info('Configure suas cidades de atendimento para ver fretes.');
        setCompatibleFreights([]);
        setTowingRequests([]);
        setLoading(false);
        return;
      }
      
      // Combinar spatial + RPC e deduplicar
      const rpcMapped: CompatibleFreight[] = filteredByType.map((f: any) => ({
        freight_id: f.freight_id,
        cargo_type: f.cargo_type,
        weight: f.weight || 0,
        origin_address: f.origin_address || `${f.origin_city || ''}, ${f.origin_state || ''}`,
        destination_address: f.destination_address || `${f.destination_city || ''}, ${f.destination_state || ''}`,
        origin_city: f.origin_city,
        origin_state: f.origin_state,
        destination_city: f.destination_city,
        destination_state: f.destination_state,
        pickup_date: f.pickup_date,
        delivery_date: f.delivery_date,
        price: f.price || 0,
        urgency: f.urgency,
        status: f.status,
        service_type: f.service_type,
        distance_km: f.distance_km || 0,
        minimum_antt_price: f.minimum_antt_price || 0,
        required_trucks: f.required_trucks,
        accepted_trucks: f.accepted_trucks,
        created_at: f.created_at,
      }));

      const combined = [...spatialFreights, ...rpcMapped];
      const uniqueMap = new Map<string, CompatibleFreight>();
      combined.forEach(f => {
        if (!uniqueMap.has(f.freight_id)) {
          uniqueMap.set(f.freight_id, f);
        }
      });
      const finalFreights = Array.from(uniqueMap.values());

      console.log(`✅ Após combinar spatial + RPC: ${finalFreights.length} fretes`, {
        spatial: spatialFreights.length,
        rpc: rpcMapped.length,
        final: finalFreights.length
      });
      
      // ✅ Verificar se este fetch ainda é válido
      if (currentFetchId === fetchIdRef.current && isMountedRef.current && !abortControllerRef.current?.signal.aborted) {
        setCompatibleFreights(finalFreights);
        
        // Emit count immediately after setting freights
        const highUrgency = finalFreights.filter((f: any) => f.urgency === 'HIGH').length;
        onCountsChange?.({ total: finalFreights.length, highUrgency });
      }

      // Buscar chamados de serviço (GUINCHO/MUDANCA) abertos e sem prestador atribuído
      if (allowedTypesFromProfile.some(t => t === 'GUINCHO' || t === 'MUDANCA')) {
        const { data: sr, error: srErr } = await supabase
          .from('service_requests')
          .select('*')
          .in('service_type', allowedTypesFromProfile.filter(t => t === 'GUINCHO' || t === 'MUDANCA'))
          .eq('status', 'OPEN')
          .is('provider_id', null)
          .order('created_at', { ascending: true });
        if (srErr) throw srErr;
        setTowingRequests(sr || []);
        
        // Update count with towing requests
        const currentHighUrgency = finalFreights.filter((f: any) => f.urgency === 'HIGH').length;
        onCountsChange?.({ total: finalFreights.length + (sr?.length || 0), highUrgency: currentHighUrgency });
      } else {
        setTowingRequests([]);
      }
      // Notificação de novos matches (rate limiting: 5 minutos)
      if (spatialData?.created > 0 || finalFreights.length > 0) {
        const lastNotificationKey = `lastMatchNotification_${profile.id}`;
        const lastNotification = localStorage.getItem(lastNotificationKey);
        const now = Date.now();
        const fiveMinutes = 5 * 60 * 1000;
        
        if (!lastNotification || (now - parseInt(lastNotification)) > fiveMinutes) {
          localStorage.setItem(lastNotificationKey, now.toString());
          if (spatialData?.created > 0) {
            toast.success(`${spatialData.created} novos matches espaciais criados!`);
          }
          if (finalFreights.length > 0) {
            toast.success(`${finalFreights.length} fretes compatíveis encontrados!`);
          }
        }
      }
    } catch (error: any) {
      console.error('Erro ao buscar fretes compatíveis:', error);
      toast.error('Erro ao carregar fretes. Tente novamente.');
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
        setIsUpdating(false);
      }
      updateLockRef.current = false;
    }
  }, [profile, allowedTypesFromProfile, user, onCountsChange]);

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

  // ✅ useEffect para recarregar quando tipos de serviço mudarem
  useEffect(() => {
    if (!profile?.id || !isMountedRef.current) return;
    setLoading(true);
    fetchCompatibleFreights().finally(() => {
      if (isMountedRef.current) setLoading(false);
    });
  }, [JSON.stringify(profile?.service_types), fetchCompatibleFreights]);
  
  // ✅ Realtime subscription com debounce
  useEffect(() => {
    let isMountedLocal = true;
    let pollInterval: NodeJS.Timeout | null = null;
    
    if (!profile?.id || !user?.id || !isMountedRef.current) return;

    // Debounced fetch específico para este effect
    const debouncedFetch = debounce(() => {
      if (isMountedLocal && isMountedRef.current && !isUpdating) {
        console.log('[SmartFreightMatcher] 🔄 Debounced fetch trigado');
        fetchCompatibleFreights();
      }
    }, 500);

    const { cleanup } = subscriptionWithRetry(
      'user-cities-changes',
      (ch) => ch.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'user_cities',
          filter: `user_id=eq.${user.id}`
        },
        (payload) => {
          if (!isMountedLocal || !isMountedRef.current) return;
          console.log('[SmartFreightMatcher] user_cities mudou:', payload);
          toast.info('Suas cidades de atendimento foram atualizadas. Recarregando fretes...');
          debouncedFetch();
        }
      ),
      {
        maxRetries: 5,
        retryDelayMs: 3000,
        onError: (error) => {
          console.error('[SmartFreightMatcher] Realtime error:', error);
          // Fallback: polling manual se realtime falhar
          if (!pollInterval) {
            pollInterval = setInterval(() => {
              if (isMountedLocal && isMountedRef.current) {
                console.log('[SmartFreightMatcher] Polling fallback ativo');
                fetchCompatibleFreights();
              }
            }, 30000); // Poll a cada 30 segundos
          }
        }
      }
    );

    return () => {
      isMountedLocal = false;
      cleanup();
      debouncedFetch.cancel();
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };
  }, [profile?.id, user?.id, fetchCompatibleFreights, isUpdating]);

  // ✅ Memoizar lista filtrada para evitar re-renders desnecessários
  const filteredFreights = useMemo(() => {
    return compatibleFreights.filter(freight => {
      const matchesSearch = !searchTerm || 
        freight.cargo_type.toLowerCase().includes(searchTerm.toLowerCase()) ||
        freight.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
        freight.destination_address.toLowerCase().includes(searchTerm.toLowerCase());

      const matchesCargoType = selectedCargoType === 'all' || freight.cargo_type === selectedCargoType;

      return matchesSearch && matchesCargoType;
    });
  }, [compatibleFreights, searchTerm, selectedCargoType]);

  // ✅ Memoizar chamados filtrados
  const filteredRequests = useMemo(() => {
    return towingRequests.filter((r: any) => {
      const matchesSearch = !searchTerm ||
        (r.location_address || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
        (r.problem_description || '').toLowerCase().includes(searchTerm.toLowerCase());
      return matchesSearch;
    });
  }, [towingRequests, searchTerm]);

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
          <Badge className="bg-primary/10 text-primary border-primary/20 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Package className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Carga</span>
          </Badge>
        );
      case 'MUDANCA':
        return (
          <Badge className="bg-blue-100 text-blue-800 border-blue-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Truck className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Mudança</span>
          </Badge>
        );
      case 'GUINCHO':
        return (
          <Badge className="bg-orange-100 text-orange-800 border-orange-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Wrench className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Guincho</span>
          </Badge>
        );
      case 'FRETE_MOTO':
        return (
          <Badge className="bg-teal-100 text-teal-800 border-teal-200 flex items-center gap-1 max-w-fit truncate whitespace-nowrap">
            <Bike className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">Moto</span>
          </Badge>
        );
      default:
        return <Badge variant="secondary" className="truncate max-w-fit whitespace-nowrap">{serviceType}</Badge>;
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
            {matchingStats.totalChecked > 0 && (
              <Badge variant="outline" className="ml-auto text-xs">
                🎯 {matchingStats.exactMatches} | 🗺️ {matchingStats.fallbackMatches}
              </Badge>
            )}
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
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando lista...</div>}>
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
                          service_type: freight.service_type as 'CARGA' | 'GUINCHO' | 'MUDANCA',
                        }}
                        onAction={(action) => handleFreightAction(freight.freight_id, action)}
                        showActions={true}
                        canAcceptFreights={canAcceptFreights}
                        isAffiliatedDriver={isAffiliated}
                        driverCompanyId={companyId || permissionCompanyId}
                      />
                    </div>
                  ))}
                </div>
              </SafeListWrapper>
            )}

            {/* Chamados de Guincho/Mudança - Design Profissional */}
            {filteredRequests.length > 0 && (
              <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando lista...</div>}>
                <div className="space-y-3">
                  <h4 className="font-semibold text-lg flex items-center gap-2">
                    <Wrench className="h-5 w-5 text-primary" />
                    Chamados de Guincho/Mudança
                  </h4>
                  <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                    {filteredRequests.map((r: any) => (
                      <Card key={r.id} className="freight-card-standard hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 border-border/60 overflow-hidden">
                        {/* Header com gradiente */}
                        <div className={`p-4 ${r.service_type === 'GUINCHO' ? 'bg-gradient-to-r from-orange-500/10 to-orange-600/5' : 'bg-gradient-to-r from-blue-500/10 to-blue-600/5'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`p-2 rounded-full ${r.service_type === 'GUINCHO' ? 'bg-orange-100 dark:bg-orange-900/30' : 'bg-blue-100 dark:bg-blue-900/30'}`}>
                                {r.service_type === 'GUINCHO' ? (
                                  <Wrench className="h-5 w-5 text-orange-600" />
                                ) : r.service_type?.includes('FRETE_MOTO') ? (
                                  <Bike className="h-5 w-5 text-blue-600" />
                                ) : (
                                  <Truck className="h-5 w-5 text-blue-600" />
                                )}
                              </div>
                              <div>
                                <h3 className="font-bold text-foreground">
                                  {r.service_type === 'GUINCHO' ? 'Guincho' : 
                                   r.service_type?.includes('MOTO') ? 'Frete Moto' :
                                   r.service_type?.includes('MUDANCA') ? 'Mudança' : 'Frete Urbano'}
                                </h3>
                                <p className="text-xs text-muted-foreground">Solicitação #{r.id?.slice(0,8)}</p>
                              </div>
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300">
                                Disponível
                              </Badge>
                              {r.is_emergency && (
                                <Badge variant="destructive" className="animate-pulse">
                                  🚨 Emergência
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        <CardContent className="p-4 space-y-4">
                          {/* Local com cidade em destaque */}
                          <div className="space-y-2">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Local do Serviço</span>
                            </div>
                            {r.city_name && (
                              <p className="text-lg font-bold text-primary pl-6">
                                {r.city_name.toUpperCase()} {r.state ? `- ${r.state}` : ''}
                              </p>
                            )}
                            <p className="text-sm text-muted-foreground pl-6 line-clamp-2">
                              {r.location_address || 'Endereço não informado'}
                            </p>
                          </div>

                          {/* Descrição do problema */}
                          {r.problem_description && (
                            <div className="p-3 bg-secondary/30 rounded-lg border border-border/50">
                              <div className="flex items-start gap-2">
                                <MessageSquare className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-1">Descrição</p>
                                  <p className="text-sm text-foreground line-clamp-3">{r.problem_description}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          {/* Valor destacado */}
                          {r.estimated_price && (
                            <div className="flex items-center justify-between p-3 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                              <div className="flex items-center gap-2">
                                <DollarSign className="h-5 w-5 text-green-600" />
                                <span className="text-sm text-green-700 dark:text-green-300">Valor Estimado</span>
                              </div>
                              <span className="text-xl font-bold text-green-700 dark:text-green-300">
                                R$ {r.estimated_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                              </span>
                            </div>
                          )}

                          {/* Tempo */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/50">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              <span>Solicitado há {Math.floor((Date.now() - new Date(r.created_at).getTime()) / (1000 * 60))} min</span>
                            </div>
                            {r.urgency && (
                              <Badge variant={r.urgency === 'HIGH' ? 'destructive' : r.urgency === 'MEDIUM' ? 'default' : 'secondary'} className="text-xs">
                                {r.urgency === 'HIGH' ? 'Alta' : r.urgency === 'MEDIUM' ? 'Média' : 'Baixa'}
                              </Badge>
                            )}
                          </div>

                          {/* Botão de ação */}
                          <Button 
                            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-3" 
                            size="lg"
                            onClick={async () => {
                              try {
                                if (!profile?.id) return;
                                const { error } = await supabase
                                  .from('service_requests')
                                  .update({ provider_id: profile.id, status: 'ACCEPTED', accepted_at: new Date().toISOString() })
                                  .eq('id', r.id)
                                  .eq('status', 'OPEN');
                                if (error) throw error;
                                toast.success('Chamado aceito com sucesso! Aguarde contato do solicitante.');
                                setTowingRequests(prev => prev.filter((x:any) => x.id !== r.id));
                              } catch (e:any) {
                                console.error('Erro ao aceitar chamado:', e);
                                toast.error('Erro ao aceitar chamado');
                              }
                            }}
                          >
                            ✅ Aceitar Chamado
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              </SafeListWrapper>
            )}
          </>
        )}
      </div>
    </div>
  );
};