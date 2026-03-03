/**
 * useAnnouncements.ts
 * 
 * Shared hook for fetching active announcements with proper filtering:
 * - Period (starts_at / ends_at)
 * - Archived
 * - Target audience by user role
 * - View count tracking
 * - Realtime subscription
 */
import { useEffect, useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export type AnnouncementData = {
  id: string;
  title: string;
  subtitle?: string;
  message: string;
  type?: string;
  priority?: number;
  category?: string;
  archived?: boolean;
  starts_at?: string;
  ends_at?: string;
  is_active: boolean;
  created_at?: string;
  target_audience?: string[];
  cta_text?: string;
  cta_url?: string;
  banner_url?: string;
  view_count?: number;
  click_count?: number;
  metadata?: {
    whatsapp?: string;
    whatsapp_message?: string;
  };
};

const ROLE_TO_AUDIENCE: Record<string, string> = {
  MOTORISTA: "motoristas",
  MOTORISTA_AFILIADO: "motoristas",
  PRODUTOR: "produtores",
  TRANSPORTADORA: "transportadoras",
  PRESTADOR_SERVICOS: "prestadores",
};

interface UseAnnouncementsOptions {
  limit?: number;
  enableRealtime?: boolean;
  trackViews?: boolean;
}

export function useAnnouncements(options: UseAnnouncementsOptions = {}) {
  const { limit = 20, enableRealtime = false, trackViews = true } = options;
  const [announcements, setAnnouncements] = useState<AnnouncementData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const trackedIds = useRef<Set<string>>(new Set());

  const fetchAnnouncements = useCallback(async () => {
    try {
      const now = new Date().toISOString();

      // Get user profile for audience filtering
      const { data: { user } } = await supabase.auth.getUser();
      let userRole: string | null = null;

      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("user_id", user.id)
          .maybeSingle();
        userRole = profile?.role || null;
      }

      const { data, error } = await supabase
        .from("system_announcements")
        .select("*")
        .eq("is_active", true)
        .eq("archived", false)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(limit);

      if (error) {
        if (import.meta.env.DEV) console.error("[useAnnouncements] Error:", error);
        return;
      }

      if (!data) {
        setAnnouncements([]);
        setIsLoading(false);
        return;
      }

      // Filter by target_audience on the client
      const audienceKey = userRole ? ROLE_TO_AUDIENCE[userRole] : null;
      const filtered = data.filter((a: any) => {
        const audience: string[] = a.target_audience || ["todos"];
        if (audience.includes("todos")) return true;
        if (audienceKey && audience.includes(audienceKey)) return true;
        return false;
      }) as AnnouncementData[];

      setAnnouncements(filtered);
      setIsLoading(false);

      // Track views for new announcements
      if (trackViews && user) {
        for (const a of filtered) {
          if (!trackedIds.current.has(a.id)) {
            trackedIds.current.add(a.id);
            try {
              await supabase.rpc("increment_announcement_view", { p_announcement_id: a.id });
            } catch {}
          }
        }
      }
    } catch (err) {
      if (import.meta.env.DEV) console.error("[useAnnouncements] Error:", err);
      setIsLoading(false);
    }
  }, [limit, trackViews]);

  useEffect(() => {
    fetchAnnouncements();

    if (!enableRealtime) return;

    const channel = supabase
      .channel("announcements-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "system_announcements" },
        () => fetchAnnouncements()
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [fetchAnnouncements, enableRealtime]);

  const trackCtaClick = useCallback(async (announcementId: string) => {
    try {
      await supabase.rpc("increment_announcement_click", { p_announcement_id: announcementId });
    } catch {}
  }, []);

  return { announcements, isLoading, refetch: fetchAnnouncements, trackCtaClick };
}
