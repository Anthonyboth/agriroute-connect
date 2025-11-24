import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { X, ChevronUp, ChevronDown, Info, AlertTriangle, AlertCircle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type?: string;
  priority?: number;
  category?: string;
  archived?: boolean;
  starts_at?: string;
  ends_at?: string;
  metadata?: {
    whatsapp?: string;
    whatsapp_message?: string;
  };
};

export const GlobalAnnouncementBar = () => {
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    fetchActiveAnnouncement();
    
    // Subscrição para atualizações em tempo real
    const channel = supabase
      .channel('global-announcements')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'system_announcements' },
        () => {
          fetchActiveAnnouncement();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchActiveAnnouncement = async () => {
    const now = new Date().toISOString();
    
    const { data } = await supabase
      .from("system_announcements")
      .select("*")
      .eq("is_active", true)
      .eq("archived", false)
      .or(`starts_at.is.null,starts_at.lte.${now}`)
      .or(`ends_at.is.null,ends_at.gte.${now}`)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (data) {
      // Verificar se foi minimizado ou dispensado
      const minimized = localStorage.getItem(`announcement-${data.id}-minimized`);
      const dismissed = localStorage.getItem(`announcement-${data.id}-dismissed`);
      
      setAnnouncement(data as any);
      setIsMinimized(minimized === 'true');
      setIsDismissed(dismissed === 'true');
    } else {
      setAnnouncement(null);
    }
  };

  const handleMinimize = () => {
    if (!announcement) return;
    const newState = !isMinimized;
    setIsMinimized(newState);
    localStorage.setItem(`announcement-${announcement.id}-minimized`, String(newState));
  };

  const handleDismiss = () => {
    if (!announcement) return;
    setIsDismissed(true);
    localStorage.setItem(`announcement-${announcement.id}-dismissed`, 'true');
  };

  if (!announcement || isDismissed) return null;

  const getTypeStyles = () => {
    switch (announcement.type) {
      case 'warning':
        return 'bg-amber-500/10 border-amber-500/20 text-amber-900 dark:text-amber-100';
      case 'alert':
        return 'bg-red-500/10 border-red-500/20 text-red-900 dark:text-red-100';
      case 'success':
        return 'bg-green-500/10 border-green-500/20 text-green-900 dark:text-green-100';
      default:
        return 'bg-blue-500/10 border-blue-500/20 text-blue-900 dark:text-blue-100';
    }
  };

  const getIcon = () => {
    switch (announcement.type) {
      case 'warning':
        return <AlertTriangle className="h-4 w-4 shrink-0" />;
      case 'alert':
        return <AlertCircle className="h-4 w-4 shrink-0" />;
      case 'success':
        return <CheckCircle className="h-4 w-4 shrink-0" />;
      default:
        return <Info className="h-4 w-4 shrink-0" />;
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
              <span className="text-sm block mt-1">{announcement.message}</span>
              {announcement.metadata?.whatsapp && (
                <button
                  onClick={() => {
                    const phone = announcement.metadata?.whatsapp;
                    const message = encodeURIComponent(announcement.metadata?.whatsapp_message || 'Olá! Preciso de suporte');
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                  }}
                  className="mt-2 inline-flex items-center gap-2 px-3 py-1.5 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-md text-xs font-medium transition-colors"
                >
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
                  Suporte via WhatsApp
                </button>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleMinimize}
                aria-label="Minimizar"
              >
                <ChevronUp className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleDismiss}
                aria-label="Dispensar"
              >
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
