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
          setVisibleAnnouncements(announcements);
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
        setVisibleAnnouncements(filtered);
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

  if (!isOpen || visibleAnnouncements.length === 0) return null;

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
          className="h-8 w-8 rounded-full hover:bg-muted"
        >
          <X className="h-5 w-5" />
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
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
};
