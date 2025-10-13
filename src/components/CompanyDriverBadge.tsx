import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, CheckCircle, MessageSquare, MapPin, XCircle } from 'lucide-react';

interface CompanyDriverBadgeProps {
  companyName: string;
}

export const CompanyDriverBadge = ({ companyName }: CompanyDriverBadgeProps) => {
  return (
    <Alert className="border-primary/30 bg-primary/5">
      <Users className="h-4 w-4 text-primary" />
      <AlertTitle className="text-primary font-semibold">Motorista Afiliado</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-foreground mb-3">
          Você está vinculado à <strong className="text-primary">{companyName}</strong>.
        </p>
        <div className="space-y-2 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
            <span>Acesso a fretes da transportadora</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
            <span>Chat e comunicação com a equipe</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle className="h-4 w-4 text-success mt-0.5 flex-shrink-0" />
            <span>Check-ins e rastreamento de fretes</span>
          </div>
          <div className="flex items-start gap-2">
            <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
            <span className="text-muted-foreground">Valores e pagamentos gerenciados pela transportadora</span>
          </div>
        </div>
        <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
          💡 Para ter acesso completo como motorista independente, você pode criar um novo cadastro com outro email.
        </p>
      </AlertDescription>
    </Alert>
  );
};
