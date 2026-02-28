import { Button } from '@/components/ui/button';
import { ArrowLeft, Check, Loader2, MapPin, Package, DollarSign, Calendar, Truck, Eye, Home } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CARGO_TYPES } from '@/lib/cargo-types';

interface FreightWizardStep5ReviewProps {
  formData: any;
  onInputChange: (field: string, value: any) => void;
  onBack: () => void;
  onSubmit: () => void;
  loading: boolean;
  calculatedAnttPrice?: number | null;
  calculatedDistance?: number;
  guestMode?: boolean;
}

export function FreightWizardStep5Review({ 
  formData,
  onInputChange,
  onBack,
  onSubmit,
  loading,
  calculatedAnttPrice,
  calculatedDistance,
  guestMode
}: FreightWizardStep5ReviewProps) {
  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '-';
    return new Date(dateString + 'T00:00:00').toLocaleDateString('pt-BR');
  };

  const getCargoLabel = (value: string) => {
    return CARGO_TYPES.find(t => t.value === value)?.label || value;
  };

  const getUrgencyBadge = (urgency: string) => {
    const variants: Record<string, { label: string; className: string }> = {
      LOW: { label: 'Baixa', className: 'bg-green-100 text-green-800' },
      MEDIUM: { label: 'Média', className: 'bg-yellow-100 text-yellow-800' },
      HIGH: { label: 'Alta', className: 'bg-red-100 text-red-800' },
    };
    const v = variants[urgency] || variants.MEDIUM;
    return <Badge className={v.className}>{v.label}</Badge>;
  };

  const calculateTotalPrice = () => {
    const trucks = parseInt(formData.required_trucks || '1');
    
    if (formData.pricing_type === 'FIXED') {
      return parseFloat(formData.price || 0) * trucks;
    }
    
    if (formData.pricing_type === 'PER_TON') {
      // Peso informado no wizard é TOTAL (toneladas).
      // Total = (R$/ton) × (toneladas totais)
      const totalTons = parseFloat(formData.weight || 0);
      return parseFloat(formData.price_per_km || 0) * totalTons;
    }
    
    // PER_KM
    if (calculatedDistance) {
      return parseFloat(formData.price_per_km || 0) * calculatedDistance * trucks;
    }
    return 0;
  };
  
  const getPricingLabel = () => {
    switch (formData.pricing_type) {
      case 'FIXED':
        return 'Valor fixo';
      case 'PER_TON':
        return 'Por tonelada';
      default:
        return 'Por km';
    }
  };
  
  const getPricingValue = () => {
    if (formData.pricing_type === 'FIXED') {
      return formatCurrency(parseFloat(formData.price || 0));
    }
    const value = formatCurrency(parseFloat(formData.price_per_km || 0));
    if (formData.pricing_type === 'PER_TON') {
      return `${value}/ton`;
    }
    return `${value}/km`;
  };

  const formatAddress = (neighborhood: string, street: string, number: string, complement: string) => {
    const parts = [neighborhood];
    if (street) parts.push(street);
    if (number) parts.push(`nº ${number}`);
    if (complement) parts.push(complement);
    return parts.join(', ');
  };

  return (
    <div className="space-y-6">
      <div className="text-center mb-6">
        <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
          <Check className="h-6 w-6 text-primary" />
        </div>
        <h3 className="text-lg font-semibold">Revisar e Publicar</h3>
        <p className="text-sm text-muted-foreground">
          Confira os dados e configure a visibilidade
        </p>
      </div>

      {/* Resumo */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {/* Rota */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <MapPin className="h-4 w-4" />
              Rota
            </div>
            <div className="pl-6 space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-green-500 text-white text-xs flex items-center justify-center">A</span>
                <span className="font-medium">{formData.origin_city}/{formData.origin_state}</span>
              </div>
              <div className="border-l-2 border-dashed border-muted h-4 ml-2.5" />
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-red-500 text-white text-xs flex items-center justify-center">B</span>
                <span className="font-medium">{formData.destination_city}/{formData.destination_state}</span>
              </div>
              {calculatedDistance && calculatedDistance > 0 && (
                <p className="text-xs text-muted-foreground mt-2 pl-7">
                  Distância: ~{calculatedDistance.toFixed(0)} km
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Endereços */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Home className="h-4 w-4" />
              Endereços
            </div>
            <div className="pl-6 space-y-2 text-sm">
              <div>
                <span className="text-muted-foreground">Origem:</span>
                <p className="font-medium">
                  {formatAddress(formData.origin_neighborhood, formData.origin_street, formData.origin_number, formData.origin_complement) || '-'}
                </p>
              </div>
              <div>
                <span className="text-muted-foreground">Destino:</span>
                <p className="font-medium">
                  {formatAddress(formData.destination_neighborhood, formData.destination_street, formData.destination_number, formData.destination_complement) || '-'}
                </p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Carga */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Package className="h-4 w-4" />
              Carga
            </div>
            <div className="pl-6 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Tipo:</span>
                <p className="font-medium">{getCargoLabel(formData.cargo_type)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Peso:</span>
                <p className="font-medium">{formData.weight} toneladas</p>
              </div>
              {formData.vehicle_axles_required && (
                <div>
                  <span className="text-muted-foreground">Eixos:</span>
                  <p className="font-medium">{formData.vehicle_axles_required}</p>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Valor */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Valor
            </div>
            <div className="pl-6 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">
                  {getPricingLabel()}:
                </span>
                <span className="font-medium">
                  {getPricingValue()}
                </span>
              </div>
              <div className="flex items-center justify-between text-lg">
                <span className="font-semibold">Total:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(calculateTotalPrice())}
                </span>
              </div>
              {calculatedAnttPrice && calculatedAnttPrice > 0 && (
                <p className="text-xs text-muted-foreground">
                  Mínimo ANTT: {formatCurrency(calculatedAnttPrice)}
                </p>
              )}
            </div>
          </div>

          <Separator />

          {/* Datas */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Datas
            </div>
            <div className="pl-6 grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-muted-foreground">Coleta:</span>
                <p className="font-medium">{formatDate(formData.pickup_date)}</p>
              </div>
              <div>
                <span className="text-muted-foreground">Entrega:</span>
                <p className="font-medium">{formatDate(formData.delivery_date)}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Veículos e Urgência */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {formData.required_trucks} {parseInt(formData.required_trucks) === 1 ? 'veículo' : 'veículos'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Urgência:</span>
              {getUrgencyBadge(formData.urgency)}
            </div>
          </div>

          {/* Observações */}
          {formData.description && (
            <>
              <Separator />
              <div className="space-y-1">
                <span className="text-sm text-muted-foreground">Observações:</span>
                <p className="text-sm">{formData.description}</p>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Visibilidade do Frete */}
      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2 text-sm font-medium">
            <Eye className="h-4 w-4" />
            Visibilidade do Frete
          </div>
          
          <RadioGroup 
            value={formData.visibility_type || 'ALL'} 
            onValueChange={(value) => onInputChange('visibility_type', value)}
            className="space-y-3"
          >
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="ALL" id="visibility_all" className="mt-1" />
              <div>
                <Label htmlFor="visibility_all" className="font-medium cursor-pointer">
                  Todos os motoristas e transportadoras
                </Label>
                <p className="text-xs text-muted-foreground">
                  Qualquer motorista ou transportadora poderá ver e se candidatar
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="TRANSPORTADORAS_ONLY" id="visibility_transportadoras" className="mt-1" />
              <div>
                <Label htmlFor="visibility_transportadoras" className="font-medium cursor-pointer">
                  Somente transportadoras
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apenas transportadoras verificadas poderão ver este frete
                </p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <RadioGroupItem value="RATING_MINIMUM" id="visibility_rating" className="mt-1" />
              <div>
                <Label htmlFor="visibility_rating" className="font-medium cursor-pointer">
                  Motoristas com avaliação mínima
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apenas motoristas com uma avaliação mínima poderão ver
                </p>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <RadioGroupItem value="RATING_AND_TRANSPORTADORAS" id="visibility_rating_transport" className="mt-1" />
              <div>
                <Label htmlFor="visibility_rating_transport" className="font-medium cursor-pointer">
                  Motoristas avaliação 4+ e Transportadoras
                </Label>
                <p className="text-xs text-muted-foreground">
                  Apenas motoristas com avaliação 4 ou mais e transportadoras verificadas
                </p>
              </div>
            </div>
          </RadioGroup>

          {(formData.visibility_type === 'RATING_MINIMUM') && (
            <div className="pl-6 space-y-2">
              <Label>Avaliação Mínima</Label>
              <Select
                value={formData.min_driver_rating || '4'}
                onValueChange={(value) => onInputChange('min_driver_rating', value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">⭐ 3 estrelas ou mais</SelectItem>
                  <SelectItem value="3.5">⭐ 3.5 estrelas ou mais</SelectItem>
                  <SelectItem value="4">⭐ 4 estrelas ou mais</SelectItem>
                  <SelectItem value="4.5">⭐ 4.5 estrelas ou mais</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} disabled={loading}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
        <Button onClick={onSubmit} disabled={loading} size="lg" className="bg-green-600 hover:bg-green-700">
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Publicando...
            </>
          ) : (
            <>
              <Check className="mr-2 h-4 w-4" />
              {guestMode ? 'Enviar Solicitação' : 'Publicar Frete'}
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
