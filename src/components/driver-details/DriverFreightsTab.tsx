import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Truck, MapPin, Calendar } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface DriverFreightsTabProps {
  driverProfileId: string;
}

export const DriverFreightsTab = ({ driverProfileId }: DriverFreightsTabProps) => {
  const { data: freights, isLoading } = useQuery({
    queryKey: ['driver-freights', driverProfileId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('freights')
        .select(`
          id,
          created_at,
          status,
          price,
          cargo_type,
          producer:producer_id(full_name),
          origin_city:origin_city_id(name, state),
          destination_city:destination_city_id(name, state)
        `)
        .eq('driver_id', driverProfileId)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!freights || freights.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Truck className="h-12 w-12 text-muted-foreground mb-4" />
          <p className="text-lg font-medium">Nenhum frete encontrado</p>
          <p className="text-sm text-muted-foreground mt-2">
            Este motorista ainda não realizou fretes
          </p>
        </CardContent>
      </Card>
    );
  }

  const getStatusBadge = (status: string) => {
    const statusLabels: Record<string, string> = {
      'OPEN': 'Aberto',
      'IN_NEGOTIATION': 'Em Negociação',
      'ACCEPTED': 'Aceito',
      'LOADING': 'A Caminho da Coleta',
      'LOADED': 'Carregado',
      'IN_TRANSIT': 'Em Transporte',
      'DELIVERED': 'Entregue',
      'DELIVERED_PENDING_CONFIRMATION': 'Entrega Reportada',
      'COMPLETED': 'Concluído',
      'CANCELLED': 'Cancelado',
      'REJECTED': 'Rejeitado',
      'PENDING': 'Pendente'
    };
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      'COMPLETED': 'default',
      'DELIVERED': 'default',
      'IN_TRANSIT': 'secondary',
      'LOADING': 'secondary',
      'CANCELLED': 'destructive',
      'REJECTED': 'destructive',
      'PENDING': 'outline',
    };
    const label = statusLabels[status] || status;
    return <Badge variant={variants[status] || 'outline'}>{label}</Badge>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Histórico de Fretes</h3>
        <Badge variant="secondary">{freights.length} fretes</Badge>
      </div>

      {freights.map((freight: any) => (
        <Card key={freight.id}>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">
                {freight.cargo_type || 'Frete'}
              </CardTitle>
              {getStatusBadge(freight.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground mt-1 flex-shrink-0" />
              <div className="flex-1 text-sm">
                <p className="font-medium">
                  {freight.origin_city?.name}, {freight.origin_city?.state}
                </p>
                <p className="text-muted-foreground">↓</p>
                <p className="font-medium">
                  {freight.destination_city?.name}, {freight.destination_city?.state}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Criado em {new Date(freight.created_at).toLocaleDateString('pt-BR')}
              </span>
            </div>

            {freight.price && (
              <div className="text-sm">
                <span className="text-muted-foreground">Valor: </span>
                <span className="font-semibold text-primary">
                  R$ {Number(freight.price).toFixed(2)}
                </span>
              </div>
            )}

            {freight.producer && (
              <div className="text-sm">
                <span className="text-muted-foreground">Produtor: </span>
                <span className="font-medium">{freight.producer.full_name}</span>
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
};
