import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Truck, Plus, Info } from 'lucide-react';
import DocumentUpload from './DocumentUpload';

interface AdvancedVehicleManagerProps {
  onVehicleAdd: (vehicleData: any) => void;
}

export const AdvancedVehicleManager: React.FC<AdvancedVehicleManagerProps> = ({
  onVehicleAdd
}) => {
  const [vehicleType, setVehicleType] = useState('');
  const [customVehicleType, setCustomVehicleType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [axleCount, setAxleCount] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [vehicleDocuments, setVehicleDocuments] = useState<string[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);
  const [crrlvUrl, setCrrlvUrl] = useState('');

  // Tipos de veículos com pesos e especificações
  const vehicleTypes = {
    'TRUCK': { 
      name: 'Truck/Toco', 
      weight: '16t', 
      axles: '3 eixos',
      specs: 'Caminhão truck para cargas gerais, ideal para distâncias médias e urbano'
    },
    'CARRETA_SIMPLES': { 
      name: 'Carreta Simples', 
      weight: '45t', 
      axles: '5 eixos',
      specs: 'Carreta básica para transporte de grãos e cargas secas'
    },
    'CARRETA_7_EIXOS': { 
      name: 'Carreta 7 Eixos', 
      weight: '74t', 
      axles: '7 eixos',
      specs: 'Carreta para cargas pesadas, alta capacidade de carga'
    },
    'RODOTREM_9_EIXOS': { 
      name: 'Rodotrem 9 Eixos', 
      weight: '91t', 
      axles: '9 eixos',
      specs: 'Maior capacidade de carga, ideal para longas distâncias'
    },
    'CARRETA_TANQUE': { 
      name: 'Carreta Tanque', 
      weight: '45t', 
      axles: '5-7 eixos',
      specs: 'Para transporte de líquidos: combustíveis, óleos, produtos químicos'
    },
    'CARRETA_FRIGORIFICO': { 
      name: 'Carreta Frigorífico', 
      weight: '45t', 
      axles: '5 eixos',
      specs: 'Transporte refrigerado/congelado de alimentos e medicamentos'
    },
    'CARRETA_GADO': { 
      name: 'Carreta para Gado', 
      weight: '45t', 
      axles: '5-6 eixos',
      specs: 'Transporte de animais vivos com ventilação adequada'
    },
    'CARRETA_CAVALOS': { 
      name: 'Carreta para Cavalos', 
      weight: '30t', 
      axles: '4-5 eixos',
      specs: 'Transporte especializado de equinos com compartimentos individuais'
    },
    'PRANCHA': { 
      name: 'Prancha/Prancha Rebaixada', 
      weight: '45-60t', 
      axles: '5-7 eixos',
      specs: 'Para máquinas pesadas, equipamentos e veículos'
    },
    'VUC': { 
      name: 'VUC (3/4)', 
      weight: '3,5t', 
      axles: '2 eixos',
      specs: 'Veículo urbano de carga para entregas na cidade'
    },
    'PICKUP': { 
      name: 'Pickup', 
      weight: '1,5t', 
      axles: '2 eixos',
      specs: 'Veículo leve para cargas pequenas e entregas rápidas'
    }
  };

  const handleAddVehicle = () => {
    const finalVehicleType = vehicleType === 'OTHER' ? customVehicleType : vehicleType;
    
    const vehicleData = {
      vehicle_type: finalVehicleType,
      license_plate: licensePlate,
      axle_count: parseInt(axleCount) || 2,
      max_capacity_tons: parseFloat(maxCapacity) || 0,
      vehicle_specifications: specifications,
      vehicle_documents: vehicleDocuments,
      vehicle_photos: vehiclePhotos,
      crlv_url: crrlvUrl
    };

    onVehicleAdd(vehicleData);
    
    // Reset form
    setVehicleType('');
    setCustomVehicleType('');
    setLicensePlate('');
    setAxleCount('');
    setMaxCapacity('');
    setSpecifications('');
    setVehicleDocuments([]);
    setVehiclePhotos([]);
    setCrrlvUrl('');
  };

  const selectedVehicleInfo = vehicleType !== 'OTHER' && vehicleType ? vehicleTypes[vehicleType as keyof typeof vehicleTypes] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Dados do Veículo
        </CardTitle>
        <CardDescription>
          Adicione informações completas do seu veículo para melhor matchmaking
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Tipo de Veículo */}
        <div className="space-y-3">
          <Label>Tipo de Veículo *</Label>
          <Select value={vehicleType} onValueChange={setVehicleType}>
            <SelectTrigger>
              <SelectValue placeholder="Selecione o tipo do seu veículo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(vehicleTypes).map(([key, info]) => (
                <SelectItem key={key} value={key}>
                  <div className="flex items-center justify-between w-full">
                    <span>{info.name}</span>
                    <Badge variant="secondary" className="ml-2">
                      {info.weight}
                    </Badge>
                  </div>
                </SelectItem>
              ))}
              <SelectItem value="OTHER">Outro (especificar)</SelectItem>
            </SelectContent>
          </Select>

          {/* Informações do tipo selecionado */}
          {selectedVehicleInfo && (
            <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  <p className="font-medium text-blue-900 dark:text-blue-100">
                    {selectedVehicleInfo.name}
                  </p>
                  <p className="text-sm text-blue-800 dark:text-blue-200">
                    Capacidade: {selectedVehicleInfo.weight} • {selectedVehicleInfo.axles}
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {selectedVehicleInfo.specs}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Campo customizado */}
          {vehicleType === 'OTHER' && (
            <div className="space-y-2">
              <Label>Especifique o Tipo de Veículo *</Label>
              <Input
                placeholder="Ex: Bitrem 7 eixos, Carreta especial..."
                value={customVehicleType}
                onChange={(e) => setCustomVehicleType(e.target.value)}
              />
            </div>
          )}
        </div>

        <Separator />

        {/* Dados básicos */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <Label>Placa do Veículo *</Label>
            <Input
              placeholder="ABC-1234"
              value={licensePlate}
              onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2">
            <Label>Número de Eixos *</Label>
            <Input
              type="number"
              placeholder="Ex: 5"
              value={axleCount}
              onChange={(e) => setAxleCount(e.target.value)}
              min="2"
              max="12"
            />
          </div>

          <div className="space-y-2">
            <Label>Capacidade Máxima (toneladas) *</Label>
            <Input
              type="number"
              placeholder="Ex: 45"
              value={maxCapacity}
              onChange={(e) => setMaxCapacity(e.target.value)}
              step="0.5"
              min="0.5"
            />
          </div>
        </div>

        {/* Especificações técnicas */}
        <div className="space-y-2">
          <Label>Especificações Técnicas</Label>
          <Textarea
            placeholder="Descreva características especiais: equipamentos, modificações, restrições..."
            value={specifications}
            onChange={(e) => setSpecifications(e.target.value)}
            rows={3}
          />
        </div>

        <Separator />

        {/* Documentação */}
        <div className="space-y-4">
          <h4 className="font-medium">Documentação do Veículo</h4>
          
          <DocumentUpload
            onUploadComplete={(url) => setCrrlvUrl(url)}
            label="CRLV (Certificado de Registro e Licenciamento)"
            fileType="crlv"
            accept="image/*,application/pdf"
            required
          />

          <DocumentUpload
            onUploadComplete={(url) => setVehicleDocuments([...vehicleDocuments, url])}
            label="Documentos Adicionais"
            fileType="vehicle_docs"
            accept="image/*,application/pdf"
          />
        </div>

        {/* Fotos do veículo */}
        <div className="space-y-4">
          <h4 className="font-medium">Fotos do Veículo</h4>
          <p className="text-sm text-muted-foreground">
            Adicione múltiplas fotos (mínimo 3): lateral, frontal, traseira, placa, equipamentos
          </p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1, 2, 3, 4].map((index) => (
              <DocumentUpload
                key={`vehicle-photo-${index}`}
                onUploadComplete={(url) => setVehiclePhotos([...vehiclePhotos, url])}
                label={`Foto ${index}${index <= 3 ? ' (obrigatória)' : ' (opcional)'}`}
                fileType={`vehicle_photo_${index}`}
                accept="image/*"
                required={index <= 3}
              />
            ))}
          </div>
        </div>

        <Button
          onClick={handleAddVehicle}
          className="w-full gradient-primary"
          disabled={!vehicleType || !licensePlate || !axleCount || !maxCapacity}
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Veículo
        </Button>
      </CardContent>
    </Card>
  );
};