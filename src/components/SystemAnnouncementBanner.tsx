import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export const SystemAnnouncementBanner = () => {
  const { announcements, trackCtaClick } = useAnnouncements({
    limit: 1,
    enableRealtime: false,
    trackViews: true,
  });
  const [isDismissed, setIsDismissed] = useState(false);
  const [checkedDismissal, setCheckedDismissal] = useState(false);

  const announcement = announcements[0] || null;

  useEffect(() => {
    if (!announcement || checkedDismissal) return;

    const checkDismissal = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setCheckedDismissal(true); return; }

      const { data: dismissal } = await supabase
        .from("user_announcement_dismissals")
        .select("id")
        .eq("user_id", user.id)
        .eq("announcement_id", announcement.id)
        .maybeSingle();

      if (dismissal) setIsDismissed(true);
      setCheckedDismissal(true);
    };

    checkDismissal();
  }, [announcement?.id, checkedDismissal]);

  const handleDismiss = async () => {
    if (!announcement) return;
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase
          .from("user_announcement_dismissals")
          .upsert(
            { user_id: user.id, announcement_id: announcement.id, dismissed_at: new Date().toISOString(), last_seen_at: new Date().toISOString() },
            { onConflict: "user_id,announcement_id" }
          );
      }
    } catch {}
    setIsDismissed(true);
  };

  if (!announcement || isDismissed) return null;

  const paragraphs = announcement.message.split("\n\n");
  const warningIndex = paragraphs.findIndex(p => p.includes("⚠️"));
  const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
  const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

  return (
    <Card className="relative">
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4 mb-3">
          <div>
            <h3 className="text-base font-semibold">{announcement.title}</h3>
            {announcement.subtitle && <p className="text-sm text-muted-foreground">{announcement.subtitle}</p>}
          </div>
          <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-7 w-7 rounded-full hover:bg-muted -mt-1">
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="space-y-2 mb-4">
          {mainParagraphs.map((paragraph, index) => (
            <p key={`banner-para-${index}`} className="text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
          ))}
        </div>

        {warningParagraph && (
          <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3 mb-4">
            <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">{warningParagraph}</p>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          {announcement.cta_text && announcement.cta_url && (
            <Button asChild size="sm" className="flex-1" onClick={() => trackCtaClick(announcement.id)}>
              <a href={announcement.cta_url} target={announcement.cta_url.startsWith("http") ? "_blank" : undefined} rel="noopener noreferrer">
                {announcement.cta_text}
              </a>
            </Button>
          )}
          {announcement.metadata?.whatsapp && (
            <Button
              onClick={() => {
                const phone = announcement.metadata?.whatsapp;
                const msg = encodeURIComponent(announcement.metadata?.whatsapp_message || "Olá!");
                window.open(`https://wa.me/${phone}?text=${msg}`, "_blank");
              }}
              variant="default"
              size="sm"
              className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white"
            >
              WhatsApp
            </Button>
          )}
          <Button onClick={handleDismiss} size="sm" variant="outline" className={announcement.cta_text || announcement.metadata?.whatsapp ? "flex-1" : ""}>
            Entendi
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
