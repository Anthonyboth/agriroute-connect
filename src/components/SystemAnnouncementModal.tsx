import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X, ExternalLink } from "lucide-react";
import { useAnnouncements } from "@/hooks/useAnnouncements";

export const SystemAnnouncementModal = () => {
  const { announcements, trackCtaClick } = useAnnouncements({
    limit: 1,
    enableRealtime: false,
    trackViews: true,
  });
  const [isOpen, setIsOpen] = useState(false);
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

      if (!dismissal) {
        setIsOpen(true);
      }
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
    setIsOpen(false);
  };

  if (!announcement) return null;

  const paragraphs = announcement.message.split("\n\n");
  const warningIndex = paragraphs.findIndex(p => p.includes("⚠️"));
  const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
  const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-background to-muted/20">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center justify-between gap-2">
            <span>{announcement.title}</span>
            <Button variant="ghost" size="icon" onClick={handleDismiss} className="h-6 w-6 rounded-full hover:bg-muted">
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        {announcement.subtitle && (
          <p className="text-sm text-muted-foreground -mt-2">{announcement.subtitle}</p>
        )}

        {announcement.banner_url && (
          <img src={announcement.banner_url} alt="" className="w-full h-40 object-cover rounded-lg" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
        )}

        <div className="space-y-4 py-4">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            {mainParagraphs.map((paragraph, index) => (
              <p key={`modal-para-${index}`} className="text-sm leading-relaxed text-muted-foreground">{paragraph}</p>
            ))}
          </div>

          {warningParagraph && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-600 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed font-medium whitespace-pre-line">{warningParagraph}</p>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          {announcement.cta_text && announcement.cta_url && (
            <Button asChild onClick={() => trackCtaClick(announcement.id)} className="flex-1">
              <a
                href={announcement.cta_url}
                target={announcement.cta_url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
              >
                {announcement.cta_text}
                {announcement.cta_url.startsWith("http") && <ExternalLink className="h-3 w-3 ml-1" />}
              </a>
            </Button>
          )}
          {announcement.metadata?.whatsapp && (
            <Button
              onClick={() => {
                const phone = announcement.metadata?.whatsapp;
                const message = encodeURIComponent(announcement.metadata?.whatsapp_message || "Olá!");
                window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
              }}
              variant="default"
              className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white"
            >
              WhatsApp
            </Button>
          )}
          <Button onClick={handleDismiss} variant={announcement.cta_text || announcement.metadata?.whatsapp ? "outline" : "default"} className="flex-1">
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
