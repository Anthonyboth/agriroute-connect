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
  catalogServiceId?: string;
}

// ============================================================
// Serviços que precisam de campos agrícolas (hectares, cultura)
// ============================================================
const AGRICULTURAL_FIELD_SERVICES = new Set([
  'PULVERIZACAO_DRONE',
  'COLHEITA_PLANTIO_TERCEIRIZADA',
  'ANALISE_SOLO',
  'AGRONOMO',
  'ASSISTENCIA_TECNICA',
  'PIVO_IRRIGACAO',
  'SECAGEM_GRAOS',
  'CLASSIFICACAO_GRAOS',
  'ARMAZENAGEM',
  'OPERADOR_MAQUINAS',
  'TOPOGRAFIA_RURAL',
]);

// ============================================================
// Serviços de reparo de veículos/máquinas (tipo de veículo)
// ============================================================
const VEHICLE_REPAIR_SERVICES = new Set([
  'BORRACHEIRO',
  'MECANICO',
  'AUTO_ELETRICA',
  'MECANICO_INDUSTRIAL',
  'CHAVEIRO',
]);

// ============================================================
// Serviços veterinários
// ============================================================
const VETERINARY_SERVICES = new Set([
  'SERVICOS_VETERINARIOS',
]);

// ============================================================
// Serviços de construção/terraplenagem (área + descrição)
// ============================================================
const CONSTRUCTION_SERVICES = new Set([
  'TERRAPLENAGEM',
  'CONSTRUCAO_MANUTENCAO_CERCAS',
  'LIMPEZA_DESASSOREAMENTO_REPRESAS',
]);

// ============================================================
// Serviços de instalação/técnicos (equipamento + descrição)
// ============================================================
const INSTALLATION_SERVICES = new Set([
  'ENERGIA_SOLAR',
  'CFTV_SEGURANCA',
  'CONSULTORIA_TI',
  'AUTOMACAO_INDUSTRIAL',
  'MANUTENCAO_BALANCAS',
  'MANUTENCAO_REVISAO_GPS',
  'TORNEARIA_SOLDA_REPAROS',
  'GUINDASTE',
  'CARREGAMENTO_DESCARREGAMENTO',
]);

const VEHICLE_TYPES_FOR_REPAIR = [
  { value: 'CARRO', label: 'Carro / Caminhonete' },
  { value: 'MOTO', label: 'Moto' },
  { value: 'CAMINHAO', label: 'Caminhão' },
  { value: 'VAN', label: 'Van / Utilitário' },
  { value: 'TRATOR', label: 'Trator' },
  { value: 'COLHEITADEIRA', label: 'Colheitadeira' },
  { value: 'IMPLEMENTO', label: 'Implemento Agrícola' },
  { value: 'OUTRO', label: 'Outro' },
];

const ANIMAL_TYPES = [
  { value: 'BOVINO', label: 'Bovinos (gado)' },
  { value: 'EQUINO', label: 'Equinos (cavalos)' },
  { value: 'SUINO', label: 'Suínos (porcos)' },
  { value: 'AVES', label: 'Aves' },
  { value: 'OVINO', label: 'Ovinos / Caprinos' },
  { value: 'PET', label: 'Pet (cão, gato)' },
  { value: 'OUTRO', label: 'Outro' },
];

export const Step1ServiceType: React.FC<Step1Props> = ({ formData, onUpdate, serviceType, catalogServiceId }) => {
  const isGuindaste = formData.subServiceType === 'GUINDASTE' || formData.subServiceType === 'Guindaste';
  
  // Determinar qual formulário contextual exibir baseado no catalogServiceId real
  const effectiveServiceId = catalogServiceId || '';

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

  // ============================================================
  // CAMPOS AGRÍCOLAS: hectares, cultura, descrição
  // ============================================================
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

  // ============================================================
  // CAMPOS PARA REPARO DE VEÍCULOS: tipo de veículo, descrição do problema
  // ============================================================
  const renderVehicleRepairFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Veículo / Máquina *</Label>
        <Select 
          value={formData.vehicle?.type || ''} 
          onValueChange={(value) => onUpdate('vehicle.type', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo de veículo" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES_FOR_REPAIR.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Placa do Veículo (opcional)</Label>
        <Input
          value={formData.vehicle?.plate || ''}
          onChange={(e) => onUpdate('vehicle.plate', e.target.value.toUpperCase())}
          placeholder="Ex: ABC-1234"
          maxLength={8}
        />
      </div>

      <div className="space-y-2">
        <Label>Descreva o problema *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva o que está acontecendo com o veículo/máquina..."
          rows={4}
        />
      </div>
    </div>
  );

  // ============================================================
  // CAMPOS VETERINÁRIOS: tipo de animal, quantidade, descrição
  // ============================================================
  const renderVeterinaryFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Tipo de Animal *</Label>
        <Select 
          value={formData.agricultural?.culture || ''} 
          onValueChange={(value) => onUpdate('agricultural.culture', value)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo de animal" />
          </SelectTrigger>
          <SelectContent>
            {ANIMAL_TYPES.map((option) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Quantidade de Animais</Label>
        <Input
          type="number"
          value={formData.agricultural?.area || ''}
          onChange={(e) => onUpdate('agricultural.area', e.target.value)}
          placeholder="Ex: 5"
        />
      </div>

      <div className="space-y-2">
        <Label>Descreva a necessidade *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva os sintomas, urgência, tipo de atendimento necessário..."
          rows={4}
        />
      </div>
    </div>
  );

  // ============================================================
  // CAMPOS DE CONSTRUÇÃO/TERRAPLENAGEM: área, descrição
  // ============================================================
  const renderConstructionFields = () => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>Área estimada (m² ou hectares)</Label>
        <Input
          value={formData.agricultural?.area || ''}
          onChange={(e) => onUpdate('agricultural.area', e.target.value)}
          placeholder="Ex: 500m² ou 2 hectares"
        />
      </div>

      <div className="space-y-2">
        <Label>Descreva o serviço que precisa *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva o tipo de trabalho, terreno, acesso ao local..."
          rows={4}
        />
      </div>
    </div>
  );

  // ============================================================
  // CAMPOS DE INSTALAÇÃO/TÉCNICOS: tipo de equipamento + descrição
  // ============================================================
  const renderInstallationFields = () => (
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
            <SelectItem value="SISTEMA_ELETRICO">Sistema Elétrico</SelectItem>
            <SelectItem value="CAMERAS_CFTV">Câmeras / CFTV</SelectItem>
            <SelectItem value="REDE_INTERNET">Rede / Internet</SelectItem>
            <SelectItem value="PAINEL_SOLAR">Painel Solar</SelectItem>
            <SelectItem value="BALANCA">Balança</SelectItem>
            <SelectItem value="GPS">GPS / Sistema de Navegação</SelectItem>
            <SelectItem value="OUTRO">Outro</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>Descreva o problema ou serviço necessário *</Label>
        <Textarea
          value={formData.problemDescription}
          onChange={(e) => onUpdate('problemDescription', e.target.value)}
          placeholder="Descreva detalhadamente o que precisa ser feito..."
          rows={4}
        />
      </div>
    </div>
  );

  // ============================================================
  // CAMPOS GENÉRICOS (fallback): apenas descrição
  // ============================================================
  const renderGenericFields = () => (
    <div className="space-y-4">
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

    // ✅ Para serviços do catálogo (agrícola/técnico), usar catalogServiceId para determinar campos
    if (effectiveServiceId && (serviceType === 'SERVICO_AGRICOLA' || serviceType === 'SERVICO_TECNICO')) {
      if (VEHICLE_REPAIR_SERVICES.has(effectiveServiceId)) {
        return renderVehicleRepairFields();
      }
      if (VETERINARY_SERVICES.has(effectiveServiceId)) {
        return renderVeterinaryFields();
      }
      if (AGRICULTURAL_FIELD_SERVICES.has(effectiveServiceId)) {
        return renderAgriculturalFields();
      }
      if (CONSTRUCTION_SERVICES.has(effectiveServiceId)) {
        return renderConstructionFields();
      }
      if (INSTALLATION_SERVICES.has(effectiveServiceId)) {
        return renderInstallationFields();
      }
      // Fallback genérico para serviços não categorizados
      return renderGenericFields();
    }

    // Fluxo original para serviços com serviceType específico (guincho, frete, mudança, etc.)
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
        return renderInstallationFields();
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
