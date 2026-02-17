import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const ANTT_NEWS_URL = 'https://www.gov.br/antt/pt-br/assuntos/ultimas-noticias';
const ANTT_FREIGHT_TABLE_URL = 'https://www.gov.br/antt/pt-br/assuntos/cargas/tabela-de-frete';

// Keywords to detect relevant ANTT updates
const RELEVANT_KEYWORDS = [
  'tabela de frete',
  'piso mínimo',
  'frete mínimo',
  'resolução',
  'transporte rodoviário de cargas',
  'custo operacional',
  'coeficiente',
  'diesel',
  'antt frete',
  'pisos mínimos',
];

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Validate admin authorization (unless triggered by cron)
    const authHeader = req.headers.get('Authorization');
    const body = await req.json().catch(() => ({}));
    const triggeredBy = body.triggered_by || 'manual';

    if (triggeredBy === 'manual' && authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return new Response(JSON.stringify({ error: 'Não autorizado' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      // Verify admin role
      const { data: roleData } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!roleData) {
        return new Response(JSON.stringify({ error: 'Apenas administradores podem sincronizar' }), {
          status: 403,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    console.log('Starting ANTT price sync...');

    // Fetch the ANTT news page
    let newsContent = '';
    let freightTableContent = '';
    let fetchError = null;

    try {
      const [newsResponse, freightResponse] = await Promise.allSettled([
        fetch(ANTT_NEWS_URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AgriRoute/1.0; +https://agriroute.lovable.app)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        }),
        fetch(ANTT_FREIGHT_TABLE_URL, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (compatible; AgriRoute/1.0; +https://agriroute.lovable.app)',
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': 'pt-BR,pt;q=0.9',
          },
        }),
      ]);

      if (newsResponse.status === 'fulfilled' && newsResponse.value.ok) {
        newsContent = await newsResponse.value.text();
      }
      if (freightResponse.status === 'fulfilled' && freightResponse.value.ok) {
        freightTableContent = await freightResponse.value.text();
      }
    } catch (e) {
      fetchError = e instanceof Error ? e.message : 'Fetch failed';
      console.error('Error fetching ANTT pages:', fetchError);
    }

    // Parse news for relevant updates
    const relevantNews = parseRelevantNews(newsContent);
    const freightTableData = parseFreightTablePage(freightTableContent);

    // Check last sync to avoid duplicates
    const { data: lastSync } = await supabase
      .from('antt_price_sync_logs')
      .select('*')
      .eq('status', 'success')
      .order('synced_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasNewUpdates = relevantNews.length > 0 && (
      !lastSync || 
      JSON.stringify(relevantNews) !== JSON.stringify(lastSync.parsed_data?.news)
    );

    // Log the sync attempt
    const syncLog = {
      source_url: ANTT_NEWS_URL,
      status: fetchError ? 'failed' : (hasNewUpdates ? 'success' : 'no_update'),
      prices_updated: 0,
      raw_content: (newsContent + freightTableContent).substring(0, 50000), // Limit storage
      parsed_data: {
        news: relevantNews,
        freight_table: freightTableData,
        checked_at: new Date().toISOString(),
      },
      error_message: fetchError,
      triggered_by: triggeredBy,
    };

    // If there are new relevant updates, update prices if possible
    if (hasNewUpdates && freightTableData.prices && freightTableData.prices.length > 0) {
      let updatedCount = 0;
      
      for (const price of freightTableData.prices) {
        const { error: updateError } = await supabase
          .from('antt_freight_prices')
          .update({
            price_per_km: price.price_per_km,
            base_price: price.base_price,
            last_sync_source: ANTT_FREIGHT_TABLE_URL,
            antt_resolution: freightTableData.resolution || null,
            updated_at: new Date().toISOString(),
          })
          .eq('service_type', price.service_type)
          .gte('distance_range_min', price.distance_range_min)
          .lte('distance_range_max', price.distance_range_max || 99999);

        if (!updateError) updatedCount++;
      }
      
      syncLog.prices_updated = updatedCount;
    }

    await supabase.from('antt_price_sync_logs').insert(syncLog);

    const response = {
      success: true,
      status: syncLog.status,
      prices_updated: syncLog.prices_updated,
      relevant_news: relevantNews,
      freight_table_info: freightTableData,
      last_sync: lastSync?.synced_at || null,
      message: hasNewUpdates 
        ? `${relevantNews.length} atualizações encontradas. ${syncLog.prices_updated} preços atualizados.`
        : fetchError 
          ? `Erro ao acessar site ANTT: ${fetchError}`
          : 'Nenhuma atualização nova encontrada.',
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in ANTT sync:', error);

    // Log failed attempt
    await supabase.from('antt_price_sync_logs').insert({
      source_url: ANTT_NEWS_URL,
      status: 'failed',
      error_message: error instanceof Error ? error.message : 'Unknown error',
      triggered_by: 'manual',
    }).catch(() => {});

    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Erro desconhecido',
      success: false 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

/**
 * Parse HTML content to find relevant ANTT news about freight prices
 */
function parseRelevantNews(html: string): Array<{ title: string; date: string; url: string }> {
  if (!html) return [];
  
  const news: Array<{ title: string; date: string; url: string }> = [];
  
  // Extract news items - look for article/news patterns in gov.br HTML
  const articleRegex = /<a[^>]*href="([^"]*)"[^>]*>([^<]*(?:tabela|frete|piso|resolução|diesel|custo operacional)[^<]*)<\/a>/gi;
  let match;
  
  while ((match = articleRegex.exec(html)) !== null) {
    const url = match[1];
    const title = match[2].trim();
    
    if (title.length > 10 && RELEVANT_KEYWORDS.some(kw => title.toLowerCase().includes(kw))) {
      // Try to extract date near the match
      const dateRegex = /(\d{2}\/\d{2}\/\d{4})/;
      const nearbyText = html.substring(Math.max(0, match.index - 200), match.index + match[0].length + 200);
      const dateMatch = nearbyText.match(dateRegex);
      
      news.push({
        title,
        date: dateMatch ? dateMatch[1] : new Date().toLocaleDateString('pt-BR'),
        url: url.startsWith('http') ? url : `https://www.gov.br${url}`,
      });
    }
  }
  
  // Also search for general text mentions
  const textRegex = /(?:tabela de frete|piso m[ií]nimo|frete m[ií]nimo)[^<]{0,200}/gi;
  while ((match = textRegex.exec(html)) !== null) {
    const snippet = match[0].trim();
    if (snippet.length > 20 && !news.some(n => n.title.includes(snippet.substring(0, 30)))) {
      news.push({
        title: snippet.substring(0, 150),
        date: new Date().toLocaleDateString('pt-BR'),
        url: ANTT_NEWS_URL,
      });
    }
  }
  
  return news.slice(0, 10); // Limit to 10 most relevant
}

/**
 * Parse the ANTT freight table page for price data
 */
function parseFreightTablePage(html: string): {
  resolution: string | null;
  last_update: string | null;
  prices: Array<{
    service_type: string;
    distance_range_min: number;
    distance_range_max: number;
    price_per_km: number;
    base_price: number;
  }>;
  raw_tables: string[];
} {
  if (!html) return { resolution: null, last_update: null, prices: [], raw_tables: [] };

  // Extract resolution number
  const resolutionMatch = html.match(/Resolu[çc][aã]o\s*(?:n[ºo°]?\s*)?(\d+[\./]?\d*(?:\/\d{4})?)/i);
  const resolution = resolutionMatch ? `Resolução ${resolutionMatch[1]}` : null;

  // Extract last update date
  const updateMatch = html.match(/(?:atualiza[çc][aã]o|vigente|vig[eê]ncia)[^<]*?(\d{2}\/\d{2}\/\d{4})/i);
  const last_update = updateMatch ? updateMatch[1] : null;

  // Extract table data
  const prices: Array<{
    service_type: string;
    distance_range_min: number;
    distance_range_max: number;
    price_per_km: number;
    base_price: number;
  }> = [];

  // Look for price values in tables
  const tableRegex = /<table[^>]*>([\s\S]*?)<\/table>/gi;
  const raw_tables: string[] = [];
  let tableMatch;

  while ((tableMatch = tableRegex.exec(html)) !== null) {
    const tableContent = tableMatch[1];
    // Check if table contains freight-related data
    if (/(?:km|dist[aâ]ncia|frete|valor|tarifa|pre[çc]o|eixo)/i.test(tableContent)) {
      raw_tables.push(tableContent.substring(0, 2000));
      
      // Try to extract rows with numeric data
      const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
      let rowMatch;
      while ((rowMatch = rowRegex.exec(tableContent)) !== null) {
        const cells = rowMatch[1].match(/<td[^>]*>([\s\S]*?)<\/td>/gi);
        if (cells && cells.length >= 3) {
          const values = cells.map(c => c.replace(/<[^>]*>/g, '').trim());
          // Try to parse as price data
          const numericValues = values.map(v => parseFloat(v.replace(/[R$\s.]/g, '').replace(',', '.')));
          if (numericValues.filter(n => !isNaN(n)).length >= 2) {
            // Found numeric row - attempt to map
            console.log('Found potential price row:', values);
          }
        }
      }
    }
  }

  return { resolution, last_update, prices, raw_tables };
}
