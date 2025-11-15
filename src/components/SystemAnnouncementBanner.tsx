import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

export const SystemAnnouncementBanner = () => {
  const [announcement, setAnnouncement] = useState<{
    id: string;
    title: string;
    message: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    const loadAnnouncement = async () => {
      if (!isMounted) return;
      await checkAndShowAnnouncement();
    };
    
    loadAnnouncement();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const checkAndShowAnnouncement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: announcements } = await supabase
        .from("system_announcements")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1);

      if (!announcements || announcements.length === 0) return;

      const activeAnnouncement = announcements[0];

      const { data: dismissal } = await supabase
        .from("user_announcement_dismissals")
        .select("*")
        .eq("user_id", user.id)
        .eq("announcement_id", activeAnnouncement.id)
        .maybeSingle();

      if (!dismissal) {
        setAnnouncement(activeAnnouncement);
      }
    } catch (error) {
      console.error("Erro ao verificar anúncios:", error);
    }
  };

  const handleDismiss = async () => {
    if (!announcement) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      await supabase
        .from("user_announcement_dismissals")
        .upsert({
          user_id: user.id,
          announcement_id: announcement.id,
          dismissed_at: new Date().toISOString(),
          last_seen_at: new Date().toISOString(),
        }, {
          onConflict: "user_id,announcement_id"
        });

      setAnnouncement(null);
    } catch (error) {
      console.error("Erro ao dismissar anúncio:", error);
      setAnnouncement(null);
    }
  };

  if (!announcement) return null;

  const paragraphs = announcement.message.split('\n\n');
  const warningIndex = paragraphs.findIndex(p => p.includes('⚠️'));
  const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
  const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

  return (
    <Card className="relative">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <h3 className="text-base font-semibold">{announcement.title}</h3>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="h-7 w-7 rounded-full hover:bg-muted -mt-1"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          {mainParagraphs.map((paragraph, index) => (
            <p key={`announcement-${announcement.id}-para-${index}`} className="text-sm leading-relaxed text-muted-foreground">
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
          <Button onClick={handleDismiss} size="sm" variant="secondary">
            Entendi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
