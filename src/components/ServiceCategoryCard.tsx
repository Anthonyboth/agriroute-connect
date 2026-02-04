import React from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ============================================
// Card de Categoria - Estilo Facebook/Instagram
// ============================================

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
  return (
    <button
      onClick={() => onClick(id)}
      className={cn(
        // Layout
        "group w-full flex items-center gap-3 p-4",
        // Card base
        "rounded-2xl border",
        "transition-all duration-150 ease-out",
        // Estados
        isActive
          ? "border-primary/30 bg-primary/5"
          : "border-border/60 bg-card hover:bg-muted/40",
        // Hover
        "hover:-translate-y-0.5 hover:shadow-sm",
        // Focus
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Touch
        "active:scale-[0.99]"
      )}
    >
      {/* Ícone em chip circular */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-10 h-10 rounded-full",
          "bg-primary/10",
          iconColor
        )}
      >
        <IconComponent className="h-5 w-5" strokeWidth={1.75} />
      </div>

      {/* Conteúdo central */}
      <div className="flex-1 min-w-0 text-left">
        <h3 className="font-medium text-foreground group-hover:text-primary transition-colors duration-150 line-clamp-1">
          {title}
        </h3>
        <p className="text-sm text-muted-foreground/80 line-clamp-1 mt-0.5">
          {description}
        </p>
      </div>

      {/* Badge e Chevron */}
      <div className="flex-shrink-0 flex items-center gap-2">
        {/* Badge de contagem */}
        <span 
          className={cn(
            "inline-flex items-center justify-center",
            "px-2 py-0.5 rounded-full",
            "text-xs font-medium",
            "bg-muted text-muted-foreground",
            "border border-border/50"
          )}
        >
          {count} {count === 1 ? "tipo" : "tipos"}
        </span>

        {/* Chevron */}
        <ChevronRight 
          className={cn(
            "h-4 w-4 text-muted-foreground/60",
            "transition-all duration-150",
            "group-hover:text-muted-foreground group-hover:translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
};
