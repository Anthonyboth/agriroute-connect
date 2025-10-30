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
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'IN_NEGOTIATION':
      return 'Em Negociação';
    case 'ACCEPTED':
      return 'Aceito';
    case 'LOADING':
      return 'Coletando';
    case 'IN_TRANSIT':
      return 'Em Transporte';
    case 'DELIVERED':
      return 'Entregue';
    case 'DELIVERED_PENDING_CONFIRMATION':
      return 'Aguardando Confirmação';
    case 'CANCELLED':
      return 'Cancelado';
    case 'REJECTED':
      return 'Rejeitado';
    case 'PENDING':
      return 'Pendente';
    case 'COMPLETED':
      return 'Finalizado';
    default:
      return status;
  }
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

export const getProposalStatusLabel = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'ACCEPTED':
      return 'Aceita';
    case 'REJECTED':
      return 'Rejeitada';
    case 'CANCELLED':
      return 'Cancelada';
    default:
      return status;
  }
};

export const getUserStatusLabel = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'APPROVED':
      return 'Aprovado';
    case 'REJECTED':
      return 'Rejeitado';
    default:
      return status;
  }
};

export const getValidationStatusLabel = (status: string): string => {
  switch (status) {
    case 'PENDING':
      return 'Pendente';
    case 'VALIDATED':
      return 'Validado';
    case 'REJECTED':
      return 'Rejeitado';
    case 'EXPIRED':
      return 'Expirado';
    default:
      return status;
  }
};