import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, CreditCard, Smartphone, DollarSign, FileText, AlertTriangle, Info } from "lucide-react";
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
        // Redirecionar para o checkout do Stripe
        window.location.href = checkoutData.url;
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
      toast.error("Erro ao processar pagamento. Tente novamente.");
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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-primary" />
            Pagamento do Frete
          </DialogTitle>
        </DialogHeader>

        {!showPaymentForm ? (
          <div className="space-y-6">
            {/* Aviso sobre pagamento pela plataforma */}
            <Card className="border-amber-200 bg-amber-50/50 dark:bg-amber-900/10 dark:border-amber-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
                  <div className="space-y-1">
                    <h4 className="text-sm font-semibold text-amber-800 dark:text-amber-300">
                      Pagamento Direto ao Motorista
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                      O pagamento pela plataforma ainda não está ativo. Por favor, realize o pagamento diretamente ao motorista responsável pelo frete.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Resumo financeiro */}
            <div className="space-y-4">
              <Card className="border-border/50">
                <CardContent className="pt-4 space-y-4">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">Valor total do frete</span>
                    <span className="text-lg font-semibold">
                      R$ {freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </div>
                  
                  {advancesTotal > 0 && (
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-green-600 dark:text-green-400">Adiantamentos pagos</span>
                      <span className="text-lg font-semibold text-green-700 dark:text-green-300">
                        - R$ {advancesTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  )}
                  
                  <div className="border-t pt-4">
                    <div className="flex justify-between items-center">
                      <span className="text-base font-medium">Valor a pagar</span>
                      <Badge variant="secondary" className="text-lg font-bold px-3 py-1 bg-primary/10 text-primary">
                        R$ {remainingAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Métodos de pagamento */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Label className="text-base font-medium">Forma de pagamento</Label>
                <Info className="h-4 w-4 text-muted-foreground" />
              </div>
              
              <Card className="border-border/50">
                <CardContent className="pt-4">
                  <RadioGroup value={paymentMethod} onValueChange={setPaymentMethod} className="space-y-3">
                    {paymentMethods.map((method) => {
                      const Icon = method.icon;
                      const isSelected = paymentMethod === method.id;
                      return (
                        <div 
                          key={method.id} 
                          className={`relative flex items-center space-x-4 rounded-lg border-2 p-4 transition-all hover:bg-muted/30 cursor-pointer ${
                            isSelected 
                              ? 'border-primary bg-primary/5 shadow-sm' 
                              : 'border-border hover:border-primary/50'
                          }`}
                          onClick={() => setPaymentMethod(method.id)}
                        >
                          <RadioGroupItem value={method.id} id={method.id} className="mt-1" />
                          <div className="flex items-center space-x-3 flex-1">
                            <div className={`p-2 rounded-full ${isSelected ? 'bg-primary/10' : 'bg-muted/50'}`}>
                              <Icon className={`h-5 w-5 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                            </div>
                            <div className="flex-1">
                              <Label htmlFor={method.id} className="font-medium cursor-pointer text-sm">
                                {method.label}
                              </Label>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {method.description}
                              </p>
                            </div>
                          </div>
                          {isSelected && (
                            <div className="absolute top-2 right-2">
                              <div className="h-2 w-2 rounded-full bg-primary"></div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            {/* Informação adicional */}
            <Card className="border-blue-200 bg-blue-50/50 dark:bg-blue-900/10 dark:border-blue-800">
              <CardContent className="pt-4">
                <div className="flex items-start gap-3">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-blue-700 dark:text-blue-400">
                    Esta funcionalidade está temporariamente desabilitada. Entre em contato com o motorista para acordar a forma de pagamento.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Botões de ação */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={onClose} className="flex-1 h-11">
                Cancelar
              </Button>
              <Button 
                onClick={handleCreatePayment} 
                disabled={true}
                className="flex-1 h-11 opacity-50 cursor-not-allowed"
              >
                <Loader2 className="w-4 h-4 mr-2" />
                Indisponível
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