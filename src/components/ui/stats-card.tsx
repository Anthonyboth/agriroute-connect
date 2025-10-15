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
        card: 'rounded-md border hover:border-emerald-300 hover:shadow-sm min-h-[90px]',
        content: 'p-3 flex flex-col items-center justify-between text-center h-full',
        iconWrap: 'mb-1',
        value: 'text-xl md:text-2xl font-semibold leading-tight mb-1',
        label: 'text-[11px] md:text-xs font-medium text-muted-foreground',
      }
    : {
        card: 'rounded-lg border-2 hover:border-emerald-300 hover:shadow-md min-h-[100px]',
        content: 'p-4 flex flex-col items-center justify-between text-center h-full',
        iconWrap: 'mb-2',
        value: 'text-2xl md:text-3xl font-bold leading-tight mb-1',
        label: 'text-xs md:text-sm font-medium text-muted-foreground',
      };

  return (
    <Card 
      className={cn(
        'w-full transition-all',
        styles.card,
        isClickable && 'cursor-pointer',
        className
      )}
      onClick={onClick}
    >
      <CardContent className={styles.content}>
        <div className={cn(styles.iconWrap, iconColor)}>
          {icon}
        </div>
        <p className={styles.value}>
          {value}
        </p>
        <p className={styles.label}>
          {label}
        </p>
        {actionButton && <div className="mt-2">{actionButton}</div>}
      </CardContent>
    </Card>
  );
};
