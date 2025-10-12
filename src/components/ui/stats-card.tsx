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
      <CardContent className="p-6 flex items-center justify-center min-h-[120px]">
        <div className="flex items-start gap-3 w-full">
          <div className={cn("flex-shrink-0 mt-1", iconColor)}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground truncate leading-tight mb-2">
              {label}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-2xl font-bold leading-tight">
                {value}
              </p>
              {actionButton}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
