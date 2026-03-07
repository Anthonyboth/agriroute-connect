import React from 'react';
import { Button } from '@/components/ui/button';
import {
  Truck, CreditCard, Zap, CalendarClock, AlertTriangle, X,
  Banknote, TrendingUp, Clock
} from 'lucide-react';
import { CreditInstallment } from '@/hooks/useCredit';

interface Notification {
  id: string;
  icon: React.ReactNode;
  message: string;
  type: 'success' | 'warning' | 'info';
  action?: { label: string; onClick: () => void };
  priority: number; // lower = higher priority
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
  onDeposit?: () => void;
  onWithdraw?: () => void;
  onUseCredit?: () => void;
  role?: string;
  // Smart trigger data
  escrowTotal?: number;
  releasedTotal?: number;
  recentlyReleasedAmount?: number;
  installments?: CreditInstallment[];
}

const MAX_VISIBLE = 3; // Avoid notification spam

export const FinancialNotifications: React.FC<FinancialNotificationsProps> = ({
  availableBalance, totalReceivable, creditAvailable,
  pendingInstallments, overdueInstallments, totalPendingAmount,
  onAdvance, onPayInstallment, onDeposit, onWithdraw, onUseCredit,
  role,
  escrowTotal = 0,
  releasedTotal = 0,
  recentlyReleasedAmount = 0,
  installments = [],
}) => {
  const [dismissed, setDismissed] = React.useState<Set<string>>(new Set());

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const notifications: Notification[] = [];

  // ── Trigger 1: Overdue installments (HIGHEST priority) ──
  if (overdueInstallments > 0) {
    notifications.push({
      id: 'overdue',
      icon: <AlertTriangle className="h-4 w-4 text-destructive" />,
      message: `${overdueInstallments} parcela(s) vencida(s) — ${formatBRL(totalPendingAmount)} pendente`,
      type: 'warning',
      priority: 1,
      action: { label: 'Pagar agora', onClick: onPayInstallment },
    });
  }

  // ── Trigger 5: Installment due within 48h ──
  const now = new Date();
  const in48h = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const urgentInstallments = installments.filter(i => {
    if (i.status !== 'pending') return false;
    const due = new Date(i.due_date);
    return due >= now && due <= in48h;
  });

  if (urgentInstallments.length > 0 && overdueInstallments === 0) {
    const total = urgentInstallments.reduce((s, i) => s + (i.amount - (i.paid_amount || 0)), 0);
    notifications.push({
      id: 'installment-due-soon',
      icon: <Clock className="h-4 w-4 text-warning" />,
      message: `Parcela de ${formatBRL(total)} vence em breve — pague para manter seu crédito ativo`,
      type: 'warning',
      priority: 2,
      action: { label: 'Pagar parcela', onClick: onPayInstallment },
    });
  }

  // ── Trigger 3: Freight released → suggest withdrawal ──
  if (recentlyReleasedAmount > 50 && onWithdraw) {
    notifications.push({
      id: 'freight-released',
      icon: <Banknote className="h-4 w-4 text-primary" />,
      message: `${formatBRL(recentlyReleasedAmount)} liberado na sua carteira — saque via Pix agora`,
      type: 'success',
      priority: 3,
      action: { label: 'Sacar agora', onClick: onWithdraw },
    });
  }

  // ── Trigger 1: Freight confirmed with escrow → offer advance ──
  if (escrowTotal > 300 && role !== 'PRODUTOR') {
    const advanceable = escrowTotal * 0.8;
    notifications.push({
      id: 'escrow-advance',
      icon: <Zap className="h-4 w-4 text-accent" />,
      message: `${formatBRL(escrowTotal)} em escrow — antecipe até ${formatBRL(advanceable)} com taxa reduzida`,
      type: 'info',
      priority: 4,
      action: { label: 'Antecipar agora', onClick: onAdvance },
    });
  }

  // ── Trigger 4: Accumulated receivables → suggest advance ──
  if (totalReceivable > 500 && role !== 'PRODUTOR' && escrowTotal <= 300) {
    notifications.push({
      id: 'advance-available',
      icon: <TrendingUp className="h-4 w-4 text-accent" />,
      message: `Você possui ${formatBRL(totalReceivable)} em recebíveis elegíveis — antecipe até ${formatBRL(totalReceivable * 0.8)}`,
      type: 'info',
      priority: 5,
      action: { label: 'Simular antecipação', onClick: onAdvance },
    });
  }

  // ── Trigger 2: Low balance with credit available ──
  if (creditAvailable > 500 && availableBalance < 200 && onUseCredit) {
    notifications.push({
      id: 'low-balance-credit',
      icon: <CreditCard className="h-4 w-4 text-accent" />,
      message: `Saldo baixo? Use até ${formatBRL(creditAvailable)} em crédito para combustível e pedágio`,
      type: 'info',
      priority: 6,
      action: { label: 'Usar crédito', onClick: onUseCredit },
    });
  }

  // Sort by priority and limit to avoid spam
  const sorted = notifications
    .filter(n => !dismissed.has(n.id))
    .sort((a, b) => a.priority - b.priority)
    .slice(0, MAX_VISIBLE);

  if (sorted.length === 0) return null;

  const colorMap = {
    success: 'bg-primary/[0.08] border-primary/25',
    warning: 'bg-warning/[0.10] border-warning/25',
    info: 'bg-accent/[0.06] border-accent/20',
  };

  return (
    <div className="space-y-2">
      {sorted.map(n => (
        <div
          key={n.id}
          className={`flex items-center gap-3 p-3 rounded-lg border ${colorMap[n.type]} transition-all animate-in slide-in-from-top-1 duration-300`}
        >
          <div className="shrink-0">{n.icon}</div>
          <p className="text-xs text-foreground flex-1 leading-relaxed">{n.message}</p>
          {n.action && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7 px-3 font-semibold shrink-0 hover:bg-background/50"
              onClick={n.action.onClick}
            >
              {n.action.label}
            </Button>
          )}
          <button
            onClick={() => setDismissed(prev => new Set([...prev, n.id]))}
            className="text-muted-foreground hover:text-foreground transition-colors p-0.5 shrink-0"
            aria-label="Dispensar notificação"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
};
