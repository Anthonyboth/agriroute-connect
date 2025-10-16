/**
 * Utilitário para validação e correção de textos em Português do Brasil
 */

// Dicionário de palavras comuns e suas grafias corretas
const commonWords: Record<string, string> = {
  // Verbos
  'avaliar': 'avaliar',
  'enviar': 'enviar',
  'cancelar': 'cancelar',
  'confirmar': 'confirmar',
  'aceitar': 'aceitar',
  'recusar': 'recusar',
  'finalizar': 'finalizar',
  
  // Substantivos
  'avaliação': 'avaliação',
  'comentário': 'comentário',
  'motorista': 'motorista',
  'prestador': 'prestador',
  'produtor': 'produtor',
  'serviço': 'serviço',
  'frete': 'frete',
  
  // Adjetivos
  'pendente': 'pendente',
  'completo': 'completo',
  'opcional': 'opcional',
  'obrigatório': 'obrigatório',
};

// Palavras que frequentemente são escritas incorretamente
const commonMistakes: Record<string, string> = {
  'avaliacao': 'avaliação',
  'avaliacão': 'avaliação',
  'comentario': 'comentário',
  'comentarios': 'comentários',
  'servico': 'serviço',
  'servicos': 'serviços',
  'obrigatorio': 'obrigatório',
  'responsavel': 'responsável',
  'mecanico': 'mecânico',
  'eletrica': 'elétrica',
  'agronomia': 'agronomia',
  'topografia': 'topografia',
};

/**
 * Valida e corrige a grafia de palavras comuns em português
 */
export function validateWord(word: string): string {
  const normalized = word.toLowerCase().trim();
  
  // Verificar erros comuns primeiro
  if (commonMistakes[normalized]) {
    return commonMistakes[normalized];
  }
  
  // Verificar dicionário de palavras corretas
  if (commonWords[normalized]) {
    return commonWords[normalized];
  }
  
  return word;
}

/**
 * Valida e corrige um texto completo
 */
export function validateText(text: string): string {
  if (!text) return text;
  
  // Separar palavras e pontuação
  const words = text.split(/\b/);
  
  // Validar cada palavra
  const correctedWords = words.map(word => {
    // Não modificar pontuação ou espaços
    if (/^\s+$/.test(word) || /^[^\w]+$/.test(word)) {
      return word;
    }
    return validateWord(word);
  });
  
  return correctedWords.join('');
}

/**
 * Normaliza nome de tipo de serviço para exibição
 */
export function normalizeServiceType(serviceType: string): string {
  const serviceNames: Record<string, string> = {
    // Serviços de manutenção
    'MECANICO': 'Mecânico',
    'AUTO_ELETRICA': 'Auto Elétrica',
    'BORRACHEIRO': 'Borracheiro',
    'CHAVEIRO': 'Chaveiro',
    'MECANICO_INDUSTRIAL': 'Mecânico Industrial',
    'TORNEARIA_SOLDA_REPAROS': 'Tornearia, Solda e Reparos',
    
    // Serviços agrícolas
    'AGRONOMO': 'Agrônomo',
    'ANALISE_SOLO': 'Análise de Solo',
    'ADUBACAO_CALCARIO': 'Adubação e Calcário',
    'COLHEITA_PLANTIO_TERCEIRIZADA': 'Colheita e Plantio Terceirizada',
    'PULVERIZACAO_DRONE': 'Pulverização com Drone',
    'PIVO_IRRIGACAO': 'Pivô de Irrigação',
    'TOPOGRAFIA_RURAL': 'Topografia Rural',
    
    // Serviços de transporte e logística
    'CARGA': 'Carga',
    'CARREGAMENTO_DESCARREGAMENTO': 'Carregamento e Descarregamento',
    'ARMAZENAGEM': 'Armazenagem',
    'CLASSIFICACAO_GRAOS': 'Classificação de Grãos',
    'SECAGEM_GRAOS': 'Secagem de Grãos',
    'GUINDASTE': 'Guindaste',
    
    // Serviços de construção
    'TERRAPLENAGEM': 'Terraplenagem',
    'CONSTRUCAO_MANUTENCAO_CERCAS': 'Construção e Manutenção de Cercas',
    
    // Serviços especializados
    'SERVICOS_VETERINARIOS': 'Serviços Veterinários',
    'ASSISTENCIA_TECNICA': 'Assistência Técnica',
    'CONSULTORIA_RURAL': 'Consultoria Rural',
    'CONSULTORIA_TI': 'Consultoria em TI',
    
    // Serviços de infraestrutura
    'ENERGIA_SOLAR': 'Energia Solar',
    'CFTV_SEGURANCA': 'CFTV e Segurança',
    'AUTOMACAO_INDUSTRIAL': 'Automação Industrial',
    
    // Serviços diversos
    'OPERADOR_MAQUINAS': 'Operador de Máquinas',
    'COMBUSTIVEL': 'Combustível',
    'COMPRA_ENTREGA_PECAS': 'Compra e Entrega de Peças',
    'LIMPEZA_DESASSOREAMENTO_REPRESAS': 'Limpeza e Desassoreamento de Represas',
    'MANUTENCAO_BALANCAS': 'Manutenção de Balanças',
    'MANUTENCAO_REVISAO_GPS': 'Manutenção e Revisão de GPS',
    'OUTROS': 'Outros Serviços',
    
    // Tipos de frete (não devem aparecer para prestadores)
    'FRETE_MOTO': 'Frete Moto',
    'GUINCHO_FREIGHT': 'Guincho',
    'CARGA_FREIGHT': 'Carga (Frete)',
    'MUDANCA_FREIGHT': 'Mudança',
    'GUINCHO': 'Guincho',
    'MUDANCA': 'Mudança',
  };
  
  return serviceNames[serviceType] || serviceType;
}

/**
 * Valida se o texto está em português correto (verificação básica)
 */
export function isValidPortuguese(text: string): boolean {
  if (!text) return false;
  
  // Verificar se tem caracteres especiais do português
  const hasPortugueseChars = /[áàâãéêíóôõúüç]/i.test(text);
  
  // Verificar se não tem caracteres estranhos
  const hasInvalidChars = /[^\w\s\dáàâãéêíóôõúüçÁÀÂÃÉÊÍÓÔÕÚÜÇ.,!?;:()\-]/i.test(text);
  
  return !hasInvalidChars;
}

/**
 * Remove acentos de um texto (útil para comparações)
 */
export function removeAccents(text: string): string {
  return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function capitalizeWords(text: string): string {
  return text.replace(/\b\w/g, char => char.toUpperCase());
}

/**
 * Valida e formata mensagem de erro
 */
export function formatErrorMessage(error: string): string {
  const errorMessages: Record<string, string> = {
    'invalid input syntax for type uuid': 'Erro ao processar identificador. Por favor, tente novamente.',
    'permission denied': 'Você não tem permissão para realizar esta ação.',
    'not found': 'Registro não encontrado.',
    'already exists': 'Este registro já existe.',
    'invalid credentials': 'Credenciais inválidas.',
    'network error': 'Erro de conexão. Verifique sua internet.',
  };
  
  const lowerError = error.toLowerCase();
  
  for (const [key, message] of Object.entries(errorMessages)) {
    if (lowerError.includes(key)) {
      return message;
    }
  }
  
  return 'Ocorreu um erro. Por favor, tente novamente.';
}
