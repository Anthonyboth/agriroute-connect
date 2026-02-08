import React, { useEffect } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceFormData, ServiceType, URGENCY_LABELS, CARGO_TYPES, ADDITIONAL_SERVICES } from '../types';
import { AlertCircle, Clock, Package, Truck, Wrench } from 'lucide-react';

interface Step4Props {
  formData: ServiceFormData;
  onUpdate: (field: string, value: any) => void;
  serviceType: ServiceType;
}

export const Step4Details: React.FC<Step4Props> = ({ formData, onUpdate, serviceType }) => {
  
  // ✅ UX: Auto-preencher data de entrega quando data de coleta é selecionada (mudança)
  useEffect(() => {
    if ((serviceType === 'MUDANCA_RESIDENCIAL' || serviceType === 'MUDANCA_COMERCIAL') &&
        formData.mudanca?.pickupDate && !formData.mudanca?.deliveryDate) {
      const pickup = new Date(formData.mudanca.pickupDate + 'T00:00:00');
      pickup.setDate(pickup.getDate() + 1);
      const nextDay = pickup.toISOString().split('T')[0];
      onUpdate('mudanca.deliveryDate', nextDay);
    }
  }, [formData.mudanca?.pickupDate]);
  
  const handleAdditionalServiceChange = (serviceId: string, checked: boolean) => {
    const currentServices = formData.mudanca?.additionalServices || [];
    const newServices = checked 
      ? [...currentServices, serviceId]
      : currentServices.filter(id => id !== serviceId);
    onUpdate('mudanca.additionalServices', newServices);
  };

  const renderUrgencySelector = () => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4" />
        Urgência *
      </Label>
      <Select 
        value={formData.urgency} 
        onValueChange={(value) => onUpdate('urgency', value)}
      >
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(URGENCY_LABELS).map(([key, data]) => (
            <SelectItem key={key} value={key}>
              <div className="flex items-center gap-2">
                <Badge className={`${data.color} text-xs`}>{data.label}</Badge>
                <span className="text-sm">{data.description}</span>
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  const renderPreferredTime = () => (
    <div className="space-y-2">
      <Label className="flex items-center gap-2">
        <Clock className="h-4 w-4" />
        Horário Preferencial
      </Label>
      <Input
        value={formData.preferredTime || ''}
        onChange={(e) => onUpdate('preferredTime', e.target.value)}
        placeholder="Ex: Manhã, tarde, fim de semana..."
      />
    </div>
  );

  const renderGuinchoDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Tipo de Veículo</Label>
          <Select 
            value={formData.vehicle?.type || ''} 
            onValueChange={(value) => onUpdate('vehicle.type', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="CARRO">Carro</SelectItem>
              <SelectItem value="MOTO">Moto</SelectItem>
              <SelectItem value="VAN">Van/Utilitário</SelectItem>
              <SelectItem value="CAMINHAO">Caminhão</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Placa (opcional)</Label>
          <Input
            value={formData.vehicle?.plate || ''}
            onChange={(e) => onUpdate('vehicle.plate', e.target.value.toUpperCase())}
            placeholder="ABC-1234"
            maxLength={8}
          />
        </div>
      </div>

      {renderUrgencySelector()}
    </div>
  );

  const renderCargoDetails = () => {
    const maxWeight = serviceType === 'FRETE_MOTO' ? 150 : 1500;
    
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <Label className="flex items-center gap-2">
            <Package className="h-4 w-4" />
            Tipo de Carga *
          </Label>
          <Select 
            value={formData.cargo?.type || ''} 
            onValueChange={(value) => onUpdate('cargo.type', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(CARGO_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Peso Aproximado *</Label>
            <div className="flex gap-2">
              <Input
                type="number"
                value={formData.cargo?.weight || ''}
                onChange={(e) => onUpdate('cargo.weight', e.target.value)}
                placeholder="0"
                min="0"
                max={maxWeight}
              />
              <Select 
                value={formData.cargo?.weightUnit || 'kg'} 
                onValueChange={(value) => onUpdate('cargo.weightUnit', value)}
              >
                <SelectTrigger className="w-20">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="kg">kg</SelectItem>
                  {serviceType !== 'FRETE_MOTO' && <SelectItem value="ton">ton</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            {serviceType === 'FRETE_MOTO' && (
              <p className="text-xs text-muted-foreground">Máximo: 150kg</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Dimensões (opcional)</Label>
            <Input
              value={formData.cargo?.dimensions ? `${formData.cargo.dimensions.length}x${formData.cargo.dimensions.width}x${formData.cargo.dimensions.height}` : ''}
              onChange={(e) => {
                const parts = e.target.value.split('x');
                onUpdate('cargo.dimensions', {
                  length: parts[0] || '',
                  width: parts[1] || '',
                  height: parts[2] || ''
                });
              }}
              placeholder="CxLxA em cm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Checkbox
            id="needs-packaging"
            checked={formData.cargo?.needsPackaging || false}
            onCheckedChange={(checked) => onUpdate('cargo.needsPackaging', checked)}
          />
          <Label htmlFor="needs-packaging">Precisa de embalagem</Label>
        </div>

        {serviceType === 'FRETE_URBANO' && (
          <div className="flex items-center gap-3">
            <Checkbox
              id="needs-helper"
              checked={formData.cargo?.needsHelper || false}
              onCheckedChange={(checked) => onUpdate('cargo.needsHelper', checked)}
            />
            <Label htmlFor="needs-helper">Precisa de ajudante para carregar</Label>
          </div>
        )}

        {renderUrgencySelector()}
        {renderPreferredTime()}
      </div>
    );
  };

  const renderMudancaDetails = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Volume Estimado (m³)</Label>
        <Input
          type="number"
          value={formData.mudanca?.volume || ''}
          onChange={(e) => onUpdate('mudanca.volume', e.target.value)}
          placeholder="Ex: 15"
          step="0.1"
        />
      </div>

      <div className="space-y-3">
        <Label>Serviços Adicionais</Label>
        <div className="grid grid-cols-1 gap-2">
          {ADDITIONAL_SERVICES.map((service) => (
            <div key={service.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center gap-3">
                <Checkbox
                  id={service.id}
                  checked={(formData.mudanca?.additionalServices || []).includes(service.id)}
                  onCheckedChange={(checked) => handleAdditionalServiceChange(service.id, !!checked)}
                />
                <Label htmlFor={service.id} className="cursor-pointer">
                  {service.label}
                </Label>
              </div>
              <Badge variant="secondary">+R$ {service.price}</Badge>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Itens Especiais</Label>
        <Textarea
          value={formData.mudanca?.specialItems || ''}
          onChange={(e) => onUpdate('mudanca.specialItems', e.target.value)}
          placeholder="Piano, obras de arte, cofres, itens frágeis..."
          rows={2}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Data de Coleta *</Label>
          <Input
            type="date"
            value={formData.mudanca?.pickupDate || ''}
            onChange={(e) => onUpdate('mudanca.pickupDate', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Data de Entrega *</Label>
          <Input
            type="date"
            value={formData.mudanca?.deliveryDate || ''}
            onChange={(e) => onUpdate('mudanca.deliveryDate', e.target.value)}
          />
        </div>
      </div>

      {renderPreferredTime()}
    </div>
  );

  const renderTechnicalDetails = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Marca</Label>
          <Input
            value={formData.technical?.brand || ''}
            onChange={(e) => onUpdate('technical.brand', e.target.value)}
            placeholder="Ex: John Deere"
          />
        </div>
        <div className="space-y-2">
          <Label>Modelo</Label>
          <Input
            value={formData.technical?.model || ''}
            onChange={(e) => onUpdate('technical.model', e.target.value)}
            placeholder="Ex: 7200R"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>Ano (aproximado)</Label>
          <Input
            value={formData.technical?.year || ''}
            onChange={(e) => onUpdate('technical.year', e.target.value)}
            placeholder="Ex: 2020"
            maxLength={4}
          />
        </div>
        <div className="space-y-2">
          <Label>Última Manutenção</Label>
          <Input
            type="date"
            value={formData.technical?.lastMaintenance || ''}
            onChange={(e) => onUpdate('technical.lastMaintenance', e.target.value)}
          />
        </div>
      </div>

      {renderUrgencySelector()}
      {renderPreferredTime()}
    </div>
  );

  const renderAgriculturalDetails = () => (
    <div className="space-y-4">
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-3">
          <p className="text-sm text-green-800">
            Preencha os detalhes específicos do serviço para receber um orçamento mais preciso.
          </p>
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Label>Informações Adicionais</Label>
        <Textarea
          value={formData.additionalInfo || ''}
          onChange={(e) => onUpdate('additionalInfo', e.target.value)}
          placeholder="Descreva quaisquer detalhes importantes sobre o serviço..."
          rows={4}
        />
      </div>

      {renderUrgencySelector()}
      {renderPreferredTime()}
    </div>
  );

  const renderContent = () => {
    switch (serviceType) {
      case 'GUINCHO':
        return renderGuinchoDetails();
      case 'FRETE_MOTO':
      case 'FRETE_URBANO':
        return renderCargoDetails();
      case 'MUDANCA_RESIDENCIAL':
      case 'MUDANCA_COMERCIAL':
        return renderMudancaDetails();
      case 'SERVICO_AGRICOLA':
        return renderAgriculturalDetails();
      case 'SERVICO_TECNICO':
        return renderTechnicalDetails();
      default:
        return renderCargoDetails();
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  );
};
