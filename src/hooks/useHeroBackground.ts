import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

// Fallback images (usadas enquanto carrega ou se não houver registro no banco)
const FALLBACK_DESKTOP = '/hero-truck-night-moon.webp';
const FALLBACK_MOBILE = '/hero-truck-night-moon-mobile.webp';

interface HeroBackground {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  mobile_image_url: string | null;
  is_active: boolean;
}

/**
 * Hook para buscar a imagem de fundo ativa do banco de dados.
 * 
 * - Busca a imagem com `is_active = true`
 * - Se a imagem do banco for uma URL absoluta (https://), usa direto
 * - Se for um path relativo (/hero-...), usa como está (public folder)
 * - Cache de 5 minutos para não sobrecarregar o banco
 * - staleTime de 2 minutos para que a imagem atualize mesmo com o app aberto
 */
export function useHeroBackground() {
  const { data, isLoading } = useQuery({
    queryKey: ['hero-background-active'],
    queryFn: async (): Promise<HeroBackground | null> => {
      const now = new Date().toISOString();
      
      // Buscar imagem ativa, respeitando starts_at/ends_at se configurados
      const { data, error } = await supabase
        .from('hero_backgrounds')
        .select('id, title, description, image_url, mobile_image_url, is_active')
        .eq('is_active', true)
        .or(`starts_at.is.null,starts_at.lte.${now}`)
        .or(`ends_at.is.null,ends_at.gte.${now}`)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.warn('[useHeroBackground] Erro ao buscar imagem de fundo:', error.message);
        return null;
      }
      
      return data;
    },
    staleTime: 2 * 60 * 1000,  // 2 minutos - permite atualizar com frequência
    gcTime: 5 * 60 * 1000,     // 5 minutos de cache
    refetchOnWindowFocus: true, // Recarrega ao voltar ao app
    retry: 1,
  });

  const desktopUrl = data?.image_url || FALLBACK_DESKTOP;
  const mobileUrl = data?.mobile_image_url || data?.image_url || FALLBACK_MOBILE;

  return {
    /** URL da imagem desktop (sempre disponível - fallback garantido) */
    desktopUrl,
    /** URL da imagem mobile (sempre disponível - fallback garantido) */
    mobileUrl,
    /** Título da campanha/imagem ativa */
    title: data?.title || null,
    /** Se está carregando do banco */
    isLoading,
    /** Dados brutos do registro ativo */
    activeBackground: data || null,
  };
}
