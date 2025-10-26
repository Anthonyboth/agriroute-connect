import React, { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ServiceProposalModal } from './ServiceProposalModal';
import { CompanyBulkFreightAcceptor } from './CompanyBulkFreightAcceptor';
import { ShareFreightToCompany } from './ShareFreightToCompany';
import { CompanyDriverSelectModal } from './CompanyDriverSelectModal';
import { Separator } from '@/components/ui/separator';
import { getFreightStatusLabel, getFreightStatusVariant } from '@/lib/freight-status';
import { 
  MapPin, 
  Package, 
  Truck, 
  Calendar, 
  DollarSign, 
  Clock,
  Eye,
  FileText,
  ArrowRight,
  Wrench,
  Home,
  Edit,
  X,
  MessageCircle
} from 'lucide-react';
import { getCargoTypeLabel } from '@/lib/cargo-types';
import { getUrgencyLabel, getUrgencyVariant } from '@/lib/urgency-labels';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { toast } from 'sonner';

interface FreightCardProps {
  freight: {
    id: string;
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
    urgency: 'LOW' | 'MEDIUM' | 'HIGH';
    status: 'OPEN' | 'IN_TRANSIT' | 'DELIVERED' | 'IN_NEGOTIATION' | 'ACCEPTED' | 'CANCELLED' | 'LOADING' | 'LOADED';
    distance_km: number;
    minimum_antt_price: number;
    service_type?: 'CARGA' | 'GUINCHO' | 'MUDANCA' | 'FRETE_MOTO';
    required_trucks?: number;
    accepted_trucks?: number;
  };
  onAction?: (action: 'propose' | 'accept' | 'complete' | 'edit' | 'cancel' | 'request-cancel') => void;
  showActions?: boolean;
  showProducerActions?: boolean;
  hidePrice?: boolean;
  canAcceptFreights?: boolean;
  isAffiliatedDriver?: boolean;
  driverCompanyId?: string;
}

export const FreightCard: React.FC<FreightCardProps> = ({ 
  freight, 
  onAction, 
  showActions = false, 
  showProducerActions = false,
  hidePrice = false,
  canAcceptFreights = true,
  isAffiliatedDriver = false,
  driverCompanyId
}) => {
  const [proposalModalOpen, setProposalModalOpen] = useState(false);
  const [bulkAcceptorOpen, setBulkAcceptorOpen] = useState(false);
  const [driverSelectModalOpen, setDriverSelectModalOpen] = useState(false);
  const { profile } = useAuth();
  const { company, drivers } = useTransportCompany();
  
  // Verificar se o frete está com vagas completas
  const isFullyBooked = (freight.required_trucks || 1) <= (freight.accepted_trucks || 0);
  const availableSlots = (freight.required_trucks || 1) - (freight.accepted_trucks || 0);
  
  const urgencyVariant = getUrgencyVariant(freight.urgency);
  const urgencyLabel = getUrgencyLabel(freight.urgency);

  const isTransportCompany = profile?.role === 'TRANSPORTADORA';

  const handleAcceptFreight = async (numTrucks = 1) => {
    // ✅ Se é transportadora E não tem driverId pré-definido, abrir modal de seleção
    if (isTransportCompany && !driverCompanyId) {
      if (!drivers || drivers.length === 0) {
        toast.error('Cadastre um motorista para aceitar fretes como transportadora');
        return;
      }
      setDriverSelectModalOpen(true);
      return;
    }

    try {
      // Primeiro: verificar se o solicitante tem cadastro
      const { data: checkData, error: checkError } = await supabase.functions.invoke(
        'check-freight-requester',
        {
          body: { freight_id: freight.id }
        }
      );

      if (checkError) {
        console.error('Error checking requester:', checkError);
        toast.error("Erro ao verificar solicitante");
        return;
      }

      // Se solicitante não tem cadastro, mostrar mensagem e não aceitar
      if (checkData?.has_registration === false) {
        toast.error("O solicitante não possui cadastro. Este frete foi movido para o histórico.");
        // Aguardar um pouco e recarregar para refletir mudança
        setTimeout(() => {
          onAction?.('accept'); // Trigger refresh/tab change
        }, 1500);
        return;
      }

      // Se tem cadastro, proceder com aceite normal
      const { data, error } = await supabase.functions.invoke(
        'accept-freight-multiple',
        {
          body: { 
            freight_id: freight.id,
            num_trucks: numTrucks
          }
        }
      );

      if (error) {
        // Extract user-friendly message from edge function response
        const errorMsg = (error as any)?.context?.response?.error 
          || (error as any)?.message 
          || 'Não foi possível aceitar o frete';
        toast.error(errorMsg);
        return;
      }

      const label = freight.service_type === 'FRETE_MOTO' ? 'frete' : 'carreta';
      toast.success(
        `${numTrucks} ${label}${numTrucks > 1 ? 's' : ''} aceita${numTrucks > 1 ? 's' : ''} com sucesso!`
      );

      onAction?.('accept');
    } catch (error: any) {
      console.error('Error accepting freight:', error);
      const errorMessage = (error as any)?.context?.response?.error 
        || error?.message 
        || error?.error 
        || "Erro ao aceitar frete";
      toast.error(errorMessage);
    }
  };

  // ✅ Handler para aceite via transportadora (com driver selecionado)
  const handleCompanyAcceptWithDriver = async (selectedDriverId: string) => {
    if (!company?.id) {
      toast.error('Informações da empresa não encontradas');
      return;
    }

    try {
      // Buscar dados do frete para garantir valores corretos
      const { data: freightData, error: freightError } = await supabase
        .from('freights')
        .select('*')
        .eq('id', freight.id)
        .single();

      if (freightError || !freightData) {
        toast.error('Erro ao buscar dados do frete');
        return;
      }

      // Verificar se frete ainda está disponível
      if (freightData.status !== 'OPEN') {
        toast.error('Este frete não está mais disponível');
        return;
      }

      // ✅ CRÍTICO: Criar assignment COM company_id E driver_id
      const { error: assignmentError } = await supabase
        .from('freight_assignments')
        .upsert({
          freight_id: freight.id,
          driver_id: selectedDriverId,
          company_id: company.id, // ✅ ESSENCIAL
          status: 'ACCEPTED',
          accepted_at: new Date().toISOString(),
          agreed_price: freightData.price,
          pricing_type: 'FIXED',
          minimum_antt_price: freightData.minimum_antt_price || 0
        }, {
          onConflict: 'freight_id,driver_id'
        });

      if (assignmentError) throw assignmentError;

      // Atualizar status do frete
      const { error: updateError } = await supabase
        .from('freights')
        .update({
          status: 'ACCEPTED',
          driver_id: selectedDriverId,
          company_id: company.id, // ✅ ESSENCIAL
          accepted_trucks: (freightData.accepted_trucks || 0) + 1
        })
        .eq('id', freight.id);

      if (updateError) throw updateError;

      toast.success('✅ Frete aceito com sucesso!', {
        description: 'O frete aparecerá na aba "Em Andamento"'
      });

      // ✅ Disparar evento para navegação
      window.dispatchEvent(new CustomEvent('navigate-to-tab', { detail: 'active' }));
      
      onAction?.('accept');
    } catch (error: any) {
      console.error('Error accepting freight:', error);
      toast.error(error?.message || 'Erro ao aceitar frete');
    }
  };

  // Icon based on service type
  const getServiceIcon = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-5 w-5 text-warning" />;
      case 'MUDANCA':
        return <Home className="h-5 w-5 text-accent" />;
      case 'FRETE_MOTO':
        return <Truck className="h-5 w-5 text-blue-500" />;
      default:
        return <Package className="h-5 w-5 text-primary" />;
    }
  };

  // Service type label
  const getServiceLabel = () => {
    switch (freight.service_type) {
      case 'GUINCHO':
        return 'Guincho';
      case 'MUDANCA':
        return 'Mudança';
      case 'FRETE_MOTO':
        return 'Frete Moto';
      default:
        return 'Carga';
    }
  };

  return (
    <Card className="freight-card-standard hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 border-border/60">
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="flex flex-col space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 flex-1 min-w-0">
              {getServiceIcon()}
              <h3 className="font-semibold text-foreground truncate text-base">
                {getCargoTypeLabel(freight.cargo_type)}
              </h3>
            </div>
            <div className="flex items-center space-x-2 flex-shrink-0">
              <Badge variant={urgencyVariant} className="text-xs font-medium">
                {urgencyLabel}
              </Badge>
              <Badge variant={getFreightStatusVariant(freight.status)} className="text-xs font-medium">
                {getFreightStatusLabel(freight.status)}
              </Badge>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <Badge variant="outline" className="text-xs bg-secondary/30">
              {getServiceLabel()}
            </Badge>
            <div className="flex items-center space-x-3 text-xs">
              {freight.service_type === 'GUINCHO' ? (
                <span className="text-muted-foreground">Reboque</span>
              ) : freight.service_type === 'MUDANCA' ? (
                <span className="text-muted-foreground">Residencial</span>
              ) : (
                <span className="text-muted-foreground">{((freight.weight || 0) / 1000).toFixed(1)}t</span>
              )}
              <span className="text-muted-foreground">{freight.distance_km} km</span>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 flex-1 overflow-y-auto">
        {/* Carretas Info */}
        {(freight.required_trucks && freight.required_trucks > 1) && (
          <div className="flex flex-col gap-2 p-2 bg-secondary/20 rounded-lg border border-border/40">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <Truck className="h-3 w-3" />
                <span className="text-xs font-medium">Carretas:</span>
              </div>
              <span className={`font-semibold text-sm ${isFullyBooked ? 'text-success' : 'text-primary'}`}>
                {freight.accepted_trucks || 0}/{freight.required_trucks}
              </span>
            </div>
            
            <div className="flex flex-wrap items-center gap-2">
              {availableSlots > 0 && (
                <Badge variant="outline" className="text-green-600 border-green-600 animate-pulse text-xs">
                  {availableSlots} {availableSlots === 1 ? 'vaga disponível' : 'vagas disponíveis'}!
                </Badge>
              )}
              
              {isFullyBooked && (
                <Badge variant="default" className="text-xs bg-success text-success-foreground">
                  Completo
                </Badge>
              )}
            </div>
          </div>
        )}

        {/* Origem e Destino */}
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1">
              <MapPin className="h-3 w-3 text-primary" />
              Origem
            </p>
            {freight.origin_city && freight.origin_state && (
              <p className="text-sm font-bold text-primary pl-4">
                {freight.origin_city.toUpperCase()} - {freight.origin_state.toUpperCase()}
              </p>
            )}
            <p className="text-xs text-muted-foreground pl-4 line-clamp-1">{freight.origin_address}</p>
          </div>
          
          <div className="space-y-1">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1">
              <ArrowRight className="h-3 w-3 text-accent" />
              Destino
            </p>
            {freight.destination_city && freight.destination_state && (
              <p className="text-sm font-bold text-primary pl-4">
                {freight.destination_city.toUpperCase()} - {freight.destination_state.toUpperCase()}
              </p>
            )}
            <p className="text-xs text-muted-foreground pl-4 line-clamp-1">{freight.destination_address}</p>
          </div>
        </div>

        {/* Datas */}
        <div className="grid grid-cols-2 gap-2">
          <div className="space-y-1 p-2 bg-gradient-to-br from-secondary/30 to-secondary/10 rounded-lg border border-border/40">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3 text-primary" />
              <span className="text-xs font-medium">Coleta</span>
            </div>
            <p className="font-semibold text-foreground text-xs">
              {new Date(freight.pickup_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div className="space-y-1 p-2 bg-gradient-to-br from-accent/20 to-accent/5 rounded-lg border border-border/40">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-3 w-3 text-accent" />
              <span className="text-xs font-medium">Entrega</span>
            </div>
            <p className="font-semibold text-foreground text-xs">
              {new Date(freight.delivery_date).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </CardContent>

      {!hidePrice && (
        <CardFooter className="pt-3 pb-3 flex-shrink-0 mt-auto">
          <div className="flex items-center justify-between w-full p-3 bg-gradient-to-r from-primary/5 to-accent/5 rounded-lg border border-border/50">
            <div className="text-left">
              <p className="font-bold text-xl text-primary">R$ {(freight.price || 0).toLocaleString('pt-BR')}</p>
              {freight.service_type === 'FRETE_MOTO' ? (
                <p className="text-xs text-blue-600 dark:text-blue-400 font-medium">
                  Mínimo: R$ 10,00
                </p>
              ) : freight.service_type === 'CARGA' && (
                freight.minimum_antt_price && freight.minimum_antt_price > 0 ? (
                  <Badge variant="outline" className="text-xs">
                    Mín. ANTT: R$ {freight.minimum_antt_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </Badge>
                ) : (
                  <Badge variant="destructive" className="text-xs">
                    ⚠️ ANTT não calculado
                  </Badge>
                )
              )}
            </div>
            <div className="text-right">
              <DollarSign className="h-6 w-6 text-accent ml-auto" />
            </div>
          </div>
        </CardFooter>
      )}

      {showActions && onAction && freight.status === 'OPEN' && !isFullyBooked && (
        <div className="px-6 pb-6">
          {isAffiliatedDriver && !canAcceptFreights ? (
            // ✅ Motorista afiliado SEM permissão: apenas compartilhar com transportadora
            <ShareFreightToCompany 
              freight={freight}
              companyId={driverCompanyId}
              driverProfile={profile}
            />
          ) : (
            <div className="space-y-3">
              {/* Botões de aceitar e contraproposta (para quem pode aceitar) */}
              {canAcceptFreights && (
                freight.service_type === 'GUINCHO' ? (
                  <Button 
                    onClick={() => handleAcceptFreight(1)}
                    className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                    size="sm"
                  >
                    <Wrench className="mr-2 h-4 w-4" />
                    Aceitar Chamado
                  </Button>
                ) : freight.service_type === 'MUDANCA' ? (
                  <Button 
                    onClick={() => handleAcceptFreight(1)}
                    className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                    size="sm"
                  >
                    <Home className="mr-2 h-4 w-4" />
                    Aceitar Mudança
                  </Button>
                ) : freight.service_type === 'FRETE_MOTO' ? (
                  <Button 
                    onClick={() => handleAcceptFreight(1)}
                    className="w-full gradient-primary hover:shadow-lg transition-all duration-300"
                    size="sm"
                  >
                    <Truck className="mr-2 h-4 w-4" />
                    Aceitar Frete por Moto
                  </Button>
                ) : isTransportCompany && freight.required_trucks && freight.required_trucks > 1 ? (
                  <div className="flex flex-col sm:flex-row gap-3">
                    <Button 
                      onClick={() => setBulkAcceptorOpen(true)}
                      className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
                    >
                      Aceitar ({availableSlots} vagas)
                    </Button>
                    <Button 
                      onClick={() => setProposalModalOpen(true)}
                      className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                      variant="outline"
                    >
                      Contra proposta
                    </Button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <Button 
                      onClick={() => handleAcceptFreight(1)}
                      className="flex-1 gradient-primary hover:shadow-lg transition-all duration-300"
                      size="sm"
                    >
                      Aceitar Frete
                    </Button>
                    <Button 
                      onClick={() => setProposalModalOpen(true)}
                      className="flex-1 border-2 border-primary/20 hover:border-primary/40 hover:bg-primary/5"
                      size="sm"
                      variant="outline"
                    >
                      Contra proposta
                    </Button>
                  </div>
                )
              )}
              
              {/* Botão de compartilhar - SEMPRE aparece para motoristas afiliados */}
              {isAffiliatedDriver && driverCompanyId && (
                <ShareFreightToCompany 
                  freight={freight}
                  companyId={driverCompanyId}
                  driverProfile={profile}
                />
              )}
            </div>
          )}
        </div>
      )}

      {showActions && isFullyBooked && (
        <div className="px-6 pb-6">
          <Button disabled className="w-full" size="sm" variant="secondary">
            Frete Completo - Sem Vagas
          </Button>
        </div>
      )}

      {/* Producer Actions */}
      {showProducerActions && onAction && freight.status !== 'CANCELLED' && (
        <div className="px-6 pb-6">
          <div className="flex gap-2">
            <Button 
              onClick={() => onAction('edit')}
              className="flex-1"
              size="sm"
              variant="outline"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
            
            {/* Cancelamento direto para OPEN, ACCEPTED, LOADING */}
            {['OPEN', 'ACCEPTED', 'LOADING'].includes(freight.status) && (
              <Button 
                onClick={() => onAction('cancel')}
                className="flex-1"
                size="sm"
                variant="destructive"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
            
            {/* Solicitar cancelamento via chat para LOADED, IN_TRANSIT */}
            {['LOADED', 'IN_TRANSIT'].includes(freight.status) && (
              <Button 
                onClick={() => onAction('request-cancel')}
                className="flex-1 border-destructive text-destructive hover:bg-destructive/10"
                size="sm"
                variant="outline"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Solicitar Cancelamento
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Mensagem para fretes cancelados */}
      {showProducerActions && freight.status === 'CANCELLED' && (
        <div className="px-6 pb-6">
          <div className="text-center p-3 bg-red-50 dark:bg-red-900/20 rounded-lg">
            <p className="text-sm text-red-600 dark:text-red-400">
              Fretes cancelados não podem ser editados
            </p>
          </div>
        </div>
      )}

      {/* Service Proposal Modal */}
      <ServiceProposalModal
        isOpen={proposalModalOpen}
        onClose={() => setProposalModalOpen(false)}
        freight={freight}
        originalProposal={freight.service_type === 'CARGA' || !freight.service_type ? {
          id: freight.id,
          proposed_price: freight.price,
          message: 'Proposta do produtor',
          driver_name: 'Produtor'
        } : undefined}
        onSuccess={() => {
          setProposalModalOpen(false);
          if (onAction) onAction('propose');
        }}
      />

      {/* Company Bulk Freight Acceptor Modal */}
      <CompanyBulkFreightAcceptor
        open={bulkAcceptorOpen}
        onOpenChange={setBulkAcceptorOpen}
        freight={freight}
        onAccept={handleAcceptFreight}
      />

      {/* Driver Selection Modal for Transport Companies */}
      <CompanyDriverSelectModal
        isOpen={driverSelectModalOpen}
        onClose={() => setDriverSelectModalOpen(false)}
        drivers={(drivers || []).filter(d => d.status === 'ACTIVE' || d.status === 'APPROVED').map(d => ({
          id: d.driver.id,
          full_name: d.driver.full_name,
          status: d.status
        }))}
        onSelectDriver={handleCompanyAcceptWithDriver}
        freight={{
          cargo_type: getCargoTypeLabel(freight.cargo_type),
          origin_address: freight.origin_address,
          destination_address: freight.destination_address,
          price: freight.price
        }}
      />
    </Card>
  );
};
export default FreightCard;