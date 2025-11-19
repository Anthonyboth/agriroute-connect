import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnttCalculationRequest {
  cargo_type: string; // 'graos_soja', 'combustivel', etc.
  distance_km: number;
  axles: number; // 2, 3, 4, 5, 6, 7, 9
  origin_state?: string;
  destination_state?: string;
  high_performance?: boolean;
  table_type?: 'A' | 'B' | 'C' | 'D'; // Override explícito da tabela
  required_trucks?: number; // NOVO - Número de carretas
}

interface AnttCalculationResponse {
  // Valores por carreta
  minimum_freight_value: number;
  suggested_freight_value: number;
  antt_reference_price: number;
  
  // NOVOS - Valores totais
  minimum_freight_value_total: number;
  suggested_freight_value_total: number;
  antt_reference_price_total: number;
  
  required_trucks: number; // Quantas carretas
  
  calculation_details: {
    antt_category: string;
    table_type: string;
    axles: number;
    distance_km: number;
    rate_per_km: number;
    fixed_charge: number;
    high_performance: boolean;
    interstate: boolean;
    formula: string;
    required_trucks: number; // NOVO
    price_per_truck: number; // NOVO
    total_price: number;     // NOVO
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get('Authorization') || '';
    
    // Schema de validação rigoroso com Zod
    const AnttRequestSchema = z.object({
      cargo_type: z.string().min(1).max(100),
      distance_km: z.number().positive().max(10000),
      axles: z.number().int().min(2).max(9),
      origin_state: z.string().length(2).optional(),
      destination_state: z.string().length(2).optional(),
      high_performance: z.boolean().optional().default(false),
      table_type: z.enum(['A', 'B', 'C', 'D']).optional(),
      required_trucks: z.number().int().positive().max(50).optional().default(1)
    });
    
    // Validar input
    const rawData = await req.json();
    const validated = AnttRequestSchema.parse(rawData);
    
    const { 
      cargo_type, 
      distance_km, 
      axles, 
      origin_state,
      destination_state,
      high_performance,
      table_type,
      required_trucks
    } = validated;
    
    console.log('📊 ANTT Calculation Request:', { cargo_type, distance_km, axles, high_performance, table_type });

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Validação de inputs
    if (!cargo_type || typeof cargo_type !== 'string') {
      throw new Error('cargo_type é obrigatório e deve ser uma string');
    }
    if (!distance_km || distance_km <= 0) {
      throw new Error('distance_km deve ser maior que zero');
    }
    if (!axles || axles < 2 || axles > 9 || ![2,3,4,5,6,7,9].includes(axles)) {
      throw new Error('axles deve ser 2, 3, 4, 5, 6, 7 ou 9');
    }

    // 1. Mapear cargo_type para categoria ANTT oficial (COMPLETO)
    const cargoMapping: Record<string, string> = {
      // Grãos
      'graos_soja': 'Granel sólido',
      'graos_milho': 'Granel sólido',
      'graos_trigo': 'Granel sólido',
      'graos_arroz': 'Granel sólido',
      'SOJA': 'Granel sólido',
      'MILHO': 'Granel sólido',
      'TRIGO': 'Granel sólido',
      'ARROZ': 'Granel sólido',
      
      // Insumos agrícolas
      'adubo_fertilizante': 'Granel sólido',
      'calcario': 'Granel sólido',
      'farelo_soja': 'Granel sólido',
      'sementes_bags': 'Neogranel',
      'defensivos_agricolas': 'Perigosa (carga geral)',
      'FERTILIZANTE': 'Granel sólido',
      'CALCARIO': 'Granel sólido',
      
      // Combustíveis
      'combustivel': 'Granel líquido',
      'combustivel_diesel': 'Granel líquido',
      'DIESEL': 'Granel líquido',
      'GASOLINA': 'Granel líquido',
      'ETANOL': 'Granel líquido',
      
      // Produtos agrícolas
      'acucar': 'Granel sólido',
      'cafe': 'Granel sólido',
      'algodao': 'Carga Geral',
      'ACUCAR': 'Granel sólido',
      'CAFE': 'Granel sólido',
      'ALGODAO': 'Carga Geral',
      
      // Ração e alimentos
      'racao_animal': 'Carga Geral',
      'fardos_algodao': 'Carga Geral',
      'RACAO': 'Carga Geral',
      
      // Madeira e celulose
      'madeira': 'Carga Geral',
      'celulose': 'Carga Geral',
      'MADEIRA': 'Carga Geral',
      'CELULOSE': 'Carga Geral',
      
      // Animais
      'gado_bovino': 'Carga Geral',
      'gado_leiteiro': 'Carga Geral',
      'suinos_porcos': 'Carga Geral',
      'GADO_BOVINO': 'Carga Geral',
      'SUINOS': 'Carga Geral',
      
      // Frutas e hortaliças
      'frutas': 'Carga Geral',
      'hortifruti': 'Carga Geral',
      'FRUTAS': 'Carga Geral',
      'HORTIFRUTI': 'Carga Geral',
      
      // Carnes e laticínios
      'carnes': 'Carga Geral',
      'laticinios': 'Carga Geral',
      'CARNES': 'Carga Geral',
      'LATICINIOS': 'Carga Geral',
      
      // Equipamentos
      'maquinas_agricolas': 'Carga Geral',
      'equipamentos': 'Carga Geral',
      'MAQUINAS': 'Carga Geral',
      'EQUIPAMENTOS': 'Carga Geral',
    };
    
    const anttCategory = cargoMapping[cargo_type] || cargoMapping[cargo_type.toUpperCase()] || 'Carga Geral';
    
    // Se table_type vier explícito, usar; senão inferir de high_performance (compatibilidade)
    const tableType = table_type || (high_performance ? 'C' : 'A');

    console.log('🔍 Mapped to ANTT:', { cargo_type, anttCategory, tableType, axles, distance_km });

    // Log de fallback para análise
    if (anttCategory === 'Carga Geral' && !cargoMapping[cargo_type]) {
      console.warn(`⚠️ Cargo type "${cargo_type}" não mapeado, usando Carga Geral como fallback`);
    }

    // 2. Buscar taxa ANTT oficial na tabela
    const { data: rateData, error: rateError } = await supabase
      .from('antt_rates')
      .select('*')
      .eq('table_type', tableType)
      .eq('cargo_category', anttCategory)
      .eq('axles', axles)
      .maybeSingle();

    if (rateError) {
      console.error('❌ Error fetching ANTT rate:', rateError);
      throw new Error('Erro ao buscar taxa ANTT');
    }

    let rateRow = rateData;

    if (!rateRow) {
      console.log('⚠️ No exact ANTT rate found, trying fallback to Carga Geral...');
      
      // Fallback para Carga Geral se não encontrar categoria específica
      const { data: fallbackData, error: fallbackError } = await supabase
        .from('antt_rates')
        .select('*')
        .eq('table_type', tableType)
        .eq('cargo_category', 'Carga Geral')
        .eq('axles', axles)
        .maybeSingle();
      
      if (fallbackError || !fallbackData) {
        throw new Error(`Taxa ANTT não encontrada para ${axles} eixos na tabela ${tableType}`);
      }
      
      console.log('✅ Using fallback Carga Geral rate');
      rateRow = fallbackData;
    } else {
      console.log('✅ ANTT rate found:', rateRow);
    }

    // 3. Calcular preço OFICIAL ANTT (fórmula exata)
    // Fórmula: (rate_per_km * distance_km) + fixed_charge
    const basePrice = (parseFloat(rateRow.rate_per_km) * distance_km) + parseFloat(rateRow.fixed_charge);

    // 4. Valores finais POR CARRETA
    const antt_reference_price = Math.round(basePrice * 100) / 100;
    const minimum_freight_value = Math.round(antt_reference_price * 100) / 100; // O mínimo É o valor ANTT
    const suggested_freight_value = Math.round(antt_reference_price * 1.10 * 100) / 100; // 10% acima (sugestão comercial)

    // 5. Valores TOTAIS (multiplicar por número de carretas)
    const minimum_freight_value_total = Math.round(minimum_freight_value * required_trucks * 100) / 100;
    const suggested_freight_value_total = Math.round(suggested_freight_value * required_trucks * 100) / 100;
    const antt_reference_price_total = Math.round(antt_reference_price * required_trucks * 100) / 100;

    const response: AnttCalculationResponse = {
      // Valores por carreta
      minimum_freight_value,
      suggested_freight_value,
      antt_reference_price,
      
      // Valores totais
      minimum_freight_value_total,
      suggested_freight_value_total,
      antt_reference_price_total,
      
      required_trucks,
      
      calculation_details: {
        antt_category: anttCategory,
        table_type: tableType,
        axles,
        distance_km,
        rate_per_km: parseFloat(rateRow.rate_per_km),
        fixed_charge: parseFloat(rateRow.fixed_charge),
        high_performance,
        interstate: false, // Removido incremento interestadual
        formula: `(${rateRow.rate_per_km} × ${distance_km}km) + ${rateRow.fixed_charge} = R$ ${antt_reference_price.toFixed(2)} por carreta`,
        required_trucks,
        price_per_truck: minimum_freight_value,
        total_price: minimum_freight_value_total
      }
    };

    console.log('✅ Final ANTT calculation:', response);

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('❌ Error calculating ANTT freight:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      details: 'Verifique os parâmetros: cargo_type, distance_km, axles (2-9)'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
