import React from 'react';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { Badge } from '@/components/ui/badge';
import { Brain, MapPin, Settings, Wrench, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SISTEMA_IA_LABEL, VER_FRETES_IA_LABEL } from '@/lib/ui-labels';
import { useHeroBackground } from '@/hooks/useHeroBackground';

interface DriverDashboardHeroProps {
  profileName?: string;
  activeMode?: string;
  isCompanyDriver: boolean;
  companyName?: string;
  canSeeFreights: boolean;
  onTabChange: (tab: string) => void;
  onServicesModalOpen: () => void;
}

export const DriverDashboardHero: React.FC<DriverDashboardHeroProps> = ({
  profileName,
  activeMode,
  isCompanyDriver,
  companyName,
  canSeeFreights,
  onTabChange,
  onServicesModalOpen,
}) => {
  const displayName = profileName?.split(' ')[0] || (activeMode === 'TRANSPORTADORA' ? 'Transportadora' : 'Motorista');
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();

  return (
    <TooltipProvider>
      <section className="relative min-h-[280px] flex items-center justify-center overflow-hidden">
        <picture className="absolute inset-0">
          <source media="(max-width: 640px)" srcSet={heroMobile} type="image/webp" />
          <img 
            src={heroDesktop}
            alt="Imagem de fundo com caminhão"
            className="w-full h-full object-cover animate-fade-in"
            loading="eager"
            decoding="async"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-b from-primary/40 via-primary/20 to-primary/40" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <div className="flex flex-col items-center gap-2 px-6 py-5 sm:flex-row sm:flex-wrap sm:justify-center sm:px-2">
              {canSeeFreights && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <HeroActionButton 
                      onClick={() => onTabChange('available')}
                      icon={<Brain className="h-4 w-4" aria-hidden="true" />}
                      aria-label="Ver fretes disponíveis selecionados pela inteligência artificial"
                      data-tutorial="driver-freights"
                    >
                      {VER_FRETES_IA_LABEL}
                    </HeroActionButton>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nossa IA seleciona os melhores fretes para o seu perfil</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                    <HeroActionButton 
                      onClick={() => onTabChange('cities')}
                      icon={<MapPin className="h-4 w-4" aria-hidden="true" />}
                      aria-label="Configurar cidades e regiões de atuação"
                      data-tutorial="driver-region"
                  >
                    Configurar Região
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Defina as cidades onde você busca fretes</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton 
                    onClick={() => onTabChange('services')}
                    icon={<Settings className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Configurar tipos de serviços oferecidos"
                  >
                    Configurar Serviços
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure os tipos de serviço que você oferece</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton 
                    onClick={onServicesModalOpen}
                    icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Solicitar serviços como guincho ou mudança"
                  >
                    Solicitar Serviços
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solicite guincho, mudança ou outros serviços</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
};
