import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronUp, ChevronDown, Info, AlertTriangle, AlertCircle, CheckCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export const GlobalAnnouncementBar = () => {
  const { announcements, trackCtaClick } = useAnnouncements({
    limit: 1,
    enableRealtime: true,
    trackViews: true,
  });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  const announcement = announcements[0] || null;

  useEffect(() => {
    if (!announcement) return;
    const dismissed = localStorage.getItem(`announcement-${announcement.id}-dismissed`);
    const minimized = localStorage.getItem(`announcement-${announcement.id}-minimized`);
    setIsDismissed(dismissed === "true");
    setIsMinimized(minimized === "true");
  }, [announcement?.id]);

  const handleMinimize = () => {
    if (!announcement) return;
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem(`announcement-${announcement.id}-minimized`, String(newState));
  };

  const handleDismiss = () => {
    if (!announcement) return;
    setIsDismissed(true);
    localStorage.setItem(`announcement-${announcement.id}-dismissed`, "true");
  };

  if (!announcement || isDismissed) return null;

  const getTypeStyles = () => {
    switch (announcement.type) {
      case "warning": return "bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100";
      case "alert": return "bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-100";
      case "success": return "bg-green-500/10 border-green-500/20 text-green-900 dark:text-green-100";
      default: return "bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100";
    }
  };

  const getIcon = () => {
    const cls = "h-4 w-4 shrink-0";
    switch (announcement.type) {
      case "warning": return <AlertTriangle className={cls} />;
      case "alert": return <AlertCircle className={cls} />;
      case "success": return <CheckCircle className={cls} />;
      default: return <Info className={cls} />;
    }
  };

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-50 border-b transition-all duration-300",
        getTypeStyles(),
        isMinimized ? "h-2 cursor-pointer" : "h-auto"
      )}
      onClick={isMinimized ? handleMinimize : undefined}
    >
      {!isMinimized && (
        <div className="container mx-auto px-4 py-2">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div className="flex-1 min-w-0">
              <span className="font-semibold text-sm block">{announcement.title}</span>
              {announcement.subtitle && <span className="text-xs opacity-80 block">{announcement.subtitle}</span>}
              <span className="text-sm block mt-1">{announcement.message}</span>
              <div className="flex flex-wrap gap-2 mt-2">
                {announcement.cta_text && announcement.cta_url && (
                  <a
                    href={announcement.cta_url}
                    target={announcement.cta_url.startsWith("http") ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    onClick={() => trackCtaClick(announcement.id)}
                    className="inline-flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium transition-colors hover:bg-primary/90"
                  >
                    {announcement.cta_text}
                    {announcement.cta_url.startsWith("http") && <ExternalLink className="h-3 w-3" />}
                  </a>
                )}
                {announcement.metadata?.whatsapp && (
                  <button
                    type="button"
                    onClick={() => {
                      const phone = announcement.metadata?.whatsapp;
                      const message = encodeURIComponent(announcement.metadata?.whatsapp_message || "Olá!");
                      window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
                    }}
                    className="inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-md text-xs font-medium transition-colors"
                  >
                    WhatsApp
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleMinimize} aria-label="Minimizar">
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon" className="h-6 w-6" onClick={handleDismiss} aria-label="Dispensar">
                <X className="h-3 w-3" />
              </Button>
            </div>
          </div>
        </div>
      )}
      {isMinimized && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ChevronDown className="h-3 w-3 opacity-50" />
        </div>
      )}
    </div>
  );
};
