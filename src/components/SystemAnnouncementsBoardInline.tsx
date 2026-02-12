import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Megaphone, X, ChevronDown, ChevronUp } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type?: string;
  created_at?: string;
  priority?: number;
  category?: string;
  metadata?: {
    whatsapp?: string;
    whatsapp_message?: string;
  };
};

/**
 * Componente inline do Mural de Avisos para ser usado dentro do dashboard
 * Posicionado entre a busca e os cards de serviços
 */
export const SystemAnnouncementsBoardInline = () => {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    // Verificar se foi dispensado recentemente
    const dismissedAt = localStorage.getItem('mural_inline_dismissed_at');
    if (dismissedAt) {
      const dismissed = new Date(dismissedAt);
      const now = new Date();
      const hoursSince = (now.getTime() - dismissed.getTime()) / (1000 * 60 * 60);
      if (hoursSince < 12) {
        setIsDismissed(true);
        return;
      }
    }

    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    const { data } = await supabase
      .from("system_announcements")
      .select("*")
      .eq("is_active", true)
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(3);

    if (data && data.length > 0) {
      setAnnouncements(data as any);
    }
  };

  const handleDismiss = () => {
    localStorage.setItem('mural_inline_dismissed_at', new Date().toISOString());
    setIsDismissed(true);
  };

  if (isDismissed || announcements.length === 0) return null;

  const firstAnnouncement = announcements[0];
  const hasMore = announcements.length > 1;

  return (
    <Card className="mb-4 border-primary/20 bg-gradient-to-r from-primary/5 to-transparent">
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="p-2 rounded-full bg-primary/10 shrink-0">
              <Megaphone className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h4 className="font-semibold text-sm">Mural de Avisos</h4>
                {announcements.length > 0 && (
                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                    {announcements.length} {announcements.length === 1 ? 'aviso' : 'avisos'}
                  </span>
                )}
              </div>
              
              {/* Primeiro aviso sempre visível */}
              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{firstAnnouncement.title}</p>
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {firstAnnouncement.message.split('\n')[0]}
                  </p>
                </div>

                {/* Avisos adicionais quando expandido */}
                {isExpanded && announcements.slice(1).map((announcement) => (
                  <div key={announcement.id} className="pt-2 border-t">
                    <p className="text-sm font-medium">{announcement.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {announcement.message.split('\n')[0]}
                    </p>
                  </div>
                ))}
              </div>

              {/* Botão expandir/recolher */}
              {hasMore && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="mt-2 h-7 px-2 text-xs text-primary hover:text-primary"
                  onClick={() => setIsExpanded(!isExpanded)}
                >
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 mr-1" />
                      Mostrar menos
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 mr-1" />
                      Ver mais {announcements.length - 1} {announcements.length - 1 === 1 ? 'aviso' : 'avisos'}
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

          {/* Botão fechar */}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0 rounded-md border-2 border-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
            onClick={handleDismiss}
            aria-label="Fechar mural"
          >
            <X className="h-4 w-4 text-red-600 dark:text-red-400" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
