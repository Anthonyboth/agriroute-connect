/**
 * src/components/RefreshButton.tsx
 * 
 * Botão de atualização manual com feedback visual.
 * Usa o hook useDashboardDataRefresh para atualizar dados.
 */

import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  /** Função de refresh */
  onRefresh: () => Promise<void>;
  /** Se está carregando */
  isRefreshing?: boolean;
  /** Último refresh (para mostrar tempo) */
  lastRefreshedAt?: Date | null;
  /** Classes CSS adicionais */
  className?: string;
  /** Variante do botão */
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  /** Tamanho do botão */
  size?: 'default' | 'sm' | 'lg' | 'icon';
  /** Mostrar tempo desde último refresh */
  showLastRefresh?: boolean;
}

export function RefreshButton({
  onRefresh,
  isRefreshing = false,
  lastRefreshedAt,
  className,
  variant = 'outline',
  size = 'sm',
  showLastRefresh = false,
}: RefreshButtonProps) {
  const handleClick = async () => {
    try {
      await onRefresh();
    } catch (error) {
      console.error('[RefreshButton] Erro ao atualizar:', error);
    }
  };

  const getTimeSinceRefresh = () => {
    if (!lastRefreshedAt) return null;
    
    const seconds = Math.floor((Date.now() - lastRefreshedAt.getTime()) / 1000);
    
    if (seconds < 60) return 'agora';
    if (seconds < 3600) return `${Math.floor(seconds / 60)}min`;
    return `${Math.floor(seconds / 3600)}h`;
  };

  const timeSince = getTimeSinceRefresh();

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleClick}
      disabled={isRefreshing}
      className={cn('gap-2', className)}
    >
      <RefreshCw 
        className={cn(
          'h-4 w-4',
          isRefreshing && 'animate-spin'
        )} 
      />
      {showLastRefresh && timeSince && (
        <span className="text-xs text-muted-foreground">
          {timeSince}
        </span>
      )}
    </Button>
  );
}
