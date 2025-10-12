import { supabase } from '@/integrations/supabase/client';

/**
 * Busca o city_id a partir do nome da cidade e estado
 * @param cityName Nome da cidade
 * @param state Sigla do estado (ex: SP, RJ, MT)
 * @returns UUID do city_id ou null se não encontrado
 */
export async function getCityId(cityName: string, state: string): Promise<string | null> {
  if (!cityName || !state) {
    return null;
  }

  try {
    const { data, error } = await supabase
      .from('cities')
      .select('id')
      .ilike('name', cityName.trim())
      .ilike('state', state.trim())
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('Erro ao buscar city_id:', error);
      return null;
    }

    return data?.id || null;
  } catch (error) {
    console.error('Erro ao buscar city_id:', error);
    return null;
  }
}

/**
 * Busca múltiplos city_ids de uma só vez
 * @param cities Array de objetos com city e state
 * @returns Map com a chave sendo "city,state" e o valor sendo o city_id
 */
export async function getCityIds(cities: Array<{ city: string; state: string }>): Promise<Map<string, string>> {
  const cityMap = new Map<string, string>();

  if (!cities || cities.length === 0) {
    return cityMap;
  }

  try {
    // Buscar todas as cidades de uma vez
    const cityNames = cities.map(c => c.city.trim().toLowerCase());
    const states = cities.map(c => c.state.trim().toUpperCase());

    const { data, error } = await supabase
      .from('cities')
      .select('id, name, state')
      .in('state', [...new Set(states)]); // Remove duplicatas

    if (error) {
      console.error('Erro ao buscar city_ids em lote:', error);
      return cityMap;
    }

    if (data) {
      // Criar mapa com os resultados
      data.forEach(city => {
        const key = `${city.name.toLowerCase()},${city.state.toUpperCase()}`;
        cityMap.set(key, city.id);
      });
    }

    return cityMap;
  } catch (error) {
    console.error('Erro ao buscar city_ids em lote:', error);
    return cityMap;
  }
}
