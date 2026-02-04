import React from 'react';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { Users, Star, Wrench } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateFreightWizardModal } from '@/components/freight-wizard';
import { HERO_BG_DESKTOP } from '@/lib/hero-assets';

interface ProducerDashboardHeroProps {
  profile: any;
  onFreightCreated: () => void;
  onViewProposals: () => void;
  onOpenServices: () => void;
  onViewRatings: () => void;
}

export const ProducerDashboardHero: React.FC<ProducerDashboardHeroProps> = ({
  profile,
  onFreightCreated,
  onViewProposals,
  onOpenServices,
  onViewRatings,
}) => {
  return (
    <TooltipProvider>
      <section className="relative min-h-[250px] flex items-center justify-center overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat animate-fade-in"
          style={{ backgroundImage: `url(${HERO_BG_DESKTOP})` }}
          role="img"
          aria-label="Imagem de fundo com caminhão"
        />
        <div className="absolute inset-0 bg-primary/75" />
        <div className="relative z-10 w-full">
          <div className="container mx-auto px-4 text-center text-primary-foreground">
            <h1 className="text-2xl md:text-3xl font-bold mb-2">
              Painel de Gerenciamento
            </h1>
            <p className="text-base opacity-90 max-w-xl mx-auto mb-4">
              Gerencie seus fretes, acompanhe propostas e monitore o desempenho
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <CreateFreightWizardModal 
                onFreightCreated={onFreightCreated}
                userProfile={profile}
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton 
                    onClick={onViewProposals}
                    icon={<Users className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Ver propostas de motoristas para seus fretes"
                  >
                    Ver Propostas
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Veja todas as propostas de motoristas interessados nos seus fretes</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton 
                    onClick={onOpenServices}
                    icon={<Wrench className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Solicitar serviços como guincho, mudança ou frete urbano"
                  >
                    Solicitar Serviços
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solicite guincho, mudança, frete de moto ou frete urbano</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <HeroActionButton 
                    onClick={onViewRatings}
                    icon={<Star className="h-4 w-4" aria-hidden="true" />}
                    aria-label="Ver avaliações recebidas dos motoristas"
                  >
                    Avaliações
                  </HeroActionButton>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Veja as avaliações que você recebeu dos motoristas</p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        </div>
      </section>
    </TooltipProvider>
  );
};
