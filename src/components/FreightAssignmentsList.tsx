import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Truck, DollarSign, User, CheckCircle, Phone } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Assignment {
  id: string;
  driver_id: string;
  agreed_price: number;
  pricing_type: string;
  price_per_km?: number;
  status: string;
  driver: {
    id: string;
    full_name: string;
    contact_phone?: string;
    rating?: number;
  };
}

interface FreightAssignmentsListProps {
  freightId: string;
  requiredTrucks: number;
  acceptedTrucks: number;
  isProducer: boolean;
}

export const FreightAssignmentsList: React.FC<FreightAssignmentsListProps> = ({
  freightId,
  requiredTrucks,
  acceptedTrucks,
  isProducer
}) => {
  const [assignments, setAssignments] = React.useState<Assignment[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    fetchAssignments();
  }, [freightId]);

  const fetchAssignments = async () => {
    try {
      const { data, error } = await supabase
        .from('freight_assignments')
        .select(`
          *,
          driver:profiles!driver_id(
            id,
            full_name,
            contact_phone,
            rating
          )
        `)
        .eq('freight_id', freightId)
        .order('accepted_at', { ascending: false });

      if (error) throw error;
      setAssignments(data || []);
    } catch (error) {
      console.error('Error fetching assignments:', error);
      toast.error('Erro ao carregar motoristas contratados');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="text-sm text-muted-foreground">Carregando...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header com progresso */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <Truck className="h-5 w-5" />
          Motoristas Contratados
        </h3>
        <Badge variant={acceptedTrucks >= requiredTrucks ? "default" : "secondary"}>
          {acceptedTrucks} / {requiredTrucks} carretas
        </Badge>
      </div>

      {/* Lista de assignments */}
      {assignments.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Truck className="h-12 w-12 mx-auto mb-2 opacity-50" />
          <p>Nenhum motorista contratado ainda</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {assignments.map((assignment) => (
            <Card key={assignment.id} className="border-l-4 border-l-green-500">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-2 flex-1">
                    {/* Nome e avaliação */}
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{assignment.driver?.full_name || 'Motorista'}</span>
                      {assignment.driver?.rating && typeof assignment.driver.rating === 'number' && (
                        <Badge variant="outline" className="text-xs">
                          {assignment.driver.rating.toFixed(1)}★
                        </Badge>
                      )}
                    </div>

                    {/* Valor acordado */}
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-green-600" />
                      <span className="text-lg font-bold text-green-600">
                        R$ {assignment.agreed_price.toLocaleString('pt-BR', {
                          minimumFractionDigits: 2
                        })}
                      </span>
                      {assignment.pricing_type === 'PER_KM' && assignment.price_per_km && (
                        <span className="text-sm text-muted-foreground">
                          (R$ {assignment.price_per_km.toFixed(2)}/km)
                        </span>
                      )}
                    </div>

                    {/* Status */}
                    <Badge variant={
                      assignment.status === 'DELIVERED' ? 'default' :
                      assignment.status === 'IN_TRANSIT' ? 'secondary' :
                      'outline'
                    }>
                      {assignment.status === 'ACCEPTED' && 'Aceito'}
                      {assignment.status === 'IN_TRANSIT' && 'Em Trânsito'}
                      {assignment.status === 'DELIVERED_PENDING_CONFIRMATION' && 'Aguardando Confirmação'}
                      {assignment.status === 'DELIVERED' && 'Entregue'}
                    </Badge>
                  </div>

                  {/* Ícone de confirmação */}
                  <CheckCircle className="h-5 w-5 text-green-600" />
                </div>

                {/* Telefone (apenas para produtor) */}
                {isProducer && assignment.driver?.contact_phone && (
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-sm text-muted-foreground flex items-center gap-2">
                      <Phone className="h-3 w-3" />
                      Contato: {assignment.driver.contact_phone}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vagas restantes */}
      {acceptedTrucks < requiredTrucks && (
        <div className="text-sm text-muted-foreground text-center p-3 bg-muted rounded-lg">
          {requiredTrucks - acceptedTrucks} {requiredTrucks - acceptedTrucks === 1 ? 'vaga' : 'vagas'} {requiredTrucks - acceptedTrucks === 1 ? 'disponível' : 'disponíveis'}
        </div>
      )}
    </div>
  );
};