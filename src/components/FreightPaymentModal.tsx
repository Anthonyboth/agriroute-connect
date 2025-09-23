import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, DollarSign, FileText } from "lucide-react";
import { StripePaymentProvider } from "./StripePaymentProvider";
import { StripePaymentForm } from "./StripePaymentForm";

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
  const [paymentMethod, setPaymentMethod] = useState("cartao");
  const [isLoading, setIsLoading] = useState(false);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [showPaymentForm, setShowPaymentForm] = useState(false);

  const remainingAmount = freightPrice - advancesTotal;

  const handleCreatePayment = async () => {
    setIsLoading(true);
    try {
      // Tentar criar sessão de Checkout (mais confiável e sem dependência da chave pública)
      const { data: checkoutData, error: checkoutError } = await supabase.functions.invoke('create-freight-payment', {
        body: {
          freight_id: freightId,
          // Edge function espera strings como CREDIT_CARD/PIX/BOLETO
          payment_method: paymentMethod.toUpperCase?.() || paymentMethod,
        },
      });

      if (checkoutError) {
        console.error('Checkout error:', checkoutError);
      }

      if (checkoutData?.url) {
        // Abrir o checkout em nova aba e fechar modal
        window.open(checkoutData.url, '_blank');
        toast.success('Redirecionando para pagamento seguro...');
        onClose();
        return;
      }

      // Fallback para Payment Element caso URL não seja retornada
      const { data, error } = await supabase.functions.invoke('create-payment', {
        body: { 
          freight_id: freightId, 
          payment_method: paymentMethod 
        }
      });

      if (error) throw error;

      if (data?.client_secret) {
        setClientSecret(data.client_secret);
        setShowPaymentForm(true);
      } else {
        throw new Error('Não foi possível inicializar o pagamento');
      }
    } catch (error) {
      console.error('Error creating payment:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao processar pagamento");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePaymentSuccess = () => {
    toast.success("Pagamento realizado com sucesso!");
    setShowPaymentForm(false);
    setClientSecret(null);
    onClose();
  };

  const handlePaymentCancel = () => {
    setShowPaymentForm(false);
    setClientSecret(null);
  };

  const paymentMethods = [
    {
      id: "cartao",
      label: "Cartão de Crédito",
      icon: CreditCard,
      description: "Parcelamento em até 12x"
    },
    {
      id: "pix", 
      label: "PIX",
      icon: Smartphone,
      description: "Pagamento instantâneo"
    },
    {
      id: "boleto",
      label: "Boleto Bancário",
      icon: FileText,
      description: "Vencimento em 3 dias úteis"
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

        {!showPaymentForm ? (
          <div className="space-y-6">
            <div className="space-y-3">
              <div className="bg-muted/20 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Valor total do frete</p>
                <p className="text-lg font-semibold">R$ {freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
              </div>

              {advancesTotal > 0 && (
                <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
                  <p className="text-sm text-green-600 dark:text-green-400">Adiantamentos pagos</p>
                  <p className="text-lg font-semibold text-green-700 dark:text-green-300">
                    - R$ {advancesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </p>
                </div>
              )}

              <div className="bg-primary/10 p-4 rounded-lg">
                <p className="text-sm text-muted-foreground">Valor a pagar</p>
                <p className="text-xl font-bold text-primary">
                  R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                Continuar
              </Button>
            </div>
          </div>
        ) : (
          <StripePaymentProvider clientSecret={clientSecret || undefined}>
            <StripePaymentForm 
              amount={remainingAmount}
              onSuccess={handlePaymentSuccess}
              onCancel={handlePaymentCancel}
            />
          </StripePaymentProvider>
        )}
      </DialogContent>
    </Dialog>
  );
}