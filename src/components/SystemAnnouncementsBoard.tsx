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

  return (
    <div className="space-y-4">
      {visibleAnnouncements.map((announcement) => {
        const paragraphs = announcement.message.split("\n\n");
        const warningIndex = paragraphs.findIndex(p => p.includes("⚠️"));
        const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
        const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

        return (
          <Card key={announcement.id} className="relative">
            <CardContent className="pt-6">
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
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};
