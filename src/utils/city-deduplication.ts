/**
 * Utilitário de deduplicação de cidades para autocomplete
 * Garante que cada cidade apareça apenas uma vez no dropdown
 * Formato OBRIGATÓRIO: "Cidade — UF" (ex: "Primavera do Leste — MT")
 * NUNCA exibir: "Cidade — NOME DO ESTADO" (ex: "Primavera do Leste — MATO GROSSO")
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
 * Mapa de nomes de estados brasileiros → UF (2 letras)
 * Suporta variações com/sem acento, maiúsculas/minúsculas
 */
const STATE_NAME_TO_UF: Record<string, string> = {
  // UFs (já válidos)
  'AC': 'AC', 'AL': 'AL', 'AP': 'AP', 'AM': 'AM', 'BA': 'BA',
  'CE': 'CE', 'DF': 'DF', 'ES': 'ES', 'GO': 'GO', 'MA': 'MA',
  'MT': 'MT', 'MS': 'MS', 'MG': 'MG', 'PA': 'PA', 'PB': 'PB',
  'PR': 'PR', 'PE': 'PE', 'PI': 'PI', 'RJ': 'RJ', 'RN': 'RN',
  'RS': 'RS', 'RO': 'RO', 'RR': 'RR', 'SC': 'SC', 'SP': 'SP',
  'SE': 'SE', 'TO': 'TO',
  
  // Nomes por extenso (normalizados para lowercase)
  'acre': 'AC',
  'alagoas': 'AL',
  'amapa': 'AP',
  'amazonas': 'AM',
  'bahia': 'BA',
  'ceara': 'CE',
  'distrito federal': 'DF',
  'espirito santo': 'ES',
  'goias': 'GO',
  'maranhao': 'MA',
  'mato grosso': 'MT',
  'mato grosso do sul': 'MS',
  'minas gerais': 'MG',
  'para': 'PA',
  'paraiba': 'PB',
  'parana': 'PR',
  'pernambuco': 'PE',
  'piaui': 'PI',
  'rio de janeiro': 'RJ',
  'rio grande do norte': 'RN',
  'rio grande do sul': 'RS',
  'rondonia': 'RO',
  'roraima': 'RR',
  'santa catarina': 'SC',
  'sao paulo': 'SP',
  'sergipe': 'SE',
  'tocantins': 'TO',
};

/**
 * Converte qualquer representação de estado para UF de 2 letras
 * Aceita: "MT", "Mato Grosso", "MATO GROSSO", "mato-grosso", etc.
 * 
 * @param stateLike - String que representa o estado (UF ou nome completo)
 * @returns UF de 2 letras ou null se não conseguir mapear
 */
export const toUF = (stateLike: string | null | undefined): string | null => {
  if (!stateLike) return null;
  
  const trimmed = stateLike.trim();
  if (!trimmed) return null;
  
  // Já é UF válido? (2 letras maiúsculas)
  const upper = trimmed.toUpperCase();
  if (/^[A-Z]{2}$/.test(upper) && STATE_NAME_TO_UF[upper]) {
    return upper;
  }
  
  // Normalizar para busca no mapa:
  // - Remover acentos
  // - Lowercase
  // - Remover hífens e caracteres especiais
  // - Normalizar espaços
  const normalized = trimmed
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Remove diacríticos
    .replace(/[-_]/g, ' ') // Substitui hífens por espaços
    .replace(/\s+/g, ' ') // Normaliza espaços múltiplos
    .trim();
  
  // Tentar buscar no mapa
  const uf = STATE_NAME_TO_UF[normalized];
  if (uf) return uf;
  
  // Última tentativa: buscar parcialmente (casos como "MATO GROSSO")
  const normalizedUpper = upper
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
  
  return STATE_NAME_TO_UF[normalizedUpper] || null;
};

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
 * SEMPRE usa UF normalizado (2 letras)
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
  
  // Fallback: nome normalizado + UF (sempre 2 letras)
  const normalizedName = normalizeCityKey(city.name);
  const uf = toUF(city.state) || city.state?.trim().toUpperCase().slice(0, 2) || '';
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
  
  // Bonus: já tem UF válido (2 letras)
  const uf = toUF(city.state);
  if (uf && uf.length === 2) score += 2;
  
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
    // Normalizar state para UF antes de processar
    const uf = toUF(city.state);
    const normalizedCity: City = {
      ...city,
      state: uf || city.state, // Usar UF se encontrado
      display_name: formatCityDisplay(city.name, city.state)
    };
    
    const key = generateDedupeKey(normalizedCity);
    const existing = seen.get(key);
    
    if (!existing) {
      seen.set(key, normalizedCity);
    } else {
      // Conflito: manter o mais completo
      const existingScore = scoreCityQuality(existing);
      const newScore = scoreCityQuality(normalizedCity);
      
      if (newScore > existingScore) {
        seen.set(key, normalizedCity);
      }
      duplicatesRemoved++;
    }
  }
  
  const uniqueCities = Array.from(seen.values());
  
  // Log de debug (DEV only) - sempre logar em dev para debug
  if (import.meta.env.DEV) {
    console.log('[CITY_DEDUPE]', {
      inputItems: cities.length,
      uniqueItems: uniqueCities.length,
      duplicatesRemoved,
      hasFullStateNames: cities.some(c => c.state && c.state.length > 2),
      items: uniqueCities.slice(0, 5).map(c => ({
        label: c.display_name,
        city: c.name,
        uf: c.state,
        city_id: c.id,
        ibge_code: c.ibge_code || null
      }))
    });
    
    // Verificação P0: alertar se ainda houver estado por extenso
    const fullStateNames = uniqueCities.filter(c => c.state && c.state.length > 2);
    if (fullStateNames.length > 0) {
      console.warn('[CITY_DEDUPE] ⚠️ ATENÇÃO: Cidades com estado por extenso detectadas:', 
        fullStateNames.map(c => `${c.name} — ${c.state}`));
    }
  }
  
  return uniqueCities;
};

/**
 * Formata display_name consistente: "Cidade — UF"
 * NUNCA retorna "Cidade — NOME DO ESTADO"
 * 
 * @param name Nome da cidade
 * @param state Estado (pode ser UF ou nome completo)
 * @returns String no formato "Cidade — UF"
 */
export const formatCityDisplay = (name: string, state: string): string => {
  if (!name) return '';
  
  // SEMPRE converter para UF de 2 letras
  const uf = toUF(state);
  
  // Se não conseguiu converter, descartar o estado do display
  // (melhor não mostrar nada do que mostrar errado)
  if (!uf) {
    if (import.meta.env.DEV && state) {
      console.warn(`[formatCityDisplay] Estado não reconhecido: "${state}" para cidade "${name}"`);
    }
    return name;
  }
  
  return `${name} — ${uf}`;
};

/**
 * Formata cidade para exibição em mensagens de sucesso/status
 * Sempre usa UF de 2 letras
 */
export const formatCityStatusMessage = (city: string, state: string, neighborhood?: string): string => {
  const uf = toUF(state) || state;
  
  if (neighborhood) {
    return `✓ ${city}, ${uf} - ${neighborhood}`;
  }
  return `✓ ${city}, ${uf}`;
};

/**
 * Verifica se um resultado de cidade é válido para exibição
 * Rejeita itens sem UF válido
 */
export const isValidCityResult = (city: City): boolean => {
  if (!city.name) return false;
  
  const uf = toUF(city.state);
  return uf !== null;
};

/**
 * Filtra e formata array de cidades, removendo inválidas
 */
export const sanitizeCityResults = (cities: City[]): City[] => {
  return cities
    .filter(isValidCityResult)
    .map(city => ({
      ...city,
      state: toUF(city.state) || city.state,
      display_name: formatCityDisplay(city.name, city.state)
    }));
};
