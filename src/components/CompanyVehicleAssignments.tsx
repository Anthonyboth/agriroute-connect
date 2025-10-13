import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Truck, User, Link2, Unlink, Plus, Star } from 'lucide-react';
import { toast } from 'sonner';
import { VehicleAssignmentModal } from './VehicleAssignmentModal';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

interface CompanyVehicleAssignmentsProps {
  companyId: string;
}

export const CompanyVehicleAssignments = ({ companyId }: CompanyVehicleAssignmentsProps) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [assignmentToRemove, setAssignmentToRemove] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const { data: assignments, isLoading, refetch } = useQuery({
    queryKey: ['company-vehicle-assignments', companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('company_vehicle_assignments')
        .select(`
          *,
          driver:driver_profile_id(
            id,
            full_name,
            phone,
            rating,
            total_ratings
          ),
          vehicle:vehicle_id(
            id,
            license_plate,
            vehicle_type,
            max_capacity_tons,
            axle_count
          )
        `)
        .eq('company_id', companyId)
        .is('removed_at', null)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const handleRemoveAssignment = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from('company_vehicle_assignments')
        .update({
          removed_at: new Date().toISOString(),
        })
        .eq('id', assignmentId);

      if (error) throw error;

      toast.success('Vínculo removido com sucesso');
      refetch();
      setAssignmentToRemove(null);
    } catch (error) {
      console.error('Erro ao remover vínculo:', error);
      toast.error('Erro ao remover vínculo');
    }
  };

  const filteredAssignments = assignments?.filter((assignment: any) =>
    assignment.driver?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    assignment.vehicle?.license_plate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Agrupar por motorista
  const groupedByDriver = filteredAssignments?.reduce((acc: any, assignment: any) => {
    const driverId = assignment.driver_profile_id;
    if (!acc[driverId]) {
      acc[driverId] = {
        driver: assignment.driver,
        vehicles: [],
      };
    }
    acc[driverId].vehicles.push({
      ...assignment.vehicle,
      assignmentId: assignment.id,
      isPrimary: assignment.is_primary,
      notes: assignment.notes,
    });
    return acc;
  }, {});

  const driverGroups = groupedByDriver ? Object.values(groupedByDriver) : [];

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
            <Button onClick={() => setIsModalOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Vínculo
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Label htmlFor="search">Buscar motorista ou veículo</Label>
            <Input
              id="search"
              placeholder="Digite o nome do motorista ou placa do veículo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {!driverGroups || driverGroups.length === 0 ? (
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
            <div className="space-y-4">
              {driverGroups.map((group: any) => (
                <Card key={group.driver?.id} className="border-2">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                          <User className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-semibold">{group.driver?.full_name}</h3>
                          <p className="text-sm text-muted-foreground">{group.driver?.phone}</p>
                        </div>
                      </div>
                      {group.driver?.rating > 0 && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3 fill-current" />
                          {group.driver.rating.toFixed(1)}
                        </Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      {group.vehicles.map((vehicle: any) => (
                        <div
                          key={vehicle.assignmentId}
                          className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border"
                        >
                          <div className="flex items-center gap-3">
                            <Truck className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{vehicle.license_plate}</span>
                                {vehicle.isPrimary && (
                                  <Badge variant="default" className="text-xs">
                                    Principal
                                  </Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {vehicle.vehicle_type} • {vehicle.max_capacity_tons}t • {vehicle.axle_count} eixos
                              </p>
                              {vehicle.notes && (
                                <p className="text-xs text-muted-foreground mt-1">
                                  {vehicle.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setAssignmentToRemove(vehicle.assignmentId)}
                          >
                            <Unlink className="h-4 w-4" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VehicleAssignmentModal
        companyId={companyId}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onSuccess={() => {
          refetch();
          setIsModalOpen(false);
        }}
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