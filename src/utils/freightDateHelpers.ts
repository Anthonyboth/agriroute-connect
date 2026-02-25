/**
 * Helpers para classificação de fretes baseado em datas de coleta
 */

import { normalizeFreightStatus } from '@/lib/freight-status';

export interface FreightDateClassification {
  status: 'scheduled' | 'today' | 'overdue' | 'current';
  daysUntilPickup: number;
  isExpired: boolean;
  label: string;
}

/**
 * Classifica um frete baseado na data de coleta
 * @param pickupDate Data de coleta do frete (formato: YYYY-MM-DD ou timestamp)
 * @returns Classificação do frete
 */
export const classifyFreightByPickupDate = (pickupDate: string | null): FreightDateClassification => {
  if (!pickupDate) {
    return {
      status: 'current',
      daysUntilPickup: 0,
      isExpired: false,
      label: 'Sem data definida'
    };
  }

  const pickup = new Date(pickupDate);
  const today = new Date();
  
  // Zerar horas para comparação de datas
  pickup.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  
  const diffTime = pickup.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  // Frete com data futura = Agendado
  if (diffDays > 0) {
    return {
      status: 'scheduled',
      daysUntilPickup: diffDays,
      isExpired: false,
      label: `Agendado para daqui ${diffDays} dia${diffDays > 1 ? 's' : ''}`
    };
  }

  // Frete com data de hoje = Deve estar em andamento hoje
  if (diffDays === 0) {
    return {
      status: 'today',
      daysUntilPickup: 0,
      isExpired: false,
      label: 'Coleta prevista para hoje'
    };
  }

  // Frete com data passada (mais de 2 dias) = Vencido
  if (diffDays <= -2) {
    return {
      status: 'overdue',
      daysUntilPickup: diffDays,
      isExpired: true,
      label: `Vencido há ${Math.abs(diffDays)} dias`
    };
  }

  // Frete com data de ontem ou anteontem = Em andamento
  return {
    status: 'current',
    daysUntilPickup: diffDays,
    isExpired: false,
    label: `Coleta prevista há ${Math.abs(diffDays)} dia${Math.abs(diffDays) > 1 ? 's' : ''}`
  };
};

/**
 * Verifica se um frete deve ser exibido na aba "Agendados"
 * @param pickupDate Data de coleta do frete
 * @param status Status atual do frete
 * @returns true se deve aparecer em "Agendados"
 */
export const isScheduledFreight = (pickupDate: string | null, status: string): boolean => {
  if (!pickupDate) return false;
  if (['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(status)) return false;
  
  const classification = classifyFreightByPickupDate(pickupDate);
  return classification.status === 'scheduled';
};

/**
 * Verifica se um frete deve ser exibido na aba "Em Andamento"
 * 
 * Regra corrigida: 
 * - Status LOADED, IN_TRANSIT, LOADING, DELIVERED_PENDING_CONFIRMATION = SEMPRE em andamento
 * - Status ACCEPTED = em andamento se pickup_date <= hoje
 * 
 * @param pickupDate Data de coleta do frete
 * @param status Status atual do frete
 * @returns true se deve aparecer em "Em Andamento"
 */
export const isInProgressFreight = (pickupDate: string | null, status: string): boolean => {
  // ✅ Defesa contra status não-canônico (ex: "CARREGANDO", "EM_TRANSPORTE")
  // Sem isso, o frete pode "sumir" das abas de andamento.
  const normalizedStatus = normalizeFreightStatus(String(status || ''));

  // Finalizados nunca aparecem em andamento
  if (['CANCELLED', 'DELIVERED', 'COMPLETED'].includes(normalizedStatus)) return false;
  
  // Status que indicam que o frete ESTÁ FISICAMENTE em andamento,
  // independente da data de coleta (já foi carregado, está em trânsito, etc.)
  const alwaysInProgressStatuses = ['LOADING', 'LOADED', 'IN_TRANSIT', 'DELIVERED_PENDING_CONFIRMATION'];
  if (alwaysInProgressStatuses.includes(normalizedStatus)) {
    return true;
  }
  
  // Status ACCEPTED: depende da data de pickup
  // Fretes com pickup futuro vão para "Agendados", não "Em Andamento"
  if (normalizedStatus === 'ACCEPTED') {
    if (!pickupDate) return true; // Sem data = assume que está em andamento
    
    const classification = classifyFreightByPickupDate(pickupDate);
    // Em andamento se pickup é hoje ou já passou
    return classification.status === 'today' || classification.status === 'current' || classification.status === 'overdue';
  }
  
  // Outros status (OPEN, etc.) não são "em andamento"
  return false;
};

/**
 * Formata a data de coleta para exibição
 * @param pickupDate Data de coleta
 * @returns String formatada
 */
export const formatPickupDate = (pickupDate: string | null): string => {
  if (!pickupDate) return 'Não definida';
  
  const date = new Date(pickupDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((date.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays === 0) return 'Hoje';
  if (diffDays === 1) return 'Amanhã';
  if (diffDays === -1) return 'Ontem';
  
  return date.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });
};

/**
 * Calcula dias até pickup (versão simplificada para uso direto)
 */
export const getDaysUntilPickup = (pickupDate: string | null): number | null => {
  if (!pickupDate) return null;
  
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const pickup = new Date(pickupDate);
  pickup.setHours(0, 0, 0, 0);
  
  const diffTime = pickup.getTime() - today.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Gera configuração de badge para data de coleta
 */
export const getPickupDateBadge = (pickupDate: string | null): {
  variant: 'destructive' | 'default' | 'secondary';
  icon: 'AlertTriangle' | 'Clock' | 'Calendar';
  text: string;
} | null => {
  const days = getDaysUntilPickup(pickupDate);
  if (days === null) return null;
  
  if (days < 0) {
    return {
      variant: 'destructive',
      icon: 'AlertTriangle',
      text: `${Math.abs(days)} dia(s) atrasado`
    };
  }
  
  if (days === 0) {
    return {
      variant: 'default',
      icon: 'Clock',
      text: 'Coleta hoje'
    };
  }
  
  if (days === 1) {
    return {
      variant: 'secondary',
      icon: 'Calendar',
      text: 'Coleta amanhã'
    };
  }
  
  if (days <= 3) {
    return {
      variant: 'secondary',
      icon: 'Calendar',
      text: `${days} dias para coleta`
    };
  }
  
  return {
    variant: 'default',
    icon: 'Calendar',
    text: `${days} dias para coleta`
  };
};
