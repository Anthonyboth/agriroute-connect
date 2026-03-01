import React, { useCallback, useState } from 'react';
import GuestServiceModal from './GuestServiceModal';
import { CreateFreightWizardModal } from './freight-wizard';
import { Button } from '@/components/ui/button';
import { AgriChip } from '@/components/ui/AgriChip';
import { 
  BottomSheet, 
  BottomSheetContent, 
  BottomSheetHeader, 
  BottomSheetBody,
  BottomSheetFooter 
} from '@/components/ui/bottom-sheet';
import { Truck, Package, Home, Wheat, ArrowLeft, Box, PawPrint } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useAuthenticatedUser } from '@/hooks/useAuthenticatedUser';
import { cn } from '@/lib/utils';

// ============================================
// FreightTransportModal — Estilo Enterprise 60/30/10
// ============================================

interface FreightTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

interface FreightServiceCardProps {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  onClick: (id: string) => void;
  ctaText?: string;
  ctaHighlight?: boolean;
}

const FreightServiceCard: React.FC<FreightServiceCardProps> = ({
  id,
  icon: IconComponent,
  title,
  description,
  badge,
  onClick,
  ctaText,
  ctaHighlight,
}) => {
  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id);
  }, [id, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(id);
    }
  }, [id, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title} - ${description}`}
      className={cn(
        // Layout row alinhado
        "group w-full flex items-center gap-3.5 p-4",
        // 60% base: fundo neutro card
        "rounded-2xl bg-card border border-border",
        "transition-all duration-150 ease-out",
        // Hover enterprise
        "hover:-translate-y-0.5",
        "hover:shadow-sm",
        "hover:border-primary/25",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Touch
        "active:scale-[0.99]",
        "cursor-pointer pointer-events-auto",
        // Highlight especial
        ctaHighlight && "ring-1 ring-primary/30 border-primary/25"
      )}
    >
      {/* Ícone — 10% acento primary */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-11 h-11 rounded-xl",
          "bg-primary/10 text-primary border border-primary/15",
          "transition-all duration-150",
          "group-hover:scale-105 group-hover:bg-primary/15"
        )}
      >
        <IconComponent className="h-5 w-5" strokeWidth={1.75} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 flex-wrap">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-150">
            {title}
          </h3>
          <AgriChip tone="neutral">{badge}</AgriChip>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
          {description}
        </p>
        {ctaText && (
          <AgriChip tone="verified" className="mt-2">
            🐾 {ctaText}
          </AgriChip>
        )}
      </div>
    </button>
  );
};

export const FreightTransportModal: React.FC<FreightTransportModalProps> = ({
  isOpen,
  onClose,
  onBack,
}) => {
  const { profile } = useAuth();
  
  const [guestServiceModal, setGuestServiceModal] = useState<{
    isOpen: boolean;
    serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' | 'ENTREGA_PACOTES' | 'TRANSPORTE_PET';
    initialSubService?: string;
  }>({ isOpen: false });

  const [guestFreightModal, setGuestFreightModal] = useState(false);
  const { isLoggedInWithProfile } = useAuthenticatedUser();

  const isProducer = profile?.role === 'PRODUTOR' || profile?.active_mode === 'PRODUTOR';

  const freightServices = [
    {
      id: 'GUINCHO',
      icon: Truck,
      title: 'Guincho e Socorro 24h',
      description: 'Reboque, socorro e assistência emergencial para veículos',
      badge: 'Disponível 24h'
    },
    {
      id: 'FRETE_URBANO',
      icon: Package,
      title: 'Frete Urbano',
      description: 'Transporte rápido de cargas dentro da cidade',
      badge: 'Entrega Rápida'
    },
    {
      id: 'ENTREGA_PACOTES',
      icon: Box,
      title: 'Entrega de Pacotes',
      description: 'Entrega rápida de encomendas, documentos e pequenas cargas',
      badge: 'Rápido'
    },
    {
      id: 'TRANSPORTE_PET',
      icon: PawPrint,
      title: 'Transporte de Pet',
      description: 'Viagem segura e confortável para seu pet',
      badge: 'Pet',
    },
    {
      id: 'MUDANCA',
      icon: Home,
      title: 'Mudança',
      description: 'Mudanças residenciais e comerciais completas',
      badge: 'Profissional'
    },
    {
      id: 'FRETE_RURAL',
      icon: Wheat,
      title: 'Frete Rural',
      description: 'Transporte de cargas agrícolas e produtos do campo',
      badge: 'Agronegócio'
    }
  ];

  const handleServiceSelect = useCallback((serviceId: string) => {
    console.log('[FreightTransportModal] Serviço selecionado:', serviceId);
    
    if (serviceId === 'FRETE_RURAL') {
      setGuestFreightModal(true);
    } else if (serviceId === 'GUINCHO') {
      setGuestServiceModal({ 
        isOpen: true, 
        serviceType: 'GUINCHO',
        initialSubService: 'GUINCHO'
      });
    } else if (serviceId === 'ENTREGA_PACOTES') {
      setGuestServiceModal({ 
        isOpen: true, 
        serviceType: 'ENTREGA_PACOTES',
        initialSubService: 'ENTREGA_PACOTES'
      });
    } else if (serviceId === 'TRANSPORTE_PET') {
      setGuestServiceModal({ 
        isOpen: true, 
        serviceType: 'TRANSPORTE_PET',
        initialSubService: 'TRANSPORTE_PET'
      });
    } else {
      setGuestServiceModal({ 
        isOpen: true, 
        serviceType: serviceId as 'MUDANCA' | 'FRETE_URBANO',
        initialSubService: undefined
      });
    }
  }, []);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      onClose();
    }
  }, [onClose]);

  const handleBackClick = useCallback(() => {
    if (onBack) {
      onBack();
    } else {
      onClose();
    }
  }, [onBack, onClose]);

  return (
    <>
      <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
        <BottomSheetContent>
          <BottomSheetHeader 
            title="Fretes e Transporte" 
            subtitle="Escolha o serviço que você precisa"
          />

          <BottomSheetBody>
            {onBack && (
              <Button 
                variant="ghost" 
                onClick={handleBackClick} 
                className="mb-4 hover:bg-muted w-fit -ml-2"
                size="sm"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
            )}

            <div className="flex flex-col gap-3">
              {freightServices.map((service) => (
                <FreightServiceCard
                  key={service.id}
                  id={service.id}
                  icon={service.icon}
                  title={service.title}
                  description={service.description}
                  badge={service.badge}
                  onClick={handleServiceSelect}
                  ctaText={'ctaText' in service ? (service as any).ctaText : undefined}
                  ctaHighlight={'ctaHighlight' in service ? (service as any).ctaHighlight : undefined}
                />
              ))}
            </div>
          </BottomSheetBody>

          <BottomSheetFooter />
        </BottomSheetContent>
      </BottomSheet>

      {guestServiceModal.isOpen && guestServiceModal.serviceType && (
        <GuestServiceModal
          isOpen={true}
          onClose={() => {
            setGuestServiceModal({ isOpen: false });
            onClose();
          }}
          onBack={() => setGuestServiceModal({ isOpen: false })}
          serviceType={guestServiceModal.serviceType}
          initialSubService={guestServiceModal.initialSubService}
        />
      )}

      <CreateFreightWizardModal
        open={guestFreightModal}
        onOpenChange={(open) => {
          setGuestFreightModal(open);
        }}
        onFreightCreated={() => {
          setGuestFreightModal(false);
          onClose();
        }}
        userProfile={isLoggedInWithProfile ? profile : (isProducer ? profile : null)}
        trigger={null}
        guestMode={!isLoggedInWithProfile}
      />
    </>
  );
};
