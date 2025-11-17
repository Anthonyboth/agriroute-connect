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

// Helper para obter data efetiva (scheduled_date ou pickup_date como fallback)
const getEffectiveDate = (freight: any): string | null => {
  return freight.scheduled_date || freight.pickup_date || null;
};

// Helper para calcular dias até a coleta
const getDaysUntilPickup = (pickupDate: string | null): number | null => {
  if (!pickupDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pickup = new Date(pickupDate);
  pickup.setHours(0, 0, 0, 0);
  
  const diffTime = pickup.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return diffDays;
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
        
        console.log('🔍 [AGENDADOS] Buscando fretes com pickup_date >= ', todayStr);
        
        // Queries completamente separadas com @ts-ignore para evitar problemas de inferência
        let freightsData: any[] = [];
        
        if (profile.role === 'PRODUTOR') {
          // @ts-ignore - TypeScript tem dificuldade com inferência profunda em queries condicionais
          const result: any = await supabase
            .from('freights')
            .select('*')
            .eq('producer_id', profile.id)
            .gte('pickup_date', todayStr)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          freightsData = result.data || [];
          
        } else if (profile.role === 'MOTORISTA' || profile.role === 'MOTORISTA_AFILIADO') {
          // @ts-ignore - TypeScript tem dificuldade com inferência profunda em queries condicionais
          const result: any = await supabase
            .from('freights')
            .select('*')
            .eq('driver_id', profile.id)
            .gte('pickup_date', todayStr)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          freightsData = result.data || [];
          
        } else if (profile.role === 'TRANSPORTADORA') {
          // @ts-ignore - TypeScript tem dificuldade com inferência profunda em queries condicionais
          const result: any = await supabase
            .from('freights')
            .select('*')
            .eq('company_id', profile.id)
            .gte('pickup_date', todayStr)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          freightsData = result.data || [];
          
        } else {
          // @ts-ignore - TypeScript tem dificuldade com inferência profunda em queries condicionais
          const result: any = await supabase
            .from('freights')
            .select('*')
            .gte('pickup_date', todayStr)
            .order('pickup_date', { ascending: true })
            .limit(100);
          
          if (result.error) throw result.error;
          freightsData = result.data || [];
        }
        
        // Filtrar status finalizados no lado do cliente
        const finalStatuses = ['CANCELLED', 'DELIVERED', 'COMPLETED', 'DELIVERED_PENDING_CONFIRMATION'];
        const filteredData = freightsData.filter((freight: any) => 
          !finalStatuses.includes(freight.status)
        );
        
        console.log('✅ [AGENDADOS] Fretes carregados:', {
          total: filteredData.length,
          totalBeforeFilter: freightsData.length,
          ids: filteredData.map((f: any) => f.id),
          dates: filteredData.map((f: any) => ({ id: f.id, pickup_date: f.pickup_date, status: f.status }))
        });

        setScheduledFreights(filteredData);
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
                <div className="flex gap-4">
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

                {/* Filtros de Urgência */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Filter className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground mr-2">Urgência:</span>
                  <Button
                    variant={urgencyFilter === 'all' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setUrgencyFilter('all')}
                  >
                    Todos ({filteredFreights.length})
                  </Button>
                    <Button
                    variant={urgencyFilter === 'today' ? 'destructive' : 'outline'}
                    size="sm"
                    onClick={() => setUrgencyFilter('today')}
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
                    className={urgencyFilter === 'tomorrow' ? 'bg-orange-600 hover:bg-orange-700' : ''}
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
                  >
                    📅 2-3 dias ({filteredFreights.filter(f => {
                      const days = getDaysUntilPickup(getEffectiveDate(f));
                      return days !== null && days >= 2 && days <= 3;
                    }).length})
                  </Button>
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