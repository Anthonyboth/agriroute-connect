import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Brain, MapPin, Settings, Wrench, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { SISTEMA_IA_LABEL, VER_FRETES_IA_LABEL } from '@/lib/ui-labels';

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

  return (
    <TooltipProvider>
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(/hero-truck-night-moon.webp)` }}
          role="img"
          aria-label="Imagem de fundo com caminhão"
        />
        <div className="absolute inset-0 bg-primary/80" />
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
            <div className="flex flex-wrap items-center justify-center gap-2 px-2">
              {canSeeFreights && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button 
                      variant="default"
                      size="sm"
                      onClick={() => onTabChange('available')}
                      className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                      aria-label="Ver fretes disponíveis selecionados pela inteligência artificial"
                    >
                      <Brain className="mr-1 h-4 w-4" aria-hidden="true" />
                      {VER_FRETES_IA_LABEL}
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Nossa IA seleciona os melhores fretes para o seu perfil</p>
                  </TooltipContent>
                </Tooltip>
              )}
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={() => onTabChange('cities')}
                    className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                    aria-label="Configurar cidades e regiões de atuação"
                  >
                    <MapPin className="mr-1 h-4 w-4" aria-hidden="true" />
                    Configurar Região
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Defina as cidades onde você busca fretes</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={() => onTabChange('services')}
                    className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                    aria-label="Configurar tipos de serviços oferecidos"
                  >
                    <Settings className="mr-1 h-4 w-4" aria-hidden="true" />
                    Configurar Serviços
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Configure os tipos de serviço que você oferece</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="default"
                    size="sm"
                    onClick={onServicesModalOpen}
                    className="bg-background text-primary hover:bg-background/90 font-medium rounded-full px-4 py-2 w-full sm:w-auto"
                    aria-label="Solicitar serviços como guincho ou mudança"
                  >
                    <Wrench className="mr-1 h-4 w-4" aria-hidden="true" />
                    Solicitar Serviços
                  </Button>
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
