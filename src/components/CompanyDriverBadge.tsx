import { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Users, CheckCircle, MessageSquare, MapPin, XCircle, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CompanyDriverBadgeProps {
  companyName: string;
  isAffiliated?: boolean;
  driverProfileId?: string;
}

const STORAGE_KEY_PREFIX = 'company_driver_badge_first_seen_';
const VISIBILITY_DAYS = 5;

export const CompanyDriverBadge = ({ companyName, isAffiliated = false, driverProfileId }: CompanyDriverBadgeProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const storageKey = `${STORAGE_KEY_PREFIX}${driverProfileId || 'default'}`;

  useEffect(() => {
    const firstSeen = localStorage.getItem(storageKey);
    
    if (!firstSeen) {
      // First time seeing badge - store timestamp and show
      localStorage.setItem(storageKey, new Date().toISOString());
      setIsVisible(true);
      return;
    }

    const firstSeenDate = new Date(firstSeen);
    const now = new Date();
    const diffMs = now.getTime() - firstSeenDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays < VISIBILITY_DAYS) {
      setIsVisible(true);
    } else {
      setIsVisible(false);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <Alert className="border-primary/30 bg-primary/5 relative">
      <Users className="h-4 w-4 text-primary" />
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 h-6 w-6 text-muted-foreground hover:text-foreground"
        onClick={handleDismiss}
        aria-label="Fechar informação"
      >
        <X className="h-3.5 w-3.5" />
      </Button>
      <AlertTitle className="text-primary font-semibold">
        {isAffiliated ? 'Motorista Afiliado' : 'Motorista de Empresa'}
      </AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm text-foreground mb-3">
          Você está vinculado à <strong className="text-primary">{companyName}</strong>
          {isAffiliated && ' como motorista afiliado'}.
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
          {isAffiliated ? (
            <>
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Não pode aceitar fretes diretamente</span>
              </div>
              <div className="flex items-start gap-2">
                <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-muted-foreground">Valores e pagamentos gerenciados pela transportadora</span>
              </div>
            </>
          ) : (
            <div className="flex items-start gap-2">
              <XCircle className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <span className="text-muted-foreground">Valores e pagamentos gerenciados pela transportadora</span>
            </div>
          )}
        </div>
        <p className="mt-3 text-xs text-muted-foreground border-t border-border pt-2">
          Para ter acesso completo como motorista independente, você pode criar um novo cadastro com outro email.
        </p>
      </AlertDescription>
    </Alert>
  );
};
