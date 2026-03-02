import React from 'react';
import { ScrollText } from 'lucide-react';
import { useBoardRules } from '../hooks/useForumMarketplace';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BoardRulesProps {
  boardId: string;
}

export function BoardRules({ boardId }: BoardRulesProps) {
  const { data: rules } = useBoardRules(boardId);

  if (!rules || rules.length === 0) return null;

  return (
    <Collapsible>
      <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full text-left py-2">
        <ScrollText className="h-4 w-4" />
        Regras da Comunidade ({rules.length})
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="bg-muted/30 rounded-lg p-3 mt-1 space-y-2">
          {rules.map((rule, idx) => (
            <div key={rule.id} className="text-sm">
              <span className="font-semibold text-foreground">{idx + 1}. {rule.title}</span>
              <p className="text-muted-foreground text-xs mt-0.5">{rule.body}</p>
            </div>
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
