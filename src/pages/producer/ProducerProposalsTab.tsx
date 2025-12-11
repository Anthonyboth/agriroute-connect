import React from 'react';
import { FreightProposalsManager } from '@/components/FreightProposalsManager';

interface ProducerProposalsTabProps {
  producerId: string;
  onProposalAccepted: () => void;
}

export const ProducerProposalsTab: React.FC<ProducerProposalsTabProps> = ({
  producerId,
  onProposalAccepted,
}) => {
  return (
    <FreightProposalsManager 
      producerId={producerId}
      onProposalAccepted={onProposalAccepted}
    />
  );
};
