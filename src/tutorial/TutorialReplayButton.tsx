import React from 'react';
import { Button } from '@/components/ui/button';
import { HelpCircle } from 'lucide-react';
import { useTutorial } from './TutorialProvider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

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
            variant="ghost"
            size="icon"
            onClick={startTutorial}
            className={cn("h-9 w-9 p-0 flex-shrink-0", className)}
            aria-label="Como usar o AgriRoute"
          >
            <HelpCircle className="h-5 w-5 text-muted-foreground" />
          </Button>
        </TooltipTrigger>
        <TooltipContent>
          <p>Refaça o tour guiado do painel</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};
