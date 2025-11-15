import { useState, useEffect } from "react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X, Megaphone } from "lucide-react";

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
    <div className="w-full mb-4">
      <Alert className="relative border-primary/30 bg-primary/5">
        <Megaphone className="h-5 w-5 text-primary" />
        <AlertTitle className="flex items-center justify-between pr-8 mb-2">
          <span className="text-lg font-semibold">{announcement.title}</span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleDismiss}
            className="absolute right-2 top-2 h-6 w-6 rounded-full hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </Button>
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <div className="space-y-2">
            {mainParagraphs.map((paragraph, index) => (
              <p key={`announcement-${announcement.id}-para-${index}`} className="text-sm leading-relaxed">
                {paragraph}
              </p>
            ))}
          </div>

          {warningParagraph && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-600 dark:border-amber-800 rounded-lg p-3 mt-3">
              <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed font-medium whitespace-pre-line">
                {warningParagraph}
              </p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <Button onClick={handleDismiss} size="sm">
              Entendi
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    </div>
  );
};
