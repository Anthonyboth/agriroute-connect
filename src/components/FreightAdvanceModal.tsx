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

        <div className="space-y-6">
          <div className="bg-muted/20 p-4 rounded-lg">
            <p className="text-sm text-muted-foreground">Valor total do frete</p>
            <p className="text-xl font-semibold">R$ {freightPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="space-y-4">
            <Label>Tipo de adiantamento</Label>
            <RadioGroup value={advanceType} onValueChange={(value) => setAdvanceType(value as "percentage" | "amount")}>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="percentage" id="percentage" />
                <Label htmlFor="percentage" className="flex items-center gap-2">
                  <Percent className="h-4 w-4" />
                  Porcentagem
                </Label>
              </div>
              <div className="flex items-center space-x-2">
                <RadioGroupItem value="amount" id="amount" />
                <Label htmlFor="amount" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valor fixo
                </Label>
              </div>
            </RadioGroup>
          </div>

          {advanceType === "percentage" ? (
            <div className="space-y-4">
              <Label>Porcentagem do adiantamento: {percentage[0]}%</Label>
              <Slider
                value={percentage}
                onValueChange={setPercentage}
                max={50}
                min={10}
                step={5}
                className="w-full"
              />
              <p className="text-sm text-muted-foreground">
                Máximo permitido: 50% do valor total
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              <Label htmlFor="customAmount">Valor do adiantamento (R$)</Label>
              <Input
                id="customAmount"
                type="number"
                placeholder="0,00"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                max={freightPrice * 0.5}
              />
              <p className="text-sm text-muted-foreground">
                Máximo: R$ {(freightPrice * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Valor do adiantamento</p>
              <p className="text-xl font-semibold text-primary">
                R$ {calculatedAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
            </div>
          )}

          {/* Avisos de validação */}
          {duplicateWarning && (
            <Alert className="border-orange-200 bg-orange-50">
              <AlertTriangle className="h-4 w-4 text-orange-600" />
              <AlertDescription className="text-orange-800">
                {duplicateWarning} Tente um valor diferente ou aguarde.
              </AlertDescription>
            </Alert>
          )}

          {pendingCount >= 3 && (
            <Alert className="border-red-200 bg-red-50">
              <AlertTriangle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">
                Você já tem {pendingCount} solicitações pendentes para este frete. Aguarde a aprovação ou rejeição das anteriores.
              </AlertDescription>
            </Alert>
          )}

          {pendingCount > 0 && pendingCount < 3 && (
            <Alert className="border-blue-200 bg-blue-50">
              <AlertTriangle className="h-4 w-4 text-blue-600" />
              <AlertDescription className="text-blue-800">
                Você tem {pendingCount} solicitação(ões) pendente(s) para este frete.
              </AlertDescription>
            </Alert>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAdvance} 
              disabled={isLoading || calculatedAmount === 0 || hasRequestedRecently || !!duplicateWarning || pendingCount >= 3}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white disabled:bg-gray-400"
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