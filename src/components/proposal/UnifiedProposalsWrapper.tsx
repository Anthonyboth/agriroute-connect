/**
 * UnifiedProposalsWrapper.tsx
 * 
 * Wrapper que exibe duas sub-abas dentro da aba de propostas:
 * - Propostas Recebidas (em fretes do próprio usuário)
 * - Propostas Feitas (em fretes de terceiros)
 */

import React, { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Inbox, Send } from 'lucide-react';
import { FreightProposalsManager } from '@/components/FreightProposalsManager';
import { MadeProposalsList } from '@/components/proposal/MadeProposalsList';
import { useMyMadeProposals } from '@/hooks/useMyMadeProposals';

interface UnifiedProposalsWrapperProps {
  /** ID do perfil do usuário (usado como producerId para "Recebidas" e userId para "Feitas") */
  userId: string;
  /** Para transportadoras: IDs dos motoristas afiliados (usado em "Feitas") */
  companyDriverIds?: string[];
  /** Callback quando uma proposta recebida é aceita */
  onProposalAccepted?: () => void;
}

export const UnifiedProposalsWrapper: React.FC<UnifiedProposalsWrapperProps> = ({
  userId,
  companyDriverIds,
  onProposalAccepted,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'received' | 'made'>('received');

  // Fetch made proposals count for badge
  const { pendingCount: madePendingCount } = useMyMadeProposals({
    userId: companyDriverIds ? undefined : userId,
    driverIds: companyDriverIds,
    enabled: !!userId,
  });

  return (
    <div className="space-y-4">
      <Tabs value={activeSubTab} onValueChange={(v) => setActiveSubTab(v as 'received' | 'made')}>
        <div className="overflow-x-auto -mx-1 px-1">
          <TabsList className="inline-flex w-max min-w-full gap-1">
            <TabsTrigger value="received" className="whitespace-nowrap text-xs sm:text-sm px-3 py-2">
              <Inbox className="h-3.5 w-3.5 mr-1.5" />
              <span>Propostas Recebidas</span>
            </TabsTrigger>
            <TabsTrigger value="made" className="whitespace-nowrap text-xs sm:text-sm px-3 py-2">
              <Send className="h-3.5 w-3.5 mr-1.5" />
              <span>Propostas Feitas</span>
              {madePendingCount > 0 && (
                <Badge variant="secondary" className="ml-1.5 h-5 px-1.5 text-xs">
                  {madePendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="received" className="mt-4">
          <FreightProposalsManager
            producerId={userId}
            onProposalAccepted={onProposalAccepted}
          />
        </TabsContent>

        <TabsContent value="made" className="mt-4">
          <MadeProposalsList
            userId={companyDriverIds ? undefined : userId}
            driverIds={companyDriverIds}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
};
