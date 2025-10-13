import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DollarSign, Percent, AlertTriangle, MessageSquare } from "lucide-react";

interface FreightAdvanceModalProps {
  isOpen: boolean;
  onClose: () => void;
  freightId: string;
  freightPrice: number;
}

export function FreightAdvanceModal({ isOpen, onClose, freightId, freightPrice }: FreightAdvanceModalProps) {
  const [advanceType, setAdvanceType] = useState<"percentage" | "amount">("percentage");
  const [percentage, setPercentage] = useState([30]);
  const [customAmount, setCustomAmount] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [hasRequestedRecently, setHasRequestedRecently] = useState(false);
  const [duplicateWarning, setDuplicateWarning] = useState<string | null>(null);
  const [pendingCount, setPendingCount] = useState(0);

  const handleCreateAdvance = async () => {
    if (hasRequestedRecently) {
      toast.error("Aguarde um momento antes de fazer nova solicitação");
      return;
    }

    setIsLoading(true);
    setHasRequestedRecently(true);
    
    try {
      const requestedAmount = calculatedAmount;
      
      // Validar valores antes de enviar
      if (advanceType === "amount" && (isNaN(parseFloat(customAmount)) || parseFloat(customAmount) <= 0)) {
        toast.error("Por favor, insira um valor válido para o adiantamento.");
        setIsLoading(false);
        setHasRequestedRecently(false);
        return;
      }

      if (requestedAmount > freightPrice * 0.5) {
        toast.error(`O adiantamento não pode exceder 50% do valor do frete (máx: R$ ${(freightPrice * 0.5).toFixed(2)})`);
        setIsLoading(false);
        setHasRequestedRecently(false);
        return;
      }

      if (requestedAmount < 1) {
        toast.error("O valor do adiantamento deve ser maior que R$ 1,00");
        setIsLoading(false);
        setHasRequestedRecently(false);
        return;
      }
      
      // Verificar solicitações duplicadas (mesmo valor nas últimas 2 horas)
      const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
      const { data: duplicateAdvances, error: duplicateError } = await supabase
        .from('freight_advances')
        .select('id, requested_amount, requested_at')
        .eq('freight_id', freightId)
        .eq('requested_amount', Math.round(requestedAmount * 100)) // Converter para centavos
        .gte('requested_at', twoHoursAgo)
        .neq('status', 'REJECTED');

      if (duplicateError) throw duplicateError;

      if (duplicateAdvances && duplicateAdvances.length > 0) {
        toast.error("Você já solicitou um adiantamento com este valor nas últimas 2 horas. Tente um valor diferente ou aguarde.");
        return;
      }

      // Verificar limite de solicitações pendentes
      const { data: pendingAdvances, error: pendingError } = await supabase
        .from('freight_advances')
        .select('id')
        .eq('freight_id', freightId)
        .eq('status', 'PENDING');

      if (pendingError) throw pendingError;

      if (pendingAdvances && pendingAdvances.length >= 3) {
        toast.error("Você já tem o máximo de 3 solicitações pendentes para este frete.");
        return;
      }

      const payload = advanceType === "percentage" 
        ? { freight_id: freightId, advance_percentage: percentage[0] / 100 }
        : { freight_id: freightId, advance_amount: parseFloat(customAmount) };

      const { data, error } = await supabase.functions.invoke('create-freight-advance', {
        body: payload
      });

      if (error) throw error;

      toast.success("Solicitação enviada! O produtor foi notificado. Combine o pagamento no chat do frete.");
      onClose();
      
      // Reset após 30 segundos
      setTimeout(() => setHasRequestedRecently(false), 30000);
    } catch (error: any) {
      console.error('Error creating advance:', error);
      const errorMessage = error?.message || error?.error || "Erro ao criar solicitação";
      const errorDetails = error?.details ? 
        "\n\n" + error.details.map((d: any) => `${d.field}: ${d.message}`).join("\n") : "";
      toast.error(`${errorMessage}${errorDetails}`);
      setHasRequestedRecently(false);
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedAmount = advanceType === "percentage" 
    ? (freightPrice * percentage[0]) / 100
    : parseFloat(customAmount) || 0;

  // Verificar duplicatas quando o valor calculado muda
  useEffect(() => {
    const checkDuplicates = async () => {
      if (calculatedAmount <= 0 || !isOpen) {
        setDuplicateWarning(null);
        return;
      }

      try {
        // Verificar solicitações duplicadas
        const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
        const { data: duplicateAdvances } = await supabase
          .from('freight_advances')
          .select('id, requested_amount, requested_at')
          .eq('freight_id', freightId)
          .eq('requested_amount', Math.round(calculatedAmount * 100))
          .gte('requested_at', twoHoursAgo)
          .neq('status', 'REJECTED');

        if (duplicateAdvances && duplicateAdvances.length > 0) {
          setDuplicateWarning(`Você já solicitou um adiantamento de R$ ${calculatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} nas últimas 2 horas.`);
        } else {
          setDuplicateWarning(null);
        }

        // Verificar solicitações pendentes
        const { data: pendingAdvances } = await supabase
          .from('freight_advances')
          .select('id')
          .eq('freight_id', freightId)
          .eq('status', 'PENDING');

        setPendingCount(pendingAdvances?.length || 0);
      } catch (error) {
        console.error('Error checking duplicates:', error);
      }
    };

    const timeoutId = setTimeout(checkDuplicates, 500); // Debounce
    return () => clearTimeout(timeoutId);
  }, [calculatedAmount, freightId, isOpen]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl">
            <DollarSign className="h-6 w-6 text-green-600" />
            Solicitar Adiantamento
          </DialogTitle>
          <DialogDescription className="sr-only">
            Solicite um adiantamento do valor do frete antes da entrega
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto space-y-6 max-h-[calc(90vh-160px)]">
          {/* Aviso sobre pagamento direto */}
          <Alert className="border-l-4 border-l-blue-500 bg-blue-50 border-blue-200">
            <MessageSquare className="h-4 w-4 text-blue-600" />
            <AlertDescription className="ml-2">
              <div className="font-semibold text-blue-800">
                💬 Pagamento Direto com o Produtor
              </div>
              <div className="text-sm text-blue-700 mt-1">
                Esta é apenas uma <strong>solicitação</strong> ao produtor. 
                O pagamento deve ser combinado diretamente no chat do frete.
                A plataforma ainda não processa pagamentos automáticos.
              </div>
            </AlertDescription>
          </Alert>

          {/* Status das Solicitações Pendentes */}
          {pendingCount > 0 && (
            <Alert className={`border-l-4 ${
              pendingCount >= 3 
                ? 'border-l-red-500 bg-red-50 border-red-200' 
                : 'border-l-amber-500 bg-amber-50 border-amber-200'
            }`}>
              <AlertTriangle className={`h-4 w-4 ${
                pendingCount >= 3 ? 'text-red-600' : 'text-amber-600'
              }`} />
              <AlertDescription className="ml-2">
                <div className={`font-semibold ${
                  pendingCount >= 3 ? 'text-red-800' : 'text-amber-800'
                }`}>
                  {pendingCount >= 3 ? 'Limite de Solicitações Atingido' : 'Solicitações Pendentes'}
                </div>
                <div className={`text-sm mt-1 ${
                  pendingCount >= 3 ? 'text-red-700' : 'text-amber-700'
                }`}>
                  {pendingCount >= 3 
                    ? `Você já tem ${pendingCount} solicitações pendentes. Aguarde a aprovação das anteriores.`
                    : `${pendingCount} solicitação(ões) aguardando aprovação para este frete.`
                  }
                </div>
              </AlertDescription>
            </Alert>
          )}

          {/* Valor do Frete - Card Principal */}
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-2xl border border-blue-200">
            <div className="text-center">
              <p className="text-sm font-medium text-blue-700 mb-2">Valor total do frete</p>
              <p className="text-3xl font-bold text-blue-900 mb-1">
                R$ {freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <div className="w-12 h-1 bg-blue-400 rounded-full mx-auto"></div>
            </div>
          </div>

          {/* Formulário de Adiantamento */}
          {pendingCount < 3 && (
            <div className="space-y-6">
              {/* Tipo de Adiantamento - Layout mais compacto */}
              <div>
                <Label className="text-base font-semibold text-gray-800 mb-3 block">Tipo de adiantamento</Label>
                <RadioGroup value={advanceType} onValueChange={(value) => setAdvanceType(value as "percentage" | "amount")}>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      advanceType === "percentage" 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      <RadioGroupItem value="percentage" id="percentage" className="absolute top-3 right-3" />
                      <Label htmlFor="percentage" className="cursor-pointer block">
                        <div className="flex items-center gap-2 mb-1">
                          <Percent className={`h-5 w-5 ${
                            advanceType === "percentage" ? 'text-green-600' : 'text-gray-500'
                          }`} />
                          <span className="font-semibold">Porcentagem</span>
                        </div>
                        <p className="text-xs text-gray-600">Calcular por %</p>
                      </Label>
                    </div>
                    
                    <div className={`relative p-4 rounded-xl border-2 transition-all cursor-pointer ${
                      advanceType === "amount" 
                        ? 'border-green-500 bg-green-50' 
                        : 'border-gray-200 bg-white hover:border-gray-300'
                    }`}>
                      <RadioGroupItem value="amount" id="amount" className="absolute top-3 right-3" />
                      <Label htmlFor="amount" className="cursor-pointer block">
                        <div className="flex items-center gap-2 mb-1">
                          <DollarSign className={`h-5 w-5 ${
                            advanceType === "amount" ? 'text-green-600' : 'text-gray-500'
                          }`} />
                          <span className="font-semibold">Valor fixo</span>
                        </div>
                        <p className="text-xs text-gray-600">Inserir valor</p>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Configuração do Valor */}
              <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
                {advanceType === "percentage" ? (
                  <div className="space-y-6">
                    <div className="text-center">
                      <Label className="text-base font-semibold text-gray-800 block mb-2">
                        Porcentagem do adiantamento
                      </Label>
                      <div className="text-4xl font-bold text-green-600 mb-4">
                        {percentage[0]}%
                      </div>
                    </div>
                    
                    <div className="space-y-3">
                      <Slider
                        value={percentage}
                        onValueChange={setPercentage}
                        max={50}
                        min={10}
                        step={5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500">
                        <span>10%</span>
                        <span>25%</span>
                        <span>50% (máx)</span>
                      </div>
                    </div>
                    
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700 text-center">
                        <strong>Máximo permitido:</strong> 50% do valor total
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Label htmlFor="customAmount" className="text-base font-semibold text-gray-800 block text-center">
                      Valor do adiantamento
                    </Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 transform -translate-y-1/2 text-gray-500 text-lg">R$</span>
                      <Input
                        id="customAmount"
                        type="number"
                        placeholder="0,00"
                        value={customAmount}
                        onChange={(e) => setCustomAmount(e.target.value)}
                        max={freightPrice * 0.5}
                        className="pl-12 text-lg font-semibold h-14 text-center bg-gray-50 border-2 focus:border-green-500"
                      />
                    </div>
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <p className="text-sm text-blue-700 text-center">
                        <strong>Máximo:</strong> R$ {(freightPrice * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Valor Calculado - Card de Resultado */}
              {calculatedAmount > 0 && (
                <div className="bg-gradient-to-br from-green-500 to-green-600 p-6 rounded-2xl text-white shadow-lg">
                  <div className="text-center">
                    <p className="text-green-100 text-sm mb-2 font-medium">Valor do adiantamento</p>
                    <p className="text-4xl font-bold mb-2">
                      R$ {calculatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                    <div className="w-16 h-1 bg-green-300 rounded-full mx-auto"></div>
                  </div>
                </div>
              )}

              {/* Avisos de Validação */}
              {duplicateWarning && (
                <Alert className="border-l-4 border-l-orange-500 bg-orange-50 border-orange-200">
                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                  <AlertDescription className="ml-2">
                    <div className="font-semibold text-orange-800">Valor já solicitado</div>
                    <div className="text-sm text-orange-700 mt-1">
                      {duplicateWarning} Tente um valor diferente ou aguarde.
                    </div>
                  </AlertDescription>
                </Alert>
              )}
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex-shrink-0 flex gap-3 pt-6 border-t border-gray-200">
          <Button 
            variant="outline" 
            onClick={onClose} 
            className="flex-1 h-12 text-base font-semibold border-2"
          >
            Cancelar
          </Button>
          <Button 
            onClick={handleCreateAdvance} 
            disabled={isLoading || calculatedAmount === 0 || hasRequestedRecently || !!duplicateWarning || pendingCount >= 3}
            className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:text-gray-600 shadow-lg"
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            {hasRequestedRecently ? "Aguarde..." : 
             duplicateWarning ? "Valor já solicitado" :
             pendingCount >= 3 ? "Limite atingido" :
             "Solicitar Adiantamento"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}