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
  const { desktopUrl: heroDesktop } = useHeroBackground();

  return (
    <TooltipProvider>
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(${heroDesktop})` }}
          role="img"
          aria-label="Imagem de fundo com caminhão"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-primary/70 via-primary/45 to-primary/70" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-xl md:text-2xl font-bold mb-2">
              Olá, {displayName}
            </h1>
            <p className="text-sm md:text-base mb-2 opacity-90 px-2">
              {SISTEMA_IA_LABEL} encontra fretes para você
            </p>
            {isCompanyDriver && companyName && (
              <Badge variant="secondary" className="mb-3 bg-background/20 text-primary-foreground border-primary-foreground/30">
                <Users className="h-3 w-3 mr-1" aria-hidden="true" />
                Motorista - {companyName}
              </Badge>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3 px-2">
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
