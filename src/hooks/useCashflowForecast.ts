import { useState, useEffect, useCallback, useMemo } from 'react';
import { usePaymentOrders, type PaymentOrder } from './usePaymentOrders';
import { useWallet } from './useWallet';
import { useCredit } from './useCredit';

export interface ForecastDay {
  label: string;
  date: Date;
  incoming: number;
  outgoing: number;
  projectedBalance: number;
  orders: Array<{ id: string; amount: number; status: string; daysUntil: number }>;
}

export interface CashflowForecast {
  days: ForecastDay[];
  totalIncoming7d: number;
  totalOutgoing7d: number;
  projectedBalance7d: number;
  loading: boolean;
}

const DAY_LABELS = ['Hoje', 'Amanhã', 'Em 2 dias', 'Em 3 dias', 'Em 4 dias', 'Em 5 dias', 'Em 6 dias', 'Em 7 dias'];

// Estimate release date based on status
function estimateReleaseDays(order: PaymentOrder): number {
  switch (order.status_financial) {
    case 'fully_released': return 0;
    case 'partially_released': return 0;
    case 'paid_reserved': {
      // Check contestation window
      if (order.contestation_window_ends_at) {
        const windowEnd = new Date(order.contestation_window_ends_at);
        const now = new Date();
        const daysLeft = Math.max(0, Math.ceil((windowEnd.getTime() - now.getTime()) / (86400000)));
        return Math.min(daysLeft, 7);
      }
      return 2; // Default: 2 days in escrow
    }
    case 'pending_payment': return 3;
    default: return 5;
  }
}

export const useCashflowForecast = (): CashflowForecast => {
  const { wallet, loading: walletLoading } = useWallet();
  const { orders, loading: ordersLoading } = usePaymentOrders();
  const { pendingInstallments, totalPending } = useCredit();

  const forecast = useMemo(() => {
    const currentBalance = wallet?.available_balance || 0;
    const now = new Date();
    const days: ForecastDay[] = [];

    // Group orders by estimated release day
    const ordersByDay: Record<number, Array<{ id: string; amount: number; status: string; daysUntil: number }>> = {};

    for (const order of orders) {
      if (order.status_financial === 'fully_released' || order.status_financial === 'cancelled') continue;
      const releaseDay = estimateReleaseDays(order);
      if (releaseDay > 7) continue;
      if (!ordersByDay[releaseDay]) ordersByDay[releaseDay] = [];
      const unreleased = order.net_amount - order.released_amount;
      if (unreleased > 0) {
        ordersByDay[releaseDay].push({
          id: order.id,
          amount: unreleased,
          status: order.status_financial,
          daysUntil: releaseDay,
        });
      }
    }

    // Calculate installment outflows (due in next 7 days)
    const installmentsByDay: Record<number, number> = {};
    for (const inst of pendingInstallments) {
      const dueDate = new Date(inst.due_date);
      const daysUntil = Math.max(0, Math.ceil((dueDate.getTime() - now.getTime()) / 86400000));
      if (daysUntil <= 7) {
        installmentsByDay[daysUntil] = (installmentsByDay[daysUntil] || 0) + (inst.amount - inst.paid_amount);
      }
    }

    let runningBalance = currentBalance;

    for (let d = 0; d <= 7; d++) {
      const dayOrders = ordersByDay[d] || [];
      const incoming = dayOrders.reduce((s, o) => s + o.amount, 0);
      const outgoing = installmentsByDay[d] || 0;
      runningBalance = runningBalance + incoming - outgoing;

      const date = new Date(now);
      date.setDate(date.getDate() + d);

      days.push({
        label: DAY_LABELS[d],
        date,
        incoming,
        outgoing,
        projectedBalance: runningBalance,
        orders: dayOrders,
      });
    }

    const totalIncoming7d = days.reduce((s, d) => s + d.incoming, 0);
    const totalOutgoing7d = days.reduce((s, d) => s + d.outgoing, 0);

    return {
      days,
      totalIncoming7d,
      totalOutgoing7d,
      projectedBalance7d: runningBalance,
    };
  }, [wallet?.available_balance, orders, pendingInstallments]);

  return {
    ...forecast,
    loading: walletLoading || ordersLoading,
  };
};
