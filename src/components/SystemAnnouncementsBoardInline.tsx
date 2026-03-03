import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Megaphone, X, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import { useAnnouncements } from "@/hooks/useAnnouncements";

/**
 * Componente inline do Mural de Avisos para ser usado dentro do dashboard
 * Posicionado entre a busca e os cards de serviços
 */
export const SystemAnnouncementsBoardInline = () => {
  const { announcements, isLoading, trackCtaClick } = useAnnouncements({
    limit: 3,
    enableRealtime: false,
    trackViews: true,
  });
  const [isExpanded, setIsExpanded] = useState(false);
  const [isDismissed, setIsDismissed] = useState(() => {
    const dismissedAt = localStorage.getItem("mural_inline_dismissed_at");
    if (!dismissedAt) return false;
    const hoursSince = (Date.now() - new Date(dismissedAt).getTime()) / (1000 * 60 * 60);
    return hoursSince < 12;
  });

  const handleDismiss = () => {
    localStorage.setItem("mural_inline_dismissed_at", new Date().toISOString());
    setIsDismissed(true);
  };

  if (isDismissed || isLoading || announcements.length === 0) return null;

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
                <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                  {announcements.length} {announcements.length === 1 ? "aviso" : "avisos"}
                </span>
              </div>

              <div className="space-y-2">
                <div>
                  <p className="text-sm font-medium">{firstAnnouncement.title}</p>
                  {firstAnnouncement.subtitle && (
                    <p className="text-xs text-muted-foreground">{firstAnnouncement.subtitle}</p>
                  )}
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {firstAnnouncement.message.split("\n")[0]}
                  </p>
                  {firstAnnouncement.cta_text && firstAnnouncement.cta_url && (
                    <a
                      href={firstAnnouncement.cta_url}
                      target={firstAnnouncement.cta_url.startsWith("http") ? "_blank" : undefined}
                      rel="noopener noreferrer"
                      onClick={() => trackCtaClick(firstAnnouncement.id)}
                      className="text-xs text-primary font-medium hover:underline mt-1 inline-block"
                    >
                      {firstAnnouncement.cta_text} →
                    </a>
                  )}
                </div>

                {isExpanded &&
                  announcements.slice(1).map((a) => (
                    <div key={a.id} className="pt-2 border-t">
                      <p className="text-sm font-medium">{a.title}</p>
                      {a.subtitle && <p className="text-xs text-muted-foreground">{a.subtitle}</p>}
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {a.message.split("\n")[0]}
                      </p>
                      {a.cta_text && a.cta_url && (
                        <a
                          href={a.cta_url}
                          target={a.cta_url.startsWith("http") ? "_blank" : undefined}
                          rel="noopener noreferrer"
                          onClick={() => trackCtaClick(a.id)}
                          className="text-xs text-primary font-medium hover:underline mt-1 inline-block"
                        >
                          {a.cta_text} →
                        </a>
                      )}
                    </div>
                  ))}
              </div>

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
                      Ver mais {announcements.length - 1} aviso(s)
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>

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
