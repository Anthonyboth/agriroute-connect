import * as React from "react"
import { Drawer as DrawerPrimitive } from "vaul"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

// ============================================
// Bottom Sheet - Estilo Instagram/Facebook (Meta)
// CORREÇÃO: z-index, pointer-events, overlay/content sync
// ============================================

interface BottomSheetProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

const BottomSheet = ({ open, onOpenChange, children }: BottomSheetProps) => (
  <DrawerPrimitive.Root
    open={open}
    onOpenChange={onOpenChange}
    shouldScaleBackground={false}
    // CRÍTICO: Sem nested modals e snap points limpos
  >
    {children}
  </DrawerPrimitive.Root>
)
BottomSheet.displayName = "BottomSheet"

const BottomSheetTrigger = DrawerPrimitive.Trigger
const BottomSheetClose = DrawerPrimitive.Close
const BottomSheetPortal = DrawerPrimitive.Portal

// Overlay com blur leve - z-index MENOR que o content
const BottomSheetOverlay = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DrawerPrimitive.Overlay
    ref={ref}
    className={cn(
      // CRÍTICO: z-40 (menor que content z-50)
      "fixed inset-0 z-40 bg-black/60 backdrop-blur-[2px]",
      "data-[state=open]:animate-in data-[state=closed]:animate-out",
      "data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    style={{ animationDuration: '220ms' }}
    {...props}
  />
))
BottomSheetOverlay.displayName = "BottomSheetOverlay"

// Container principal - estilo Meta Premium
interface BottomSheetContentProps extends React.ComponentPropsWithoutRef<typeof DrawerPrimitive.Content> {
  showCloseButton?: boolean;
}

const BottomSheetContent = React.forwardRef<
  React.ElementRef<typeof DrawerPrimitive.Content>,
  BottomSheetContentProps
>(({ className, children, showCloseButton = true, ...props }, ref) => (
  <BottomSheetPortal>
    <BottomSheetOverlay />
    <DrawerPrimitive.Content
      ref={ref}
      className={cn(
        // CRÍTICO: z-50 (maior que overlay z-40), pointer-events-auto
        "fixed z-50 flex flex-col bg-background overflow-hidden pointer-events-auto",
        // Mobile: bottom sheet ocupando 90% da altura
        "inset-x-0 bottom-0 h-[90dvh]",
        // Desktop: centralizado com tamanho máximo
        "md:inset-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
        "md:h-auto md:max-h-[85vh] md:w-full md:max-w-[720px]",
        // Borda e cantos estilo Meta - sem cortes
        "rounded-t-[24px] md:rounded-[24px]",
        "border border-border/50",
        // Sombra premium
        "shadow-[0_-12px_32px_rgba(0,0,0,0.12),0_-2px_8px_rgba(0,0,0,0.08)]",
        // Animações
        "duration-[220ms] ease-[cubic-bezier(0.2,0.8,0.2,1)]",
        "data-[state=open]:animate-in data-[state=closed]:animate-out",
        "data-[state=closed]:slide-out-to-bottom data-[state=open]:slide-in-from-bottom",
        "md:data-[state=closed]:slide-out-to-bottom-0 md:data-[state=open]:slide-in-from-bottom-0",
        "md:data-[state=closed]:fade-out-0 md:data-[state=open]:fade-in-0",
        "md:data-[state=closed]:zoom-out-95 md:data-[state=open]:zoom-in-95",
        className
      )}
      {...props}
    >
      {/* Drag Handle - estilo Meta */}
      <div className="flex justify-center pt-3 pb-1 md:hidden flex-shrink-0">
        <div 
          className="h-1 w-10 rounded-full bg-muted-foreground/30"
          aria-hidden="true"
        />
      </div>
      
      {children}

      {/* Botão fechar - discreto */}
      {showCloseButton && (
        <DrawerPrimitive.Close 
          className={cn(
            "absolute right-4 top-4 md:right-5 md:top-5",
            "p-2 rounded-full",
            "text-muted-foreground/70 hover:text-foreground",
            "hover:bg-muted",
            "transition-all duration-150",
            "focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
            // CRÍTICO: z-index alto para sempre estar clicável
            "z-[60]"
          )}
        >
          <X className="h-5 w-5" strokeWidth={2} />
          <span className="sr-only">Fechar</span>
        </DrawerPrimitive.Close>
      )}
    </DrawerPrimitive.Content>
  </BottomSheetPortal>
))
BottomSheetContent.displayName = "BottomSheetContent"

// Header com título e subtítulo
interface BottomSheetHeaderProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string;
  subtitle?: string;
}

const BottomSheetHeader = React.forwardRef<HTMLDivElement, BottomSheetHeaderProps>(
  ({ className, title, subtitle, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex flex-col px-5 pt-2 pb-4 md:px-6 md:pt-4 md:pb-5",
        "border-b border-border/50",
        "flex-shrink-0",
        className
      )}
      {...props}
    >
      <DrawerPrimitive.Title className="text-lg font-semibold text-foreground pr-8">
        {title}
      </DrawerPrimitive.Title>
      {subtitle && (
        <DrawerPrimitive.Description className="text-sm text-muted-foreground/70 mt-1">
          {subtitle}
        </DrawerPrimitive.Description>
      )}
    </div>
  )
)
BottomSheetHeader.displayName = "BottomSheetHeader"

// Body com scroll
const BottomSheetBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex-1 overflow-y-auto overscroll-contain",
      "px-5 py-4 md:px-6 md:py-5",
      // Scrollbar discreta
      "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
      className
    )}
    {...props}
  />
))
BottomSheetBody.displayName = "BottomSheetBody"

// Footer visual passivo - fecha o sheet visualmente
const BottomSheetFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Altura mínima para fechar o visual
      children ? "px-5 py-4 md:px-6 md:py-5" : "h-6",
      "border-t border-border/50",
      "bg-background",
      "flex-shrink-0",
      className
    )}
    style={{
      boxShadow: 'inset 0 1px 0 rgba(0,0,0,0.04)'
    }}
    {...props}
  >
    {children}
  </div>
))
BottomSheetFooter.displayName = "BottomSheetFooter"

export {
  BottomSheet,
  BottomSheetTrigger,
  BottomSheetClose,
  BottomSheetPortal,
  BottomSheetOverlay,
  BottomSheetContent,
  BottomSheetHeader,
  BottomSheetBody,
  BottomSheetFooter,
}
