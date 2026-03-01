import { useToast } from "@/hooks/use-toast"
import {
  Toast,
  ToastClose,
  ToastDescription,
  ToastProvider,
  ToastTitle,
  ToastViewport,
} from "@/components/ui/toast"
import { CheckCircle2, XCircle, AlertTriangle, Info } from "lucide-react"

export function Toaster() {
  const { toasts } = useToast()

  // Don't render anything (including ToastViewport) when there are no toasts
  // This prevents a blank notification box from appearing alongside Sonner toasts
  if (toasts.length === 0) return null;

  const getIcon = (variant?: string) => {
    switch (variant) {
      case 'destructive':
        return <XCircle className="h-5 w-5 text-destructive-foreground shrink-0" />
      case 'success':
        return <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400 shrink-0" />
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0" />
      default:
        return <Info className="h-5 w-5 text-primary shrink-0" />
    }
  }

  return (
    <ToastProvider>
      {toasts.map(function ({ id, title, description, action, variant, ...props }) {
        return (
          <Toast key={id} variant={variant} {...props}>
            <div className="flex gap-3 items-start">
              {getIcon(variant)}
              <div className="grid gap-1 flex-1">
                {title && <ToastTitle>{title}</ToastTitle>}
                {description && (
                  <ToastDescription>{description}</ToastDescription>
                )}
              </div>
            </div>
            {action}
            <ToastClose />
          </Toast>
        )
      })}
      <ToastViewport />
    </ToastProvider>
  )
}
