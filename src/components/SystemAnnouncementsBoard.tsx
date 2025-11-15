import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

type Announcement = {
  id: string;
  title: string;
  message: string;
  type?: string;
  created_at?: string;
  priority?: number;
};

export const SystemAnnouncementsBoard = () => {
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<Announcement[]>([]);

  useEffect(() => {
    let mounted = true;

    const fetchAnnouncements = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar todos os anúncios ativos
      const { data: announcements } = await supabase
        .from("system_announcements")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false });

      if (!announcements || announcements.length === 0) return;

      // Buscar dismissals do usuário
      const { data: dismissals } = await supabase
        .from("user_announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id);

      const dismissedIds = new Set((dismissals || []).map(d => d.announcement_id));
      const filtered = announcements.filter(a => !dismissedIds.has(a.id));

      if (mounted) {
        setVisibleAnnouncements(filtered);
      }
    };

    fetchAnnouncements();

    return () => {
      mounted = false;
    };
  }, []);

  const handleDismiss = async (announcement: Announcement) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from("user_announcement_dismissals")
      .upsert({
        user_id: user.id,
        announcement_id: announcement.id,
        dismissed_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
      }, { onConflict: "user_id,announcement_id" });

    setVisibleAnnouncements(prev => prev.filter(a => a.id !== announcement.id));
  };

  if (visibleAnnouncements.length === 0) return null;

  // Separar "Palavras da Salvação" dos demais
  const salvationAnnouncement = visibleAnnouncements.find(a => a.type === 'success');
  const otherAnnouncements = visibleAnnouncements.filter(a => a.type !== 'success');

  return (
    <Card className="relative">
      <CardContent className="pt-6 space-y-4">
        {/* Palavras da Salvação - Box Verde no topo */}
        {salvationAnnouncement && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md p-4">
            <div className="flex items-start justify-between gap-4 mb-3">
              <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100">
                {salvationAnnouncement.title}
              </h3>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => handleDismiss(salvationAnnouncement)}
                className="h-7 w-7 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-900 -mt-1"
              >
                <X className="h-4 w-4 text-emerald-900 dark:text-emerald-100" />
              </Button>
            </div>
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100 whitespace-pre-line mb-4">
              {salvationAnnouncement.message}
            </p>
            <div className="flex justify-end">
              <Button 
                onClick={() => handleDismiss(salvationAnnouncement)} 
                size="sm" 
                variant="secondary"
                className="bg-emerald-100 dark:bg-emerald-900 text-emerald-900 dark:text-emerald-100 hover:bg-emerald-200 dark:hover:bg-emerald-800"
              >
                Entendi
              </Button>
            </div>
          </div>
        )}

        {/* Demais avisos como subseções */}
        {otherAnnouncements.map((announcement) => {
          const paragraphs = announcement.message.split("\n\n");
          const warningIndex = paragraphs.findIndex(p => p.includes("⚠️"));
          const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
          const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

          return (
            <div key={announcement.id} className="border rounded-md p-4">
              <div className="flex items-start justify-between gap-4 mb-3">
                <h3 className="text-base font-semibold">{announcement.title}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDismiss(announcement)}
                  className="h-7 w-7 rounded-full hover:bg-muted -mt-1"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="space-y-2 mb-4">
                {mainParagraphs.map((paragraph, index) => (
                  <p
                    key={`${announcement.id}-p-${index}`}
                    className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line"
                  >
                    {paragraph}
                  </p>
                ))}
              </div>

              {warningParagraph && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4">
                  <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">
                    {warningParagraph}
                  </p>
                </div>
              )}

              <div className="flex justify-end">
                <Button onClick={() => handleDismiss(announcement)} size="sm" variant="secondary">
                  Entendi
                </Button>
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
