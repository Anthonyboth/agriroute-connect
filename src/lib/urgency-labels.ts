export function getUrgencyLabel(urgency: string): string {
  switch (urgency) {
    case 'LOW':
      return 'Baixa';
    case 'MEDIUM':
      return 'Média';
    case 'HIGH':
      return 'Alta';
    default:
      return 'Média';
  }
}

export function getUrgencyVariant(urgency: string): "default" | "secondary" | "destructive" | "outline" {
  switch (urgency) {
    case 'LOW':
      return 'secondary';
    case 'MEDIUM':
      return 'default';
    case 'HIGH':
      return 'destructive';
    default:
      return 'outline';
  }
}