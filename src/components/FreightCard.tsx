import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MapPin, Package, Truck, Calendar } from "lucide-react";

interface Freight {
  id: string;
  cargoType: string;
  totalWeight: number;
  requiredVehicleType: string;
  originAddress: string;
  destAddress: string;
  suggestedPrice: number;
  distance: number;
  status: 'OPEN' | 'BOOKED' | 'PICKUP' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
  windowStart: string;
  windowEnd: string;
}

interface FreightCardProps {
  freight: Freight;
  userRole: 'PRODUTOR' | 'MOTORISTA';
  onAction: (freight: Freight) => void;
}

export const FreightCard = ({ freight, userRole, onAction }: FreightCardProps) => {
  const getStatusBadge = (status: string) => {
    const statusMap = {
      'OPEN': { label: 'Aberto', variant: 'default' as const },
      'BOOKED': { label: 'Reservado', variant: 'secondary' as const },
      'PICKUP': { label: 'Coleta', variant: 'outline' as const },
      'IN_TRANSIT': { label: 'Em Transporte', variant: 'outline' as const },
      'DELIVERED': { label: 'Entregue', variant: 'outline' as const },
      'CANCELLED': { label: 'Cancelado', variant: 'destructive' as const }
    };
    const config = statusMap[status as keyof typeof statusMap];
    return <Badge variant={config.variant} className={`status-${status.toLowerCase().replace('_', '-')}`}>{config.label}</Badge>;
  };

  const formatCurrency = (value: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

  const formatDate = (dateString: string) => 
    new Date(dateString).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });

  const getActionButton = () => {
    if (userRole === 'MOTORISTA' && freight.status === 'OPEN') {
      return (
        <Button variant="hero" size="sm" onClick={() => onAction(freight)}>
          Fazer Proposta
        </Button>
      );
    }
    if (userRole === 'PRODUTOR') {
      return (
        <Button variant="outline" size="sm" onClick={() => onAction(freight)}>
          Ver Detalhes
        </Button>
      );
    }
    return null;
  };

  return (
    <Card className="hover:shadow-card transition-smooth cursor-pointer">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <span className="font-semibold text-foreground">{freight.cargoType}</span>
              <Badge variant="secondary">{freight.totalWeight}t</Badge>
            </div>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Truck className="h-4 w-4" />
              {freight.requiredVehicleType}
            </div>
          </div>
          {getStatusBadge(freight.status)}
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-primary mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Origem:</div>
              <div className="text-muted-foreground">{freight.originAddress}</div>
            </div>
          </div>
          <div className="flex items-start gap-2 text-sm">
            <MapPin className="h-4 w-4 text-accent mt-0.5 flex-shrink-0" />
            <div>
              <div className="font-medium">Destino:</div>
              <div className="text-muted-foreground">{freight.destAddress}</div>
            </div>
          </div>
        </div>

        <div className="flex justify-between items-center pt-3 border-t border-border">
          <div className="space-y-1">
            <div className="text-lg font-bold text-primary">
              {formatCurrency(freight.suggestedPrice)}
            </div>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Calendar className="h-3 w-3" />
              {formatDate(freight.windowStart)} - {formatDate(freight.windowEnd)}
            </div>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-muted-foreground">{freight.distance} km</div>
            {getActionButton()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};