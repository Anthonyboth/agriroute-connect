// Tradução dos status de fretes para português brasileiro

export const getFreightStatusLabel = (status: string): string => {
  switch (status) {
    case 'OPEN':
      return 'Aberto';
    case 'IN_NEGOTIATION':
      return 'Em Negociação';
    case 'ACCEPTED':
      return 'Aceito';
    case 'IN_TRANSIT':
      return 'Em Transporte';
    case 'DELIVERED':
      return 'Entregue';
    case 'CANCELLED':
      return 'Cancelado';
    case 'REJECTED':
      return 'Rejeitado';
    case 'PENDING':
      return 'Pendente';
    case 'COMPLETED':
      return 'Concluído';
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
    case 'IN_TRANSIT':
      return 'secondary';
    case 'DELIVERED':
      return 'default';
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