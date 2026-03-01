import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Wrench, Plus } from 'lucide-react';
import DocumentUpload from './DocumentUpload';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface ServiceVehicleFormProps {
  companyId: string;
  onSuccess: () => void;
  editingVehicle?: any | null;
  onEditComplete?: () => void;
}

const SERVICE_VEHICLE_TYPES = {
  'GUINCHO': { name: 'Guincho', weight: 'Varia', axles: 2 },
  'REBOQUE': { name: 'Reboque', weight: 'Varia', axles: 2 },
  'SOCORRO_24H': { name: 'Socorro 24h', weight: 'N/A', axles: 2 },
  'TRANSPORTE_MOTO': { name: 'Transporte de Moto', weight: 'N/A', axles: 2 },
  'OUTROS_SERVICOS': { name: 'Outros Serviços', weight: 'N/A', axles: 2 },
};

export const ServiceVehicleForm: React.FC<ServiceVehicleFormProps> = ({
  companyId,
  onSuccess,
  editingVehicle,
  onEditComplete
}) => {
  const [vehicleType, setVehicleType] = useState('');
  const [serviceName, setServiceName] = useState('');
  const [licensePlate, setLicensePlate] = useState('');
  const [maxCapacity, setMaxCapacity] = useState('');
  const [specifications, setSpecifications] = useState('');
  const [vehicleDocuments, setVehicleDocuments] = useState<string[]>([]);
  const [vehiclePhotos, setVehiclePhotos] = useState<string[]>([]);
  const [crrlvUrl, setCrrlvUrl] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (editingVehicle) {
      // Extrair tipo de serviço das especificações
      const specs = editingVehicle.vehicle_specifications || '';
      const match = specs.match(/Tipo:\s*(.+?)(?:\n|$)/);
      if (match) {
        setServiceName(match[1]);
      }
      setVehicleType('OUTROS');
      setLicensePlate(editingVehicle.license_plate || '');
      setMaxCapacity(editingVehicle.max_capacity_tons?.toString() || '');
      setSpecifications(specs.replace(/Tipo:\s*.+?\n/, ''));
      setVehicleDocuments(editingVehicle.vehicle_documents || []);
      setVehiclePhotos(editingVehicle.vehicle_photos || []);
      setCrrlvUrl(editingVehicle.crlv_url || '');
    }
  }, [editingVehicle]);

  const resetForm = () => {
    setVehicleType('');
    setServiceName('');
    setLicensePlate('');
    setMaxCapacity('');
    setSpecifications('');
    setVehicleDocuments([]);
    setVehiclePhotos([]);
    setCrrlvUrl('');
  };

  const handleSubmit = async () => {
    if (!serviceName || !licensePlate) {
      toast.error('Preencha o tipo de serviço e a placa');
      return;
    }

    setLoading(true);
    try {
      const fullSpecs = `Tipo: ${serviceName}\n${specifications || ''}`.trim();
      
      const vehicleData = {
        company_id: companyId,
        vehicle_type: 'OUTROS' as any,
        license_plate: licensePlate.toUpperCase(),
        max_capacity_tons: maxCapacity ? parseFloat(maxCapacity) : null,
        axle_count: 2,
        vehicle_specifications: fullSpecs,
        vehicle_documents: vehicleDocuments,
        vehicle_photos: vehiclePhotos,
        crlv_url: crrlvUrl,
        is_company_vehicle: true,
        status: 'PENDING',
      };

      if (editingVehicle) {
        // UPDATE
        const { error } = await supabase
          .from('vehicles')
          .update(vehicleData)
          .eq('id', editingVehicle.id);

        if (error) throw error;
        toast.success('Veículo de serviço atualizado com sucesso');
        onEditComplete?.();
      } else {
        // INSERT
        const { error } = await supabase
          .from('vehicles')
          .insert({
            ...vehicleData,
            driver_id: companyId, // Usar company_id como fallback
          });

        if (error) throw error;
        toast.success('Veículo de serviço cadastrado com sucesso. Aguarde aprovação.');
      }

      resetForm();
      onSuccess();
    } catch (error: any) {
      console.error('Erro ao salvar veículo de serviço:', error);
      toast.error(error.message || 'Erro ao salvar veículo de serviço');
    } finally {
      setLoading(false);
    }
  };

  const selectedVehicleInfo = serviceName ? SERVICE_VEHICLE_TYPES[serviceName as keyof typeof SERVICE_VEHICLE_TYPES] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="h-5 w-5" />
          {editingVehicle ? 'Editar Veículo de Serviço' : 'Cadastrar Veículo de Serviço'}
        </CardTitle>
        <CardDescription>
          {editingVehicle ? 'Atualize as informações do veículo' : 'Cadastre veículos especializados (guinchos, reboques, socorro)'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Tipo de Veículo */}
        <div className="space-y-2">
          <Label htmlFor="service-vehicle-type">Tipo de Veículo/Serviço *</Label>
          <Select value={serviceName} onValueChange={setServiceName}>
            <SelectTrigger id="service-vehicle-type">
              <SelectValue placeholder="Selecione o tipo" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(SERVICE_VEHICLE_TYPES).map(([value, info]) => (
                <SelectItem key={value} value={value}>
                  <div className="flex items-center justify-between w-full">
                    <span>{info.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {selectedVehicleInfo && (
            <div className="p-3 bg-muted rounded-lg text-sm">
              <p className="font-semibold">{selectedVehicleInfo.name}</p>
            </div>
          )}
        </div>

        {/* Placa */}
        <div className="space-y-2">
          <Label htmlFor="service-license-plate">Placa do Veículo *</Label>
          <Input
            id="service-license-plate"
            placeholder="Ex: ABC1234"
            value={licensePlate}
            onChange={(e) => setLicensePlate(e.target.value.toUpperCase())}
            maxLength={7}
          />
        </div>

        {/* Capacidade (opcional para serviços) */}
        <div className="space-y-2">
          <Label htmlFor="service-capacity">Capacidade de Carga (toneladas)</Label>
          <Input
            id="service-capacity"
            type="number"
            step="0.1"
            placeholder="Ex: 3.5"
            value={maxCapacity}
            onChange={(e) => setMaxCapacity(e.target.value)}
          />
        </div>

        {/* Especificações */}
        <div className="space-y-2">
          <Label htmlFor="service-specifications">Especificações e Equipamentos</Label>
          <Textarea
            id="service-specifications"
            placeholder="Descreva equipamentos especiais, capacidades, áreas de atendimento, etc."
            value={specifications}
            onChange={(e) => setSpecifications(e.target.value)}
            rows={3}
          />
        </div>

        {/* CRLV */}
        <div className="space-y-2">
          <Label>CRLV (Certificado de Registro e Licenciamento) *</Label>
          <DocumentUpload
            label="CRLV"
            onUploadComplete={(url) => setCrrlvUrl(url)}
            accept="image/*,application/pdf"
          />
        </div>

        {/* Documentos Adicionais */}
        <div className="space-y-2">
          <Label>Documentos Adicionais</Label>
          <DocumentUpload
            label="Alvará, Certificações"
            onUploadComplete={(url) => setVehicleDocuments([...vehicleDocuments, url])}
            accept="image/*,application/pdf"
          />
          {vehicleDocuments.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {vehicleDocuments.length} documento(s) anexado(s)
            </p>
          )}
        </div>

        {/* Fotos */}
        <div className="space-y-2">
          <Label>Fotos do Veículo</Label>
          <DocumentUpload
            label="Fotos do veículo e equipamentos"
            onUploadComplete={(url) => setVehiclePhotos([...vehiclePhotos, url])}
            accept="image/*"
          />
          {vehiclePhotos.length > 0 && (
            <div className="grid grid-cols-4 gap-2 mt-2">
              {vehiclePhotos.map((photo, i) => (
                <img
                  key={i}
                  src={photo}
                  alt={`Foto ${i + 1}`}
                  className="rounded object-cover aspect-square border"
                />
              ))}
            </div>
          )}
        </div>

        {/* Botão de envio */}
        <Button
          onClick={handleSubmit}
          disabled={!serviceName || !licensePlate || loading}
          className="w-full"
        >
          {loading ? (
            'Salvando...'
          ) : editingVehicle ? (
            'Atualizar Veículo'
          ) : (
            <>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Veículo de Serviço
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
};
