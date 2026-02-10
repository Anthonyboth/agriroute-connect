/**
 * Tutorial steps registry per user role.
 * Each step has an id, a target CSS selector, title and description.
 */

export interface TutorialStep {
  id: string;
  /** CSS selector for the element to highlight. If not found, step is shown as centered overlay. */
  targetSelector?: string;
  title: string;
  description: string;
}

export const PRODUCER_STEPS: TutorialStep[] = [
  {
    id: 'producer-hero',
    targetSelector: '[data-tutorial="producer-hero"]',
    title: 'Painel de Gerenciamento',
    description: 'Aqui você cria fretes e solicita serviços em poucos cliques.',
  },
  {
    id: 'producer-proposals',
    targetSelector: '[data-tutorial="producer-proposals"]',
    title: 'Propostas de Motoristas',
    description: 'Aqui aparecem os motoristas interessados no seu frete.',
  },
  {
    id: 'producer-services',
    targetSelector: '[data-tutorial="producer-services"]',
    title: 'Solicitar Serviços',
    description: 'Solicite guincho, fretes urbanos, mudanças e outros serviços.',
  },
  {
    id: 'producer-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Andamento',
    description: 'Acompanhe fretes e serviços em tempo real.',
  },
  {
    id: 'producer-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Veja tudo que já foi concluído.',
  },
  {
    id: 'producer-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Acompanhe gastos, volumes transportados e estatísticas.',
  },
];

export const DRIVER_STEPS: TutorialStep[] = [
  {
    id: 'driver-freights',
    targetSelector: '[data-tutorial="driver-freights"]',
    title: 'Fretes Inteligentes',
    description: 'Aqui estão os fretes compatíveis com seu perfil e cidades.',
  },
  {
    id: 'driver-accept',
    targetSelector: '[data-tutorial="driver-region"]',
    title: 'Aceitar Frete',
    description: 'Aceite apenas fretes que você realmente pode atender.',
  },
  {
    id: 'driver-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Andamento',
    description: 'Atualize o status da viagem conforme avança.',
  },
  {
    id: 'driver-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Todos os fretes concluídos ficam salvos aqui.',
  },
  {
    id: 'driver-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Veja seus ganhos e desempenho.',
  },
];

export const SERVICE_PROVIDER_STEPS: TutorialStep[] = [
  {
    id: 'sp-available',
    targetSelector: '[data-tutorial="sp-available"]',
    title: 'Serviços Disponíveis',
    description: 'Solicitações compatíveis com seus serviços aparecem aqui.',
  },
  {
    id: 'sp-accept',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Aceitar Serviço',
    description: 'Ao aceitar, o cliente verá seus dados de contato.',
  },
  {
    id: 'sp-ongoing',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Em Execução',
    description: 'Atualize o serviço conforme o andamento.',
  },
  {
    id: 'sp-completed',
    targetSelector: '[data-tutorial="tab-completed"]',
    title: 'Concluídos',
    description: 'Serviços finalizados ficam salvos aqui.',
  },
  {
    id: 'sp-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Acompanhe ganhos e avaliações.',
  },
];

export const COMPANY_STEPS: TutorialStep[] = [
  {
    id: 'company-freights',
    targetSelector: '[data-tutorial="company-freights"]',
    title: 'Fretes Disponíveis',
    description: 'Gerencie fretes multi-carreta aqui.',
  },
  {
    id: 'company-drivers',
    targetSelector: '[data-tutorial="company-drivers"]',
    title: 'Atribuir Motoristas',
    description: 'Distribua fretes entre motoristas afiliados.',
  },
  {
    id: 'company-monitoring',
    targetSelector: '[data-tutorial="tab-ongoing"]',
    title: 'Monitoramento',
    description: 'Acompanhe cada carreta em tempo real.',
  },
  {
    id: 'company-history',
    targetSelector: '[data-tutorial="tab-history"]',
    title: 'Histórico',
    description: 'Fretes finalizados ficam registrados.',
  },
  {
    id: 'company-reports',
    targetSelector: '[data-tutorial="tab-reports"]',
    title: 'Relatórios',
    description: 'Indicadores por motorista e rota.',
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
