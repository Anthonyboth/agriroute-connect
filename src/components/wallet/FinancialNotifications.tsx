import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Truck, CreditCard, Zap, CalendarClock, AlertTriangle, X
} from 'lucide-react';

interface Notification {
  id: string;
  icon: React.ReactNode;
  message: string;
  type: 'success' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
}

interface FinancialNotificationsProps {
  availableBalance: number;
  totalReceivable: number;
  creditAvailable: number;
  pendingInstallments: number;
  overdueInstallments: number;
  totalPendingAmount: number;
  onAdvance: () => void;
  onPayInstallment: () => void;
  role?: string;
}

export const FinancialNotifications: React.FC<FinancialNotificationsProps> = ({
  availableBalance, totalReceivable, creditAvailable,
  pendingInstallments, overdueInstallments, totalPendingAmount,
  onAdvance, onPayInstallment, role
}) => {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const notifications: Notification[] = [];

  // Only show advance notification for non-PRODUTOR roles
  if (totalReceivable > 500 && role !== 'PRODUTOR') {
    notifications.push({
      id: 'advance-available',
      icon: <Zap className="h-4 w-4 text-accent" />,
      message: `Você pode antecipar até ${formatBRL(totalReceivable * 0.8)} agora`,
      type: 'info',
      action: { label: 'Antecipar', onClick: onAdvance },
    });
  }

  if (overdueInstallments > 0) {
    notifications.push({
      id: 'overdue',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      message: `${overdueInstallments} parcela(s) vencida(s) — ${formatBRL(totalPendingAmount)} pendente`,
      type: 'warning',
      action: { label: 'Pagar', onClick: onPayInstallment },
    });
  } else if (pendingInstallments > 0) {
    notifications.push({
      id: 'upcoming',
      icon: <CalendarClock className="h-4 w-4 text-warning" />,
      message: `Próxima parcela de crédito vence em breve — ${formatBRL(totalPendingAmount)}`,
      type: 'info',
      action: { label: 'Ver', onClick: onPayInstallment },
    });
  }

  if (creditAvailable > 1000 && availableBalance < 200) {
    notifications.push({
      id: 'low-balance-credit',
      icon: <CreditCard className="h-4 w-4 text-accent" />,
      message: `Saldo baixo? Use até ${formatBRL(creditAvailable)} em crédito de transporte`,
      type: 'info',
    });
  }

  const visible = notifications.filter(n => !dismissed.has(n.id));
  if (visible.length === 0) return null;

  const colorMap = {
    success: 'bg-primary/[0.06] border-primary/20',
    warning: 'bg-warning/[0.08] border-warning/20',
    info: 'bg-accent/[0.06] border-accent/15',
  };

  return (
    <div className="space-y-2">
      {visible.map(n => (
        <div key={n.id} className={`flex items-center gap-3 p-3 rounded-lg border ${colorMap[n.type]} transition-all`}>
          {n.icon}
          <p className="text-xs text-foreground flex-1">{n.message}</p>
          {n.action && (
            <Button size="sm" variant="ghost" className="text-xs h-7 px-2.5 font-medium" onClick={n.action.onClick}>
              {n.action.label}
            </Button>
          )}
          <button
            onClick={() => setDismissed(prev => new Set([...prev, n.id]))}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
