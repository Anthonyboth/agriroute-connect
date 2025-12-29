// Sistema de Internacionalização (i18n) para AGRIROUTE
// Todas as mensagens em português brasileiro

export type LocaleKey = 'pt-BR' | 'en-US' | 'es-ES';

export interface TranslationDictionary {
  common: typeof ptBR.common;
  status: typeof ptBR.status;
  freight: typeof ptBR.freight;
  service: typeof ptBR.service;
  reports: typeof ptBR.reports;
  auth: typeof ptBR.auth;
  errors: typeof ptBR.errors;
  success: typeof ptBR.success;
  validation: typeof ptBR.validation;
  gamification: typeof ptBR.gamification;
  premium: typeof ptBR.premium;
}

export const ptBR = {
  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    confirm: 'Confirmar',
    delete: 'Excluir',
    edit: 'Editar',
    add: 'Adicionar',
    search: 'Buscar',
    filter: 'Filtrar',
    clear: 'Limpar',
    apply: 'Aplicar',
    close: 'Fechar',
    back: 'Voltar',
    next: 'Próximo',
    previous: 'Anterior',
    loading: 'Carregando...',
    noData: 'Nenhum dado encontrado',
    noResults: 'Nenhum resultado encontrado',
    all: 'Todos',
    none: 'Nenhum',
    yes: 'Sim',
    no: 'Não',
    or: 'ou',
    and: 'e',
    required: 'Obrigatório',
    optional: 'Opcional',
    total: 'Total',
    average: 'Média',
    actions: 'Ações',
    details: 'Detalhes',
    view: 'Visualizar',
    download: 'Baixar',
    upload: 'Enviar',
    refresh: 'Atualizar',
    retry: 'Tentar novamente',
    submit: 'Enviar',
    update: 'Atualizar',
    create: 'Criar',
    select: 'Selecionar',
    selectAll: 'Selecionar todos',
    deselectAll: 'Desmarcar todos',
    showMore: 'Ver mais',
    showLess: 'Ver menos',
    expand: 'Expandir',
    collapse: 'Recolher',
  },
  status: {
    OPEN: 'Aberto',
    IN_NEGOTIATION: 'Em Negociação',
    ACCEPTED: 'Aceito',
    LOADING: 'A Caminho da Coleta',
    LOADED: 'Carregado',
    IN_TRANSIT: 'Em Transporte',
    DELIVERED: 'Entregue',
    DELIVERED_PENDING_CONFIRMATION: 'Entrega Reportada',
    CANCELLED: 'Cancelado',
    COMPLETED: 'Concluído',
    REJECTED: 'Rejeitado',
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    ACTIVE: 'Ativo',
    INACTIVE: 'Inativo',
    LEFT: 'Saiu',
    REMOVED: 'Removido',
    IN_PROGRESS: 'Em Andamento',
    PROCESSING: 'Processando',
    FAILED: 'Falhou',
    RESOLVED: 'Resolvido',
    EXPIRED: 'Expirado',
    VALIDATED: 'Validado',
  },
  freight: {
    title: 'Frete',
    freights: 'Fretes',
    newFreight: 'Novo Frete',
    myFreights: 'Meus Fretes',
    availableFreights: 'Fretes Disponíveis',
    origin: 'Origem',
    destination: 'Destino',
    distance: 'Distância',
    weight: 'Peso',
    price: 'Preço',
    pricePerKm: 'Preço por km',
    pickupDate: 'Data de Coleta',
    deliveryDate: 'Data de Entrega',
    cargoType: 'Tipo de Carga',
    urgency: 'Urgência',
    urgencyLow: 'Baixa',
    urgencyMedium: 'Média',
    urgencyHigh: 'Alta',
    urgencyUrgent: 'Urgente',
    proposal: 'Proposta',
    proposals: 'Propostas',
    acceptFreight: 'Aceitar Frete',
    cancelFreight: 'Cancelar Frete',
    trackFreight: 'Rastrear Frete',
    confirmDelivery: 'Confirmar Entrega',
    reportDelivery: 'Reportar Entrega',
    noFreightsAvailable: 'Nenhum frete disponível no momento',
    noFreightsFound: 'Nenhum frete encontrado',
  },
  service: {
    title: 'Serviço',
    services: 'Serviços',
    newService: 'Novo Serviço',
    myServices: 'Meus Serviços',
    availableServices: 'Serviços Disponíveis',
    serviceType: 'Tipo de Serviço',
    problemDescription: 'Descrição do Problema',
    vehicleInfo: 'Informações do Veículo',
    location: 'Localização',
    estimatedPrice: 'Preço Estimado',
    finalPrice: 'Preço Final',
    acceptService: 'Aceitar Serviço',
    cancelService: 'Cancelar Serviço',
    completeService: 'Concluir Serviço',
  },
  reports: {
    title: 'Relatórios',
    dashboard: 'Dashboard',
    analytics: 'Analytics',
    period: 'Período',
    dateRange: 'Intervalo de Datas',
    last7Days: 'Últimos 7 dias',
    last30Days: 'Últimos 30 dias',
    last90Days: 'Últimos 90 dias',
    allTime: 'Todo o período',
    custom: 'Personalizado',
    from: 'De',
    to: 'Até',
    exportPDF: 'Exportar PDF',
    exportExcel: 'Exportar Excel',
    exporting: 'Exportando...',
    exportSuccess: 'Relatório exportado com sucesso',
    exportError: 'Erro ao exportar relatório',
    noDataForPeriod: 'Nenhum dado encontrado para este período',
    tryExpandingRange: 'Tente expandir o intervalo de datas',
    totalRevenue: 'Receita Total',
    totalSpent: 'Total Gasto',
    totalFreights: 'Total de Fretes',
    totalServices: 'Total de Serviços',
    totalDistance: 'Distância Total',
    averageRating: 'Avaliação Média',
    completionRate: 'Taxa de Conclusão',
    cancellationRate: 'Taxa de Cancelamento',
    topDrivers: 'Principais Motoristas',
    topProviders: 'Principais Prestadores',
    topRoutes: 'Principais Rotas',
    byStatus: 'Por Status',
    byCargoType: 'Por Tipo de Carga',
    byMonth: 'Por Mês',
    byDay: 'Por Dia',
    comparison: 'Comparação',
    previousPeriod: 'Período Anterior',
    growth: 'Crescimento',
    insights: 'Insights',
    dataQuality: 'Qualidade dos Dados',
    recordsWithoutId: 'Registros sem ID',
    recordsOutOfRange: 'Registros fora do período',
  },
  auth: {
    login: 'Entrar',
    logout: 'Sair',
    register: 'Cadastrar',
    email: 'E-mail',
    password: 'Senha',
    confirmPassword: 'Confirmar Senha',
    forgotPassword: 'Esqueci minha senha',
    resetPassword: 'Redefinir Senha',
    createAccount: 'Criar Conta',
    alreadyHaveAccount: 'Já tem uma conta?',
    dontHaveAccount: 'Não tem uma conta?',
    loginSuccess: 'Login realizado com sucesso',
    logoutSuccess: 'Logout realizado com sucesso',
    registerSuccess: 'Cadastro realizado com sucesso',
    invalidCredentials: 'Credenciais inválidas',
    sessionExpired: 'Sessão expirada. Faça login novamente.',
  },
  errors: {
    generic: 'Ocorreu um erro inesperado',
    network: 'Erro de conexão. Verifique sua internet.',
    unauthorized: 'Você não tem permissão para esta ação',
    notFound: 'Recurso não encontrado',
    validation: 'Dados inválidos',
    serverError: 'Erro no servidor. Tente novamente mais tarde.',
    loadingError: 'Erro ao carregar dados',
    savingError: 'Erro ao salvar dados',
    deletingError: 'Erro ao excluir dados',
    timeoutError: 'A requisição demorou muito. Tente novamente.',
    offlineError: 'Você está offline. Alguns recursos podem não funcionar.',
  },
  success: {
    saved: 'Salvo com sucesso!',
    created: 'Criado com sucesso!',
    updated: 'Atualizado com sucesso!',
    deleted: 'Excluído com sucesso!',
    sent: 'Enviado com sucesso!',
    completed: 'Concluído com sucesso!',
    accepted: 'Aceito com sucesso!',
    cancelled: 'Cancelado com sucesso!',
    copied: 'Copiado para a área de transferência!',
  },
  validation: {
    required: 'Este campo é obrigatório',
    invalidEmail: 'E-mail inválido',
    invalidPhone: 'Telefone inválido',
    invalidCPF: 'CPF inválido',
    invalidCNPJ: 'CNPJ inválido',
    invalidDate: 'Data inválida',
    minLength: 'Mínimo de {min} caracteres',
    maxLength: 'Máximo de {max} caracteres',
    minValue: 'Valor mínimo: {min}',
    maxValue: 'Valor máximo: {max}',
    passwordMismatch: 'As senhas não coincidem',
    passwordTooWeak: 'Senha muito fraca',
  },
  gamification: {
    level: 'Nível',
    xp: 'XP',
    badges: 'Medalhas',
    rewards: 'Recompensas',
    achievements: 'Conquistas',
    earnedBadge: 'Medalha conquistada!',
    levelUp: 'Subiu de nível!',
    xpGained: 'XP ganho',
    nextLevel: 'Próximo nível',
    progress: 'Progresso',
    rank: 'Ranking',
    leaderboard: 'Placar de Líderes',
    redeemReward: 'Resgatar Recompensa',
    rewardRedeemed: 'Recompensa resgatada!',
    lockedReward: 'Recompensa bloqueada',
    requiresLevel: 'Requer nível {level}',
  },
  premium: {
    upgrade: 'Fazer Upgrade',
    premium: 'Premium',
    free: 'Gratuito',
    basic: 'Básico',
    enterprise: 'Enterprise',
    features: 'Recursos',
    unlimitedExports: 'Exportações ilimitadas',
    fullHistory: 'Histórico completo',
    periodComparison: 'Comparação de períodos',
    autoInsights: 'Insights automáticos',
    prioritySupport: 'Suporte prioritário',
    upgradeNow: 'Fazer upgrade agora',
    currentPlan: 'Plano atual',
    exportsRemaining: 'Exportações restantes hoje',
    limitReached: 'Limite de exportações atingido',
    upgradeToContinue: 'Faça upgrade para continuar exportando',
  },
};

// Current locale (can be extended for multi-language support)
let currentLocale: LocaleKey = 'pt-BR';

export const setLocale = (locale: LocaleKey) => {
  currentLocale = locale;
};

export const getLocale = (): LocaleKey => currentLocale;

// Translation function
export const t = (key: string, params?: Record<string, string | number>): string => {
  const keys = key.split('.');
  let value: any = ptBR;
  
  for (const k of keys) {
    value = value?.[k];
    if (value === undefined) {
      console.warn(`[i18n] Missing translation for key: ${key}`);
      return key;
    }
  }
  
  if (typeof value !== 'string') {
    console.warn(`[i18n] Translation value is not a string for key: ${key}`);
    return key;
  }
  
  // Replace params
  if (params) {
    return value.replace(/\{(\w+)\}/g, (_, param) => String(params[param] ?? `{${param}}`));
  }
  
  return value;
};

// Export translations for direct access
export const translations = ptBR;
