import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Truck, Plus, Edit, FileText, Camera, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { DocumentUpload } from '@/components/DocumentUpload';
import { useNavigate } from 'react-router-dom';
import { useTransportCompany } from '@/hooks/useTransportCompany';
import { usePanelCapabilities } from '@/hooks/usePanelCapabilities';
import { useCompanyDriver } from '@/hooks/useCompanyDriver';
import { VehiclePhotoGallery } from '@/components/vehicle/VehiclePhotoGallery';
import { VehiclePhotoThumbnails } from '@/components/vehicle/VehiclePhotoThumbnails';
import { VehiclePhotoExpandedGallery } from '@/components/vehicle/VehiclePhotoExpandedGallery';
import { useQueryClient } from '@tanstack/react-query';

import { VEHICLE_TYPES_SELECT, getVehicleTypeLabel } from '@/lib/vehicle-types';

interface Vehicle {
  id: string;
  license_plate: string;
  vehicle_type: string;
  max_capacity_tons: number;
  max_capacity_kg?: number;
  axle_count: number;
  status: string;
  crlv_url?: string;
  vehicle_photo_url?: string;
  vehicle_specifications?: string;
  vehicle_documents?: any;
  vehicle_photos?: any;
}

interface VehicleManagerProps {
  driverProfile: any;
}

// Vehicle types that use kg instead of tons
const SMALL_VEHICLE_TYPES = ['MOTO', 'FIORINO', 'VAN', 'HR', 'PICKUP'];

export const VehicleManager: React.FC<VehicleManagerProps> = ({ driverProfile }) => {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isTransportCompany, company } = useTransportCompany();
  const { can, reason } = usePanelCapabilities();
  const { isAffiliated: isAffiliated } = useCompanyDriver();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<Vehicle | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [duplicatePlateError, setDuplicatePlateError] = useState<string | null>(null);
  const [vehicleData, setVehicleData] = useState({
    license_plate: '',
    vehicle_type: '',
    max_capacity_tons: 0,
    max_capacity_kg: 0,
    axle_count: 2,
    crlv_url: '',
    vehicle_photo_url: '',
    vehicle_specifications: '',
    vehicle_documents: [] as string[],
    vehicle_photos: [] as string[],
  });
  const [photoCount, setPhotoCount] = useState(0);
  const [viewingGalleryVehicleId, setViewingGalleryVehicleId] = useState<string | null>(null);
  const [expandedGalleryVehicleId, setExpandedGalleryVehicleId] = useState<string | null>(null);

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
      max_capacity_kg: 0,
      axle_count: 2,
      crlv_url: '',
      vehicle_photo_url: '',
      vehicle_specifications: '',
      vehicle_documents: [],
      vehicle_photos: [],
    });
    setEditingVehicle(null);
    setDuplicatePlateError(null);
  };

  // Check for duplicate plate
  const checkDuplicatePlate = async (plate: string): Promise<boolean> => {
    if (!plate || plate.length < 7) return false;
    
    const normalizedPlate = plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
    
    // Query for existing vehicles with same plate
    let query = supabase
      .from('vehicles')
      .select('id, license_plate, driver_id')
      .ilike('license_plate', `%${normalizedPlate}%`);
    
    // If editing, exclude current vehicle
    if (editingVehicle) {
      query = query.neq('id', editingVehicle.id);
    }

    const { data, error } = await query;
    
    if (error) {
      console.error('Erro ao verificar placa:', error);
      return false;
    }

    // Check if any match belongs to same driver or company
    if (data && data.length > 0) {
      const match = data.find(v => {
        const vPlate = v.license_plate.toUpperCase().replace(/[^A-Z0-9]/g, '');
        return vPlate === normalizedPlate;
      });
      
      if (match) {
        setDuplicatePlateError('Esta placa já está cadastrada no sistema');
        return true;
      }
    }

    setDuplicatePlateError(null);
    return false;
  };

  const handlePlateChange = async (value: string) => {
    const formatted = value.toUpperCase();
    setVehicleData(prev => ({ ...prev, license_plate: formatted }));
    
    if (formatted.length >= 7) {
      await checkDuplicatePlate(formatted);
    } else {
      setDuplicatePlateError(null);
    }
  };

  const isSmallVehicle = SMALL_VEHICLE_TYPES.includes(vehicleData.vehicle_type);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!driverProfile?.id) return;

    // Check for duplicate plate before submitting
    const isDuplicate = await checkDuplicatePlate(vehicleData.license_plate);
    if (isDuplicate) {
      toast({
        title: "Placa duplicada",
        description: "Já existe um veículo cadastrado com esta placa.",
        variant: "destructive",
      });
      return;
    }

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
      // Convert kg to tons if small vehicle, or use tons directly
      const capacityInTons = isSmallVehicle 
        ? vehicleData.max_capacity_kg / 1000 
        : vehicleData.max_capacity_tons;

      const vehiclePayload = {
        license_plate: vehicleData.license_plate,
        vehicle_type: vehicleData.vehicle_type,
        max_capacity_tons: capacityInTons,
        axle_count: vehicleData.axle_count,
        crlv_url: vehicleData.crlv_url,
        vehicle_photo_url: vehicleData.vehicle_photo_url,
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
      setDuplicatePlateError(null);
      fetchVehicles();
      
      // ✅ CRITICAL: Invalidar cache de contagem de veículos para atualizar permissões de aceitar frete
      queryClient.invalidateQueries({ queryKey: ['driver-vehicle-count', driverProfile.id] });
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
    const isSmall = SMALL_VEHICLE_TYPES.includes(vehicle.vehicle_type);
    setVehicleData({
      license_plate: vehicle.license_plate,
      vehicle_type: vehicle.vehicle_type,
      max_capacity_tons: vehicle.max_capacity_tons,
      max_capacity_kg: isSmall ? vehicle.max_capacity_tons * 1000 : 0,
      axle_count: vehicle.axle_count,
      crlv_url: vehicle.crlv_url || '',
      vehicle_photo_url: vehicle.vehicle_photo_url || '',
      vehicle_specifications: vehicle.vehicle_specifications || '',
      vehicle_documents: vehicle.vehicle_documents || [],
      vehicle_photos: vehicle.vehicle_photos || [],
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Meus Veículos</h3>
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <Button
            type="button"
            onClick={handleAddVehicle}
            // Não travar o botão por role; a regra real é centralizada em `can('manage_own_vehicles')`
            // e mostramos feedback via toast em `handleAddVehicle`.
            disabled={isVehicleLimitReached}
          >
            <Plus className="h-4 w-4 mr-2" />
            Adicionar Veículo
          </Button>
          
          {/*
            NOTE: Adding an explicit z-index here to avoid cases where CSS purging/caching
            prevents the dialog content z-index class from being generated, which results
            in the overlay appearing (dark screen) without the modal content.
          */}
          <DialogContent className="max-w-2xl z-[10000]">
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
                    onChange={(e) => handlePlateChange(e.target.value)}
                    className={duplicatePlateError ? 'border-destructive' : ''}
                    required
                  />
                  {duplicatePlateError && (
                    <p className="text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {duplicatePlateError}
                    </p>
                  )}
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
                {isSmallVehicle ? (
                  <div className="space-y-2">
                    <Label htmlFor="max_capacity_kg">Capacidade (kg)</Label>
                    <Input
                      id="max_capacity_kg"
                      type="number"
                      min="1"
                      max="5000"
                      step="10"
                      placeholder="Ex: 500"
                      value={vehicleData.max_capacity_kg || ''}
                      onChange={(e) => setVehicleData(prev => ({ 
                        ...prev, 
                        max_capacity_kg: Number(e.target.value) 
                      }))}
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Para motos e veículos pequenos
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <Label htmlFor="max_capacity">Capacidade (toneladas)</Label>
                    <Input
                      id="max_capacity"
                      type="number"
                      min="0.5"
                      max="100"
                      step="0.5"
                      value={vehicleData.max_capacity_tons || ''}
                      onChange={(e) => setVehicleData(prev => ({ 
                        ...prev, 
                        max_capacity_tons: Number(e.target.value) 
                      }))}
                      required
                    />
                  </div>
                )}

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
                <h4 className="font-medium">Especificações Técnicas</h4>
                <textarea
                  className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  placeholder="Descreva características especiais: equipamentos, modificações, restrições..."
                  value={vehicleData.vehicle_specifications}
                  onChange={(e) => setVehicleData(prev => ({ ...prev, vehicle_specifications: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Documentação do Veículo</h4>
                
                <DocumentUpload
                  label="CRLV (Certificado de Registro) *"
                  fileType="crlv"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setVehicleData(prev => ({ ...prev, crlv_url: url }))}
                />

                <DocumentUpload
                  label="Documentos Adicionais"
                  fileType="vehicle_docs"
                  bucketName="driver-documents"
                  onUploadComplete={(url) => setVehicleData(prev => ({ ...prev, vehicle_documents: [...(prev.vehicle_documents || []), url] }))}
                />
                {vehicleData.vehicle_documents.length > 0 && (
                  <p className="text-xs text-muted-foreground">{vehicleData.vehicle_documents.length} documento(s) anexado(s)</p>
                )}
              </div>

              {/* Fotos do veículo */}
              <div className="space-y-4">
                <h4 className="font-medium">Fotos do Veículo</h4>
                <p className="text-sm text-muted-foreground">
                  Adicione fotos (mínimo 3): lateral, frontal, traseira, placa, equipamentos
                </p>

                {editingVehicle ? (
                  <VehiclePhotoGallery
                    vehicleId={editingVehicle.id}
                    isEditing={true}
                    minPhotos={['CARRETA', 'CARRETA_BAU', 'BITREM', 'RODOTREM'].includes(vehicleData.vehicle_type) ? 1 : 0}
                    onPhotosChange={setPhotoCount}
                  />
                ) : (
                  <div className="grid grid-cols-2 gap-4">
                    {[1, 2, 3, 4].map((index) => (
                      <DocumentUpload
                        key={`vehicle-photo-${index}`}
                        onUploadComplete={(url) => setVehicleData(prev => ({ ...prev, vehicle_photos: [...(prev.vehicle_photos || []), url] }))}
                        label={`Foto ${index}${index <= 3 ? ' (obrigatória)' : ' (opcional)'}`}
                        fileType={`vehicle_photo_${index}`}
                        bucketName="driver-documents"
                      />
                    ))}
                  </div>
                )}
              </div>

              {/* Aviso para novos veículos */}

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
              <Button type="button" onClick={() => setIsAddModalOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Cadastrar Primeiro Veículo
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Modal de galeria de fotos */}
      <Dialog open={!!viewingGalleryVehicleId} onOpenChange={() => setViewingGalleryVehicleId(null)}>
        <DialogContent className="max-w-lg z-[10000]">
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