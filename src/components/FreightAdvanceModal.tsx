import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, DollarSign, Percent } from "lucide-react";

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

  const handleCreateAdvance = async () => {
    setIsLoading(true);
    try {
      const payload = advanceType === "percentage" 
        ? { freight_id: freightId, advance_percentage: percentage[0] }
        : { freight_id: freightId, advance_amount: Math.round(parseFloat(customAmount) * 100) };

      const { data, error } = await supabase.functions.invoke('create-freight-advance', {
        body: payload
      });

      if (error) throw error;

      // Abrir Stripe checkout em nova aba
      window.open(data.url, '_blank');
      
      toast.success("Redirecionando para pagamento do adiantamento");
      onClose();
    } catch (error) {
      console.error('Error creating advance:', error);
      toast.error(error instanceof Error ? error.message : "Erro ao criar adiantamento");
    } finally {
      setIsLoading(false);
    }
  };

  const calculatedAmount = advanceType === "percentage" 
    ? (freightPrice * percentage[0]) / 100
    : parseFloat(customAmount) * 100 || 0;

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
            <p className="text-xl font-semibold">R$ {(freightPrice / 100).toFixed(2)}</p>
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
                max={freightPrice / 100 * 0.5}
              />
              <p className="text-sm text-muted-foreground">
                Máximo: R$ {(freightPrice / 100 * 0.5).toFixed(2)}
              </p>
            </div>
          )}

          {calculatedAmount > 0 && (
            <div className="bg-primary/10 p-4 rounded-lg">
              <p className="text-sm text-muted-foreground">Valor do adiantamento</p>
              <p className="text-xl font-semibold text-primary">
                R$ {(calculatedAmount / 100).toFixed(2)}
              </p>
            </div>
          )}

          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancelar
            </Button>
            <Button 
              onClick={handleCreateAdvance} 
              disabled={isLoading || calculatedAmount === 0}
              className="flex-1"
            >
              {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Solicitar Adiantamento
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}