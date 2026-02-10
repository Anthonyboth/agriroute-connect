/**
 * Tutorial steps registry per user role.
 * Each step has an id, a target CSS selector, title and description.
 * Up to 10 steps per role with correct selectors matching data-tutorial attributes.
 */

export interface TutorialStep {
  id: string;
  /** CSS selector for the element to highlight. If not found, step is shown as centered overlay. */
  targetSelector?: string;
  title: string;
  description: string;
  /** Optional emoji icon for visual flair */
  icon?: string;
}

export const PRODUCER_STEPS: TutorialStep[] = [
  {
    id: 'producer-hero',
    targetSelector: '[data-tutorial="producer-hero"]',
    title: 'Bem-vindo ao AgriRoute!',
    description: 'Este é o seu painel de gerenciamento. Aqui você cria fretes e solicita serviços.',
    icon: '🏠',
  },
  {
    id: 'producer-freights-tab',
    targetSelector: '[data-tutorial="tab-freights-open"]',
    title: 'Aba de Fretes',
    description: 'Crie e gerencie seus fretes rurais e urbanos nesta aba.',
    icon: '🚛',
  },
  {
    id: 'producer-services-tab',
    targetSelector: '[data-tutorial="tab-services-open"]',
    title: 'Aba de Serviços',
    description: 'Solicite guincho, mudança, transporte de pet e outros serviços.',
    icon: '🔧',
  },
  {
    id: 'producer-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Andamento',
    description: 'Acompanhe fretes e serviços em tempo real.',
    icon: '▶️',
  },
  {
    id: 'producer-confirm',
    targetSelector: '[data-tutorial="tab-confirm-delivery"]',
    title: 'Confirmar Entrega',
    description: 'Confirme a entrega dos fretes quando o motorista concluir o transporte.',
    icon: '✅',
  },
  {
    id: 'producer-proposals',
    targetSelector: '[data-tutorial="tab-proposals"]',
    title: 'Propostas',
    description: 'Veja e aceite propostas de motoristas interessados nos seus fretes.',
    icon: '👥',
  },
  {
    id: 'producer-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Veja todos os fretes e serviços já concluídos.',
    icon: '📋',
  },
  {
    id: 'producer-payments',
    targetSelector: '[data-tutorial="tab-payments"]',
    title: 'Pagamentos',
    description: 'Gerencie pagamentos e acompanhe valores pendentes.',
    icon: '💳',
  },
  {
    id: 'producer-chat',
    targetSelector: '[data-tutorial="tab-chat"]',
    title: 'Chat',
    description: 'Converse diretamente com motoristas e prestadores.',
    icon: '💬',
  },
  {
    id: 'producer-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Acompanhe gastos, volumes transportados e estatísticas detalhadas.',
    icon: '📊',
  },
];

export const DRIVER_STEPS: TutorialStep[] = [
  {
    id: 'driver-hero',
    targetSelector: '[data-tutorial="driver-hero"]',
    title: 'Bem-vindo, Motorista!',
    description: 'Este é o seu painel. Encontre fretes, gerencie viagens e acompanhe ganhos.',
    icon: '🚚',
  },
  {
    id: 'driver-freights',
    targetSelector: '[data-tutorial="driver-freights"]',
    title: 'Fretes Inteligentes',
    description: 'Aqui estão os fretes compatíveis com seu perfil e cidades cadastradas.',
    icon: '🧠',
  },
  {
    id: 'driver-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Andamento',
    description: 'Atualize o status da viagem conforme avança na rota.',
    icon: '▶️',
  },
  {
    id: 'driver-cities',
    targetSelector: '[data-tutorial="tab-cities"]',
    title: 'Cidades de Atuação',
    description: 'Configure as cidades onde você deseja receber fretes.',
    icon: '📍',
  },
  {
    id: 'driver-vehicles',
    targetSelector: '[data-tutorial="tab-vehicles"]',
    title: 'Meus Veículos',
    description: 'Cadastre e gerencie seus veículos para receber fretes compatíveis.',
    icon: '🚛',
  },
  {
    id: 'driver-services',
    targetSelector: '[data-tutorial="tab-services"]',
    title: 'Serviços',
    description: 'Veja serviços disponíveis na sua região para atender.',
    icon: '🔧',
  },
  {
    id: 'driver-requests',
    targetSelector: '[data-tutorial="tab-my-requests"]',
    title: 'Solicitações',
    description: 'Gerencie serviços que você contratou como cliente.',
    icon: '📝',
  },
  {
    id: 'driver-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Todos os fretes e serviços concluídos ficam salvos aqui.',
    icon: '📋',
  },
  {
    id: 'driver-chat',
    targetSelector: '[data-tutorial="tab-chat"]',
    title: 'Chat',
    description: 'Converse com produtores e transportadoras sobre os fretes.',
    icon: '💬',
  },
  {
    id: 'driver-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Veja seus ganhos, despesas e desempenho detalhado.',
    icon: '📊',
  },
];

export const SERVICE_PROVIDER_STEPS: TutorialStep[] = [
  {
    id: 'sp-welcome',
    title: 'Bem-vindo, Prestador!',
    description: 'Este é o seu painel para gerenciar serviços e atender clientes.',
    icon: '🛠️',
  },
  {
    id: 'sp-available',
    targetSelector: '[data-tutorial="sp-available"]',
    title: 'Serviços Disponíveis',
    description: 'Solicitações compatíveis com seus serviços aparecem aqui.',
    icon: '🧠',
  },
  {
    id: 'sp-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Execução',
    description: 'Serviços aceitos que estão em andamento.',
    icon: '▶️',
  },
  {
    id: 'sp-completed',
    targetSelector: '[data-tutorial="tab-completed"]',
    title: 'Concluídos',
    description: 'Serviços finalizados ficam salvos aqui.',
    icon: '✅',
  },
  {
    id: 'sp-requests',
    targetSelector: '[data-tutorial="tab-my-requests-sp"]',
    title: 'Minhas Solicitações',
    description: 'Gerencie serviços que você contratou como cliente.',
    icon: '📝',
  },
  {
    id: 'sp-ratings',
    targetSelector: '[data-tutorial="tab-ratings-sp"]',
    title: 'Avaliações',
    description: 'Veja o que os clientes acharam do seu trabalho.',
    icon: '⭐',
  },
  {
    id: 'sp-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Acompanhe ganhos, avaliações e estatísticas.',
    icon: '📊',
  },
];

export const COMPANY_STEPS: TutorialStep[] = [
  {
    id: 'company-welcome',
    title: 'Bem-vindo, Transportadora!',
    description: 'Gerencie fretes, motoristas afiliados e monitore operações.',
    icon: '🏢',
  },
  {
    id: 'company-freights',
    targetSelector: '[data-tutorial="company-freights"]',
    title: 'Fretes Disponíveis',
    description: 'Gerencie fretes multi-carreta e aceite novos fretes.',
    icon: '🚛',
  },
  {
    id: 'company-drivers',
    targetSelector: '[data-tutorial="company-drivers"]',
    title: 'Motoristas Afiliados',
    description: 'Distribua fretes entre motoristas da sua frota.',
    icon: '👥',
  },
  {
    id: 'company-monitoring',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Monitoramento',
    description: 'Acompanhe cada carreta e motorista em tempo real.',
    icon: '📡',
  },
  {
    id: 'company-requests',
    targetSelector: '[data-tutorial="tab-my-requests-co"]',
    title: 'Solicitações',
    description: 'Gerencie serviços contratados pela transportadora.',
    icon: '📝',
  },
  {
    id: 'company-vehicles',
    targetSelector: '[data-tutorial="tab-vehicles-co"]',
    title: 'Frota',
    description: 'Cadastre e gerencie os veículos da transportadora.',
    icon: '🚚',
  },
  {
    id: 'company-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Fretes e serviços finalizados ficam registrados aqui.',
    icon: '📋',
  },
  {
    id: 'company-chat',
    targetSelector: '[data-tutorial="tab-chat-co"]',
    title: 'Chat',
    description: 'Comunique-se com motoristas afiliados e produtores.',
    icon: '💬',
  },
  {
    id: 'company-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Indicadores por motorista, rota e desempenho da frota.',
    icon: '📊',
  },
];

export function getStepsForRole(role: string): TutorialStep[] {
  switch (role) {
    case 'PRODUTOR':
      return PRODUCER_STEPS;
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO':
      return DRIVER_STEPS;
    case 'PRESTADOR_SERVICOS':
      return SERVICE_PROVIDER_STEPS;
    case 'TRANSPORTADORA':
      return COMPANY_STEPS;
    default:
      return PRODUCER_STEPS;
  }
}
