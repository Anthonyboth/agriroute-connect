import React from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface RefreshButtonProps {
  onClick: () => void;
  isRefreshing: boolean;
  lastRefreshLabel?: string;
  className?: string;
  variant?: 'default' | 'outline' | 'ghost' | 'secondary';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showLabel?: boolean;
}

/**
 * Botão padronizado de atualização
 * - Mostra spinner enquanto atualiza
 * - Fica desabilitado durante refresh
 * - Mostra timestamp do último refresh (opcional)
 */
export const RefreshButton: React.FC<RefreshButtonProps> = ({
  onClick,
  isRefreshing,
  lastRefreshLabel,
  className,
  variant = 'outline',
  size = 'sm',
  showLabel = true,
}) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <Button
        variant={variant}
        size={size}
        onClick={onClick}
        disabled={isRefreshing}
        className="gap-2"
      >
        <RefreshCw className={cn('h-4 w-4', isRefreshing && 'animate-spin')} />
        {showLabel && (isRefreshing ? 'Atualizando...' : 'Atualizar')}
      </Button>
      
      {lastRefreshLabel && !isRefreshing && (
        <span className="text-xs text-muted-foreground hidden sm:inline">
          {lastRefreshLabel}
        </span>
      )}
    </div>
  );
};
