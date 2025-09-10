import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, Building, DollarSign, FileText } from "lucide-react";

interface FreightPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string;
  freightPrice: number;
  advancesTotal?: number;
}

export function FreightPaymentModal({ 
  isOpen, 
  onClose, 
  freightId, 
  freightPrice, 
  advancesTotal = 0 
}: FreightPaymentModalProps) {
  const [paymentMethod, setPaymentMethod] = useState("CREDIT_CARD");
  const [isLoading, setIsLoading] = useState(false);

  const remainingAmount = freightPrice - advancesTotal;

  const handleCreatePayment = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-freight-payment', {
        body: { 
          freight_id: freightId, 
          payment_method: paymentMethod 
        }
      });

      if (error) throw error;

      // Abrir Stripe checkout em nova aba
      window.open(data.url, '_blank');
      
      toast.success("Redirecionando para pagamento");
      onClose();
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  const paymentMethods = [
    {
      id: "CREDIT_CARD",
      label: "Cartão de Crédito",
      icon: CreditCard,
      description: "Parcelamento em até 12x"
    },
    {
      id: "PIX", 
      label: "PIX",
      icon: Smartphone,
      description: "Pagamento instantâneo"
    },
    {
      id: "BOLETO",
      label: "Boleto Bancário",
      icon: FileText,
      description: "Vencimento em 3 dias úteis"
    },
    {
      id: "BANK_TRANSFER",
      label: "Transferência Bancária",
      icon: Building,
      description: "TED ou DOC"
    }
  ];

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Pagamento do Frete
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="space-y-3">
            <div className="bg-muted/20 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Valor total do frete</p>
              <p className="text-lg font-semibold">R$ {(freightPrice / 100).toFixed(2)}</p>
            </div>

            {advancesTotal > 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                <p className="text-sm text-green-600 dark:text-green-400">Adiantamentos pagos</p>
                <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                  - R$ {(advancesTotal / 100).toFixed(2)}
                </p>
              </div>
            )}

            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Valor a pagar</p>
              <p className="text-xl font-bold text-primary">
                R$ {(remainingAmount / 100).toFixed(2)}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <Label>Forma de pagamento</Label>
            <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod}>
              {paymentMethods.map((method) => {
                const Icon = method.icon;
                return (
                  <div key={method.id} className="flex items-center space-x-3 border rounded-lg p-3 hover:bg-muted/20">
                    <RadioGroupItem value={method.id} id={method.id} />
                    <div className="flex items-center space-x-3 flex-1">
                      <Icon className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <Label htmlFor={method.id} className="font-medium cursor-pointer">
                          {method.label}
                        </Label>
                        <p className="text-sm text-muted-foreground">
                          {method.description}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </RadioGroup>
          </div>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreatePayment} 
              disabled={isLoading || remainingAmount <= 0}
              className="flex-1"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Pagar R$ {(remainingAmount / 100).toFixed(2)}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}