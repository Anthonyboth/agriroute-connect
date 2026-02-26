import React from 'react';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ServiceFormData, ServiceType } from '../types';
import { SUB_SERVICE_OPTIONS } from '../config';
import { Input } from '@/components/ui/input';

interface Step1Props {
  formData: ServiceFormData;
  onUpdate: (field: keyof ServiceFormData | string, value: any) => void;
  serviceType: ServiceType;
}

export const Step1ServiceType: React.FC<Step1Props> = ({ formData, onUpdate, serviceType }) => {
  const isGuindaste = formData.subServiceType === 'GUINDASTE' || formData.subServiceType === 'Guindaste';
  
  const renderGuinchoFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Veículo *</Label>
        <div className="grid grid-cols-2 gap-3">
          {SUB_SERVICE_OPTIONS.GUINCHO.map((option) => (
            <Card 
              key={option.id}
              className={`cursor-pointer transition-all hover:border-primary ${
                formData.subServiceType === option.id ? 'border-primary bg-primary/5' : ''
              }`}
              onClick={() => onUpdate('subServiceType', option.id)}
            >
              <CardContent className="p-3">
                <p className="font-medium text-sm">{option.name}</p>
                <p className="text-xs text-muted-foreground">{option.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Label>Situação do Veículo *</Label>
        <Select 
          value={formData.vehicle?.situation || ''} 
          onValueChange={(value) => onUpdate('vehicle.situation', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="O que aconteceu?" />
          </SelectTrigger>
          <SelectContent>
            {SUB_SERVICE_OPTIONS.VEHICLE_SITUATIONS.map((option) => (
              <SelectItem key={option.id} value={option.id}>
                {option.name} - {option.description}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Descreva o problema</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Conte mais detalhes sobre a situação..."
          rows={3}
        />
      </div>
    </div>
  );

  const renderFreteFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>O que você precisa transportar? *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva os itens que serão transportados..."
          rows={3}
        />
      </div>

      {serviceType === 'FRETE_MOTO' && (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-3 flex items-center gap-2">
            <Badge variant="outline" className="bg-amber-100 text-amber-800">
              Limite: 150kg
            </Badge>
            <span className="text-sm text-amber-800">Ideal para entregas rápidas e pequenos volumes</span>
          </CardContent>
        </Card>
      )}

    </div>
  );

  const renderMudancaFields = () => {
    // Se o tipo já foi selecionado no MudancaModal (MUDANCA_RESIDENCIAL/MUDANCA_COMERCIAL),
    // não mostrar a seleção duplicada de tipo
    const typeAlreadySelected = serviceType === 'MUDANCA_RESIDENCIAL' || serviceType === 'MUDANCA_COMERCIAL';

    return (
      <div className="space-y-4">
        {!typeAlreadySelected && (
          <div className="space-y-2">
            <Label>Tipo de Mudança *</Label>
            <div className="grid grid-cols-2 gap-3">
              <Card 
                className={`cursor-pointer transition-all hover:border-primary ${
                  formData.mudanca?.type === 'RESIDENCIAL' ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => onUpdate('mudanca.type', 'RESIDENCIAL')}
              >
                <CardContent className="p-4 text-center">
                  <span className="text-2xl">🏠</span>
                  <p className="font-medium mt-2">Residencial</p>
                  <p className="text-xs text-muted-foreground">Casa ou apartamento</p>
                </CardContent>
              </Card>
              <Card 
                className={`cursor-pointer transition-all hover:border-primary ${
                  formData.mudanca?.type === 'COMERCIAL' ? 'border-primary bg-primary/5' : ''
                }`}
                onClick={() => onUpdate('mudanca.type', 'COMERCIAL')}
              >
                <CardContent className="p-4 text-center">
                  <span className="text-2xl">🏢</span>
                  <p className="font-medium mt-2">Comercial</p>
                  <p className="text-xs text-muted-foreground">Escritório ou loja</p>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        <div className="space-y-2">
          <Label>Número de Cômodos *</Label>
          <Select 
            value={formData.mudanca?.rooms || ''} 
            onValueChange={(value) => onUpdate('mudanca.rooms', value)}
          >
            <SelectTrigger>
              <SelectValue placeholder="Quantos cômodos?" />
            </SelectTrigger>
            <SelectContent>
              {SUB_SERVICE_OPTIONS.ROOMS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Descrição geral</Label>
          <Textarea
            value={formData.problemDescription}
            onChange={(e) => onUpdate('problemDescription', e.target.value)}
            placeholder="Descreva o que será transportado, itens especiais, observações..."
            rows={3}
          />
        </div>
      </div>
    );
  };

  const renderAgriculturalFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Área em Hectares</Label>
        <Input
          type="number"
          value={formData.agricultural?.area || ''}
          onChange={(e) => onUpdate('agricultural.area', e.target.value)}
          placeholder="Ex: 50"
        />
      </div>

      <div className="space-y-2">
        <Label>Cultura</Label>
        <Select 
          value={formData.agricultural?.culture || ''} 
          onValueChange={(value) => onUpdate('agricultural.culture', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione a cultura" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="SOJA">Soja</SelectItem>
            <SelectItem value="MILHO">Milho</SelectItem>
            <SelectItem value="CAFE">Café</SelectItem>
            <SelectItem value="CANA">Cana-de-açúcar</SelectItem>
            <SelectItem value="ALGODAO">Algodão</SelectItem>
            <SelectItem value="OUTROS">Outros</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Descreva o serviço que precisa *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva detalhadamente o que você precisa..."
          rows={4}
        />
      </div>
    </div>
  );

  const renderTechnicalFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Equipamento *</Label>
        <Select 
          value={formData.technical?.equipmentType || ''} 
          onValueChange={(value) => onUpdate('technical.equipmentType', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="TRATOR">Trator</SelectItem>
            <SelectItem value="COLHEITADEIRA">Colheitadeira</SelectItem>
            <SelectItem value="PLANTADEIRA">Plantadeira</SelectItem>
            <SelectItem value="PULVERIZADOR">Pulverizador</SelectItem>
            <SelectItem value="CAMINHAO">Caminhão</SelectItem>
            <SelectItem value="OUTRO">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Descreva o problema *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva detalhadamente o problema ou serviço necessário..."
          rows={4}
        />
      </div>
    </div>
  );

  const renderContent = () => {
    // Guindaste: render specific fields regardless of fallback serviceType
    if (isGuindaste) {
      return (
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Descreva a operação de içamento/movimentação *</Label>
            <Textarea
              value={formData.problemDescription}
              onChange={(e) => onUpdate('problemDescription', e.target.value)}
              placeholder="Descreva o que precisa ser levantado ou movimentado, peso estimado, altura, condições de acesso..."
              rows={4}
            />
          </div>
        </div>
      );
    }

    switch (serviceType) {
      case 'GUINCHO':
        return renderGuinchoFields();
      case 'FRETE_MOTO':
      case 'FRETE_URBANO':
        return renderFreteFields();
      case 'MUDANCA_RESIDENCIAL':
      case 'MUDANCA_COMERCIAL':
        return renderMudancaFields();
      case 'SERVICO_AGRICOLA':
        return renderAgriculturalFields();
      case 'SERVICO_TECNICO':
        return renderTechnicalFields();
      default:
        return renderFreteFields();
    }
  };

  return (
    <div className="space-y-6">
      {renderContent()}
    </div>
  );
};
