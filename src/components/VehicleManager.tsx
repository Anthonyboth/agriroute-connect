import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Truck, Plus, Edit, FileText, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate } from 'react-router-dom';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { usePanelCapabilities } from '@/hooks/usePanelCapabilities';
import { VehiclePhotoGallery } from '@/components/vehicle/VehiclePhotoGallery';
import { VehiclePhotoThumbnails } from '@/components/vehicle/VehiclePhotoThumbnails';

import { VEHICLE_TYPES_SELECT, getVehicleTypeLabel } from '@/lib/vehicle-types';

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
  const navigate = useNavigate();
  const { isTransportCompany } = useTransportCompany();
  const { can, reason } = usePanelCapabilities();
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
  const [photoCount, setPhotoCount] = useState(0);
  const [viewingGalleryVehicleId, setViewingGalleryVehicleId] = useState<string | null>(null);

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

    // Validação: carretas precisam de pelo menos 1 foto
    const isCarreta = ['CARRETA', 'CARRETA_BAU', 'BITREM', 'RODOTREM'].includes(vehicleData.vehicle_type);
    if (isCarreta && editingVehicle && photoCount < 1) {
      toast({
        title: "Foto obrigatória",
        description: "Carretas precisam de pelo menos 1 foto do veículo.",
        variant: "destructive",
      });
      return;
    }

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
        const { data, error } = await supabase
          .from('vehicles')
          .insert({
            ...vehiclePayload,
            vehicle_type: vehiclePayload.vehicle_type as any
          })
          .select()
          .single();

        if (error) throw error;
        
        // Mensagem diferenciada com base no status retornado
        if (data?.status === 'PENDING') {
          toast({
            title: "Veículo cadastrado",
            description: "⚠️ Seu veículo foi cadastrado e aguarda aprovação do administrador da transportadora.",
          });
        } else {
          toast({
            title: "✅ Veículo aprovado",
            description: "Seu veículo foi cadastrado e aprovado automaticamente!",
          });
        }
      }

      resetForm();
      setIsAddModalOpen(false);
      setPhotoCount(0);
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

  // getVehicleTypeLabel agora é importado de @/lib/vehicle-types

  const handleAddVehicle = () => {
    // ✅ Verificar permissão centralizada
    if (!can('manage_own_vehicles')) {
      toast({
        title: "Não permitido",
        description: reason('manage_own_vehicles') || "Você não tem permissão para gerenciar veículos.",
        variant: "destructive",
      });
      return;
    }
    
    // Verificar se é autônomo com 1 veículo (limite)
    if (vehicles.length >= 1 && driverProfile.role === 'MOTORISTA' && !isTransportCompany) {
      toast({
        title: "Limite atingido",
        description: reason('manage_own_vehicles') || "Você já tem 1 veículo cadastrado. Para cadastrar mais veículos, transforme sua conta em transportadora.",
        variant: "destructive",
      });
      return;
    }
    
    resetForm();
    setIsAddModalOpen(true);
  };

  useEffect(() => {
    fetchVehicles();
  }, [driverProfile]);

  const isVehicleLimitReached = vehicles.length >= 1 && driverProfile.role === 'MOTORISTA' && !isTransportCompany;
  const isAffiliated = driverProfile.role === 'MOTORISTA_AFILIADO';

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Meus Veículos</h3>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogTrigger asChild>
            <Button 
              onClick={handleAddVehicle}
              disabled={isVehicleLimitReached || isAffiliated}
            >
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
                      {VEHICLE_TYPES_SELECT.map((type) => (
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
              </div>

              {/* Galeria de fotos - só aparece ao editar veículo existente */}
              {editingVehicle && (
                <div className="space-y-2">
                  <VehiclePhotoGallery
                    vehicleId={editingVehicle.id}
                    isEditing={true}
                    minPhotos={['CARRETA', 'CARRETA_BAU', 'BITREM', 'RODOTREM'].includes(vehicleData.vehicle_type) ? 1 : 0}
                    onPhotosChange={setPhotoCount}
                  />
                </div>
              )}

              {/* Aviso para novos veículos */}
              {!editingVehicle && (
                <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                  <p className="text-xs text-blue-800 dark:text-blue-200">
                    💡 Após cadastrar o veículo, você poderá adicionar fotos no álbum clicando em "Editar".
                  </p>
                </div>
              )}

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

      {/* Mensagem de limite atingido */}
      {isVehicleLimitReached && (
        <div className="bg-amber-50 dark:bg-amber-950 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
          <p className="text-sm text-amber-800 dark:text-amber-200">
            Limite de 1 veículo atingido. {' '}
            <Button 
              variant="link" 
              className="p-0 h-auto text-amber-800 dark:text-amber-200 underline"
              onClick={() => navigate('/cadastro-transportadora')}
            >
              Transforme sua conta em transportadora
            </Button>
            {' '} para cadastrar mais veículos e gerenciar motoristas.
          </p>
        </div>
      )}

      {isAffiliated && (
        <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <p className="text-sm text-blue-800 dark:text-blue-200">
            Motoristas afiliados não podem cadastrar veículos próprios. Entre em contato com sua transportadora para usar os veículos da empresa.
          </p>
        </div>
      )}

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
              <div className="flex gap-4">
                {/* Thumbnails das fotos */}
                <VehiclePhotoThumbnails
                  vehicleId={vehicle.id}
                  maxShow={4}
                  onClick={() => setViewingGalleryVehicleId(vehicle.id)}
                />

                {/* Informações do veículo */}
                <div className="flex-1 grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Tipo:</span>
                    <p className="font-medium text-sm">{getVehicleTypeLabel(vehicle.vehicle_type)}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Capacidade:</span>
                    <p className="font-medium text-sm">{vehicle.max_capacity_tons}t</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Eixos:</span>
                    <p className="font-medium text-sm">{vehicle.axle_count}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    {vehicle.crlv_url && (
                      <FileText className="h-3 w-3 text-success" />
                    )}
                    <span className="text-xs text-muted-foreground">
                      {vehicle.crlv_url ? 'CRLV OK' : 'Sem CRLV'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => setViewingGalleryVehicleId(vehicle.id)}
                  className="flex-1"
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Ver Fotos
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => handleEdit(vehicle)}
                  className="flex-1"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Editar
                </Button>
              </div>
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

      {/* Modal de galeria de fotos */}
      <Dialog open={!!viewingGalleryVehicleId} onOpenChange={() => setViewingGalleryVehicleId(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Álbum de Fotos
            </DialogTitle>
          </DialogHeader>
          {viewingGalleryVehicleId && (
            <VehiclePhotoGallery
              vehicleId={viewingGalleryVehicleId}
              isEditing={true}
              minPhotos={0}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};