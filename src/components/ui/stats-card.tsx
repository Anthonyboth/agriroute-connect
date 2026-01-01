import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface StatsCardProps {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  iconColor?: string;
  onClick?: () => void;
  actionButton?: React.ReactNode;
  className?: string;
  size?: 'sm' | 'md';
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  iconColor = 'text-primary',
  onClick,
  actionButton,
  className,
  size = 'md',
}) => {
  const isClickable = Boolean(onClick);
  const styles = size === 'sm'
    ? {
        card: 'rounded-lg border hover:border-primary/50 hover:shadow-md min-h-[100px]',
        content: 'p-3 flex flex-col items-center justify-center text-center h-full gap-1',
        iconWrap: '',
        value: 'text-lg md:text-xl font-bold leading-none tabular-nums',
        label: 'text-[11px] md:text-xs font-medium text-muted-foreground leading-tight',
      }
    : {
        card: 'rounded-xl border-2 hover:border-primary/50 hover:shadow-lg min-h-[120px]',
        content: 'p-4 flex flex-col items-center justify-center text-center h-full gap-2',
        iconWrap: '',
        value: 'text-2xl md:text-3xl font-bold leading-none tabular-nums',
        label: 'text-xs md:text-sm font-medium text-muted-foreground leading-tight',
      };

  return (
    <Card 
      className={cn(
        'w-full transition-all duration-200',
        styles.card,
        isClickable && 'cursor-pointer active:scale-[0.98]',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={styles.content}>
        <div className={cn(styles.iconWrap, iconColor, 'shrink-0')}>
          {icon}
        </div>
        <p className={cn(styles.value, 'break-words max-w-full')}>
          {value}
        </p>
        <p className={cn(styles.label, 'break-words max-w-full')}>
          {label}
        </p>
        {actionButton && <div className="mt-1 shrink-0">{actionButton}</div>}
      </CardContent>
    </Card>
  );
};
