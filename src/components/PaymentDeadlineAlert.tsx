import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Clock, AlertTriangle, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { FreightPaymentModal } from './FreightPaymentModal';

interface PaymentDeadline {
  id: string;
  freight_id: string;
  deadline_at: string;
  minimum_amount: number;
  status: 'PENDING' | 'FULFILLED' | 'OVERDUE';
  freight?: {
    cargo_type: string;
    price: number;
    pickup_date: string;
  };
}

interface PaymentDeadlineAlertProps {
  userId: string;
}

export const PaymentDeadlineAlert: React.FC<PaymentDeadlineAlertProps> = ({ userId }) => {
  const [deadlines, setDeadlines] = useState<PaymentDeadline[]>([]);
  const [selectedFreight, setSelectedFreight] = useState<PaymentDeadline | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  useEffect(() => {
    fetchPaymentDeadlines();
  }, [userId]);

  const fetchPaymentDeadlines = async () => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (!profile) return;

      const { data, error } = await supabase
        .from('freight_payment_deadlines')
        .select(`
          *,
          freight:freights(cargo_type, price, pickup_date)
        `)
        .in('status', ['PENDING', 'OVERDUE'])
        .order('deadline_at', { ascending: true });

      if (error) throw error;

      setDeadlines((data || []).map(d => ({
        ...d,
        status: d.status as 'PENDING' | 'FULFILLED' | 'OVERDUE'
      })));
    } catch (error) {
      console.error('Error fetching payment deadlines:', error);
    }
  };

  const getTimeRemaining = (deadline: string) => {
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffMs = deadlineDate.getTime() - now.getTime();
    
    if (diffMs <= 0) {
      return 'Prazo expirado';
    }

    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

    if (diffHours > 24) {
      const days = Math.floor(diffHours / 24);
      return `${days} dia${days > 1 ? 's' : ''}`;
    } else if (diffHours > 0) {
      return `${diffHours}h ${diffMinutes}m`;
    } else {
      return `${diffMinutes} min`;
    }
  };

  const getAlertVariant = (status: string, deadline: string) => {
    if (status === 'OVERDUE') return 'destructive';
    
    const now = new Date();
    const deadlineDate = new Date(deadline);
    const diffHours = (deadlineDate.getTime() - now.getTime()) / (1000 * 60 * 60);
    
    if (diffHours <= 2) return 'destructive';
    if (diffHours <= 6) return 'default';
    return 'default';
  };

  const handlePaymentClick = (deadline: PaymentDeadline) => {
    setSelectedFreight(deadline);
    setPaymentModalOpen(true);
  };

  const handlePaymentSuccess = () => {
    fetchPaymentDeadlines();
    setPaymentModalOpen(false);
    setSelectedFreight(null);
  };

  if (deadlines.length === 0) return null;

  return (
    <>
      <div className="space-y-4 mb-6">
        {deadlines.map((deadline) => (
          <Alert 
            key={deadline.id} 
            variant={getAlertVariant(deadline.status, deadline.deadline_at)}
            className="border-l-4"
          >
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium">
                  Solicitação de adiantamento - {deadline.freight?.cargo_type}
                </div>
                <div className="text-sm text-muted-foreground">
                  O motorista solicitou adiantamento (
                  <span className="font-medium">
                    {getTimeRemaining(deadline.deadline_at)}
                  </span>)
                </div>
                <div className="text-sm">
                  Valor mínimo: R$ {deadline.minimum_amount.toLocaleString('pt-BR', { 
                    minimumFractionDigits: 2, 
                    maximumFractionDigits: 2 
                  })}
                </div>
              </div>
              <Button 
                size="sm" 
                onClick={() => handlePaymentClick(deadline)}
                className="ml-4"
              >
                <CreditCard className="h-4 w-4 mr-2" />
                Pagar Agora
              </Button>
            </AlertDescription>
          </Alert>
        ))}
      </div>

      {selectedFreight && (
        <FreightPaymentModal
          isOpen={paymentModalOpen}
          onClose={() => {
            setPaymentModalOpen(false);
            setSelectedFreight(null);
          }}
          freightId={selectedFreight.freight_id}
          freightPrice={selectedFreight.freight?.price || 0}
        />
      )}
    </>
  );
};