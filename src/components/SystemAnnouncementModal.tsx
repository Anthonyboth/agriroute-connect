import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { X } from "lucide-react";

export const SystemAnnouncementModal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [announcement, setAnnouncement] = useState<{
    id: string;
    title: string;
    message: string;
    type: string;
  } | null>(null);

  useEffect(() => {
    checkAndShowAnnouncement();
  }, []);

  const checkAndShowAnnouncement = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar anúncio ativo com maior prioridade
      const { data: announcements } = await supabase
        .from("system_announcements")
        .select("*")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1);

      if (!announcements || announcements.length === 0) return;

      const activeAnnouncement = announcements[0];

      // Verificar se usuário já viu/dismissou este anúncio
      const { data: dismissal } = await supabase
        .from("user_announcement_dismissals")
        .select("*")
        .eq("user_id", user.id)
        .eq("announcement_id", activeAnnouncement.id)
        .maybeSingle();

      // Se nunca viu, mostrar
      if (!dismissal) {
        setAnnouncement(activeAnnouncement);
        setIsOpen(true);
        return;
      }

      // Se já viu, não mostrar novamente
    } catch (error) {
      console.error("Erro ao verificar anúncios:", error);
    }
  };

  const handleDismiss = async () => {
    if (!announcement) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Inserir ou atualizar dismissal
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

      setIsOpen(false);
    } catch (error) {
      console.error("Erro ao dismissar anúncio:", error);
      setIsOpen(false);
    }
  };

  if (!announcement) return null;

  // Separar mensagem em parágrafos e identificar aviso importante
  const paragraphs = announcement.message.split('\n\n');
  const warningIndex = paragraphs.findIndex(p => p.includes('⚠️'));
  const mainParagraphs = warningIndex >= 0 ? paragraphs.slice(0, warningIndex) : paragraphs;
  const warningParagraph = warningIndex >= 0 ? paragraphs[warningIndex] : null;

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogContent className="sm:max-w-[600px] bg-gradient-to-br from-background to-muted/20">
        <DialogHeader>
          <DialogTitle className="text-xl flex items-center justify-between gap-2">
            <span>{announcement.title}</span>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              className="h-6 w-6 rounded-full hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Mensagem principal */}
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 space-y-3">
            {mainParagraphs.map((paragraph) => (
              <p key={paragraph.substring(0, 50)} className="text-sm leading-relaxed text-muted-foreground">
                {paragraph}
              </p>
            ))}
          </div>

          {/* Aviso importante destacado */}
          {warningParagraph && (
            <div className="bg-amber-50 dark:bg-amber-950 border border-amber-600 dark:border-amber-800 rounded-lg p-4">
              <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed font-medium whitespace-pre-line">
                {warningParagraph}
              </p>
            </div>
          )}

        </div>

        <div className="flex justify-end">
          <Button onClick={handleDismiss} className="w-full sm:w-auto">
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
