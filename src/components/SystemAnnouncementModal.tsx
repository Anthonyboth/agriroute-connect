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
    metadata?: {
      whatsapp?: string;
      whatsapp_message?: string;
    };
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
        setAnnouncement(activeAnnouncement as any);
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
            {mainParagraphs.map((paragraph, index) => (
              <p key={`announcement-${announcement.id}-para-${index}`} className="text-sm leading-relaxed text-muted-foreground">
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

        <div className="flex flex-col sm:flex-row gap-2">
          {announcement.metadata?.whatsapp && (
            <Button
              onClick={() => {
                const phone = announcement.metadata?.whatsapp;
                const message = encodeURIComponent(announcement.metadata?.whatsapp_message || 'Olá! Preciso de suporte');
                window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
              }}
              variant="default"
              className="flex-1 bg-[#25D366] hover:bg-[#20BA5A] text-white"
            >
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 24 24">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
              </svg>
              Suporte via WhatsApp
            </Button>
          )}
          <Button onClick={handleDismiss} variant={announcement.metadata?.whatsapp ? "outline" : "default"} className={announcement.metadata?.whatsapp ? "flex-1" : "w-full sm:w-auto"}>
            Entendi
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
