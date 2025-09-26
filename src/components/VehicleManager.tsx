import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Truck, Plus, Edit, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentUpload } from '@/components/DocumentUpload';

const VEHICLE_TYPES = [
  { value: 'VUC', label: 'Caminhão 3/4' },
  { value: 'TRUCK', label: 'Caminhão Truck' },
  { value: 'CARRETA', label: 'Semirreboque' },
  { value: 'CARRETA_BAU', label: 'Carreta Baú para Mudanças' },
  { value: 'BITREM', label: 'Bitruck' },
  { value: 'RODOTREM', label: 'Rodotrem' },
  { value: 'TOCO', label: 'Toco' },
  { value: 'F400', label: 'Ford F-400' },
  { value: 'STRADA', label: 'Fiat Strada' },
  { value: 'CARRO_PEQUENO', label: 'Carro Pequeno para Fretes Urbanos' }
];

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  max_capacity_tons: number;
  axle_count: number;
  status: string;
  crlv_url?: string;
  vehicle_photo_url?: string;
}

interface VehicleManagerProps {
  driverProfile: any;
}

export const VehicleManager: React.FC<VehicleManagerProps> = ({ driverProfile }) => {
  const { toast } = useToast();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [vehicleData, setVehicleData] = useState({
    license_plate: '',
    vehicle_type: '',
    max_capacity_tons: 0,
    axle_count: 2,
    crlv_url: '',
    vehicle_photo_url: ''
  });

  const fetchVehicles = async () => {
    if (!driverProfile?.id) return;

    try {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('driver_id', driverProfile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setVehicles(data || []);
    } catch (error: any) {
      console.error('Erro ao carregar veículos:', error);
    }
  };

  const resetForm = () => {
    setVehicleData({
      license_plate: '',
      vehicle_type: '',
      max_capacity_tons: 0,
      axle_count: 2,
      crlv_url: '',
      vehicle_photo_url: ''
    });
    setEditingVehicle(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile?.id) return;

    setLoading(true);
    try {
      const vehiclePayload = {
        ...vehicleData,
        driver_id: driverProfile.id
      };

      if (editingVehicle) {
        const { error } = await supabase
          .from('vehicles')
          .update({
            ...vehiclePayload,
            vehicle_type: vehiclePayload.vehicle_type as any
          })
          .eq('id', editingVehicle.id);

        if (error) throw error;
        
        toast({
          title: "Veículo atualizado",
          description: "As informações do veículo foram atualizadas com sucesso.",
        });
      } else {
        const { error } = await supabase
          .from('vehicles')
          .insert({
            ...vehiclePayload,
            vehicle_type: vehiclePayload.vehicle_type as any
          });

        if (error) throw error;
        
        toast({
          title: "Veículo cadastrado",
          description: "O veículo foi cadastrado com sucesso.",
        });
      }

      resetForm();
      setIsAddModalOpen(false);
      fetchVehicles();
    } catch (error: any) {
      console.error('Error saving vehicle:', error);
      toast({
        title: "Erro ao salvar veículo",
        description: "Não foi possível salvar o veículo. Verifique os dados e tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (vehicle: Vehicle) => {
    setVehicleData({
      license_plate: vehicle.license_plate,
      vehicle_type: vehicle.vehicle_type,
      max_capacity_tons: vehicle.max_capacity_tons,
      axle_count: vehicle.axle_count,
      crlv_url: vehicle.crlv_url || '',
      vehicle_photo_url: vehicle.vehicle_photo_url || ''
    });
    setEditingVehicle(vehicle);
    setIsAddModalOpen(true);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'PENDING': { label: 'Pendente', variant: 'secondary' as const },
      'APPROVED': { label: 'Aprovado', variant: 'default' as const },
      'REJECTED': { label: 'Rejeitado', variant: 'destructive' as const }
    };
    
    const statusInfo = statusMap[status as keyof typeof statusMap] || { label: status, variant: 'secondary' as const };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getVehicleTypeLabel = (type: string) => {
    return VEHICLE_TYPES.find(v => v.value === type)?.label || type;
  };

  useEffect(() => {
    fetchVehicles();
  }, [driverProfile]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Meus Veículos</h3>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button onClick={resetForm}>
              <Plus className="h-4 w-4 mr-2" />
              Adicionar Veículo
            </Button>
          </DialogTrigger>
          
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>
                {editingVehicle ? 'Editar Veículo' : 'Cadastrar Novo Veículo'}
              </DialogTitle>
              <DialogDescription>
                Preencha as informações do seu veículo para transporte de cargas.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="license_plate">Placa do Veículo</Label>
                  <Input
                    id="license_plate"
                    placeholder="ABC-1234"
                    value={vehicleData.license_plate}
                    onChange={(e) => setVehicleData(prev => ({ 
                      ...prev, 
                      license_plate: e.target.value.toUpperCase() 
                    }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="vehicle_type">Tipo de Veículo</Label>
                  <Select
                    value={vehicleData.vehicle_type}
                    onValueChange={(value) => setVehicleData(prev => ({ 
                      ...prev, 
                      vehicle_type: value 
                    }))}
                    required
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o tipo" />
                    </SelectTrigger>
                    <SelectContent>
                      {VEHICLE_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="max_capacity">Capacidade (toneladas)</Label>
                  <Input
                    id="max_capacity"
                    type="number"
                    min="1"
                    max="100"
                    step="0.5"
                    value={vehicleData.max_capacity_tons}
                    onChange={(e) => setVehicleData(prev => ({ 
                      ...prev, 
                      max_capacity_tons: Number(e.target.value) 
                    }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="axle_count">Número de Eixos</Label>
                  <Input
                    id="axle_count"
                    type="number"
                    min="2"
                    max="9"
                    value={vehicleData.axle_count}
                    onChange={(e) => setVehicleData(prev => ({ 
                      ...prev, 
                      axle_count: Number(e.target.value) 
                    }))}
                    required
                  />
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Documentos do Veículo</h4>
                
                <DocumentUpload
                  label="CRLV (Certificado de Registro)"
                  fileType="crlv"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setVehicleData(prev => ({ ...prev, crlv_url: url }))}
                />

                <DocumentUpload
                  label="Foto do Veículo"
                  fileType="vehicle_photo"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setVehicleData(prev => ({ ...prev, vehicle_photo_url: url }))}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => setIsAddModalOpen(false)}
                  className="flex-1"
                >
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={loading}
                  className="flex-1"
                >
                  {loading ? 'Salvando...' : editingVehicle ? 'Atualizar' : 'Cadastrar'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {vehicles.map((vehicle) => (
          <Card key={vehicle.id}>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="h-5 w-5" />
                  {vehicle.license_plate}
                </CardTitle>
                {getStatusBadge(vehicle.status)}
              </div>
            </CardHeader>
            
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Tipo:</span>
                  <p className="font-medium">{getVehicleTypeLabel(vehicle.vehicle_type)}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Capacidade:</span>
                  <p className="font-medium">{vehicle.max_capacity_tons}t</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Eixos:</span>
                  <p className="font-medium">{vehicle.axle_count}</p>
                </div>
                <div className="flex items-center gap-2">
                  {vehicle.crlv_url && (
                    <FileText className="h-4 w-4 text-success" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {vehicle.crlv_url ? 'CRLV OK' : 'Sem CRLV'}
                  </span>
                </div>
              </div>

              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => handleEdit(vehicle)}
                className="w-full"
              >
                <Edit className="h-4 w-4 mr-2" />
                Editar
              </Button>
            </CardContent>
          </Card>
        ))}

        {vehicles.length === 0 && (
          <Card className="md:col-span-2">
            <CardContent className="py-8 text-center">
              <Truck className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-4">
                Nenhum veículo cadastrado ainda.
              </p>
              <Button onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Veículo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};