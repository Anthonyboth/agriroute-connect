import React from 'react';
import { HeroActionButton } from '@/components/ui/hero-action-button';
import { Users, Star, Wrench } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateFreightWizardModal } from '@/components/freight-wizard';
import { useHeroBackground } from '@/hooks/useHeroBackground';

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
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();

  return (
    <TooltipProvider>
      <section data-tutorial="producer-hero" className="relative min-h-[280px] flex items-center justify-center overflow-hidden">
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
                    data-tutorial="producer-proposals"
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
                    data-tutorial="producer-services"
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
