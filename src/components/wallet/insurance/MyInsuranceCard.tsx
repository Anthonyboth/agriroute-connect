import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, FileText, XCircle, AlertTriangle } from 'lucide-react';
import type { UserInsurance } from '@/hooks/useInsurance';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  active: { label: 'Ativo', variant: 'default' },
  cancelled: { label: 'Cancelado', variant: 'destructive' },
  expired: { label: 'Expirado', variant: 'secondary' },
};

interface MyInsuranceCardProps {
  insurance: UserInsurance;
  onCancel: (id: string) => void;
  onClaim: (insurance: UserInsurance) => void;
}

export const MyInsuranceCard = React.memo<MyInsuranceCardProps>(({
  insurance, onCancel, onClaim,
}) => {
  const productName = insurance.insurance_products?.name || 'Seguro';
  const st = statusConfig[insurance.status] || statusConfig.active;

  return (
    <Card className="border-primary/10">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            <span className="font-semibold text-sm">{productName}</span>
          </div>
          <Badge variant={st.variant}>{st.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Cobertura:</span>
            <p className="font-semibold">{formatBRL(insurance.coverage_value)}</p>
          </div>
          <div>
            <span className="text-muted-foreground">Prêmio:</span>
            <p className="font-semibold text-primary">{formatBRL(insurance.price)}</p>
          </div>
          {insurance.end_date && (
            <div>
              <span className="text-muted-foreground">Validade:</span>
              <p className="font-semibold">{new Date(insurance.end_date).toLocaleDateString('pt-BR')}</p>
            </div>
          )}
          <div>
            <span className="text-muted-foreground">Desde:</span>
            <p className="font-semibold">{new Date(insurance.start_date).toLocaleDateString('pt-BR')}</p>
          </div>
        </div>

        {insurance.status === 'active' && (
          <div className="flex gap-2 pt-1">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 gap-1"
              type="button"
              onClick={() => onClaim(insurance)}
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              Sinistro
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="flex-1 gap-1 text-destructive hover:text-destructive"
              type="button"
              onClick={() => onCancel(insurance.id)}
            >
              <XCircle className="h-3.5 w-3.5" />
              Cancelar
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
});

MyInsuranceCard.displayName = 'MyInsuranceCard';
