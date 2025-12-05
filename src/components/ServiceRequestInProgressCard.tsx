import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { MapPin, Phone, MessageSquare, Navigation, CheckCircle, Truck, Clock, Wrench } from 'lucide-react';
import { formatBRL } from '@/lib/formatters';

interface ServiceRequestInProgressCardProps {
  request: {
    id: string;
    service_type: string;
    status: string;
    contact_name?: string;
    contact_phone?: string;
    location_address?: string;
    location_lat?: number;
    location_lng?: number;
    problem_description?: string;
    estimated_price?: number;
    is_emergency?: boolean;
    client_id?: string;
    prospect_user_id?: string;
    city_name?: string;
    state?: string;
    created_at: string;
  };
  onMarkOnTheWay: (id: string) => void;
  onFinishService: (id: string) => void;
}

export const ServiceRequestInProgressCard = ({ 
  request, 
  onMarkOnTheWay, 
  onFinishService 
}: ServiceRequestInProgressCardProps) => {
  
  const openInMaps = () => {
    if (request.location_lat && request.location_lng) {
      const url = `https://www.google.com/maps/dir/?api=1&destination=${request.location_lat},${request.location_lng}`;
      window.open(url, '_blank');
    } else if (request.location_address) {
      const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(request.location_address)}`;
      window.open(url, '_blank');
    }
  };

  const openWhatsApp = () => {
    if (request.contact_phone) {
      const cleaned = request.contact_phone.replace(/\D/g, '');
      const formattedForWhatsApp = cleaned.startsWith('55') ? cleaned : `55${cleaned}`;
      window.open(`https://wa.me/${formattedForWhatsApp}`, '_blank');
    }
  };

  const getServiceIcon = () => {
    switch (request.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-5 w-5 text-orange-600" />;
      case 'MUDANCA':
      case 'FRETE_URBANO':
        return <Truck className="h-5 w-5 text-blue-600" />;
      default:
        return <Truck className="h-5 w-5 text-primary" />;
    }
  };

  const getServiceLabel = () => {
    switch (request.service_type) {
      case 'GUINCHO':
        return 'Guincho';
      case 'MUDANCA':
        return 'Mudança';
      case 'FRETE_URBANO':
        return 'Frete Urbano';
      default:
        return request.service_type;
    }
  };

  const getStatusBadge = () => {
    switch (request.status) {
      case 'ACCEPTED':
        return <Badge variant="default" className="bg-blue-500">Aceito</Badge>;
      case 'ON_THE_WAY':
        return <Badge variant="default" className="bg-orange-500">A Caminho</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="bg-green-500">Em Andamento</Badge>;
      default:
        return <Badge variant="secondary">{request.status}</Badge>;
    }
  };

  // Verificar se é usuário sem cadastro (guest)
  const isGuestUser = !!request.prospect_user_id && !request.client_id;

  return (
    <Card className="border-l-4 border-l-orange-500 hover:shadow-lg transition-shadow">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {getServiceIcon()}
            <CardTitle className="text-base">{getServiceLabel()}</CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {request.is_emergency && (
              <Badge variant="destructive" className="text-xs">🚨 Emergência</Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Informações do cliente */}
        <div className="bg-secondary/30 rounded-lg p-3 space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Dados do Cliente
          </h4>
          
          {request.contact_name && (
            <p className="text-sm">
              <span className="text-muted-foreground">Nome:</span>{' '}
              <span className="font-medium">{request.contact_name}</span>
            </p>
          )}
          
          {request.contact_phone && (
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Telefone:</span>
              <Button
                variant="link"
                size="sm"
                className="p-0 h-auto text-primary"
                onClick={openWhatsApp}
              >
                {request.contact_phone}
              </Button>
            </div>
          )}
        </div>

        {/* Endereço */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" />
            Local do Serviço
          </h4>
          
          {request.city_name && (
            <p className="text-sm font-bold text-primary">
              {request.city_name.toUpperCase()}{request.state ? ` - ${request.state}` : ''}
            </p>
          )}
          
          {request.location_address && (
            <p className="text-sm text-muted-foreground">{request.location_address}</p>
          )}
          
          {(request.location_lat || request.location_address) && (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={openInMaps}
            >
              <Navigation className="h-4 w-4 mr-2" />
              Abrir no Google Maps
            </Button>
          )}
        </div>

        {/* Descrição do problema */}
        {request.problem_description && (
          <div className="bg-secondary/20 rounded-lg p-3">
            <h4 className="font-semibold text-sm flex items-center gap-2 mb-1">
              <MessageSquare className="h-4 w-4" />
              Descrição
            </h4>
            <p className="text-sm text-muted-foreground">{request.problem_description}</p>
          </div>
        )}

        {/* Valor */}
        {request.estimated_price && (
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 border border-green-200">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Valor do Serviço:</span>
              <span className="text-lg font-bold text-green-600">
                {formatBRL(request.estimated_price)}
              </span>
            </div>
          </div>
        )}

        {/* Tempo */}
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          Aceito em: {new Date(request.created_at).toLocaleString('pt-BR')}
        </div>
      </CardContent>

      <CardFooter className="flex gap-2 pt-4">
        {/* Botão "A Caminho" - apenas para usuários cadastrados */}
        {request.status === 'ACCEPTED' && request.client_id && (
          <Button
            variant="default"
            className="flex-1 bg-orange-500 hover:bg-orange-600"
            onClick={() => onMarkOnTheWay(request.id)}
          >
            <Navigation className="h-4 w-4 mr-2" />
            A Caminho
          </Button>
        )}

        {/* Botão "Encerrar" - sempre disponível */}
        <Button
          variant="default"
          className="flex-1 bg-green-600 hover:bg-green-700"
          onClick={() => onFinishService(request.id)}
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isGuestUser ? 'Encerrar Serviço' : 'Concluir Serviço'}
        </Button>
      </CardFooter>
    </Card>
  );
};
