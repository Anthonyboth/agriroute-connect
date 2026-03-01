import React, { useCallback } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { ERP } from "@/styles/agri-erp";

// ============================================
// AgriCategoryRow — Card de Categoria (ERP multicolorido)
// 60% base neutro, 30% cor da categoria, 10% acento
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
  const handleClick = useCallback((e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    e.stopPropagation();
    onClick(id);
  }, [id, onClick]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onClick(id);
    }
  }, [id, onClick]);

  // Resolve category color — fallback to agricultural (green)
  const colors = ERP.catColors[id] || ERP.catColors.agricultural;

  return (
    <button
      type="button"
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${title} - ${count} ${count === 1 ? 'tipo' : 'tipos'} de serviço`}
      className={cn(
        // Layout — row alinhado
        "group w-full flex items-center gap-3.5 p-4",
        // 60% base + 30% cor da categoria
        "rounded-2xl border transition-all duration-150 ease-out",
        colors.bg, colors.border, colors.bgHover,
        // Estado ativo
        isActive && "ring-1 ring-primary/20",
        // Hover enterprise
        "hover:-translate-y-0.5 hover:shadow-sm",
        // Focus acessibilidade
        "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
        // Touch
        "active:scale-[0.99]",
        "pointer-events-auto cursor-pointer"
      )}
    >
      {/* Ícone — cor da categoria */}
      <div
        className={cn(
          "flex-shrink-0 flex items-center justify-center",
          "w-11 h-11 rounded-xl border",
          colors.text, colors.bg, colors.border,
          "transition-all duration-150",
          "group-hover:scale-105"
        )}
      >
        <IconComponent className="h-5 w-5" strokeWidth={1.75} />
      </div>

      {/* Conteúdo — grid fixo */}
      <div className="flex-1 min-w-0 text-left">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-foreground transition-colors duration-150 truncate">
            {title}
          </h3>
          {/* Badge com cor da categoria */}
          <span
            className={cn(
              "inline-flex items-center justify-center",
              "h-6 px-2 rounded-full",
              "text-xs font-semibold leading-none whitespace-nowrap",
              "border",
              colors.chipBg
            )}
          >
            {count} {count === 1 ? "tipo" : "tipos"}
          </span>
        </div>
        <p className="text-sm text-muted-foreground truncate mt-0.5">
          {description}
        </p>
      </div>

      {/* Chevron */}
      <div className="flex-shrink-0">
        <ChevronRight
          className={cn(
            "h-4 w-4 text-muted-foreground/50",
            "transition-all duration-150",
            "group-hover:text-muted-foreground group-hover:translate-x-0.5"
          )}
        />
      </div>
    </button>
  );
};
