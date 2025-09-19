import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DollarSign, Percent, AlertTriangle } from "lucide-react";

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
        ? { freight_id: freightId, advance_percentage: percentage[0] }
        : { freight_id: freightId, advance_amount: parseFloat(customAmount) };

      const { data, error } = await supabase.functions.invoke('create-freight-advance', {
        body: payload
      });

      if (error) throw error;

      toast.success("Solicitação de adiantamento enviada ao produtor!");
      onClose();
      
      // Reset após 30 segundos
      setTimeout(() => setHasRequestedRecently(false), 30000);
    } catch (error) {
      console.error('Error creating advance:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar adiantamento");
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
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-primary" />
            Solicitar Adiantamento
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Status das Solicitações Pendentes */}
          {pendingCount > 0 && (
            <div className={`p-4 rounded-xl border-l-4 ${
              pendingCount >= 3 
                ? 'border-l-red-500 bg-red-50/80' 
                : 'border-l-amber-500 bg-amber-50/80'
            }`}>
              <div className="flex items-start gap-3">
                <AlertTriangle className={`h-5 w-5 mt-0.5 flex-shrink-0 ${
                  pendingCount >= 3 ? 'text-red-600' : 'text-amber-600'
                }`} />
                <div>
                  <p className={`font-semibold mb-1 ${
                    pendingCount >= 3 ? 'text-red-800' : 'text-amber-800'
                  }`}>
                    {pendingCount >= 3 ? 'Limite de Solicitações Atingido' : 'Solicitações Pendentes'}
                  </p>
                  <p className={`text-sm leading-relaxed ${
                    pendingCount >= 3 ? 'text-red-700' : 'text-amber-700'
                  }`}>
                    {pendingCount >= 3 
                      ? `Você já tem ${pendingCount} solicitações pendentes. Aguarde a aprovação ou rejeição das anteriores antes de fazer uma nova solicitação.`
                      : `Você tem ${pendingCount} solicitação(ões) aguardando aprovação para este frete.`
                    }
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Valor do Frete */}
          <div className="bg-gradient-to-r from-slate-50 to-slate-100 p-5 rounded-xl border border-slate-200">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm font-medium text-slate-600 mb-1">Valor total do frete</p>
                <p className="text-2xl font-bold text-slate-900">
                  R$ {freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <DollarSign className="h-8 w-8 text-slate-400" />
            </div>
          </div>

          {/* Formulário de Adiantamento */}
          {pendingCount < 3 && (
            <div className="space-y-5">
              {/* Tipo de Adiantamento */}
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                <Label className="text-base font-semibold text-slate-700 mb-4 block">Tipo de adiantamento</Label>
                <RadioGroup value={advanceType} onValueChange={(value) => setAdvanceType(value as "percentage" | "amount")}>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                      <RadioGroupItem value="percentage" id="percentage" />
                      <Label htmlFor="percentage" className="flex items-center gap-2 cursor-pointer">
                        <Percent className="h-4 w-4 text-primary" />
                        <span className="font-medium">Porcentagem</span>
                      </Label>
                    </div>
                    <div className="flex items-center space-x-3 p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors">
                      <RadioGroupItem value="amount" id="amount" />
                      <Label htmlFor="amount" className="flex items-center gap-2 cursor-pointer">
                        <DollarSign className="h-4 w-4 text-primary" />
                        <span className="font-medium">Valor fixo</span>
                      </Label>
                    </div>
                  </div>
                </RadioGroup>
              </div>

              {/* Configuração do Valor */}
              <div className="bg-white p-5 rounded-xl border border-slate-200">
                {advanceType === "percentage" ? (
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <Label className="text-base font-semibold text-slate-700">Porcentagem do adiantamento</Label>
                      <span className="text-lg font-bold text-primary">{percentage[0]}%</span>
                    </div>
                    <Slider
                      value={percentage}
                      onValueChange={setPercentage}
                      max={50}
                      min={10}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                      <strong>Máximo permitido:</strong> 50% do valor total
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <Label htmlFor="customAmount" className="text-base font-semibold text-slate-700 block">Valor do adiantamento (R$)</Label>
                    <Input
                      id="customAmount"
                      type="number"
                      placeholder="0,00"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      max={freightPrice * 0.5}
                      className="text-lg font-semibold"
                    />
                    <p className="text-sm text-slate-500 bg-slate-50 p-3 rounded-lg">
                      <strong>Máximo:</strong> R$ {(freightPrice * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </p>
                  </div>
                )}
              </div>

              {/* Valor Calculado */}
              {calculatedAmount > 0 && (
                <div className="bg-gradient-to-r from-green-50 to-green-100 p-5 rounded-xl border border-green-200">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm font-medium text-green-700 mb-1">Valor do adiantamento</p>
                      <p className="text-3xl font-bold text-green-800">
                        R$ {calculatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </p>
                    </div>
                    <div className="bg-green-600 rounded-full p-3">
                      <DollarSign className="h-6 w-6 text-white" />
                    </div>
                  </div>
                </div>
              )}

              {/* Avisos de Validação */}
              {duplicateWarning && (
                <div className="border-l-4 border-l-orange-500 bg-orange-50/80 p-4 rounded-r-xl">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-semibold text-orange-800 mb-1">Valor já solicitado</p>
                      <p className="text-sm text-orange-700 leading-relaxed">
                        {duplicateWarning} Tente um valor diferente ou aguarde.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botões de Ação */}
          <div className="flex gap-4 pt-4 border-t border-slate-200">
            <Button variant="outline" onClick={onClose} className="flex-1 h-12 text-base font-semibold">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAdvance} 
              disabled={isLoading || calculatedAmount === 0 || hasRequestedRecently || !!duplicateWarning || pendingCount >= 3}
              className="flex-1 h-12 text-base font-semibold bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400 disabled:text-gray-600"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {hasRequestedRecently ? "Aguarde..." : 
               duplicateWarning ? "Valor já solicitado" :
               pendingCount >= 3 ? "Limite atingido" :
               "Solicitar Adiantamento"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}