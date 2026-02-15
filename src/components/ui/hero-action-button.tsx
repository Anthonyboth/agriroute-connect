import * as React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface HeroActionButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * HeroActionButton - Botão padronizado para seções Hero em todos os painéis
 * 
 * Padrão visual:
 * - Fundo branco (mesmo no dark mode)
 * - Texto verde (primary)
 * - Borda suave cinza
 * - Arredondado (pill)
 * - Efeitos de hover/active/focus consistentes
 */
const HeroActionButton = React.forwardRef<HTMLButtonElement, HeroActionButtonProps>(
  ({ className, icon, children, ...props }, ref) => {
    return (
      <Button
        ref={ref}
        type="button"
        className={cn(
          // Base styles - bolha transparente
          "bg-white/20 backdrop-blur-md text-white/90 font-semibold",
          "border border-white/30",
          "rounded-full",
          // Sizing
          "h-9 px-4 text-xs",
          "w-full sm:w-auto max-w-[220px]",
          // Icon spacing
          "gap-2",
          // Hover effects
          "hover:bg-white/30 hover:shadow-md hover:shadow-black/10 hover:-translate-y-[1px]",
          // Active/pressed
          "active:translate-y-0 active:bg-white/25 active:shadow-none",
          // Focus accessible
          "focus-visible:ring-2 focus-visible:ring-white/50 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent",
          // Disabled
          "disabled:opacity-60 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0",
          // Transitions
          "transition-all duration-200",
          // User className override
          className
        )}
        {...props}
      >
        {icon && <span className="h-4 w-4 flex-shrink-0">{icon}</span>}
        {children}
      </Button>
    );
  }
);
HeroActionButton.displayName = "HeroActionButton";

export { HeroActionButton };
