import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowRight, Home } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface FreightWizardStep2AddressProps {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onNext: () => void;
  onBack: () => void;
}

export function FreightWizardStep2Address({ 
  formData, 
  onInputChange, 
  onNext,
  onBack
}: FreightWizardStep2AddressProps) {
  // Pelo menos o bairro/fazenda de origem e destino são obrigatórios
  const canProceed = formData.origin_neighborhood && formData.destination_neighborhood;

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Home className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Endereço Completo</h3>
        <p className="text-sm text-muted-foreground">
          Informe o endereço exato de coleta e entrega
        </p>
      </div>

      {/* Endereço de Origem */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">A</span>
            Endereço de Origem
            <span className="text-muted-foreground font-normal text-sm">
              ({formData.origin_city}/{formData.origin_state})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="origin_neighborhood">Bairro / Fazenda / Nome do Local *</Label>
            <Input
              id="origin_neighborhood"
              value={formData.origin_neighborhood || ''}
              onChange={(e) => onInputChange('origin_neighborhood', e.target.value)}
              placeholder="Ex: Fazenda São João, Centro, Zona Industrial..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="origin_street">Rua / Avenida (opcional)</Label>
              <Input
                id="origin_street"
                value={formData.origin_street || ''}
                onChange={(e) => onInputChange('origin_street', e.target.value)}
                placeholder="Ex: Av. Brasil, Rua das Flores..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="origin_number">Número (opcional)</Label>
              <Input
                id="origin_number"
                value={formData.origin_number || ''}
                onChange={(e) => onInputChange('origin_number', e.target.value)}
                placeholder="Ex: 123, S/N..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="origin_complement">Complemento (opcional)</Label>
            <Input
              id="origin_complement"
              value={formData.origin_complement || ''}
              onChange={(e) => onInputChange('origin_complement', e.target.value)}
              placeholder="Ex: Galpão 2, Portão azul, KM 15..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Endereço de Destino */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span className="w-6 h-6 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">B</span>
            Endereço de Destino
            <span className="text-muted-foreground font-normal text-sm">
              ({formData.destination_city}/{formData.destination_state})
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="destination_neighborhood">Bairro / Fazenda / Nome do Local *</Label>
            <Input
              id="destination_neighborhood"
              value={formData.destination_neighborhood || ''}
              onChange={(e) => onInputChange('destination_neighborhood', e.target.value)}
              placeholder="Ex: Fazenda São João, Centro, Zona Industrial..."
            />
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="destination_street">Rua / Avenida (opcional)</Label>
              <Input
                id="destination_street"
                value={formData.destination_street || ''}
                onChange={(e) => onInputChange('destination_street', e.target.value)}
                placeholder="Ex: Av. Brasil, Rua das Flores..."
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="destination_number">Número (opcional)</Label>
              <Input
                id="destination_number"
                value={formData.destination_number || ''}
                onChange={(e) => onInputChange('destination_number', e.target.value)}
                placeholder="Ex: 123, S/N..."
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="destination_complement">Complemento (opcional)</Label>
            <Input
              id="destination_complement"
              value={formData.destination_complement || ''}
              onChange={(e) => onInputChange('destination_complement', e.target.value)}
              placeholder="Ex: Galpão 2, Portão azul, KM 15..."
            />
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onNext} disabled={!canProceed}>
          Continuar
          <ArrowRight className="ml-2 h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
