import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Info, Edit, X } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import { toast } from 'sonner';
import { VEHICLE_TYPES, getVehicleTypeInfo } from '@/lib/vehicle-types';

interface AdvancedVehicleManagerProps {
  onVehicleAdd: (vehicleData: any) => void;
  editingVehicle?: any | null;
  onEditComplete?: () => void;
}

export const AdvancedVehicleManager: React.FC<AdvancedVehicleManagerProps> = ({
  onVehicleAdd,
  editingVehicle,
  onEditComplete
}) => {
  const formRef = useRef<HTMLDivElement>(null);
  const [vehicleType, setVehicleType] = useState('');
  const [customVehicleType, setCustomVehicleType] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [axleCount, setAxleCount] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [vehicleDocuments, setVehicleDocuments] = useState<string[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);
  const [crrlvUrl, setCrrlvUrl] = useState('');

  useEffect(() => {
    if (editingVehicle) {
      setVehicleType(editingVehicle.vehicle_type || '');
      setLicensePlate(editingVehicle.license_plate || '');
      setAxleCount(editingVehicle.axle_count?.toString() || '');
      setMaxCapacity(editingVehicle.max_capacity_tons?.toString() || '');
      setSpecifications(editingVehicle.vehicle_specifications || '');
      setVehicleDocuments(editingVehicle.vehicle_documents || []);
      setVehiclePhotos(editingVehicle.vehicle_photos || []);
      setCrrlvUrl(editingVehicle.crlv_url || '');
    }
  }, [editingVehicle]);

  const resetForm = () => {
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

  const handleAddVehicle = () => {
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

    if (editingVehicle) {
      onVehicleAdd({ ...vehicleData, id: editingVehicle.id });
      toast.success('Veículo atualizado com sucesso!');
      onEditComplete?.();
    } else {
      onVehicleAdd(vehicleData);
      toast.success('Veículo cadastrado com sucesso!');
    }

    resetForm();
  };

  const selectedVehicleInfo = vehicleType && vehicleType !== 'OUTROS' ? getVehicleTypeInfo(vehicleType) : null;

  return (
    <div ref={formRef} className="space-y-6">
      {/* Indicador de modo edição */}
      {editingVehicle && (
        <Alert className="border-warning bg-warning/10">
          <Edit className="h-4 w-4 text-warning" />
          <AlertDescription className="flex items-center justify-between">
            <span className="font-medium text-warning">
              Editando veículo: {editingVehicle.license_plate}
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                resetForm();
                onEditComplete?.();
              }}
              className="h-7 text-warning hover:text-warning/80"
            >
              <X className="h-4 w-4 mr-1" />
              Cancelar edição
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Tipo de Veículo */}
      <div className="space-y-3">
        <Label>Tipo de Veículo *</Label>
        <Select value={vehicleType} onValueChange={setVehicleType}>
          <SelectTrigger>
            <SelectValue placeholder="Selecione o tipo do seu veículo" />
          </SelectTrigger>
          <SelectContent>
            {VEHICLE_TYPES.map((vType) => (
              <SelectItem key={vType.value} value={vType.value}>
                <div className="flex items-center justify-between w-full">
                  <span>{vType.label}</span>
                  <Badge variant="secondary" className="ml-2">
                    {vType.weight}
                  </Badge>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {selectedVehicleInfo && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="font-medium text-blue-900 dark:text-blue-100">
                  {selectedVehicleInfo.label}
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

      {/* Especificações técnicas */}
      {vehicleType !== 'OUTROS' && (
        <div className="space-y-2">
          <Label>Especificações Técnicas</Label>
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

      <div className="flex gap-2 pt-2">
        {editingVehicle && (
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
              onEditComplete?.();
            }}
            className="flex-1"
          >
            Cancelar
          </Button>
        )}
        <Button
          onClick={handleAddVehicle}
          className={editingVehicle ? 'flex-1' : 'w-full'}
          disabled={
            !vehicleType || 
            !licensePlate || 
            !axleCount || 
            !maxCapacity || 
            (vehicleType === 'OUTROS' && !specifications)
          }
        >
          <Plus className="mr-2 h-4 w-4" />
          {editingVehicle ? 'Atualizar Veículo' : 'Adicionar Veículo'}
        </Button>
      </div>
    </div>
  );
};
