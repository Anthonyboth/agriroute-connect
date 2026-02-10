import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from './TutorialProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Floating / inline button to replay the tutorial.
 * Only visible when replay is allowed (within 15 days of signup).
 */
export const TutorialReplayButton: React.FC<{ className?: string }> = ({ className }) => {
  const { canReplay, startTutorial, isActive } = useTutorial();

  if (!canReplay || isActive) return null;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            onClick={startTutorial}
            className={className}
            aria-label="Como usar o AgriRoute"
          >
            <HelpCircle className="h-4 w-4 mr-1.5" />
            <span className="hidden sm:inline">Como usar o AgriRoute</span>
            <span className="sm:hidden">Ajuda</span>
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refaça o tour guiado do painel</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
