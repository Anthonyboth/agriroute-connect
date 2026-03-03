import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";
import { useAnnouncements, type AnnouncementData } from "@/hooks/useAnnouncements";

interface SystemAnnouncementsBoardProps {
  isOpen: boolean;
  onClose: () => void;
  ignoreDismissals?: boolean;
}

export const SystemAnnouncementsBoard = ({ isOpen, onClose, ignoreDismissals = false }: SystemAnnouncementsBoardProps) => {
  const { announcements: allAnnouncements, trackCtaClick } = useAnnouncements({
    enableRealtime: false,
    trackViews: true,
  });
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<AnnouncementData[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (!isOpen || allAnnouncements.length === 0) {
      if (!isOpen) setVisibleAnnouncements([]);
      return;
    }

    if (ignoreDismissals) {
      setVisibleAnnouncements(allAnnouncements);
      return;
    }

    // Filter by dismissals
    const filterDismissed = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setVisibleAnnouncements(allAnnouncements); return; }

      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(7, 0, 0, 0);
      if (now < cutoff) cutoff.setDate(cutoff.getDate() - 1);

      const { data: dismissals } = await supabase
        .from("user_announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id)
        .gte("dismissed_at", cutoff.toISOString());

      const dismissedIds = new Set((dismissals || []).map(d => d.announcement_id));
      setVisibleAnnouncements(allAnnouncements.filter(a => !dismissedIds.has(a.id)));
    };

    filterDismissed();
  }, [isOpen, ignoreDismissals, allAnnouncements]);

  const handleDismissAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    await Promise.all(
      visibleAnnouncements.map(a =>
        supabase.from("user_announcement_dismissals").upsert(
          { user_id: user.id, announcement_id: a.id, dismissed_at: now, last_seen_at: now },
          { onConflict: "user_id,announcement_id" }
        )
      )
    );
    localStorage.setItem("mural_dismissed_at", now);
    setVisibleAnnouncements([]);
    onClose();
  };

  if (!isOpen || visibleAnnouncements.length === 0) return null;

  const filteredAnnouncements = selectedCategory === "all"
    ? visibleAnnouncements
    : visibleAnnouncements.filter(a => a.category === selectedCategory);

  const salvationAnnouncement = filteredAnnouncements.find(a => a.type === "success");
  const otherAnnouncements = filteredAnnouncements.filter(a => a.type !== "success");

  return (
    <Card className="overflow-hidden">
      <div className="flex justify-end p-2 border-b">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDismissAll}
          aria-label="Fechar mural"
          className="h-12 w-12 rounded-md border-2 border-red-500 bg-red-50 hover:bg-red-100 dark:bg-red-950 dark:hover:bg-red-900"
        >
          <X className="h-7 w-7 text-red-600 dark:text-red-400" />
        </Button>
      </div>

      <CardContent className="pt-4 space-y-4">
        {salvationAnnouncement && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md p-4">
            <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100 mb-1">
              {salvationAnnouncement.title}
            </h3>
            {salvationAnnouncement.subtitle && (
              <p className="text-sm text-emerald-800 dark:text-emerald-200 mb-2">{salvationAnnouncement.subtitle}</p>
            )}
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100 whitespace-pre-line">
              {salvationAnnouncement.message}
            </p>
            {salvationAnnouncement.cta_text && salvationAnnouncement.cta_url && (
              <a
                href={salvationAnnouncement.cta_url}
                target={salvationAnnouncement.cta_url.startsWith("http") ? "_blank" : undefined}
                rel="noopener noreferrer"
                onClick={() => trackCtaClick(salvationAnnouncement.id)}
                className="mt-3 inline-block px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-md text-sm font-medium transition-colors"
              >
                {salvationAnnouncement.cta_text}
              </a>
            )}
          </div>
        )}

        {otherAnnouncements.map((announcement) => {
          const paragraphs = announcement.message.split("\n\n");
          const warningIndex = paragraphs.findIndex(p => p.includes("⚠️"));
          const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
          const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

          return (
            <div key={announcement.id} className="border rounded-md p-4">
              {announcement.banner_url && (
                <img src={announcement.banner_url} alt="" className="w-full h-32 object-cover rounded-md mb-3" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              )}
              <h3 className="text-base font-semibold mb-1">{announcement.title}</h3>
              {announcement.subtitle && <p className="text-sm text-muted-foreground mb-2">{announcement.subtitle}</p>}

              <div className="space-y-2 mb-4">
                {mainParagraphs.map((p, i) => (
                  <p key={`${announcement.id}-p-${i}`} className="text-sm leading-relaxed text-muted-foreground whitespace-pre-line">{p}</p>
                ))}
              </div>

              {warningParagraph && (
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                  <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">{warningParagraph}</p>
                </div>
              )}

              {announcement.cta_text && announcement.cta_url && (
                <a
                  href={announcement.cta_url}
                  target={announcement.cta_url.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  onClick={() => trackCtaClick(announcement.id)}
                  className="mt-3 inline-block px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-md text-sm font-medium transition-colors"
                >
                  {announcement.cta_text}
                </a>
              )}

              {announcement.metadata?.whatsapp && (
                <button
                  type="button"
                  onClick={() => {
                    const phone = announcement.metadata?.whatsapp;
                    const message = encodeURIComponent(announcement.metadata?.whatsapp_message || "Olá! Preciso de suporte");
                    window.open(`https://wa.me/${phone}?text=${message}`, "_blank");
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-md text-sm font-medium transition-colors"
                >
                  Suporte via WhatsApp
                </button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
