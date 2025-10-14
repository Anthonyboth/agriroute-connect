import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Calendar, CalendarIcon, Clock, MapPin, Package, Plus, Search, Filter } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { getFreightStatusLabel, getFreightStatusVariant, getProposalStatusLabel } from '@/lib/freight-status';
import { ScheduledFreightModal } from './ScheduledFreightModal';
import { FlexibleProposalModal } from './FlexibleProposalModal';
import { ProposalCounterModal } from './ProposalCounterModal';
import { EditFreightModal } from './EditFreightModal';
import { ConfirmDialog } from './ConfirmDialog';

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

interface FlexibleProposal {
  id: string;
  freight_id: string;
  driver_name?: string;
  proposed_date: string;
  original_date: string;
  days_difference: number;
  proposed_price?: number;
  message?: string;
  status: string;
  created_at: string;
}

export const ScheduledFreightsManager: React.FC = () => {
  const { profile } = useAuth();
  const [scheduledFreights, setScheduledFreights] = useState<ScheduledFreight[]>([]);
  const [flexibleProposals, setFlexibleProposals] = useState<FlexibleProposal[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [counterProposalModalOpen, setCounterProposalModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [selectedFreight, setSelectedFreight] = useState<any>(null);
  const [selectedProposal, setSelectedProposal] = useState<any>(null);

  useEffect(() => {
    if (profile) {
      fetchScheduledFreights();
      fetchFlexibleProposals();
    }
  }, [profile]);

  const fetchScheduledFreights = async () => {
    if (!profile) return;

    setLoading(true);
    try {
      // Adicionar timeout para evitar travamentos
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na busca de fretes')), 8000)
      );

      const fetchPromise = (async () => {
        let query = supabase
          .from('freights')
          .select(`
            *,
            producer:profiles!freights_producer_id_fkey(full_name)
          `)
          .eq('is_scheduled', true)
          .eq('status', 'OPEN')
          .order('scheduled_date', { ascending: true });

        if (profile.role === 'PRODUTOR') {
          query = query.eq('producer_id', profile.id);
        } else if (profile.role === 'MOTORISTA') {
          // Para motoristas, buscar fretes onde ele foi aceito pelo produtor
          query = query.eq('driver_id', profile.id);
        } else {
          // Para outros papéis, mostrar apenas fretes abertos
          query = query.eq('status', 'OPEN');
        }

        return await query;
      })();

      const { data, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;

      if (error) throw error;

      const formattedData = data?.map(freight => ({
        ...freight,
        producer_name: freight.producer?.full_name
      })) || [];

      setScheduledFreights(formattedData);
    } catch (error) {
      console.error('Erro ao buscar fretes agendados:', error);
      toast.error('Erro ao carregar fretes');
      // Definir array vazio em caso de erro
      setScheduledFreights([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchFlexibleProposals = async () => {
    if (!profile) return;

    try {
      // Adicionar timeout
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Timeout na busca de propostas')), 8000)
      );

      const fetchPromise = (async () => {
        let query = supabase
          .from('flexible_freight_proposals')
          .select('*')
          .neq('status', 'REJECTED')
          .order('created_at', { ascending: false });

        if (profile.role === 'PRODUTOR') {
          // Só buscar se tiver fretes agendados para evitar consultas desnecessárias
          if (scheduledFreights.length === 0) {
            return { data: [], error: null };
          }
          query = query.in('freight_id', scheduledFreights.map(f => f.id));
        } else {
          query = query.eq('driver_id', profile.id);
        }

        return await query;
      })();

      const { data: proposalsData, error } = await Promise.race([fetchPromise, timeoutPromise]) as any;
      if (error) throw error;

      if (!proposalsData || proposalsData.length === 0) {
        setFlexibleProposals([]);
        return;
      }

      // Buscar dados dos motoristas separadamente com timeout
      const driverIds = proposalsData.map(p => p.driver_id).filter(Boolean);
      if (driverIds.length === 0) {
        setFlexibleProposals(proposalsData.map(proposal => ({
          ...proposal,
          driver_name: 'Nome não disponível'
        })));
        return;
      }

      const driversPromise = supabase
        .from('profiles')
        .select('id, full_name')
        .in('id', driverIds);

      const { data: driversData } = await Promise.race([
        driversPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout motoristas')), 5000))
      ]) as any;

      const formattedData = proposalsData.map(proposal => ({
        ...proposal,
        driver_name: driversData?.find(d => d.id === proposal.driver_id)?.full_name || 'Nome não disponível'
      }));

      setFlexibleProposals(formattedData);
    } catch (error) {
      console.error('Erro ao buscar propostas flexíveis:', error);
      setFlexibleProposals([]);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('flexible_freight_proposals')
        .update({ status: 'ACCEPTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta aceita!');
      fetchFlexibleProposals();
    } catch (error: any) {
      console.error('Erro ao aceitar proposta:', error);
      toast.error('Erro ao aceitar proposta');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('flexible_freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      // Remove a proposta rejeitada imediatamente do estado local
      setFlexibleProposals(prev => prev.filter(proposal => proposal.id !== proposalId));

      toast.success('Proposta recusada');
    } catch (error: any) {
      console.error('Erro ao recusar proposta:', error);
      toast.error('Erro ao recusar proposta');
    }
  };

  const openProposalModal = (freight: ScheduledFreight) => {
    setSelectedFreight({
      id: freight.id,
      producer_name: freight.producer_name,
      origin_address: freight.origin_address,
      destination_address: freight.destination_address,
      scheduled_date: freight.scheduled_date,
      cargo_type: freight.cargo_type,
      weight: (freight.weight / 1000), // Convert kg to tonnes for display
      price: freight.price,
      flexible_dates: freight.flexible_dates,
      date_range_start: freight.date_range_start,
      date_range_end: freight.date_range_end,
      description: freight.description
    });
    setProposalModalOpen(true);
  };

  const openCounterProposalModal = (proposal: any) => {
    setSelectedProposal({
      id: proposal.freight_id, // ID do frete
      proposed_price: proposal.proposed_price || 0,
      message: proposal.message,
      driver_name: proposal.driver_name || 'Motorista'
    });
    
    // Encontrar o frete original para pegar o preço
    const originalFreight = scheduledFreights.find(f => f.id === proposal.freight_id);
    setSelectedFreight(originalFreight);
    setCounterProposalModalOpen(true);
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
      const { error } = await supabase
        .from('freights')
        .update({ status: 'CANCELLED' })
        .eq('id', selectedFreight.id);

      if (error) throw error;

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
          <Tabs defaultValue="freights" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="freights">
                Fretes {profile?.role === 'PRODUTOR' ? 'Criados' : 'Disponíveis'}
              </TabsTrigger>
              <TabsTrigger value="proposals">
                Propostas {profile?.role === 'PRODUTOR' ? 'Recebidas' : 'Enviadas'}
              </TabsTrigger>
            </TabsList>

            <TabsContent value="freights" className="space-y-4">
              {/* Busca */}
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
                <Button variant="outline">
                  <Filter className="mr-2 h-4 w-4" />
                  Filtros
                </Button>
              </div>

              {/* Lista de Fretes */}
              <div className="grid gap-4">
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando fretes...
                  </div>
                ) : filteredFreights.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {searchTerm ? 'Nenhum frete encontrado com os filtros aplicados' : 'Nenhum frete agendado encontrado'}
                  </div>
                ) : (
                  filteredFreights.map((freight) => (
                    <Card key={freight.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div className="space-y-1">
                            {freight.producer_name && (
                              <p className="font-semibold text-lg">{freight.producer_name}</p>
                            )}
                            <p className="text-muted-foreground">{freight.cargo_type} - {(freight.weight / 1000).toFixed(1)}t</p>
                          </div>
                          <Badge variant="secondary" className="text-lg px-3 py-1">
                            R$ {freight.price.toLocaleString()}
                          </Badge>
                        </div>

                        <div className="space-y-2 text-sm">
                          <div className="flex items-center gap-2">
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                            <span>{freight.origin_address} → {freight.destination_address}</span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            <span>{format(new Date(freight.scheduled_date), 'PPP', { locale: ptBR })}</span>
                            {freight.flexible_dates && (
                              <Badge variant="outline" className="text-xs">
                                Aceita datas alternativas
                              </Badge>
                            )}
                          </div>

                          {freight.flexible_dates && freight.date_range_start && freight.date_range_end && (
                            <div className="text-xs text-muted-foreground pl-6">
                              Período flexível: {format(new Date(freight.date_range_start), 'dd/MM')} a{' '}
                              {format(new Date(freight.date_range_end), 'dd/MM')}
                            </div>
                          )}
                        </div>

                        {freight.description && (
                          <p className="text-sm text-muted-foreground border-t pt-2">
                            {freight.description}
                          </p>
                        )}

                        <div className="flex justify-between items-center pt-2">
                          <Badge variant={getFreightStatusVariant(freight.status)}>
                            {getFreightStatusLabel(freight.status)}
                          </Badge>
                          
                          {profile?.role === 'PRODUTOR' && freight.status === 'OPEN' && (
                            <div className="flex gap-2">
                              <Button 
                                size="sm" 
                                variant="secondary"
                                onClick={() => openEditModal(freight)}
                              >
                                Editar
                              </Button>
                              <Button 
                                size="sm" 
                                variant="destructive"
                                onClick={() => confirmCancelFreight(freight)}
                              >
                                Cancelar
                              </Button>
                            </div>
                          )}
                          
                          {profile?.role === 'MOTORISTA' && freight.status === 'OPEN' && (
                            <Button 
                              size="sm" 
                              onClick={() => openProposalModal(freight)}
                              className="gradient-primary"
                            >
                              Contra proposta
                            </Button>
                          )}
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>

            <TabsContent value="proposals" className="space-y-4">
              <div className="grid gap-4">
                {flexibleProposals.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhuma proposta encontrada
                  </div>
                ) : (
                  flexibleProposals.map((proposal) => (
                    <Card key={proposal.id} className="p-4">
                      <div className="space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            {profile?.role === 'PRODUTOR' ? (
                              <p className="font-semibold">Proposta de {proposal.driver_name}</p>
                            ) : (
                              <p className="font-semibold">Sua proposta</p>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {format(new Date(proposal.created_at), 'PPP', { locale: ptBR })}
                            </p>
                          </div>
                          {getStatusBadge(proposal.status)}
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">Data original:</p>
                            <p>{format(new Date(proposal.original_date), 'PPP', { locale: ptBR })}</p>
                          </div>
                          <div>
                            <p className="font-medium">Data proposta:</p>
                            <p>{format(new Date(proposal.proposed_date), 'PPP', { locale: ptBR })}</p>
                            <p className="text-muted-foreground">
                              ({Math.abs(proposal.days_difference)} dias {proposal.days_difference > 0 ? 'depois' : 'antes'})
                            </p>
                          </div>
                        </div>

                        {proposal.proposed_price && (
                          <div className="text-sm">
                            <p className="font-medium">Valor proposto: R$ {proposal.proposed_price.toLocaleString()}</p>
                          </div>
                        )}

                        {proposal.message && (
                          <div className="text-sm border-t pt-2">
                            <p className="font-medium">Mensagem:</p>
                            <p className="text-muted-foreground">{proposal.message}</p>
                          </div>
                        )}

                        {profile?.role === 'PRODUTOR' && proposal.status === 'PENDING' && (
                          <div className="flex gap-2 pt-2">
                            <Button 
                              size="sm" 
                              onClick={() => handleAcceptProposal(proposal.id)}
                              className="gradient-primary"
                            >
                              Aceitar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="secondary"
                              onClick={() => openCounterProposalModal(proposal)}
                            >
                              Contra proposta
                            </Button>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => handleRejectProposal(proposal.id)}
                            >
                              Recusar
                            </Button>
                          </div>
                        )}
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </TabsContent>
          </Tabs>
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

      <FlexibleProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        freight={selectedFreight}
        onSuccess={() => {
          fetchFlexibleProposals();
          setProposalModalOpen(false);
        }}
      />

      <ProposalCounterModal
        isOpen={counterProposalModalOpen}
        onClose={() => setCounterProposalModalOpen(false)}
        originalProposal={selectedProposal}
        freightPrice={selectedFreight?.price || 0}
        freightDistance={selectedFreight?.distance_km || 0}
        onSuccess={() => {
          fetchFlexibleProposals();
          setCounterProposalModalOpen(false);
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