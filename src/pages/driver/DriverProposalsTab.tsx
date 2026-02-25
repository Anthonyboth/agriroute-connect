import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { FreightCard } from '@/components/FreightCard';
import { SafeListWrapper } from '@/components/SafeListWrapper';
import { Brain, DollarSign, CheckCircle } from 'lucide-react';
import { normalizeServiceType } from '@/lib/service-type-normalization';
import { getPricePerTruck, formatPricePerTruck } from '@/lib/proposal-utils';
import type { Proposal } from './types';

interface DriverProposalsTabProps {
  proposals: Proposal[];
  onProposalClick: (proposal: Proposal) => void;
}

export const DriverProposalsTab: React.FC<DriverProposalsTabProps> = ({
  proposals,
  onProposalClick,
}) => {
  const pendingProposals = proposals.filter(p => 
    (p.status === 'PENDING' || p.status === 'COUNTER_PROPOSED') &&
    Boolean((p.freight as any)?.producer_id || (p.freight as any)?.producer?.id)
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold">Minhas Propostas Enviadas</h3>
        <Badge variant="secondary" className="text-sm font-medium">
          {pendingProposals.length} proposta{pendingProposals.length !== 1 ? 's' : ''}
        </Badge>
      </div>
      
      {pendingProposals.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3">
          <SafeListWrapper fallback={<div className="p-4 text-sm text-muted-foreground animate-pulse">Atualizando propostas...</div>}>
            {pendingProposals.map((proposal) => 
              proposal.freight && proposal.id ? (
                <div 
                  key={proposal.id} 
                  className="relative cursor-pointer"
                  role="button"
                  tabIndex={0}
                  onClick={() => onProposalClick(proposal)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      onProposalClick(proposal);
                    }
                  }}
                >
                   <FreightCard 
                     freight={{
                       ...proposal.freight,
                       status: proposal.freight.status as 'OPEN' | 'IN_TRANSIT' | 'DELIVERED',
                       service_type: proposal.freight.service_type 
                         ? normalizeServiceType(proposal.freight.service_type) 
                         : undefined
                     }}
                    showActions={false}
                  />
                  
                  {/* Informações compactas da proposta - valor UNITÁRIO */}
                  {(() => {
                    const driverTotal = proposal.proposed_price;
                    const driverUnitPrice = proposal.proposal_unit_price;
                    const driverPricingType = proposal.proposal_pricing_type;
                    const freightPricingType = proposal.freight?.pricing_type;
                    const effectivePricingType = (driverPricingType && driverPricingType !== 'FIXED') ? driverPricingType : freightPricingType;
                    
                    let derivedUnitPrice = driverUnitPrice;
                    let unitSuffix = '';
                    
                    if (effectivePricingType === 'PER_TON') {
                      unitSuffix = '/ton';
                      if (!derivedUnitPrice && driverTotal && proposal.freight?.weight) {
                        const weightInTons = proposal.freight.weight >= 1000 ? proposal.freight.weight / 1000 : proposal.freight.weight;
                        derivedUnitPrice = driverTotal / weightInTons;
                      }
                    } else if (effectivePricingType === 'PER_KM') {
                      unitSuffix = '/km';
                      if (!derivedUnitPrice && driverTotal && proposal.freight?.distance_km) {
                        derivedUnitPrice = driverTotal / proposal.freight.distance_km;
                      }
                    }
                    
                    const displayValue = derivedUnitPrice && unitSuffix
                      ? `R$ ${derivedUnitPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}${unitSuffix}`
                      : `R$ ${driverTotal?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
                    
                    return (
                      <div className="mt-3 p-3 bg-gradient-to-r from-card to-secondary/10 border rounded-lg">
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-sm font-medium">
                            Sua Proposta{unitSuffix ? ` (${unitSuffix.replace('/', '')})` : ''}:
                          </span>
                          <span className="text-lg font-bold text-primary">
                            {displayValue}
                          </span>
                        </div>
                    
                    <div className="flex justify-between items-center">
                      <Badge 
                        variant={
                          proposal.status === 'ACCEPTED' ? 'default' :
                          proposal.status === 'COUNTER_PROPOSED' ? 'outline' :
                          proposal.status === 'PENDING' ? 'secondary' : 'destructive'
                        }
                        className="text-xs"
                        title={
                          proposal.status === 'ACCEPTED' ? 'Aceita pelo produtor' :
                          proposal.status === 'COUNTER_PROPOSED' ? 'O produtor enviou uma contraproposta' :
                          proposal.status === 'PENDING' ? 'Aguardando análise' : 'Rejeitada'
                        }
                      >
                        {proposal.status === 'ACCEPTED' ? '✅ Aceita' :
                         proposal.status === 'COUNTER_PROPOSED' ? '🔄 Contraproposta' :
                         proposal.status === 'PENDING' ? '⏳ Pendente' : '❌ Rejeitada'}
                      </Badge>
                      
                      <span className="text-xs text-muted-foreground">
                        Enviada {new Date(proposal.created_at).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                    
                        {proposal.message && (
                          <div className="mt-3 pt-3 border-t">
                            <p className="text-xs text-muted-foreground mb-1">Mensagem:</p>
                            <p className="text-sm">{proposal.message}</p>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : null
            )}
          </SafeListWrapper>
        </div>
      ) : (
        <EmptyProposalsState />
      )}
    </div>
  );
};

const EmptyProposalsState: React.FC = () => (
  <div className="text-center py-12 space-y-6">
    <div className="mx-auto w-24 h-24 bg-muted rounded-full flex items-center justify-center">
      <CheckCircle className="h-10 w-10 text-muted-foreground" />
    </div>
    
    <div className="space-y-2">
      <h3 className="text-xl font-semibold text-foreground">
        Comece Enviando Propostas
      </h3>
      <p className="text-muted-foreground max-w-md mx-auto">
        Suas propostas enviadas aparecerão aqui. Explore os fretes disponíveis e envie propostas para começar a trabalhar.
      </p>
    </div>

    {/* Cards informativos */}
    <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto mt-8">
      <Card className="p-4">
        <div className="text-center space-y-2">
          <Brain className="h-8 w-8 text-primary mx-auto" />
          <h4 className="font-medium">IA Inteligente</h4>
          <p className="text-sm text-muted-foreground">
            Nossa IA encontra fretes compatíveis com seu perfil automaticamente
          </p>
        </div>
      </Card>
      
      <Card className="p-4">
        <div className="text-center space-y-2">
          <DollarSign className="h-8 w-8 text-green-500 mx-auto" />
          <h4 className="font-medium">Melhores Preços</h4>
          <p className="text-sm text-muted-foreground">
            Valores baseados na tabela ANTT para garantir preços justos
          </p>
        </div>
      </Card>
    </div>
  </div>
);
