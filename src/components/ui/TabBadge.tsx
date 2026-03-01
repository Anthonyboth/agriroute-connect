import React from 'react';
import { Badge } from '@/components/ui/badge';

interface TabBadgeProps {
  count: number;
}

/**
 * Badge padronizado para abas de navegação dos dashboards.
 * Exibe um número vermelho (destructive) apenas quando count > 0.
 * Padrão visual: h-5, min-w-[20px], text-xs, ml-1.
 */
export const TabBadge: React.FC<TabBadgeProps> = ({ count }) => {
  if (count <= 0) return null;

  const displayValue = count > 99 ? '99+' : count;

  return (
    <Badge variant="destructive" className="ml-1 h-5 min-w-[20px] px-1 text-xs">
      {displayValue}
    </Badge>
  );
};
