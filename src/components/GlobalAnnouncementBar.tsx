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
      
      setAnnouncement(data);
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
        <div className="container mx-auto px-4 py-2 flex items-center gap-3">
          {getIcon()}
          <div className="flex-1 flex items-center gap-3 min-w-0">
            <span className="font-semibold text-sm">{announcement.title}</span>
            <span className="text-sm truncate">{announcement.message}</span>
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
      )}
      {isMinimized && (
        <div className="absolute inset-0 flex items-center justify-center">
          <ChevronDown className="h-3 w-3 opacity-50" />
        </div>
      )}
    </div>
  );
};
