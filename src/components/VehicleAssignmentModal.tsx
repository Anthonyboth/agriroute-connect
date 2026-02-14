import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { getErrorMessage } from '@/lib/error-handler';

interface VehicleAssignmentModalProps {
  companyId: string;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  editingAssignment?: {
    id: string;
    driver_profile_id: string;
    vehicle_id: string;
    is_primary: boolean;
    notes?: string;
  } | null;
}

export const VehicleAssignmentModal = ({
  companyId,
  isOpen,
  onClose,
  onSuccess,
  editingAssignment,
}: VehicleAssignmentModalProps) => {
  const [selectedDriver, setSelectedDriver] = useState('');
  const [selectedVehicle, setSelectedVehicle] = useState('');
  const [isPrimary, setIsPrimary] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);

  // Preencher dados ao editar
  useEffect(() => {
    if (editingAssignment) {
      setSelectedDriver(editingAssignment.driver_profile_id);
      setSelectedVehicle(editingAssignment.vehicle_id);
      setIsPrimary(editingAssignment.is_primary);
      setNotes(editingAssignment.notes || '');
    } else {
      setSelectedDriver('');
      setSelectedVehicle('');
      setIsPrimary(false);
      setNotes('');
    }
  }, [editingAssignment, isOpen]);

  // Buscar motoristas da empresa
  const { data: drivers } = useQuery({
    queryKey: ['company-drivers-for-assignment', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_drivers')
        .select(`
          driver_profile_id,
          driver:profiles_secure!company_drivers_driver_profile_id_fkey(
            id,
            full_name,
            phone
          )
        `)
        .eq('company_id', companyId)
        .eq('status', 'ACTIVE');

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!companyId,
  });

  // Buscar veículos da empresa (apenas APROVADOS)
  const { data: vehicles } = useQuery({
    queryKey: ['company-vehicles-for-assignment', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('vehicles')
        .select('*')
        .eq('company_id', companyId)
        .eq('is_company_vehicle', true)
        .in('status', ['APPROVED']); // Apenas veículos aprovados

      if (error) throw error;
      return data;
    },
    enabled: isOpen && !!companyId,
  });

  const handleSubmit = async () => {
    if (!selectedDriver || !selectedVehicle) {
      toast.error('Selecione um motorista e um veículo');
      return;
    }

    setLoading(true);
    try {
      if (editingAssignment) {
        // MODO DE EDIÇÃO
        const { error } = await supabase
          .from('company_vehicle_assignments')
          .update({
            vehicle_id: selectedVehicle,
            is_primary: isPrimary,
            notes: notes || null,
          })
          .eq('id', editingAssignment.id);

        if (error) throw error;

        toast.success('Vínculo atualizado com sucesso');
      } else {
        // MODO DE CRIAÇÃO
        // Verificar se motorista já tem vínculo ativo com outro veículo
        const { data: existingDriverAssignment } = await supabase
          .from('company_vehicle_assignments')
          .select('id, vehicle_id')
          .eq('company_id', companyId)
          .eq('driver_profile_id', selectedDriver)
          .is('removed_at', null)
          .maybeSingle();

        if (existingDriverAssignment) {
          toast.error('Este motorista já possui um vínculo ativo com outro veículo. Remova o vínculo anterior primeiro.');
          return;
        }

        // Verificar se veículo já está vinculado a outro motorista
        const { data: existingVehicleAssignment } = await supabase
          .from('company_vehicle_assignments')
          .select('id, driver_profile_id')
          .eq('company_id', companyId)
          .eq('vehicle_id', selectedVehicle)
          .is('removed_at', null)
          .maybeSingle();

        if (existingVehicleAssignment) {
          toast.error('Este veículo já está vinculado a outro motorista. Remova o vínculo anterior primeiro.');
          return;
        }

        // Criar vínculo
        const { data: newAssignment, error } = await supabase
          .from('company_vehicle_assignments')
          .insert({
            company_id: companyId,
            driver_profile_id: selectedDriver,
            vehicle_id: selectedVehicle,
            is_primary: isPrimary,
            notes: notes || null,
          })
          .select('id, vehicle_id, driver_profile_id')
          .single();

        if (error) throw error;

        // Invocar Edge Function para enviar notificação
        try {
          await supabase.functions.invoke('send-vehicle-assignment-notification', {
            body: {
              assignment_id: newAssignment.id,
              driver_id: newAssignment.driver_profile_id,
              vehicle_id: newAssignment.vehicle_id,
              action: 'created',
              company_id: companyId
            }
          });
        } catch (notifError) {
          console.warn('Erro ao enviar notificação de vínculo:', notifError);
        }

        toast.success('Vínculo criado com sucesso');
      }

      onSuccess();
      handleClose();
    } catch (error: any) {
      console.error('Erro ao salvar vínculo:', error);
      // P9: Usar error-handler para mensagens em português
      const errorMessage = getErrorMessage(error);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedDriver('');
    setSelectedVehicle('');
    setIsPrimary(false);
    setNotes('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular Veículo a Motorista</DialogTitle>
          <DialogDescription>
            Defina qual veículo será usado por qual motorista
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="driver">Motorista</Label>
            <Select value={selectedDriver} onValueChange={setSelectedDriver}>
              <SelectTrigger id="driver">
                <SelectValue placeholder="Selecione um motorista" />
              </SelectTrigger>
              <SelectContent>
                {drivers?.map((item: any) => (
                  <SelectItem key={item.driver_profile_id} value={item.driver_profile_id}>
                    {item.driver?.full_name} - {item.driver?.phone}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="vehicle">Veículo (apenas aprovados)</Label>
            <Select value={selectedVehicle} onValueChange={setSelectedVehicle}>
              <SelectTrigger id="vehicle">
                <SelectValue placeholder="Selecione um veículo aprovado" />
              </SelectTrigger>
              <SelectContent>
                {vehicles?.length === 0 && (
                  <div className="p-2 text-sm text-muted-foreground text-center">
                    Nenhum veículo aprovado disponível
                  </div>
                )}
                {vehicles?.map((vehicle: any) => (
                  <SelectItem 
                    key={vehicle.id} 
                    value={vehicle.id}
                    disabled={vehicle.status !== 'APPROVED'}
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{vehicle.license_plate}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{vehicle.vehicle_type}</span>
                      <span className="text-muted-foreground">•</span>
                      <span>{vehicle.max_capacity_tons}t</span>
                      {typeof vehicle.axle_count === 'number' && (
                        <>
                          <span className="text-muted-foreground">•</span>
                          <span>{vehicle.axle_count} eixos</span>
                        </>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {vehicles && vehicles.length === 0 && (
              <p className="text-xs text-yellow-600">
                Cadastre e aguarde aprovação de veículos na aba "Frota"
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="primary"
              checked={isPrimary}
              onCheckedChange={(checked) => setIsPrimary(checked as boolean)}
            />
            <Label htmlFor="primary" className="cursor-pointer">
              Definir como veículo principal do motorista
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Observações (opcional)</Label>
            <Textarea
              id="notes"
              placeholder="Ex: Motorista responsável por rotas longas..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={handleClose}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingAssignment ? 'Atualizar Vínculo' : 'Criar Vínculo'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};