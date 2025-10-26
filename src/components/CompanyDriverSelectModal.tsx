import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Truck, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface Driver {
  id: string;
  full_name: string;
  status: string;
}

interface CompanyDriverSelectModalProps {
  isOpen: boolean;
  onClose: () => void;
  drivers: Driver[];
  onSelectDriver: (driverId: string) => void;
  freight: {
    cargo_type: string;
    origin_address: string;
    destination_address: string;
    price: number;
  };
}

export const CompanyDriverSelectModal: React.FC<CompanyDriverSelectModalProps> = ({
  isOpen,
  onClose,
  drivers,
  onSelectDriver,
  freight
}) => {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');

  const handleAccept = () => {
    if (selectedDriverId) {
      onSelectDriver(selectedDriverId);
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Escolher Motorista para o Frete</DialogTitle>
          <DialogDescription>
            Selecione um motorista para aceitar este frete em nome da transportadora
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Resumo do Frete */}
          <div className="p-3 bg-secondary/20 rounded-lg border border-border">
            <p className="font-semibold text-sm">{freight.cargo_type}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {freight.origin_address} → {freight.destination_address}
            </p>
            <p className="text-sm font-bold text-primary mt-2">
              R$ {freight.price.toLocaleString('pt-BR')}
            </p>
          </div>

          {drivers.length === 0 ? (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Nenhum motorista cadastrado. Cadastre um motorista na aba "Motoristas" para aceitar fretes como transportadora.
              </AlertDescription>
            </Alert>
          ) : (
            <RadioGroup value={selectedDriverId} onValueChange={setSelectedDriverId}>
              <div className="space-y-2">
                {drivers.map((driver) => (
                  <div
                    key={driver.id}
                    className={`flex items-center space-x-3 p-3 rounded-lg border-2 cursor-pointer transition-all ${
                      selectedDriverId === driver.id
                        ? 'border-primary bg-primary/5'
                        : 'border-border hover:border-primary/50'
                    }`}
                    onClick={() => setSelectedDriverId(driver.id)}
                  >
                    <RadioGroupItem value={driver.id} id={driver.id} />
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        <Truck className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                    <Label
                      htmlFor={driver.id}
                      className="flex-1 cursor-pointer"
                    >
                      <p className="font-medium">{driver.full_name}</p>
                      <p className="text-xs text-muted-foreground">
                        Status: {driver.status}
                      </p>
                    </Label>
                  </div>
                ))}
              </div>
            </RadioGroup>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          {drivers.length > 0 && (
            <Button
              onClick={handleAccept}
              disabled={!selectedDriverId}
              className="gradient-primary"
            >
              Aceitar Frete
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
