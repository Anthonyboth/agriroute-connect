import * as React from "react";
import { cn } from "@/lib/utils";
import { getButtonSafePosition } from "@/lib/layout-utils";
import { zIndexClasses } from "@/lib/z-index-manager";

interface SafePositionedElementProps {
  /**
   * Posição do elemento na tela
   */
  position: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'center-top' | 'center-bottom';
  
  /**
   * Conteúdo a ser renderizado
   */
  children: React.ReactNode;
  
  /**
   * Camada de z-index (opcional)
   * @default 'dialog'
   */
  zIndex?: keyof typeof zIndexClasses;
  
  /**
   * Classes CSS adicionais
   */
  className?: string;
  
  /**
   * Se verdadeiro, o elemento terá pointer-events: none
   * (útil para overlays que não devem capturar cliques)
   */
  preventPointerEvents?: boolean;
}

/**
 * Componente wrapper que garante que elementos posicionados absolutamente
 * não se sobreponham ao conteúdo e tenham z-index correto.
 * 
 * @example
 * ```tsx
 * <SafePositionedElement position="top-right" zIndex="dialogClose">
 *   <Button>Fechar</Button>
 * </SafePositionedElement>
 * ```
 */
export const SafePositionedElement = React.forwardRef<
  HTMLDivElement,
  SafePositionedElementProps
>(({ position, children, zIndex = 'dialog', className, preventPointerEvents = false, ...props }, ref) => {
  const positionClasses = getButtonSafePosition(position);
  const zIndexClass = zIndexClasses[zIndex];
  
  return (
    <div
      ref={ref}
      className={cn(
        positionClasses,
        zIndexClass,
        preventPointerEvents && 'pointer-events-none',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
});

SafePositionedElement.displayName = "SafePositionedElement";
