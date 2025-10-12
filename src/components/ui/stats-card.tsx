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
}

export const StatsCard: React.FC<StatsCardProps> = ({
  icon,
  label,
  value,
  iconColor = 'text-primary',
  onClick,
  actionButton,
  className
}) => {
  return (
    <Card 
      className={cn(
        "w-full shadow-sm border-2 hover:border-emerald-300 focus-within:border-emerald-300 active:border-emerald-300 transition-all cursor-pointer hover:shadow-md",
        className
      )}
      onClick={onClick}
    >
      <CardContent className="p-4 flex flex-col items-center justify-center text-center min-h-[100px]">
        <div className={cn("mb-2", iconColor)}>
          {icon}
        </div>
        <p className="text-2xl md:text-3xl font-bold leading-tight mb-1">
          {value}
        </p>
        <p className="text-xs md:text-sm font-medium text-muted-foreground">
          {label}
        </p>
        {actionButton && <div className="mt-2">{actionButton}</div>}
      </CardContent>
    </Card>
  );
};
