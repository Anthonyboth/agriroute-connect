import React, { useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Card de Categoria - Estilo Facebook/Instagram Premium
// CORREÇÃO: onClick, tabIndex, acessibilidade
// ============================================

// Cores de fundo por categoria (tons suaves Meta)
const categoryBackgrounds: Record<string, string> = {
  freight: "bg-orange-50 dark:bg-orange-950/30",
  agricultural: "bg-green-50 dark:bg-green-950/30",
  logistics: "bg-blue-50 dark:bg-blue-950/30",
  technical: "bg-purple-50 dark:bg-purple-950/30",
  urban: "bg-slate-50 dark:bg-slate-950/30",
  all: "bg-primary/5",
};

// Cores de fundo do ícone por categoria
const iconBackgrounds: Record<string, string> = {
  freight: "bg-orange-100 dark:bg-orange-900/50 border-orange-200/60 dark:border-orange-700/50",
  agricultural: "bg-green-100 dark:bg-green-900/50 border-green-200/60 dark:border-green-700/50",
  logistics: "bg-blue-100 dark:bg-blue-900/50 border-blue-200/60 dark:border-blue-700/50",
  technical: "bg-purple-100 dark:bg-purple-900/50 border-purple-200/60 dark:border-purple-700/50",
  urban: "bg-slate-100 dark:bg-slate-900/50 border-slate-200/60 dark:border-slate-700/50",
  all: "bg-primary/15 border-primary/20",
};

interface ServiceCategoryCardProps {
  id: string;
  title: string;
  description: string;
  count: number;
  icon: React.ElementType;
  iconColor: string;
  onClick: (id: string) => void;
  isActive?: boolean;
}

export const ServiceCategoryCard: React.FC<ServiceCategoryCardProps> = ({
  id,
  title,
  description,
  count,
  icon: IconComponent,
  iconColor,
  onClick,
  isActive = false,
}) => {
  const bgColor = categoryBackgrounds[id] || categoryBackgrounds.all;
  const iconBg = iconBackgrounds[id] || iconBackgrounds.all;

  // CRÍTICO: Handler de clique robusto
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id);
  }, [id, onClick]);

  // CRÍTICO: Suporte a teclado (Enter/Space)
  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(id);
    }
  }, [id, onClick]);

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title} - ${count} ${count === 1 ? 'tipo' : 'tipos'} de serviço`}
      className={cn(
        // Layout
        "group w-full flex items-center gap-3.5 p-4",
        // Card base com gradiente sutil
        "rounded-2xl border border-border/60",
        "transition-all duration-150 ease-out",
        // Fundo por categoria
        bgColor,
        // Estados
        isActive && "border-primary/30 ring-1 ring-primary/20",
        // Hover premium
        "hover:-translate-y-0.5",
        "hover:shadow-[0_4px_12px_rgba(0,0,0,0.06)]",
        // Focus acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Touch feedback
        "active:scale-[0.99]",
        // CRÍTICO: pointer-events sempre ativo
        "pointer-events-auto",
        // Cursor pointer
        "cursor-pointer"
      )}
    >
      {/* Ícone em container maior com presença visual */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-11 h-11 rounded-xl",
          "border",
          iconBg,
          iconColor,
          "transition-all duration-150",
          "group-hover:scale-105"
        )}
      >
        <IconComponent className="h-5 w-5" strokeWidth={1.75} />
      </div>

      {/* Conteúdo central com hierarquia clara */}
      <div className="flex-1 min-w-0 text-left">
        {/* Linha 1: Título + Badge */}
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors duration-150 line-clamp-1">
            {title}
          </h3>
          {/* Badge de contagem mais visível */}
          <span 
            className={cn(
              "inline-flex items-center justify-center",
              "px-2 py-0.5 rounded-full",
              "text-xs font-medium",
              "bg-background/80 text-muted-foreground",
              "border border-border/60",
              "shadow-sm"
            )}
          >
            {count} {count === 1 ? "tipo" : "tipos"}
          </span>
        </div>
        
        {/* Linha 2: Descrição */}
        <p className="text-sm text-muted-foreground/70 line-clamp-1 mt-0.5">
          {description}
        </p>
      </div>

      {/* Chevron discreto */}
      <div className="flex-shrink-0">
        <ChevronRight 
          className={cn(
            "h-4 w-4 text-muted-foreground/50",
            "transition-all duration-150",
            "group-hover:text-muted-foreground/80 group-hover:translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
};
