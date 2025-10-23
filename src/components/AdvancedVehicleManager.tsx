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
import { toast } from 'sonner';

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

  // Tipos de veículos com pesos e especificações - ATUALIZADO COM TODOS OS TIPOS BRASILEIROS
  const vehicleTypes = {
    'TOCO': { 
      name: 'Toco', 
      weight: '16t', 
      axles: 3,
      specs: 'Caminhão toco para cargas gerais, ideal para distâncias médias e urbano'
    },
    'TRUCK': { 
      name: 'Truck', 
      weight: '23t', 
      axles: 3,
      specs: 'Caminhão truck para cargas gerais, ideal para distâncias médias'
    },
    'CARRETA': { 
      name: 'Carreta (Genérica)', 
      weight: '45t', 
      axles: 5,
      specs: 'Carreta padrão para transporte geral'
    },
    'CARRETA_2_EIXOS': { 
      name: 'Carreta 2 Eixos', 
      weight: '30t', 
      axles: 4,
      specs: 'Carreta leve para cargas médias'
    },
    'CARRETA_3_EIXOS': { 
      name: 'Carreta 3 Eixos', 
      weight: '45t', 
      axles: 5,
      specs: 'Carreta básica para transporte de grãos e cargas secas'
    },
    'CARRETA_SIDER': { 
      name: 'Carreta Sider', 
      weight: '45t', 
      axles: 5,
      specs: 'Lona lateral para carga/descarga rápida'
    },
    'CARRETA_GRANELEIRA': { 
      name: 'Carreta Graneleira', 
      weight: '45t', 
      axles: 5,
      specs: 'Para grãos, rações e produtos a granel'
    },
    'CARRETA_PRANCHA': { 
      name: 'Carreta Prancha', 
      weight: '50t', 
      axles: 5,
      specs: 'Plataforma aberta para máquinas e equipamentos'
    },
    'CARRETA_TANQUE': { 
      name: 'Carreta Tanque', 
      weight: '45t', 
      axles: 5,
      specs: 'Para transporte de líquidos: combustíveis, óleos, produtos químicos'
    },
    'CARRETA_FRIGORIFICA': { 
      name: 'Carreta Frigorífica', 
      weight: '45t', 
      axles: 5,
      specs: 'Transporte refrigerado/congelado de alimentos e medicamentos'
    },
    'RODOTREM': { 
      name: 'Rodotrem (Genérico)', 
      weight: '74t', 
      axles: 7,
      specs: 'Rodotrem padrão para longas distâncias'
    },
    'RODOTREM_7_EIXOS': { 
      name: 'Rodotrem 7 Eixos', 
      weight: '74t', 
      axles: 7,
      specs: 'Cavalo + 2 semi-reboques para longas distâncias'
    },
    'RODOTREM_9_EIXOS': { 
      name: 'Rodotrem 9 Eixos', 
      weight: '91t', 
      axles: 9,
      specs: 'Maior capacidade de carga, ideal para longas distâncias'
    },
    'BITREM': { 
      name: 'Bitrem (Genérico)', 
      weight: '57t', 
      axles: 7,
      specs: 'Bitrem padrão para transporte de grãos'
    },
    'BITREM_7_EIXOS': { 
      name: 'Bitrem 7 Eixos', 
      weight: '74t', 
      axles: 7,
      specs: 'Caminhão + 2 reboques para alta capacidade'
    },
    'BITREM_9_EIXOS': { 
      name: 'Bitrem 9 Eixos', 
      weight: '91t', 
      axles: 9,
      specs: 'Caminhão + 2 reboques longos para máxima capacidade'
    },
    'TRITREM_9_EIXOS': { 
      name: 'Tritrem 9 Eixos', 
      weight: '91t', 
      axles: 9,
      specs: 'Cavalo + 3 semi-reboques para grandes volumes'
    },
    'TRITREM_11_EIXOS': { 
      name: 'Tritrem 11 Eixos', 
      weight: '110t', 
      axles: 11,
      specs: 'Cavalo + 3 semi-reboques longos - máxima capacidade'
    },
    'CAVALO_MECANICO_TOCO': { 
      name: 'Cavalo Mecânico Toco', 
      weight: '23t', 
      axles: 3,
      specs: 'Para puxar semi-reboques - configuração toco'
    },
    'CAVALO_MECANICO_TRUCK': { 
      name: 'Cavalo Mecânico Truck', 
      weight: '30t', 
      axles: 3,
      specs: 'Para puxar semi-reboques - configuração truck'
    },
    'CAMINHAO_3_4': { 
      name: 'Caminhão 3/4', 
      weight: '6t', 
      axles: 2,
      specs: 'Transporte urbano e regional de cargas médias'
    },
    'CAMINHAO_TRUCK': { 
      name: 'Caminhão Truck', 
      weight: '14t', 
      axles: 3,
      specs: 'Caminhão para transporte regional'
    },
    'CAMINHONETE': { 
      name: 'Caminhonete', 
      weight: '3,5t', 
      axles: 2,
      specs: 'Cargas leves e pequenos volumes'
    },
    'VUC': { 
      name: 'VUC (Veículo Urbano de Carga)', 
      weight: '3,5t', 
      axles: 2,
      specs: 'Veículo urbano de carga para entregas na cidade'
    },
    'VLC_URBANO': { 
      name: 'VLC Urbano', 
      weight: '2,5t', 
      axles: 2,
      specs: 'Veículo leve de carga para entregas urbanas'
    },
    'PICKUP': { 
      name: 'Pickup', 
      weight: '1,5t', 
      axles: 2,
      specs: 'Veículo leve para cargas pequenas e entregas rápidas'
    },
    'OUTROS': { 
      name: 'Outros', 
      weight: 'Variável', 
      axles: 0,
      specs: 'Tipo de veículo não especificado na lista - descreva nas especificações'
    }
  };

  const handleAddVehicle = () => {
    // Para OUTROS, garantir que tem especificação
    if (vehicleType === 'OUTROS' && !specifications) {
      toast.error('Para o tipo "Outros", descreva o veículo nas especificações');
      return;
    }
    
    const vehicleData = {
      vehicle_type: vehicleType,
      license_plate: licensePlate,
      axle_count: parseInt(axleCount) || 2,
      max_capacity_tons: parseFloat(maxCapacity) || 0,
      vehicle_specifications: vehicleType === 'OUTROS' 
        ? specifications || 'Tipo não especificado'
        : specifications,
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

  const selectedVehicleInfo = vehicleType && vehicleType !== 'OUTROS' ? vehicleTypes[vehicleType as keyof typeof vehicleTypes] : null;

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
                    Capacidade: {selectedVehicleInfo.weight} • {selectedVehicleInfo.axles} eixos
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300">
                    {selectedVehicleInfo.specs}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Campo para OUTROS - Especificação obrigatória */}
          {vehicleType === 'OUTROS' && (
            <div className="space-y-2">
              <Label>Descrição do Veículo *</Label>
              <Textarea
                placeholder="Exemplo: Caminhão com implemento especial, 12 eixos, Tritrem customizado, etc."
                value={specifications}
                onChange={(e) => setSpecifications(e.target.value)}
                rows={3}
                className="border-orange-300 focus:border-orange-500"
              />
              <p className="text-sm text-orange-600 dark:text-orange-400">
                ⚠️ Obrigatório: Descreva o tipo de veículo que não está listado acima
              </p>
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

        {/* Especificações técnicas - oculto quando tipo é OUTROS (já mostra acima) */}
        {vehicleType !== 'OUTROS' && (
          <div className="space-y-2">
            <Label>Especificações Técnicas {vehicleType === 'OUTROS' && '*'}</Label>
            <Textarea
              placeholder="Descreva características especiais: equipamentos, modificações, restrições..."
              value={specifications}
              onChange={(e) => setSpecifications(e.target.value)}
              rows={3}
            />
          </div>
        )}

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
          disabled={
            !vehicleType || 
            !licensePlate || 
            !axleCount || 
            !maxCapacity || 
            (vehicleType === 'OUTROS' && !specifications)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          Adicionar Veículo
        </Button>
      </CardContent>
    </Card>
  );
};