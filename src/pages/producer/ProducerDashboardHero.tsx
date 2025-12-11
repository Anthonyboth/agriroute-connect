import React from 'react';
import { Button } from '@/components/ui/button';
import { Users, Star, Wrench } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { CreateFreightWizardModal } from '@/components/freight-wizard';

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
          style={{ backgroundImage: `url(/hero-truck-night-moon.webp)` }}
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
            <div className="flex flex-col sm:flex-row items-center justify-center gap-2">
              <CreateFreightWizardModal 
                onFreightCreated={onFreightCreated}
                userProfile={profile}
              />
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={onViewProposals}
                    className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
                    aria-label="Ver propostas de motoristas para seus fretes"
                  >
                    <Users className="mr-1 h-4 w-4" aria-hidden="true" />
                    Ver Propostas
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Veja todas as propostas de motoristas interessados nos seus fretes</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={onOpenServices}
                    className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
                    aria-label="Solicitar serviços como guincho, mudança ou frete urbano"
                  >
                    <Wrench className="mr-1 h-4 w-4" aria-hidden="true" />
                    Solicitar Serviços
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Solicite guincho, mudança, frete de moto ou frete urbano</p>
                </TooltipContent>
              </Tooltip>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    variant="outline"
                    size="sm"
                    onClick={onViewRatings}
                    className="bg-white/20 text-white border-white/50 hover:bg-white/30 font-semibold rounded-full px-4 py-2 w-full sm:w-auto shadow-lg backdrop-blur-sm transition-all duration-200"
                    aria-label="Ver avaliações recebidas dos motoristas"
                  >
                    <Star className="mr-1 h-4 w-4" aria-hidden="true" />
                    Avaliações
                  </Button>
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
