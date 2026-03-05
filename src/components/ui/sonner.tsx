import { useTheme } from "next-themes"
import { Toaster as Sonner, toast as sonnerToast } from "sonner"

type ToasterProps = React.ComponentProps<typeof Sonner>

/**
 * Global toast throttle — 5s minimum between any two toasts.
 * Prevents notification flooding on the user's screen.
 */
let lastGlobalToastTime = 0;
const MIN_TOAST_GAP_MS = 5_000;

function isThrottled(): boolean {
  const now = Date.now();
  if (now - lastGlobalToastTime < MIN_TOAST_GAP_MS) {
    console.log('[Toast] Throttled — min 5s between notifications');
    return true;
  }
  lastGlobalToastTime = now;
  return false;
}

type ToastParams = Parameters<typeof sonnerToast>;
const toast = ((message: ToastParams[0], data?: ToastParams[1]) => {
  if (isThrottled()) return;
  return sonnerToast(message, data);
}) as typeof sonnerToast;

// Proxy all typed methods with throttle
toast.success = (m: ToastParams[0], d?: ToastParams[1]) => { if (!isThrottled()) return sonnerToast.success(m, d); };
toast.error = (m: ToastParams[0], d?: ToastParams[1]) => { if (!isThrottled()) return sonnerToast.error(m, d); };
toast.warning = (m: ToastParams[0], d?: ToastParams[1]) => { if (!isThrottled()) return sonnerToast.warning(m, d); };
toast.info = (m: ToastParams[0], d?: ToastParams[1]) => { if (!isThrottled()) return sonnerToast.info(m, d); };
toast.message = (m: ToastParams[0], d?: ToastParams[1]) => { if (!isThrottled()) return sonnerToast.message(m, d); };
toast.loading = sonnerToast.loading;
toast.promise = sonnerToast.promise;
toast.dismiss = sonnerToast.dismiss;
toast.custom = sonnerToast.custom;

/**
 * Toaster configurado para SEMPRE aparecer acima de todos os elementos.
 * Z-index máximo: 2147483647 (32-bit signed int max)
 * 
 * visibleToasts=1 + duration=5000 — no flooding.
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
      visibleToasts={1}
      duration={5000}
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
          zIndex: 2147483647,
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
