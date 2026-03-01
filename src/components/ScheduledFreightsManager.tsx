import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CalendarIcon, Clock, MapPin, Package, Plus, Search, Filter } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getFreightStatusLabel, getFreightStatusVariant, getProposalStatusLabel } from '@/lib/freight-status';
import { formatDateLong, formatDate } from '@/lib/formatters';
import { ScheduledFreightModal } from './ScheduledFreightModal';
import { EditFreightModal } from './EditFreightModal';
import { ConfirmDialog } from './ConfirmDialog';
import { ScheduledFreightCard } from './ScheduledFreightCard';
import { getDaysUntilPickup, isScheduledFreight } from '@/utils/freightDateHelpers';

/**
 * Enriquece fretes com dados dos participantes (produtor e motorista)
 * para exibição no card de fretes agendados.
 */
const enrichFreightsWithParticipants = async (freights: any[], profile: any) => {
  if (!freights.length) return freights;

  // Coletar IDs de produtores e fretes
  const producerIds = [...new Set(freights.map(f => f.producer_id).filter(Boolean))];
  const freightIds = freights.map(f => f.id);

  // Buscar perfis de produtores
  let producerMap: Record<string, any> = {};
  if (producerIds.length > 0) {
    const { data: producers } = await (supabase as any)
      .from('profiles_secure')
      .select('id, full_name, profile_photo_url, rating, total_ratings')
      .in('id', producerIds);
    if (producers) {
      producerMap = Object.fromEntries(producers.map((p: any) => [p.id, p]));
    }
  }

  // Buscar motoristas atribuídos via freight_assignments
  let driverAssignments: Record<string, any[]> = {};
  if (freightIds.length > 0) {
    const { data: assignments } = await supabase
      .from('freight_assignments')
      .select('freight_id, driver_id, agreed_price, status')
      .in('freight_id', freightIds)
      .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);

    if (assignments && assignments.length > 0) {
      // Agrupar por freight_id
      for (const a of assignments) {
        if (!driverAssignments[a.freight_id]) driverAssignments[a.freight_id] = [];
        driverAssignments[a.freight_id].push(a);
      }

      // Buscar perfis dos motoristas
      const driverIds = [...new Set(assignments.map(a => a.driver_id).filter(Boolean))];
      if (driverIds.length > 0) {
        const { data: drivers } = await (supabase as any)
          .from('profiles_secure')
          .select('id, full_name, profile_photo_url, rating, total_ratings')
          .in('id', driverIds);
        
        if (drivers) {
          const driverMap = Object.fromEntries(drivers.map((d: any) => [d.id, d]));
          // Enriquecer assignments com perfil do motorista
          for (const freightId of Object.keys(driverAssignments)) {
            driverAssignments[freightId] = driverAssignments[freightId].map(a => ({
              ...a,
              driver_profile: driverMap[a.driver_id] || null,
            }));
          }
        }
      }
    }
  }

  // Enriquecer cada frete
  return freights.map(f => ({
    ...f,
    producer: f.producer_id ? producerMap[f.producer_id] || null : null,
    assigned_drivers: driverAssignments[f.id] || [],
  }));
};

// Helper para obter data efetiva (scheduled_date ou pickup_date como fallback)
const getEffectiveDate = (freight: any): string | null => {
  return freight.scheduled_date || freight.pickup_date || null;
};

interface ScheduledFreight {
  id: string;
  origin_address: string;
  destination_address: string;
  scheduled_date: string;
  cargo_type: string;
  weight: number;
  price: number;
  flexible_dates: boolean;
  date_range_start?: string;
  date_range_end?: string;
  description?: string;
  status: string;
  producer_name?: string;
}


export const ScheduledFreightsManager: React.FC = () => {
  const { profile } = useAuth();
  const [scheduledFreights, setScheduledFreights] = useState<ScheduledFreight[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<'all' | 'today' | 'tomorrow' | 'near'>('all');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      fetchScheduledFreights();
    }
  }, [profile]);

  const fetchScheduledFreights = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      try {
        // Data de hoje (início do dia)
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];
        
        console.log('🔍 [AGENDADOS] Buscando fretes futuros (>= hoje)', todayStr);
        
        let freightsData: any[] = [];
        const FINAL_STATUSES = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION'];
        
        if (profile.role === 'PRODUTOR') {
          const result: any = await supabase
            .from('freights')
            .select('*')
            .eq('producer_id', profile.id)
            .or(`pickup_date.gte.${todayStr},scheduled_date.gte.${todayStr}`)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          const allFreights = result.data || [];
          console.log('📊 [PRODUTOR] Total buscado:', allFreights.length);
          
          // Filtrar com helper isScheduledFreight e excluir finais
          freightsData = allFreights.filter((f: any) => 
            !FINAL_STATUSES.includes(f.status) && 
            isScheduledFreight(f.pickup_date || f.scheduled_date, f.status)
          );
          console.log('✅ [PRODUTOR] Após filtro scheduled:', freightsData.length, 
            'IDs:', freightsData.map(f => `${f.id.slice(0,8)}(${f.pickup_date})`));
          
        } else if (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO') {
          // ✅ CORRIGIDO: Sempre buscar via freight_assignments para fretes aceitos
          console.log('🔍 [MOTORISTA] Buscando fretes aceitos via freight_assignments...');
          
          // Buscar assignments aceitos do motorista
          const { data: assigns, error: assignError } = await supabase
            .from('freight_assignments')
            .select('freight_id')
            .eq('driver_id', profile.id)
            .in('status', ['ACCEPTED', 'LOADING', 'LOADED', 'IN_TRANSIT']);
          
          if (assignError) {
            console.error('Erro ao buscar assignments:', assignError);
          }
          
          const assignmentIds = (assigns || []).map(a => a.freight_id);
          console.log('📋 [MOTORISTA] Assignments encontrados:', assignmentIds.length);
          
          // Buscar fretes via assignments
          if (assignmentIds.length > 0) {
            const { data: assignedFreights, error: freightError } = await supabase
              .from('freights')
              .select('*')
              .in('id', assignmentIds);
            
            if (!freightError && assignedFreights) {
              console.log('📊 [MOTORISTA ASSIGNMENTS] Total buscado:', assignedFreights.length);
              
              const assignedScheduled = assignedFreights.filter((f: any) => 
                !FINAL_STATUSES.includes(f.status) && 
                isScheduledFreight(f.pickup_date || f.scheduled_date, f.status)
              );
              console.log('✅ [MOTORISTA ASSIGNMENTS] Após filtro scheduled:', assignedScheduled.length);
              freightsData = [...freightsData, ...assignedScheduled];
            }
          }
          
          // Também tentar RPC para fretes disponíveis (não aceitos ainda)
          try {
            const { data: rpcData, error: rpcErr } = await supabase.rpc('get_freights_for_driver', { 
              p_driver_id: profile.id 
            });
            
            if (!rpcErr && rpcData && rpcData.length > 0) {
              console.log('📊 [MOTORISTA RPC] Fretes disponíveis:', rpcData.length);
              
              const rpcScheduled = rpcData.filter((f: any) => 
                !FINAL_STATUSES.includes(f.status) && 
                isScheduledFreight(f.pickup_date || f.scheduled_date, f.status)
              );
              
              // Adicionar apenas os que não estão já na lista
              const existingIds = new Set(freightsData.map((f: any) => f.id));
              const newFromRpc = rpcScheduled.filter((f: any) => !existingIds.has(f.id));
              console.log('✅ [MOTORISTA RPC] Novos após dedup:', newFromRpc.length);
              
              freightsData = [...freightsData, ...newFromRpc];
            }
          } catch (rpcError) {
            console.warn('⚠️ RPC falhou (não bloqueante):', rpcError);
          }
          
          console.log('📦 [MOTORISTA] Total final de fretes agendados:', freightsData.length,
            'IDs:', freightsData.map((f: any) => `${f.id.slice(0,8)}(${f.pickup_date})`)
          );
          
        } else if (profile.role === 'TRANSPORTADORA') {
          const result: any = await supabase
            .from('freights')
            .select('*')
            .eq('company_id', profile.id)
            .or(`pickup_date.gte.${todayStr},scheduled_date.gte.${todayStr}`)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          const allFreights = result.data || [];
          console.log('📊 [TRANSPORTADORA] Total buscado:', allFreights.length);
          
          // Filtrar com helper isScheduledFreight e excluir finais
          freightsData = allFreights.filter((f: any) => 
            !FINAL_STATUSES.includes(f.status) && 
            isScheduledFreight(f.pickup_date || f.scheduled_date, f.status)
          );
          console.log('✅ [TRANSPORTADORA] Após filtro scheduled:', freightsData.length,
            'IDs:', freightsData.map(f => `${f.id.slice(0,8)}(${f.pickup_date})`));
          
        } else {
          const result: any = await supabase
            .from('freights')
            .select('*')
            .or(`pickup_date.gte.${todayStr},scheduled_date.gte.${todayStr}`)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          const allFreights = result.data || [];
          console.log('📊 [OUTRO] Total buscado:', allFreights.length);
          
          freightsData = allFreights.filter((f: any) => 
            !FINAL_STATUSES.includes(f.status) && 
            isScheduledFreight(f.pickup_date || f.scheduled_date, f.status)
          );
          console.log('✅ [OUTRO] Após filtro scheduled:', freightsData.length);
        }
        
        console.log('✅ [AGENDADOS] Fretes carregados:', {
          total: freightsData.length,
          ids: freightsData.map((f: any) => f.id),
          dates: freightsData.map((f: any) => ({ id: f.id, pickup_date: f.pickup_date, status: f.status }))
        });

        // ✅ Deduplicate by ID before enriching
        const dedupedFreights = Array.from(
          new Map(freightsData.map((f: any) => [f.id, f])).values()
        );
        // ✅ Enriquecer com dados dos participantes (produtor/motorista)
        const enrichedFreights = await enrichFreightsWithParticipants(dedupedFreights, profile);
        setScheduledFreights(enrichedFreights);
      } catch (queryError) {
        console.error('Erro na query de agendados:', queryError);
        throw queryError;
      }
    } catch (error) {
      console.error('Erro ao buscar fretes agendados:', error);
      toast.error('Erro ao carregar fretes');
      // Definir array vazio em caso de erro
      setScheduledFreights([]);
    } finally {
      setLoading(false);
    }
  };


  const openEditModal = (freight: ScheduledFreight) => {
    setSelectedFreight(freight);
    setEditModalOpen(true);
  };

  const confirmCancelFreight = (freight: ScheduledFreight) => {
    setSelectedFreight(freight);
    setCancelDialogOpen(true);
  };

  const handleCancelFreight = async () => {
    if (!selectedFreight?.id) return;

    try {
      const { data, error } = await supabase.functions.invoke('cancel-freight-safe', {
        body: {
          freight_id: selectedFreight.id,
          reason: 'Cancelado'
        }
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'Erro ao cancelar');

      toast.success('Frete cancelado com sucesso');
      fetchScheduledFreights();
      setCancelDialogOpen(false);
    } catch (error) {
      console.error('Erro ao cancelar frete:', error);
      toast.error('Erro ao cancelar frete');
    }
  };

  const filteredFreights = scheduledFreights.filter(freight =>
    freight.origin_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    freight.destination_address.toLowerCase().includes(searchTerm.toLowerCase()) ||
    freight.cargo_type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadge = (status: string) => {
    // For proposals, use proposal status translations
    return <Badge variant={getFreightStatusVariant(status)}>{getProposalStatusLabel(status)}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Fretes Agendados
              </CardTitle>
              <CardDescription>
                {profile?.role === 'PRODUTOR' 
                  ? 'Gerencie seus fretes agendados e propostas recebidas'
                  : 'Encontre fretes agendados e faça suas propostas'
                }
              </CardDescription>
            </div>
            
            {profile?.role === 'PRODUTOR' && (
              <Button onClick={() => setCreateModalOpen(true)} className="gradient-primary">
                <Plus className="mr-2 h-4 w-4" />
                Agendar Frete
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-4">
              {/* Busca e Filtros de Urgência */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="flex-1 relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Buscar por origem, destino ou tipo de carga..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>

                {/* Filtros de Urgência - Responsivo */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Filter className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Urgência:</span>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant={urgencyFilter === 'all' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUrgencyFilter('all')}
                      className="text-xs sm:text-sm"
                    >
                      Todos ({filteredFreights.length})
                    </Button>
                    <Button
                      variant={urgencyFilter === 'today' ? 'destructive' : 'outline'}
                      size="sm"
                      onClick={() => setUrgencyFilter('today')}
                      className="text-xs sm:text-sm"
                    >
                      🔴 Hoje ({filteredFreights.filter(f => {
                        const days = getDaysUntilPickup(getEffectiveDate(f));
                        return days === 0;
                      }).length})
                    </Button>
                    <Button
                      variant={urgencyFilter === 'tomorrow' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setUrgencyFilter('tomorrow')}
                      className={`text-xs sm:text-sm ${urgencyFilter === 'tomorrow' ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                    >
                      ⚠️ Amanhã ({filteredFreights.filter(f => {
                        const days = getDaysUntilPickup(getEffectiveDate(f));
                        return days === 1;
                      }).length})
                    </Button>
                    <Button
                      variant={urgencyFilter === 'near' ? 'secondary' : 'outline'}
                      size="sm"
                      onClick={() => setUrgencyFilter('near')}
                      className="text-xs sm:text-sm"
                    >
                      📅 2-3 dias ({filteredFreights.filter(f => {
                        const days = getDaysUntilPickup(getEffectiveDate(f));
                        return days !== null && days >= 2 && days <= 3;
                      }).length})
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lista de Fretes */}
              <div className="grid gap-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando fretes...
                  </div>
                ) : (() => {
                  // Aplicar filtros de urgência
                  const urgencyFiltered = filteredFreights.filter(freight => {
                    if (urgencyFilter === 'all') return true;
                    const days = getDaysUntilPickup(getEffectiveDate(freight));
                    if (days === null) return false;
                    if (urgencyFilter === 'today') return days === 0;
                    if (urgencyFilter === 'tomorrow') return days === 1;
                    if (urgencyFilter === 'near') return days >= 2 && days <= 3;
                    return true;
                  });

                  // Ordenar por urgência (mais urgente primeiro)
                  const sortedFreights = [...urgencyFiltered].sort((a, b) => {
                    const daysA = getDaysUntilPickup(getEffectiveDate(a)) ?? 999;
                    const daysB = getDaysUntilPickup(getEffectiveDate(b)) ?? 999;
                    return daysA - daysB;
                  });

                  return sortedFreights.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      {urgencyFilter === 'all' 
                        ? (searchTerm ? 'Nenhum frete encontrado com os filtros aplicados' : 'Nenhum frete agendado encontrado')
                        : urgencyFilter === 'today'
                        ? 'Não há fretes com coleta agendada para hoje.'
                        : urgencyFilter === 'tomorrow'
                        ? 'Não há fretes com coleta agendada para amanhã.'
                        : 'Não há fretes com coleta agendada para 2-3 dias.'}
                    </div>
                  ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                      {sortedFreights.map((freight) => (
                        <ScheduledFreightCard
                          key={freight.id}
                          freight={freight}
                          userRole={profile?.role as 'PRODUTOR' | 'MOTORISTA' | 'MOTORISTA_AFILIADO'}
                          userProfileId={profile?.id || ''}
                          currentUserProfile={profile}
                          onWithdraw={(freightId) => {
                            // Lógica de desistência do frete
                            const freightToCancel = scheduledFreights.find(f => f.id === freightId);
                            if (freightToCancel) {
                              confirmCancelFreight(freightToCancel);
                            }
                          }}
                        />
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Modais */}
        <ScheduledFreightModal
          isOpen={createModalOpen}
          onClose={() => setCreateModalOpen(false)}
          onSuccess={() => {
            fetchScheduledFreights();
            setCreateModalOpen(false);
          }}
        />

        <EditFreightModal
          isOpen={editModalOpen}
          onClose={() => setEditModalOpen(false)}
          freight={selectedFreight}
          onSuccess={() => {
            fetchScheduledFreights();
            setEditModalOpen(false);
          }}
        />

        <ConfirmDialog
          isOpen={cancelDialogOpen}
          onClose={() => setCancelDialogOpen(false)}
          onConfirm={handleCancelFreight}
          title="Cancelar frete"
          description="Tem certeza que deseja cancelar este frete? Essa ação não pode ser desfeita."
          confirmText="Cancelar frete"
          cancelText="Voltar"
          variant="destructive"
        />
      </div>
    );
  };