/**
 * Utilitário de deduplicação de cidades para autocomplete
 * Garante que cada cidade apareça apenas uma vez no dropdown
 */

interface City {
  id: string;
  name: string;
  state: string;
  display_name: string;
  lat?: number;
  lng?: number;
  ibge_code?: string;
}

/**
 * Normaliza string de cidade para comparação
 * Remove acentos, espaços extras, pontuação
 */
export const normalizeCityKey = (cityName: string): string => {
  if (!cityName) return '';
  
  return cityName
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[^\w\s]/g, '') // Remove pontuação
    .replace(/\s+/g, ' ') // Normaliza espaços
    .toUpperCase();
};

/**
 * Gera chave única para deduplicação
 * Prioridade: ibge_code > city_id > normalized_name|UF
 */
export const generateDedupeKey = (city: City): string => {
  // Prioridade 1: IBGE code se existir
  if (city.ibge_code) {
    return `ibge:${city.ibge_code}`;
  }
  
  // Prioridade 2: ID interno (UUID)
  if (city.id) {
    return `id:${city.id}`;
  }
  
  // Fallback: nome normalizado + UF
  const normalizedName = normalizeCityKey(city.name);
  const uf = city.state?.trim().toUpperCase() || '';
  return `name:${normalizedName}|${uf}`;
};

/**
 * Pontua a qualidade de um registro de cidade
 * Quanto maior, mais completo/confiável
 */
const scoreCityQuality = (city: City): number => {
  let score = 0;
  
  if (city.id) score += 10;
  if (city.ibge_code) score += 8;
  if (city.lat && city.lng) score += 5;
  if (city.name) score += 3;
  if (city.state) score += 2;
  if (city.display_name) score += 1;
  
  return score;
};

/**
 * Remove cidades duplicadas do array
 * Preserva o registro mais completo em caso de conflito
 * 
 * @param cities Array de cidades do RPC/API
 * @returns Array deduplicado com logs de debug
 */
export const deduplicateCities = (cities: City[]): City[] => {
  if (!cities || cities.length === 0) return [];
  
  const seen = new Map<string, City>();
  let duplicatesRemoved = 0;
  
  for (const city of cities) {
    const key = generateDedupeKey(city);
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, city);
    } else {
      // Conflito: manter o mais completo
      const existingScore = scoreCityQuality(existing);
      const newScore = scoreCityQuality(city);
      
      if (newScore > existingScore) {
        seen.set(key, city);
      }
      duplicatesRemoved++;
    }
  }
  
  const uniqueCities = Array.from(seen.values());
  
  // Log de debug (DEV only)
  if (duplicatesRemoved > 0 && process.env.NODE_ENV === 'development') {
    console.log('[CITY_DEDUPE]', {
      inputItems: cities.length,
      uniqueItems: uniqueCities.length,
      duplicatesRemoved,
      items: uniqueCities.map(c => ({
        label: c.display_name,
        city: c.name,
        uf: c.state,
        city_id: c.id,
        ibge_code: c.ibge_code || null
      }))
    });
  }
  
  return uniqueCities;
};

/**
 * Formata display_name consistente: "Cidade — UF"
 */
export const formatCityDisplay = (name: string, state: string): string => {
  if (!name) return '';
  const uf = state?.trim().toUpperCase() || '';
  return uf ? `${name} — ${uf}` : name;
};
