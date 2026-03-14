import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Clock, CheckCircle2, XCircle } from 'lucide-react';
import type { InsuranceClaim } from '@/hooks/useInsurance';

const formatBRL = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

const statusConfig: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline'; icon: React.ReactNode }> = {
  pending: { label: 'Em análise', variant: 'outline', icon: <Clock className="h-3.5 w-3.5" /> },
  approved: { label: 'Aprovado', variant: 'default', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
  denied: { label: 'Negado', variant: 'destructive', icon: <XCircle className="h-3.5 w-3.5" /> },
  paid: { label: 'Pago', variant: 'default', icon: <CheckCircle2 className="h-3.5 w-3.5" /> },
};

export const InsuranceClaimCard = React.memo<{ claim: InsuranceClaim }>(({ claim }) => {
  const st = statusConfig[claim.status] || statusConfig.pending;

  return (
    <Card className="border-amber-200/50 dark:border-amber-800/50">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="font-semibold text-sm">Sinistro</span>
          </div>
          <Badge variant={st.variant} className="gap-1">
            {st.icon} {st.label}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground line-clamp-2">{claim.description}</p>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-muted-foreground">Reclamado:</span>
            <p className="font-semibold">{formatBRL(claim.amount_claimed)}</p>
          </div>
          {claim.amount_paid > 0 && (
            <div>
              <span className="text-muted-foreground">Pago:</span>
              <p className="font-semibold text-green-600">{formatBRL(claim.amount_paid)}</p>
            </div>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          Aberto em {new Date(claim.created_at).toLocaleDateString('pt-BR')}
        </p>
      </CardContent>
    </Card>
  );
});

InsuranceClaimCard.displayName = 'InsuranceClaimCard';
