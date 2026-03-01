import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Truck, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';
import { getCanonicalFreightPrice, type FreightPricingInput } from '@/lib/freightPriceContract';

interface CompanyBulkFreightAcceptorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  freight: {
    id: string;
    required_trucks?: number;
    accepted_trucks?: number;
    price: number;
    pricing_type?: string | null;
    price_per_ton?: number | null;
    price_per_km?: number | null;
    weight?: number | null;
    distance_km?: number | null;
    origin_address: string;
    destination_address: string;
  };
  onAccept: (numTrucks: number) => Promise<void>;
}

export const CompanyBulkFreightAcceptor = ({
  open,
  onOpenChange,
  freight,
  onAccept
}: CompanyBulkFreightAcceptorProps) => {
  const requiredTrucks = freight.required_trucks || 1;
  const acceptedTrucks = freight.accepted_trucks || 0;
  const availableSlots = requiredTrucks - acceptedTrucks;
  const [numTrucks, setNumTrucks] = useState(Math.min(availableSlots, 1));
  const [loading, setLoading] = useState(false);

  // ✅ Contrato canônico: respeita pricing_type (PER_TON, PER_KM, FIXED)
  const pricingInput: FreightPricingInput = {
    pricing_type: freight.pricing_type,
    price_per_ton: freight.price_per_ton,
    price_per_km: freight.price_per_km,
    price: freight.price,
    required_trucks: requiredTrucks,
    weight: freight.weight,
    distance_km: freight.distance_km,
  };
  const priceDisplay = getCanonicalFreightPrice(pricingInput);

  const handleAccept = async () => {
    setLoading(true);
    try {
      await onAccept(numTrucks);
      onOpenChange(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Aceitar Múltiplas Carretas
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Info do Frete */}
          <div className="bg-muted/50 p-4 rounded-lg space-y-2">
            <div className="text-sm">
              <span className="text-muted-foreground">Origem:</span>
              <p className="font-medium">{freight.origin_address}</p>
            </div>
            <div className="text-sm">
              <span className="text-muted-foreground">Destino:</span>
              <p className="font-medium">{freight.destination_address}</p>
            </div>
          </div>

          {/* Vagas Disponíveis */}
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              <strong>{availableSlots}</strong> carretas disponíveis de <strong>{requiredTrucks}</strong> total
            </AlertDescription>
          </Alert>

          {/* Seletor de Quantidade */}
          <div className="space-y-2">
            <Label>Quantas carretas deseja aceitar?</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                min={1}
                max={availableSlots}
                value={numTrucks}
                onChange={(e) => setNumTrucks(Math.min(availableSlots, Math.max(1, parseInt(e.target.value) || 1)))}
              />
              <Button
                variant="outline"
                onClick={() => setNumTrucks(availableSlots)}
              >
                Todas ({availableSlots})
              </Button>
            </div>
          </div>

          {/* Resumo de Valores — usando contrato canônico */}
          <div className="bg-primary/5 p-4 rounded-lg space-y-1">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Valor unitário:</span>
              <span className="font-semibold">
                {priceDisplay.primaryLabel}
              </span>
            </div>
            {priceDisplay.secondaryLabel && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Detalhes:</span>
                <span className="text-muted-foreground">
                  {priceDisplay.secondaryLabel}
                </span>
              </div>
            )}
            <div className="flex justify-between text-sm pt-1 border-t border-border/50">
              <span className="font-medium">Carretas selecionadas:</span>
              <span className="text-xl font-bold text-primary">
                {numTrucks}
              </span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button
              className="flex-1"
              onClick={handleAccept}
              disabled={loading}
            >
              {loading ? "Aceitando..." : `Aceitar ${numTrucks} Carreta${numTrucks > 1 ? 's' : ''}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
