import React from 'react';
import { cn } from '@/lib/utils';

interface AgriChipProps {
  tone?: 'neutral' | 'verified' | 'highlight';
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

/**
 * AgriChip — Chip padronizado com altura fixa, baseline alinhado.
 * 60/30/10: neutral = 30% (muted), verified = 10% (primary), highlight = 10% (accent)
 */
export const AgriChip: React.FC<AgriChipProps> = ({ tone = 'neutral', icon, children, className }) => {
  const toneClasses = {
    neutral: 'bg-muted/60 text-muted-foreground border-border',
    verified: 'bg-primary/10 text-primary border-primary/20',
    highlight: 'bg-accent/60 text-accent-foreground border-accent/30',
  };

  return (
    <span
      className={cn(
        'h-6 inline-flex items-center gap-1.5 px-2.5 rounded-full border text-[11px] font-semibold leading-none whitespace-nowrap',
        toneClasses[tone],
        className
      )}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
};
