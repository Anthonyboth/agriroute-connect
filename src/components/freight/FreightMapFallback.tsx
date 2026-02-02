/**
 * Componente fallback para quando o mapa não carrega
 */
import React from 'react';
import { MapPin } from 'lucide-react';

interface FreightMapFallbackProps {
  freightId?: string;
  className?: string;
}

export const FreightMapFallback: React.FC<FreightMapFallbackProps> = ({ className }) => {
  return (
    <div className={`flex flex-col items-center justify-center h-[300px] bg-muted/50 rounded-lg border border-dashed gap-2 ${className || ''}`}>
      <MapPin className="h-8 w-8 text-muted-foreground/50" />
      <span className="text-muted-foreground text-sm">Mapa indisponível no momento</span>
      <span className="text-muted-foreground text-xs">Tente recarregar a página</span>
    </div>
  );
};

export default FreightMapFallback;
