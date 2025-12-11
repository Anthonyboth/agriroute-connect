import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import FreightCheckinModal from '@/components/FreightCheckinModal';
import FreightWithdrawalModal from '@/components/FreightWithdrawalModal';
import UnifiedLocationManager from '@/components/UnifiedLocationManager';
import { ServicesModal } from '@/components/ServicesModal';
import { TrackingConsentModal } from '@/components/TrackingConsentModal';
import { AutoRatingModal } from '@/components/AutoRatingModal';
import { DriverProposalDetailsModal } from '@/components/DriverProposalDetailsModal';
import type { Freight } from './types';

interface DriverDashboardModalsProps {
  // Check-in Modal
  showCheckinModal: boolean;
  selectedFreightForCheckin: string | null;
  initialCheckinType: string | null;
  profile: any;
  onCheckinClose: () => void;
  onCheckinCreated: () => void;

  // Withdrawal Modal
  showWithdrawalModal: boolean;
  selectedFreightForWithdrawal: Freight | null;
  onWithdrawalClose: () => void;
  onWithdrawalConfirm: () => void;

  // Location Manager Modal
  showLocationManager: boolean;
  onLocationManagerClose: () => void;

  // Services Modal
  servicesModalOpen: boolean;
  onServicesModalClose: () => void;

  // Tracking Consent Modal
  showTrackingConsentModal: boolean;
  freightAwaitingConsent: string | null;
  onTrackingConsent: (consented: boolean) => void;

  // Auto Rating Modal
  activeFreightForRating: Freight | null;
  onRatingClose: () => void;

  // Proposal Details Modal
  proposalDetailsModal: { open: boolean; proposal: any | null };
  counterOffers: any[];
  onProposalDetailsClose: () => void;
  onCancelProposal: (proposalId: string) => Promise<void>;
  onAcceptCounterOffer: (counterOfferId: string) => Promise<void>;
  onRejectCounterOffer: (messageId: string) => Promise<void>;
}

export const DriverDashboardModals: React.FC<DriverDashboardModalsProps> = ({
  // Check-in
  showCheckinModal,
  selectedFreightForCheckin,
  initialCheckinType,
  profile,
  onCheckinClose,
  onCheckinCreated,

  // Withdrawal
  showWithdrawalModal,
  selectedFreightForWithdrawal,
  onWithdrawalClose,
  onWithdrawalConfirm,

  // Location Manager
  showLocationManager,
  onLocationManagerClose,

  // Services
  servicesModalOpen,
  onServicesModalClose,

  // Tracking Consent
  showTrackingConsentModal,
  freightAwaitingConsent,
  onTrackingConsent,

  // Rating
  activeFreightForRating,
  onRatingClose,

  // Proposal Details
  proposalDetailsModal,
  counterOffers,
  onProposalDetailsClose,
  onCancelProposal,
  onAcceptCounterOffer,
  onRejectCounterOffer,
}) => {
  return (
    <>
      {/* Modal de Check-in */}
      {selectedFreightForCheckin && (
        <FreightCheckinModal
          key={selectedFreightForCheckin}
          isOpen={showCheckinModal}
          onClose={onCheckinClose}
          freightId={selectedFreightForCheckin}
          currentUserProfile={profile}
          initialType={initialCheckinType || undefined}
          onCheckinCreated={onCheckinCreated}
        />
      )}

      {/* Modal de Desistência */}
      <FreightWithdrawalModal
        key={selectedFreightForWithdrawal?.id || 'withdrawal-modal'}
        isOpen={showWithdrawalModal}
        onClose={onWithdrawalClose}
        onConfirm={onWithdrawalConfirm}
        freightInfo={selectedFreightForWithdrawal ? {
          cargo_type: selectedFreightForWithdrawal.cargo_type,
          origin_address: selectedFreightForWithdrawal.origin_address,
          destination_address: selectedFreightForWithdrawal.destination_address,
          price: selectedFreightForWithdrawal.price
        } : undefined}
      />

      {/* Modal de Configuração de Localização */}
      {showLocationManager && (
        <div key="location-manager-overlay" className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-semibold">Configurar Áreas de Atendimento</h2>
                <Button variant="ghost" onClick={onLocationManagerClose}>
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <UnifiedLocationManager 
                userType="MOTORISTA" 
                onAreasUpdate={() => {}}
              />
            </div>
          </div>
        </div>
      )}

      <ServicesModal
        isOpen={servicesModalOpen}
        onClose={onServicesModalClose}
      />

      {/* Modal de Consentimento de Tracking */}
      <TrackingConsentModal
        isOpen={showTrackingConsentModal}
        freightId={freightAwaitingConsent || ''}
        onConsent={onTrackingConsent}
      />

      {/* Modal de Avaliação Automática */}
      {activeFreightForRating && (
        <AutoRatingModal
          isOpen={true}
          onClose={onRatingClose}
          freightId={activeFreightForRating.id}
          userToRate={
            activeFreightForRating.producer
              ? {
                  id: activeFreightForRating.producer.id,
                  full_name: activeFreightForRating.producer.full_name,
                  role: 'PRODUTOR' as const
                }
              : null
          }
          currentUserProfile={profile}
        />
      )}

      {/* Modal de Detalhes da Proposta */}
      <DriverProposalDetailsModal
        isOpen={proposalDetailsModal.open}
        onClose={onProposalDetailsClose}
        proposal={proposalDetailsModal.proposal}
        counterOffers={counterOffers}
        onCancelProposal={onCancelProposal}
        onAcceptCounterOffer={async (counterOfferId) => {
          onAcceptCounterOffer(counterOfferId);
        }}
        onRejectCounterOffer={onRejectCounterOffer}
      />
    </>
  );
};
