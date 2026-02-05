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
  category?: string;
  archived?: boolean;
  starts_at?: string;
  ends_at?: string;
  metadata?: {
    whatsapp?: string;
    whatsapp_message?: string;
  };
};

interface SystemAnnouncementsBoardProps {
  isOpen: boolean;
  onClose: () => void;
  ignoreDismissals?: boolean;
}

export const SystemAnnouncementsBoard = ({ isOpen, onClose, ignoreDismissals = false }: SystemAnnouncementsBoardProps) => {
  const [visibleAnnouncements, setVisibleAnnouncements] = useState<Announcement[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");

  useEffect(() => {
    if (!isOpen) return;
    
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

      if (!announcements || announcements.length === 0) {
        if (mounted) setVisibleAnnouncements([]);
        return;
      }

      // Se abertura manual, ignorar dismissals
      if (ignoreDismissals) {
        if (mounted) {
          setVisibleAnnouncements(announcements as any);
        }
        return;
      }

      // Calcular cutoff (últimas 07:00)
      const now = new Date();
      const cutoff = new Date(now);
      cutoff.setHours(7, 0, 0, 0);
      if (now < cutoff) {
        cutoff.setDate(cutoff.getDate() - 1);
      }

      // Buscar dismissals do ciclo atual (após cutoff)
      const { data: dismissals } = await supabase
        .from("user_announcement_dismissals")
        .select("announcement_id")
        .eq("user_id", user.id)
        .gte("dismissed_at", cutoff.toISOString());

      const dismissedIds = new Set((dismissals || []).map(d => d.announcement_id));
      const filtered = announcements.filter(a => !dismissedIds.has(a.id));

      if (mounted) {
        setVisibleAnnouncements(filtered as any);
      }
    };

    fetchAnnouncements();

    return () => {
      mounted = false;
    };
  }, [isOpen, ignoreDismissals]);

  const handleDismissAll = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date();
    
    // Dispensar TODOS os avisos ativos de uma vez
    const dismissPromises = visibleAnnouncements.map(announcement =>
      supabase
        .from("user_announcement_dismissals")
        .upsert({
          user_id: user.id,
          announcement_id: announcement.id,
          dismissed_at: now.toISOString(),
          last_seen_at: now.toISOString(),
        }, { onConflict: "user_id,announcement_id" })
    );

    await Promise.all(dismissPromises);
    
    // Salvar timestamp global do dismiss no localStorage
    localStorage.setItem('mural_dismissed_at', now.toISOString());
    
    // Limpar estado e fechar
    setVisibleAnnouncements([]);
    onClose();
  };

  if (!isOpen) return null;
  if (visibleAnnouncements.length === 0) return null;

  // Filtrar por categoria
  const filteredAnnouncements = selectedCategory === "all" 
    ? visibleAnnouncements 
    : visibleAnnouncements.filter(a => a.category === selectedCategory);

  // Separar "Palavras da Salvação" dos demais
  const salvationAnnouncement = filteredAnnouncements.find(a => a.type === 'success');
  const otherAnnouncements = filteredAnnouncements.filter(a => a.type !== 'success');

  const categories = [
    { value: "all", label: "Todas categorias" },
    { value: "informativo", label: "Informativo" },
    { value: "financeiro", label: "Financeiro" },
    { value: "comunicado", label: "Comunicado" },
    { value: "manutencao", label: "Manutenção" },
  ];

  const getCategoryBadge = (category?: string) => {
    const colors = {
      informativo: "bg-blue-500/10 text-blue-900 dark:text-blue-100",
      financeiro: "bg-green-500/10 text-green-900 dark:text-green-100",
      comunicado: "bg-purple-500/10 text-purple-900 dark:text-purple-100",
      manutencao: "bg-orange-500/10 text-orange-900 dark:text-orange-100",
    };
    return colors[category as keyof typeof colors] || colors.informativo;
  };

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
        {/* Palavras da Salvação - Box Verde no topo */}
        {salvationAnnouncement && (
          <div className="bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-800 rounded-md p-4">
            <h3 className="text-base font-semibold text-emerald-900 dark:text-emerald-100 mb-3">
              {salvationAnnouncement.title}
            </h3>
            <p className="text-sm leading-relaxed text-emerald-900 dark:text-emerald-100 whitespace-pre-line">
              {salvationAnnouncement.message}
            </p>
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
              <h3 className="text-base font-semibold mb-3">{announcement.title}</h3>

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
                <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-md p-3">
                  <p className="text-sm text-amber-900 dark:text-amber-100 leading-relaxed whitespace-pre-line">
                    {warningParagraph}
                  </p>
                </div>
              )}

              {announcement.metadata?.whatsapp && (
                <button
                  onClick={() => {
                    const phone = announcement.metadata?.whatsapp;
                    const message = encodeURIComponent(announcement.metadata?.whatsapp_message || 'Olá! Preciso de suporte');
                    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
                  }}
                  className="mt-3 w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-[#25D366] hover:bg-[#20BA5A] text-white rounded-md text-sm font-medium transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.890-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                  </svg>
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
