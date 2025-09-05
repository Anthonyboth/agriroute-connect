import React from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, 
  Package, 
  Truck, 
  Calendar, 
  DollarSign, 
  Clock,
  Eye,
  FileText,
  ArrowRight 
} from 'lucide-react';

export interface Freight {
  id: string;
  cargoType: string;
  weight: number;
  origin: string;
  destination: string;
  price: number;
  distance: number;
  status: 'ABERTO' | 'RESERVADO' | 'EM_TRANSITO' | 'ENTREGUE' | 'CANCELADO';
  pickupDate: string;
  deliveryDate: string;
  urgency?: 'BAIXA' | 'MEDIA' | 'ALTA';
  description?: string;
}

interface FreightCardProps {
  freight: Freight;
  userRole: 'PRODUTOR' | 'MOTORISTA';
  onAction: (freight: Freight, action: string) => void;
}

const FreightCard: React.FC<FreightCardProps> = ({ freight, userRole, onAction }) => {
  const getStatusBadge = (status: string) => {
    const statusConfig = {
      ABERTO: { label: 'Aberto', className: 'status-open' },
      RESERVADO: { label: 'Reservado', className: 'status-booked' },
      EM_TRANSITO: { label: 'Em Trânsito', className: 'status-in-transit' },
      ENTREGUE: { label: 'Entregue', className: 'status-delivered' },
      CANCELADO: { label: 'Cancelado', className: 'status-cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig];
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const getUrgencyBadge = (urgency?: string) => {
    if (!urgency) return null;
    
    const urgencyConfig = {
      BAIXA: { label: 'Baixa', className: 'bg-success/10 text-success' },
      MEDIA: { label: 'Média', className: 'bg-warning/10 text-warning' },
      ALTA: { label: 'Alta', className: 'bg-destructive/10 text-destructive' },
    };
    
    const config = urgencyConfig[urgency as keyof typeof urgencyConfig];
    return (
      <Badge className={config.className}>
        <Clock className="w-3 h-3 mr-1" />
        {config.label}
      </Badge>
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(value);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatWeight = (weight: number) => {
    return weight >= 1000 ? `${(weight / 1000).toFixed(1)}t` : `${weight}kg`;
  };

  const getActionButton = () => {
    if (userRole === 'MOTORISTA') {
      if (freight.status === 'ABERTO') {
        return (
          <Button 
            onClick={() => onAction(freight, 'fazer_proposta')}
            className="gradient-primary text-primary-foreground w-full"
            size="sm"
          >
            <FileText className="w-4 h-4 mr-2" />
            Fazer Proposta
          </Button>
        );
      } else if (freight.status === 'RESERVADO') {
        return (
          <Button 
            onClick={() => onAction(freight, 'iniciar_transporte')}
            className="bg-accent text-accent-foreground w-full"
            size="sm"
          >
            <Truck className="w-4 h-4 mr-2" />
            Iniciar Transporte
          </Button>
        );
      }
    }
    
    return (
      <Button 
        variant="outline" 
        onClick={() => onAction(freight, 'ver_detalhes')}
        className="w-full"
        size="sm"
      >
        <Eye className="w-4 h-4 mr-2" />
        Ver Detalhes
      </Button>
    );
  };

  return (
    <Card className="shadow-card hover:shadow-glow transition-smooth group">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-2">
            <Package className="h-5 w-5 text-primary" />
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-smooth">
              {freight.cargoType}
            </h3>
          </div>
          <div className="flex flex-col space-y-2">
            {getStatusBadge(freight.status)}
            {getUrgencyBadge(freight.urgency)}
          </div>
        </div>
        {freight.description && (
          <p className="text-sm text-muted-foreground mt-2">
            {freight.description}
          </p>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Peso e Distância */}
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center space-x-1 text-muted-foreground">
            <Package className="h-4 w-4" />
            <span>{formatWeight(freight.weight)}</span>
          </div>
          <div className="flex items-center space-x-1 text-muted-foreground">
            <MapPin className="h-4 w-4" />
            <span>{freight.distance} km</span>
          </div>
        </div>

        {/* Origem e Destino */}
        <div className="space-y-3">
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Origem</p>
              <p className="text-sm text-muted-foreground">{freight.origin}</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3 ml-6">
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </div>
          
          <div className="flex items-center space-x-3">
            <div className="w-3 h-3 rounded-full bg-accent" />
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">Destino</p>
              <p className="text-sm text-muted-foreground">{freight.destination}</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* Datas */}
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Coleta</span>
            </div>
            <p className="font-medium text-foreground">{formatDate(freight.pickupDate)}</p>
          </div>
          <div className="space-y-1">
            <div className="flex items-center space-x-1 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>Entrega</span>
            </div>
            <p className="font-medium text-foreground">{formatDate(freight.deliveryDate)}</p>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-4">
        <div className="flex items-center justify-between w-full">
          <div className="flex items-center space-x-1">
            <DollarSign className="h-5 w-5 text-success" />
            <span className="text-2xl font-bold text-success">
              {formatCurrency(freight.price)}
            </span>
          </div>
          {getActionButton()}
        </div>
      </CardFooter>
    </Card>
  );
};

export default FreightCard;