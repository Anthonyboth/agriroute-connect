import React, { useCallback, useState } from 'react';
import GuestServiceModal from './GuestServiceModal';
import { CreateFreightWizardModal } from './freight-wizard';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  BottomSheet, 
  BottomSheetContent, 
  BottomSheetHeader, 
  BottomSheetBody,
  BottomSheetFooter 
} from '@/components/ui/bottom-sheet';
import { Truck, Package, Home, Wheat, ArrowLeft } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';

// ============================================
// FreightTransportModal - Estilo Sheet Meta Premium
// Mesmo design do ServicesModal
// ============================================

interface FreightTransportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onBack?: () => void;
}

// Card de serviço estilo Meta
interface FreightServiceCardProps {
  id: string;
  icon: React.ElementType;
  title: string;
  description: string;
  badge: string;
  colorClass: string;
  onClick: (id: string) => void;
}

const FreightServiceCard: React.FC<FreightServiceCardProps> = ({
  id,
  icon: IconComponent,
  title,
  description,
  badge,
  colorClass,
  onClick,
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
        // Layout
        "group w-full flex items-center gap-4 p-4",
        // Card base
        "rounded-2xl border border-border/60",
        "transition-all duration-150 ease-out",
        // Fundo claro
        "bg-background/80",
        // Hover premium
        "hover:-translate-y-0.5",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        "hover:border-primary/30",
        // Focus acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Touch
        "active:scale-[0.99]",
        "cursor-pointer pointer-events-auto"
      )}
    >
      {/* Ícone */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-12 h-12 rounded-xl",
          colorClass,
          "transition-all duration-150",
          "group-hover:scale-105"
        )}
      >
        <IconComponent className="h-6 w-6" strokeWidth={1.75} />
      </div>

      {/* Conteúdo */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2 mb-1">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-150">
            {title}
          </h3>
          <Badge variant="secondary" className="text-xs">
            {badge}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">
          {description}
        </p>
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
    serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO';
    initialSubService?: string;
  }>({ isOpen: false });

  const [guestFreightModal, setGuestFreightModal] = useState(false);

  const isProducer = profile?.role === 'PRODUTOR' || profile?.active_mode === 'PRODUTOR';

  const freightServices = [
    {
      id: 'GUINCHO',
      icon: Truck,
      title: 'Guincho e Socorro 24h',
      description: 'Reboque, socorro e assistência emergencial para veículos',
      colorClass: 'bg-orange-100 dark:bg-orange-900/50 text-orange-600 dark:text-orange-400 border border-orange-200/60 dark:border-orange-700/50',
      badge: 'Disponível 24h'
    },
    {
      id: 'FRETE_URBANO',
      icon: Package,
      title: 'Frete Urbano',
      description: 'Transporte rápido de cargas dentro da cidade',
      colorClass: 'bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 border border-blue-200/60 dark:border-blue-700/50',
      badge: 'Entrega Rápida'
    },
    {
      id: 'MUDANCA',
      icon: Home,
      title: 'Mudança',
      description: 'Mudanças residenciais e comerciais completas',
      colorClass: 'bg-green-100 dark:bg-green-900/50 text-green-600 dark:text-green-400 border border-green-200/60 dark:border-green-700/50',
      badge: 'Profissional'
    },
    {
      id: 'FRETE_RURAL',
      icon: Wheat,
      title: 'Frete Rural',
      description: 'Transporte de cargas agrícolas e produtos do campo',
      colorClass: 'bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 border border-emerald-200/60 dark:border-emerald-700/50',
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
      {/* Modal Principal - Bottom Sheet estilo Meta */}
      <BottomSheet open={isOpen} onOpenChange={handleOpenChange}>
        <BottomSheetContent>
          <BottomSheetHeader 
            title="Fretes e Transporte" 
            subtitle="Escolha o serviço que você precisa"
          />

          <BottomSheetBody>
            {/* Botão Voltar */}
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

            {/* Cards de serviços estilo Meta */}
            <div className="flex flex-col gap-3">
              {freightServices.map((service) => (
                <FreightServiceCard
                  key={service.id}
                  id={service.id}
                  icon={service.icon}
                  title={service.title}
                  description={service.description}
                  badge={service.badge}
                  colorClass={service.colorClass}
                  onClick={handleServiceSelect}
                />
              ))}
            </div>
          </BottomSheetBody>

          <BottomSheetFooter />
        </BottomSheetContent>
      </BottomSheet>

      {/* Guest Service Modal para GUINCHO, FRETE_URBANO, MUDANCA */}
      {guestServiceModal.serviceType && (
        <GuestServiceModal
          isOpen={guestServiceModal.isOpen}
          onClose={() => {
            setGuestServiceModal({ isOpen: false });
            onClose();
          }}
          onBack={() => setGuestServiceModal({ isOpen: false })}
          serviceType={guestServiceModal.serviceType}
          initialSubService={guestServiceModal.initialSubService}
        />
      )}

      {/* CreateFreightWizardModal para FRETE_RURAL */}
      <CreateFreightWizardModal
        open={guestFreightModal}
        onOpenChange={(open) => {
          setGuestFreightModal(open);
        }}
        onFreightCreated={() => {
          setGuestFreightModal(false);
          onClose();
        }}
        userProfile={isProducer ? profile : null}
        trigger={null}
        guestMode={!isProducer}
      />
    </>
  );
};
