import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Toaster configurado para SEMPRE aparecer acima de todos os elementos.
 * Z-index máximo: 2147483647 (32-bit signed int max)
 * 
 * Isso garante que notificações apareçam sobre:
 * - Modais e Dialogs
 * - Sheets e Drawers  
 * - Popovers e Dropdowns
 * - Qualquer outro elemento com z-index alto
 */
const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group !z-[2147483647]"
      position="top-center"
      expand={false}
      richColors
      closeButton
      duration={3000}
      icons={{
        success: null,
        error: null,
        info: null,
        warning: null,
        loading: null,
      }}
      toastOptions={{
        classNames: {
          toast:
            "relative group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-2xl pl-8 !z-[2147483647]",
          description: "group-[.toast]:text-muted-foreground text-sm",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton: "group-[.toast]:bg-background group-[.toast]:border-border",
        },
        style: {
          // Força z-index máximo inline para garantir sobreposição
          zIndex: 2147483647,
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
