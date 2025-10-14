import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileText, CheckCircle, XCircle, Clock, DollarSign, User, Package, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  message?: string;
  status: string;
  created_at: string;
  freight: {
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    pickup_date: string;
    price: number;
    distance_km: number;
    producer_id: string;
  };
  driver: {
    full_name: string;
    rating?: number;
    contact_phone?: string;
  };
}

export const CompanyProposalsManager: React.FC = () => {
  const { company, drivers } = useTransportCompany();
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('pending');

  useEffect(() => {
    if (company?.id && drivers) {
      fetchProposals();
    }
  }, [company, drivers]);

  const fetchProposals = async () => {
    if (!company?.id || !drivers) return;

    try {
      // Buscar propostas dos motoristas afiliados
      const driverIds = drivers.filter(d => d.status === 'ACTIVE').map(d => d.driver_profile_id);
      
      if (driverIds.length === 0) {
        setProposals([]);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('freight_proposals')
        .select(`
          *,
          freight:freights(
            cargo_type,
            origin_address,
            destination_address,
            pickup_date,
            price,
            distance_km,
            producer_id
          ),
          driver:profiles!driver_id(
            full_name,
            rating,
            contact_phone
          )
        `)
        .in('driver_id', driverIds)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProposals(data || []);
    } catch (error) {
      console.error('Erro ao buscar propostas:', error);
      toast.error('Erro ao carregar propostas');
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptProposal = async (proposalId: string) => {
    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'ACCEPTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta aceita com sucesso!');
      fetchProposals();
    } catch (error) {
      console.error('Erro ao aceitar proposta:', error);
      toast.error('Erro ao aceitar proposta');
    }
  };

  const handleRejectProposal = async (proposalId: string) => {
    if (!confirm('Tem certeza que deseja rejeitar esta proposta?')) return;

    try {
      const { error } = await supabase
        .from('freight_proposals')
        .update({ status: 'REJECTED' })
        .eq('id', proposalId);

      if (error) throw error;

      toast.success('Proposta rejeitada');
      fetchProposals();
    } catch (error) {
      console.error('Erro ao rejeitar proposta:', error);
      toast.error('Erro ao rejeitar proposta');
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { label: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
      PENDING: { label: 'Pendente', variant: 'outline' },
      ACCEPTED: { label: 'Aceita', variant: 'default' },
      REJECTED: { label: 'Rejeitada', variant: 'destructive' },
      CANCELLED: { label: 'Cancelada', variant: 'secondary' }
    };

    const { label, variant } = statusMap[status] || { label: status, variant: 'outline' as const };
    return <Badge variant={variant}>{label}</Badge>;
  };

  const filterProposals = (status: string) => {
    if (status === 'pending') return proposals.filter(p => p.status === 'PENDING');
    if (status === 'accepted') return proposals.filter(p => p.status === 'ACCEPTED');
    if (status === 'rejected') return proposals.filter(p => p.status === 'REJECTED' || p.status === 'CANCELLED');
    return proposals;
  };

  const renderProposalCard = (proposal: Proposal) => {
    const priceDiff = proposal.proposed_price - proposal.freight.price;
    const isCounter = priceDiff !== 0;

    return (
      <Card key={proposal.id} className="border-l-4 border-l-blue-500">
        <CardContent className="p-4">
          <div className="space-y-4">
            {/* Header */}
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-muted-foreground" />
                  <span className="font-semibold">{proposal.driver.full_name}</span>
                  {proposal.driver.rating && (
                    <Badge variant="outline" className="text-xs">
                      ⭐ {proposal.driver.rating.toFixed(1)}
                    </Badge>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  Enviada {formatDistanceToNow(new Date(proposal.created_at), { 
                    addSuffix: true, 
                    locale: ptBR 
                  })}
                </p>
              </div>
              {getStatusBadge(proposal.status)}
            </div>

            {/* Frete Info */}
            <div className="bg-muted/30 p-3 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{proposal.freight.cargo_type}</span>
              </div>
              <div className="text-sm space-y-1">
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-green-600 mt-0.5" />
                  <span className="text-muted-foreground flex-1">{proposal.freight.origin_address}</span>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-3 w-3 text-red-600 mt-0.5" />
                  <span className="text-muted-foreground flex-1">{proposal.freight.destination_address}</span>
                </div>
              </div>
            </div>

            {/* Valores */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-muted-foreground">Valor Original</p>
                <p className="text-lg font-semibold">
                  R$ {proposal.freight.price.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Valor Proposto</p>
                <p className={`text-lg font-semibold ${isCounter ? (priceDiff > 0 ? 'text-red-600' : 'text-green-600') : ''}`}>
                  R$ {proposal.proposed_price.toLocaleString('pt-BR', {
                    minimumFractionDigits: 2
                  })}
                  {isCounter && (
                    <span className="text-sm ml-2">
                      ({priceDiff > 0 ? '+' : ''}R$ {Math.abs(priceDiff).toFixed(2)})
                    </span>
                  )}
                </p>
              </div>
            </div>

            {/* Mensagem */}
            {proposal.message && (
              <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
                <p className="text-sm text-blue-900">{proposal.message}</p>
              </div>
            )}

            {/* Ações */}
            {proposal.status === 'PENDING' && (
              <div className="flex gap-2 pt-2">
                <Button
                  variant="default"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleAcceptProposal(proposal.id)}
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Aceitar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => handleRejectProposal(proposal.id)}
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Rejeitar
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">Carregando propostas...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Gestão de Propostas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Estatísticas */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-yellow-50 rounded-lg">
              <Clock className="h-6 w-6 mx-auto mb-2 text-yellow-600" />
              <div className="text-2xl font-bold text-yellow-600">
                {proposals.filter(p => p.status === 'PENDING').length}
              </div>
              <div className="text-sm text-muted-foreground">Pendentes</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <CheckCircle className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-600">
                {proposals.filter(p => p.status === 'ACCEPTED').length}
              </div>
              <div className="text-sm text-muted-foreground">Aceitas</div>
            </div>
            <div className="text-center p-4 bg-red-50 rounded-lg">
              <XCircle className="h-6 w-6 mx-auto mb-2 text-red-600" />
              <div className="text-2xl font-bold text-red-600">
                {proposals.filter(p => p.status === 'REJECTED').length}
              </div>
              <div className="text-sm text-muted-foreground">Rejeitadas</div>
            </div>
            <div className="text-center p-4 bg-primary/5 rounded-lg">
              <DollarSign className="h-6 w-6 mx-auto mb-2 text-primary" />
              <div className="text-2xl font-bold text-primary">
                R$ {(proposals
                  .filter(p => p.status === 'ACCEPTED')
                  .reduce((sum, p) => sum + p.proposed_price, 0) / 1000
                ).toFixed(1)}k
              </div>
              <div className="text-sm text-muted-foreground">Total Aceito</div>
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pendentes</TabsTrigger>
              <TabsTrigger value="accepted">Aceitas</TabsTrigger>
              <TabsTrigger value="rejected">Rejeitadas</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="space-y-4">
              {filterProposals('pending').length === 0 ? (
                <div className="text-center py-12">
                  <Clock className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma proposta pendente</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('pending').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="accepted" className="space-y-4">
              {filterProposals('accepted').length === 0 ? (
                <div className="text-center py-12">
                  <CheckCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma proposta aceita ainda</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('accepted').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>

            <TabsContent value="rejected" className="space-y-4">
              {filterProposals('rejected').length === 0 ? (
                <div className="text-center py-12">
                  <XCircle className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
                  <p className="text-muted-foreground">Nenhuma proposta rejeitada</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {filterProposals('rejected').map(renderProposalCard)}
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};
