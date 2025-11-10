/**
 * Normalização robusta de nomes de cidades
 * Remove acentos, caracteres especiais, espaços extras e converte para minúsculas
 */
export const normalizeCity = (cityName: string): string => {
  if (!cityName) return '';
  
  return cityName
    .toLowerCase()
    .normalize('NFD') // Decompor acentos
    .replace(/[\u0300-\u036f]/g, '') // Remover diacríticos
    .replace(/[^\w\s]/g, '') // Remover pontuação
    .replace(/\s+/g, ' ') // Normalizar espaços
    .trim();
};

/**
 * Normaliza cidade|UF para formato consistente
 * Exemplo: "Goiânia|GO" -> "goiania|GO"
 */
export const normalizeCityState = (city: string, state: string): string => {
  const cleanCity = normalizeCity(city);
  const cleanState = state?.trim().toUpperCase() || '';
  return cleanState ? `${cleanCity}|${cleanState}` : cleanCity;
};

/**
 * Extrai e normaliza cidade de um endereço completo
 * Exemplo: "Rua X, 123 - Goiânia, GO" -> "goiania"
 */
export const extractAndNormalizeCity = (address: string): string => {
  if (!address) return '';
  
  // Remover estado comum no final (MT, GO, MS, etc.)
  const withoutState = address.replace(/,?\s*(MT|GO|MS|MG|SP|RJ|BA|RS|PR|SC|CE|PE|PA|AM|RO|AC|AP|RR|TO|MA|PI|AL|SE|PB|RN|ES|DF)\s*$/i, '');
  
  // Pegar última parte após vírgula (normalmente é a cidade)
  const parts = withoutState.split(',').map(p => p.trim());
  const cityPart = parts[parts.length - 1] || parts[0];
  
  return normalizeCity(cityPart);
};
