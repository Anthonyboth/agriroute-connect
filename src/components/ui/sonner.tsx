import { useTheme } from "next-themes"
import { Toaster as Sonner, toast } from "sonner"
import { X } from "lucide-react"

type ToasterProps = React.ComponentProps<typeof Sonner>

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group z-[120]"
      closeButton
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
            "relative group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg pl-6",
          description: "group-[.toast]:text-muted-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
          closeButton:
            "absolute left-2 top-2 grid place-items-center p-0 m-0 h-4 w-4 text-foreground/70 hover:text-foreground dark:text-foreground/70 dark:hover:text-foreground !bg-transparent !border-0 !shadow-none ring-0 outline-none [-webkit-tap-highlight-color:transparent]",
        },
      }}
      {...props}
    />
  )
}

export { Toaster, toast }
