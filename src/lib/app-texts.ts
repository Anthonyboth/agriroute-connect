/**
 * Textos centralizados da aplicação em Português do Brasil
 * Todos os textos da interface devem estar aqui para facilitar manutenção
 */

export const appTexts = {
  // Avaliações
  ratings: {
    title: 'Avaliações',
    pendingTitle: 'Avaliações Pendentes',
    rateService: 'Avaliar Serviço',
    rateFreight: 'Avaliar Frete',
    rateDriver: 'Avaliar Motorista',
    rateProducer: 'Avaliar Produtor',
    rateProvider: 'Avaliar Prestador',
    rateClient: 'Avaliar Cliente',
    
    // Perguntas
    howWasService: 'Como você avalia o serviço prestado?',
    howWasFreight: 'Como foi sua experiência com este frete?',
    
    // Níveis de satisfação
    satisfaction: {
      1: 'Muito Insatisfeito',
      2: 'Insatisfeito',
      3: 'Neutro',
      4: 'Satisfeito',
      5: 'Muito Satisfeito',
    },
    
    // Botões
    submitRating: 'Enviar Avaliação',
    rateLater: 'Avaliar Depois',
    cancel: 'Cancelar',
    
    // Mensagens
    required: 'Por favor, selecione uma nota de 1 a 5 estrelas.',
    success: 'Avaliação enviada com sucesso!',
    error: 'Erro ao enviar avaliação. Tente novamente.',
    
    // Campos
    comment: 'Comentários',
    commentOptional: 'Comentários (opcional)',
    commentPlaceholder: 'Conte mais sobre sua experiência...',
    commentHelp: 'Você pode avaliar depois no seu histórico',
    
    // Contexto
    driverResponsible: 'Motorista responsável',
    freightProducer: 'Produtor do frete',
    serviceProvider: 'Prestador de serviço',
    client: 'Cliente',
  },
  
  // Status de serviços
  serviceStatus: {
    PENDING: 'Pendente',
    ACCEPTED: 'Aceito',
    IN_PROGRESS: 'Em Andamento',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
    OPEN: 'Aberto',
  },
  
  // Status de fretes
  freightStatus: {
    OPEN: 'Aberto',
    PENDING: 'Pendente',
    ASSIGNED: 'Atribuído',
    IN_TRANSIT: 'Em Trânsito',
    DELIVERED: 'Entregue',
    COMPLETED: 'Concluído',
    CANCELLED: 'Cancelado',
  },
  
  // Roles de usuário
  userRoles: {
    PRODUTOR: 'Produtor',
    MOTORISTA: 'Motorista',
    MOTORISTA_AFILIADO: 'Motorista Afiliado',
    TRANSPORTADORA: 'Transportadora',
    PRESTADOR_SERVICOS: 'Prestador de Serviços',
    ADMIN: 'Administrador',
  },
  
  // Mensagens gerais
  general: {
    loading: 'Carregando...',
    saving: 'Salvando...',
    sending: 'Enviando...',
    processing: 'Processando...',
    success: 'Sucesso!',
    error: 'Erro!',
    noData: 'Nenhum dado encontrado',
    tryAgain: 'Tentar Novamente',
    confirm: 'Confirmar',
    back: 'Voltar',
  },
  
  // Erros comuns
  errors: {
    generic: 'Ocorreu um erro. Por favor, tente novamente.',
    network: 'Erro de conexão. Verifique sua internet.',
    permission: 'Você não tem permissão para esta ação.',
    notFound: 'Registro não encontrado.',
    invalidData: 'Dados inválidos.',
    required: 'Campo obrigatório.',
  },
  
  // Dashboard do Prestador de Serviços
  serviceProviderDashboard: {
    title: 'Painel do Prestador',
    welcome: 'Bem-vindo',
    availableServices: 'Serviços Disponíveis',
    myServices: 'Meus Serviços',
    serviceRequests: 'Solicitações de Serviço',
    noRequests: 'Nenhuma solicitação disponível no momento',
  },
  
  // Painel de avaliações pendentes
  pendingRatings: {
    title: 'Avaliações Pendentes',
    count: (n: number) => `Avaliações Pendentes (${n})`,
    provider: 'Prestador',
    client: 'Cliente',
    service: 'Serviço',
    completedOn: 'Concluído em',
    rateButton: 'Avaliar',
  },
  
  // Tipos de serviço (português correto)
  serviceTypes: {
    // Manutenção
    MECANICO: 'Mecânico',
    AUTO_ELETRICA: 'Auto Elétrica',
    BORRACHEIRO: 'Borracheiro',
    CHAVEIRO: 'Chaveiro',
    MECANICO_INDUSTRIAL: 'Mecânico Industrial',
    TORNEARIA_SOLDA_REPAROS: 'Tornearia, Solda e Reparos',
    
    // Agrícola
    AGRONOMO: 'Agrônomo',
    ANALISE_SOLO: 'Análise de Solo',
    ADUBACAO_CALCARIO: 'Adubação e Calcário',
    COLHEITA_PLANTIO_TERCEIRIZADA: 'Colheita e Plantio Terceirizada',
    PULVERIZACAO_DRONE: 'Pulverização com Drone',
    PIVO_IRRIGACAO: 'Pivô de Irrigação',
    TOPOGRAFIA_RURAL: 'Topografia Rural',
    
    // Transporte e logística
    CARGA: 'Carga',
    CARREGAMENTO_DESCARREGAMENTO: 'Saqueiros / Ajudantes de Carga',
    ARMAZENAGEM: 'Armazenagem',
    CLASSIFICACAO_GRAOS: 'Classificação de Grãos',
    SECAGEM_GRAOS: 'Secagem de Grãos',
    GUINDASTE: 'Guindaste',
    
    // Construção
    TERRAPLENAGEM: 'Terraplenagem',
    CONSTRUCAO_MANUTENCAO_CERCAS: 'Construção e Manutenção de Cercas',
    
    // Especializado
    SERVICOS_VETERINARIOS: 'Serviços Veterinários',
    ASSISTENCIA_TECNICA: 'Assistência Técnica',
    CONSULTORIA_RURAL: 'Consultoria Rural',
    CONSULTORIA_TI: 'Consultoria em TI',
    
    // Infraestrutura
    ENERGIA_SOLAR: 'Energia Solar',
    CFTV_SEGURANCA: 'CFTV e Segurança',
    AUTOMACAO_INDUSTRIAL: 'Automação Industrial',
    
    // Diversos
    OPERADOR_MAQUINAS: 'Operador de Máquinas',
    COMBUSTIVEL: 'Combustível',
    COMPRA_ENTREGA_PECAS: 'Compra e Entrega de Peças',
    LIMPEZA_DESASSOREAMENTO_REPRESAS: 'Limpeza e Desassoreamento de Represas',
    MANUTENCAO_BALANCAS: 'Manutenção de Balanças',
    MANUTENCAO_REVISAO_GPS: 'Manutenção e Revisão de GPS',
    OUTROS: 'Outros Serviços',
  },
  
  // Datas e tempo
  date: {
    today: 'Hoje',
    yesterday: 'Ontem',
    tomorrow: 'Amanhã',
    daysAgo: (n: number) => `Há ${n} ${n === 1 ? 'dia' : 'dias'}`,
    hoursAgo: (n: number) => `Há ${n} ${n === 1 ? 'hora' : 'horas'}`,
    minutesAgo: (n: number) => `Há ${n} ${n === 1 ? 'minuto' : 'minutos'}`,
  },
};

/**
 * Helper para obter texto traduzido com fallback
 */
export function getText(path: string, fallback: string = ''): string {
  const keys = path.split('.');
  let current: any = appTexts;
  
  for (const key of keys) {
    if (current[key] === undefined) {
      return fallback || path;
    }
    current = current[key];
  }
  
  return typeof current === 'string' ? current : fallback || path;
}
