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

  // Map iconColor to hover shadow color
  const getGlowColor = (color: string) => {
    if (color.includes('orange')) return 'hover:shadow-orange-300';
    if (color.includes('green')) return 'hover:shadow-green-300';
    if (color.includes('blue')) return 'hover:shadow-blue-300';
    if (color.includes('purple')) return 'hover:shadow-purple-300';
    if (color.includes('amber')) return 'hover:shadow-amber-300';
    if (color.includes('teal')) return 'hover:shadow-teal-300';
    return 'hover:shadow-primary/30';
  };

  const glowClasses = `hover:shadow-lg ${getGlowColor(iconColor)} hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80`;

  const styles = size === 'sm'
    ? {
        card: 'rounded-lg border hover:border-primary/50 min-h-[100px]',
        content: 'p-3 flex flex-col items-center justify-center text-center h-full gap-1',
        iconWrap: '',
        value: 'text-lg md:text-xl font-bold leading-none tabular-nums',
        label: 'text-[11px] md:text-xs font-medium text-muted-foreground leading-tight',
      }
    : {
        card: 'rounded-xl border-2 hover:border-primary/50 min-h-[120px]',
        content: 'p-4 flex flex-col items-center justify-center text-center h-full gap-2',
        iconWrap: '',
        value: 'text-2xl md:text-3xl font-bold leading-none tabular-nums',
        label: 'text-xs md:text-sm font-medium text-muted-foreground leading-tight',
      };

  return (
    <Card 
      className={cn(
        'w-full',
        glowClasses,
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
