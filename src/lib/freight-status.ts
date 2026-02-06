// Tradução dos status de fretes para português brasileiro

// Status canônicos do sistema
export const CANONICAL_FREIGHT_STATUSES = [
  'OPEN',
  'IN_NEGOTIATION',
  'ACCEPTED',
  'LOADING',
  'LOADED',
  'IN_TRANSIT',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'PENDING'
] as const;

// Normalizar status (mapear sinônimos para canônicos)
export const normalizeFreightStatus = (status: string): string => {
  const normalized = status.toUpperCase().trim();
  
  // Mapear sinônimos comuns
  const synonymMap: Record<string, string> = {
    'PENDENTE': 'OPEN',
    'ABERTO': 'OPEN',
    'AGUARDANDO': 'OPEN',
    'ACEITO': 'ACCEPTED',
    'EM_NEGOCIACAO': 'IN_NEGOTIATION',
    'NEGOCIANDO': 'IN_NEGOTIATION',
    'CARREGANDO': 'LOADING',
    'COLETANDO': 'LOADING',
    'CARREGADO': 'LOADED',
    'EM_TRANSPORTE': 'IN_TRANSIT',
    'EM_TRANSITO': 'IN_TRANSIT',
    'TRANSPORTE': 'IN_TRANSIT',
    'ENTREGUE': 'DELIVERED',
    'FINALIZADO': 'COMPLETED',
    'CONCLUIDO': 'COMPLETED',
    'CANCELADO': 'CANCELLED',
    'REJEITADO': 'REJECTED'
  };
  
  return synonymMap[normalized] || normalized;
};

// Verificar se status é "aberto" (disponível para aceitar)
export const isOpenStatus = (status: string): boolean => {
  const normalized = normalizeFreightStatus(status);
  return ['OPEN', 'IN_NEGOTIATION', 'PENDING'].includes(normalized);
};

// Verificar se status é final (não pode mais ser alterado)
export const isFinalStatus = (status: string): boolean => {
  const normalized = normalizeFreightStatus(status);
  return ['DELIVERED_PENDING_CONFIRMATION', 'DELIVERED', 'COMPLETED', 'CANCELLED'].includes(normalized);
};

export const getFreightStatusLabel = (status: string): string => {
  const statusLabels: Record<string, string> = {
    'OPEN': 'Aberto',
    'IN_NEGOTIATION': 'Em Negociação',
    'ACCEPTED': 'Aceito',
    'LOADING': 'A Caminho da Coleta',
    'LOADED': 'Carregado',
    'IN_TRANSIT': 'Em Transporte',
    'DELIVERED': 'Entregue',
    'DELIVERED_PENDING_CONFIRMATION': 'Aguardando Confirmação',
    'CANCELLED': 'Cancelado',
    'REJECTED': 'Rejeitado',
    'PENDING': 'Pendente',
    'COMPLETED': 'Concluído',
    'UNLOADING': 'Descarregando',
    'WAITING': 'Aguardando',
    'CONFIRMED': 'Confirmado',
    'WAITING_DRIVER': 'Aguardando Motorista',
    'WAITING_PRODUCER': 'Aguardando Produtor',
    'EXPIRED': 'Expirado'
  };
  
  // Retorna a tradução ou formata o status removendo underscores
  return statusLabels[status] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const getFreightStatusVariant = (status: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  switch (status) {
    case 'OPEN':
      return 'default';
    case 'IN_NEGOTIATION':
      return 'secondary';
    case 'ACCEPTED':
      return 'default';
    case 'LOADING':
      return 'secondary';
    case 'IN_TRANSIT':
      return 'secondary';
    case 'DELIVERED':
      return 'default';
    case 'DELIVERED_PENDING_CONFIRMATION':
      return 'secondary';
    case 'CANCELLED':
      return 'destructive';
    case 'REJECTED':
      return 'destructive';
    case 'PENDING':
      return 'outline';
    case 'COMPLETED':
      return 'default';
    default:
      return 'outline';
  }
};

// ✅ SEGURANÇA: Funções NUNCA retornam status cru em inglês.
// Fallback humaniza o texto ao invés de expor códigos internos.

export const getProposalStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    ACCEPTED: 'Aceita',
    REJECTED: 'Rejeitada',
    CANCELLED: 'Cancelada',
    EXPIRED: 'Expirada',
    COUNTER_PROPOSED: 'Contraproposta',
  };
  return labels[status?.toUpperCase()] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const getUserStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    APPROVED: 'Aprovado',
    REJECTED: 'Rejeitado',
    ACTIVE: 'Ativo',
    INACTIVE: 'Inativo',
    SUSPENDED: 'Suspenso',
  };
  return labels[status?.toUpperCase()] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};

export const getValidationStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: 'Pendente',
    VALIDATED: 'Validado',
    REJECTED: 'Rejeitado',
    EXPIRED: 'Expirado',
    APPROVED: 'Aprovado',
  };
  return labels[status?.toUpperCase()] || status.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, l => l.toUpperCase());
};