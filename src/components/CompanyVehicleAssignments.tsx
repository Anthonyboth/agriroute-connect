import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Truck, User, Link2, Unlink, Plus, Star, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import { VehicleAssignmentModal } from './VehicleAssignmentModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { AdvancedAssignmentFilters, AssignmentFilters } from './AdvancedAssignmentFilters';
import { AssignmentReportExporter } from './AssignmentReportExporter';

import { VEHICLE_TYPES_SELECT, getVehicleTypeLabel } from '@/lib/vehicle-types';
import { Phone } from 'lucide-react';

interface CompanyVehicleAssignmentsProps {
  companyId: string;
}

export const CompanyVehicleAssignments = ({ companyId }: CompanyVehicleAssignmentsProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [filters, setFilters] = useState<AssignmentFilters>({
    searchTerm: '',
    status: 'active',
    vehicleType: 'all'
  });

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ['company-vehicle-assignments', companyId, filters.status],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          *,
          driver_profiles!inner(
            id,
            full_name,
            phone,
            rating,
            total_ratings
          ),
          vehicles!inner(
            id,
            license_plate,
            vehicle_type,
            max_capacity_tons,
            axle_count
          )
        `)
        .eq('company_id', companyId)
        .order('created_at', { ascending: false });
      
      // Apply status filter
      if (filters.status === 'active') {
        return (data || []).filter(d => !d.removed_at);
      } else if (filters.status === 'removed') {
        return (data || []).filter(d => d.removed_at);
      }

      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      // Buscar dados do assignment antes de remover
      const { data: assignmentData } = await supabase
        .from('company_vehicle_assignments')
        .select('driver_profile_id, vehicle_id')
        .eq('id', assignmentId)
        .single();

      const { error } = await supabase
        .from('company_vehicle_assignments')
        .update({
          removed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (error) throw error;

      // Invocar Edge Function para enviar notificação
      if (assignmentData) {
        try {
          await supabase.functions.invoke('send-vehicle-assignment-notification', {
            body: {
              assignment_id: assignmentId,
              driver_id: assignmentData.driver_profile_id,
              vehicle_id: assignmentData.vehicle_id,
              action: 'removed',
              company_id: companyId
            }
          });
        } catch (notifError) {
          console.warn('Erro ao enviar notificação de remoção:', notifError);
        }
      }

      toast.success('Vínculo removido com sucesso');
      refetch();
      setAssignmentToRemove(null);
    } catch (error) {
      console.error('Erro ao remover vínculo:', error);
      toast.error('Erro ao remover vínculo');
    }
  };

  const filteredAssignments = useMemo(() => {
    if (!assignments) return [];
    
    return assignments.filter((assignment: any) => {
      const driver = assignment.driver_profiles;
      const vehicle = assignment.vehicles;
      
      if (!driver || !vehicle) return false;
      
      // Search filter
      const searchLower = filters.searchTerm.toLowerCase();
      const matchesSearch = !filters.searchTerm || 
        driver.full_name?.toLowerCase().includes(searchLower) ||
        vehicle.license_plate?.toLowerCase().includes(searchLower);
      
      // Vehicle type filter
      const matchesVehicleType = filters.vehicleType === 'all' || 
        vehicle.vehicle_type === filters.vehicleType;
      
      return matchesSearch && matchesVehicleType;
    });
  }, [assignments, filters]);

  // Lista linear de vínculos (sem agrupamento)

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8">
          <div className="text-center text-muted-foreground">Carregando vínculos...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Vínculos Motorista-Veículo</CardTitle>
              <CardDescription>
                Gerencie quais veículos estão vinculados a cada motorista
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <AssignmentReportExporter 
                assignments={assignments || []} 
                companyName="Transportadora"
              />
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Novo Vínculo
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <AdvancedAssignmentFilters
            filters={filters}
            onFiltersChange={setFilters}
            resultCount={filteredAssignments?.length || 0}
            vehicleTypes={VEHICLE_TYPES_SELECT}
          />

          {!filteredAssignments || filteredAssignments.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Link2 className="mx-auto h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium mb-2">Nenhum vínculo cadastrado</p>
              <p className="text-sm mb-4">
                Comece vinculando veículos aos seus motoristas
              </p>
              <Button onClick={() => setIsModalOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Criar Primeiro Vínculo
              </Button>
            </div>
          ) : (
            <div className="space-y-2 mt-4">
              {filteredAssignments.map((assignment: any) => {
                const driver = assignment.driver_profiles;
                const vehicle = assignment.vehicles;
                
                return (
                  <div
                    key={assignment.id}
                    className="flex items-center justify-between p-4 rounded-lg bg-muted/30 border hover:bg-muted/50 transition-colors"
                  >
                    {/* Motorista */}
                    <div className="flex items-center gap-3 min-w-[200px]">
                      <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{driver?.full_name || 'Motorista'}</p>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Phone className="h-3 w-3" />
                          {driver?.phone || '-'}
                        </div>
                      </div>
                    </div>

                    {/* Veículo */}
                    <div className="flex items-center gap-3 min-w-[220px]">
                      <div className="h-9 w-9 rounded-lg bg-secondary/50 flex items-center justify-center shrink-0">
                        <Truck className="h-4 w-4 text-secondary-foreground" />
                      </div>
                      <div>
                        <p className="font-mono font-medium text-sm">{vehicle?.license_plate || '-'}</p>
                        <p className="text-xs text-muted-foreground">
                          {getVehicleTypeLabel(vehicle?.vehicle_type)} • {vehicle?.max_capacity_tons}t
                        </p>
                      </div>
                    </div>

                    {/* Status e Ações */}
                    <div className="flex items-center gap-3">
                      {assignment.is_primary && (
                        <Badge variant="default" className="gap-1">
                          <Star className="h-3 w-3" />
                          Principal
                        </Badge>
                      )}
                      {driver?.rating > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {driver.rating.toFixed(1)}
                        </Badge>
                      )}
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingAssignment({
                            id: assignment.id,
                            driver_profile_id: driver?.id,
                            vehicle_id: vehicle?.id,
                            is_primary: assignment.is_primary,
                            notes: assignment.notes
                          })}
                          title="Editar vínculo"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setAssignmentToRemove(assignment.id)}
                          title="Remover vínculo"
                        >
                          <Unlink className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <VehicleAssignmentModal
        companyId={companyId}
        isOpen={isModalOpen || !!editingAssignment}
        onClose={() => {
          setIsModalOpen(false);
          setEditingAssignment(null);
        }}
        onSuccess={() => {
          refetch();
          setIsModalOpen(false);
          setEditingAssignment(null);
        }}
        editingAssignment={editingAssignment}
      />

      <AlertDialog open={!!assignmentToRemove} onOpenChange={() => setAssignmentToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover vínculo?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja remover este vínculo? O motorista não terá mais acesso a este veículo.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => assignmentToRemove && handleRemoveAssignment(assignmentToRemove)}>
              Remover Vínculo
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};