import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, Phone, MessageSquare, Navigation, CheckCircle, Truck, Clock, Wrench,
  Car, AlertTriangle, Calendar, FileText, Mail, User
} from 'lucide-react';
import { formatBRL } from '@/lib/formatters';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface ServiceRequestInProgressCardProps {
  request: {
    id: string;
    service_type: string;
    status: string;
    contact_name?: string;
    contact_phone?: string;
    contact_email?: string;
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
    accepted_at?: string;
    vehicle_info?: string;
    urgency?: string;
    preferred_datetime?: string;
    additional_info?: string;
  };
  onMarkOnTheWay: (id: string) => void;
  onFinishService: (id: string) => void;
}

const ServiceRequestInProgressCardComponent = ({ 
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

  const openEmail = () => {
    if (request.contact_email) {
      window.open(`mailto:${request.contact_email}`, '_blank');
    }
  };

  const getServiceIcon = () => {
    switch (request.service_type) {
      case 'GUINCHO':
        return <Wrench className="h-6 w-6 text-orange-600" />;
      case 'MUDANCA':
      case 'FRETE_URBANO':
        return <Truck className="h-6 w-6 text-blue-600" />;
      default:
        return <Truck className="h-6 w-6 text-primary" />;
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
        return <Badge variant="default" className="bg-blue-500 text-base px-3 py-1">Aceito</Badge>;
      case 'ON_THE_WAY':
        return <Badge variant="default" className="bg-orange-500 text-base px-3 py-1">A Caminho</Badge>;
      case 'IN_PROGRESS':
        return <Badge variant="default" className="bg-green-500 text-base px-3 py-1">Em Andamento</Badge>;
      default:
        return <Badge variant="secondary" className="text-base px-3 py-1">{request.status}</Badge>;
    }
  };

  const getUrgencyBadge = () => {
    if (!request.urgency) return null;
    
    switch (request.urgency.toUpperCase()) {
      case 'ALTA':
      case 'URGENTE':
        return (
          <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
            <AlertTriangle className="h-4 w-4 mr-1" />
            🔴 URGENTE
          </Badge>
        );
      case 'MEDIA':
      case 'MÉDIA':
        return (
          <Badge className="bg-yellow-500 text-black text-sm px-3 py-1">
            <AlertTriangle className="h-4 w-4 mr-1" />
            🟡 PRIORIDADE MÉDIA
          </Badge>
        );
      case 'BAIXA':
        return (
          <Badge variant="secondary" className="text-sm px-3 py-1">
            🟢 PRIORIDADE NORMAL
          </Badge>
        );
      default:
        return null;
    }
  };

  const formatPreferredDateTime = () => {
    if (!request.preferred_datetime) return null;
    
    try {
      const date = parseISO(request.preferred_datetime);
      const time = format(date, 'HH:mm', { locale: ptBR });
      
      if (isToday(date)) {
        return `Hoje às ${time}`;
      } else if (isTomorrow(date)) {
        return `Amanhã às ${time}`;
      } else {
        return format(date, "dd 'de' MMMM 'às' HH:mm", { locale: ptBR });
      }
    } catch {
      return request.preferred_datetime;
    }
  };

  const formatAcceptedAt = () => {
    const dateStr = request.accepted_at || request.created_at;
    try {
      const date = parseISO(dateStr);
      return format(date, "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR });
    } catch {
      return new Date(dateStr).toLocaleString('pt-BR');
    }
  };

  // Verificar se é usuário sem cadastro (guest)
  const isGuestUser = !!request.prospect_user_id && !request.client_id;

  return (
    <Card className="border-l-4 border-l-orange-500 hover:shadow-xl transition-shadow">
      {/* Header com tipo de serviço e status */}
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-3">
            {getServiceIcon()}
            <CardTitle className="text-xl font-bold">{getServiceLabel()}</CardTitle>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {request.is_emergency && (
              <Badge variant="destructive" className="text-sm px-3 py-1 animate-pulse">
                🚨 EMERGÊNCIA
              </Badge>
            )}
            {getStatusBadge()}
          </div>
        </div>
        
        {/* Badge de urgência abaixo do header */}
        {getUrgencyBadge() && (
          <div className="mt-3">
            {getUrgencyBadge()}
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-5">
        {/* ===== SEÇÃO: DADOS DO CLIENTE ===== */}
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 space-y-3 border border-blue-200 dark:border-blue-800">
          <h4 className="font-bold text-base flex items-center gap-2 text-blue-700 dark:text-blue-300">
            <User className="h-5 w-5" />
            DADOS DO CLIENTE
          </h4>
          
          {request.contact_name && (
            <p className="text-base">
              <span className="text-muted-foreground">Nome:</span>{' '}
              <span className="font-bold text-lg">{request.contact_name.toUpperCase()}</span>
            </p>
          )}
          
          {request.contact_phone && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base text-muted-foreground flex items-center gap-1">
                <Phone className="h-4 w-4" />
                Telefone:
              </span>
              <Button
                variant="default"
                size="sm"
                className="bg-green-600 hover:bg-green-700 text-base px-4"
                onClick={openWhatsApp}
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                {request.contact_phone}
              </Button>
            </div>
          )}
          
          {request.contact_email && (
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-base text-muted-foreground flex items-center gap-1">
                <Mail className="h-4 w-4" />
                Email:
              </span>
              <Button
                variant="outline"
                size="sm"
                className="text-base"
                onClick={openEmail}
              >
                {request.contact_email}
              </Button>
            </div>
          )}
        </div>

        {/* ===== SEÇÃO: VEÍCULO DO CLIENTE ===== */}
        {request.vehicle_info && (
          <div className="bg-slate-50 dark:bg-slate-900/30 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
            <h4 className="font-bold text-base flex items-center gap-2 text-slate-700 dark:text-slate-300 mb-2">
              <Car className="h-5 w-5" />
              VEÍCULO DO CLIENTE
            </h4>
            <p className="text-lg font-semibold">{request.vehicle_info}</p>
          </div>
        )}

        {/* ===== SEÇÃO: LOCAL DO SERVIÇO ===== */}
        <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 space-y-3 border border-purple-200 dark:border-purple-800">
          <h4 className="font-bold text-base flex items-center gap-2 text-purple-700 dark:text-purple-300">
            <MapPin className="h-5 w-5" />
            LOCAL DO SERVIÇO
          </h4>
          
          {request.city_name && (
            <p className="text-xl font-black text-primary">
              {request.city_name.toUpperCase()}{request.state ? ` - ${request.state}` : ''}
            </p>
          )}
          
          {request.location_address && (
            <p className="text-base text-muted-foreground">{request.location_address}</p>
          )}
          
          {(request.location_lat || request.location_address) && (
            <Button
              variant="default"
              size="lg"
              className="w-full text-base py-3 bg-purple-600 hover:bg-purple-700"
              onClick={openInMaps}
            >
              <Navigation className="h-5 w-5 mr-2" />
              Abrir no Google Maps
            </Button>
          )}
        </div>

        {/* ===== SEÇÃO: DATA E HORA PREFERIDA ===== */}
        {request.preferred_datetime && (
          <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-4 border border-amber-200 dark:border-amber-800">
            <h4 className="font-bold text-base flex items-center gap-2 text-amber-700 dark:text-amber-300 mb-2">
              <Calendar className="h-5 w-5" />
              DATA E HORA PREFERIDA
            </h4>
            <p className="text-lg font-semibold">{formatPreferredDateTime()}</p>
          </div>
        )}

        {/* ===== SEÇÃO: DESCRIÇÃO DO PROBLEMA ===== */}
        {request.problem_description && (
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-xl p-4 border border-orange-200 dark:border-orange-800">
            <h4 className="font-bold text-base flex items-center gap-2 text-orange-700 dark:text-orange-300 mb-2">
              <MessageSquare className="h-5 w-5" />
              DESCRIÇÃO DO PROBLEMA
            </h4>
            <p className="text-base leading-relaxed">{request.problem_description}</p>
          </div>
        )}

        {/* ===== SEÇÃO: OBSERVAÇÕES ADICIONAIS ===== */}
        {request.additional_info && (
          <div className="bg-gray-50 dark:bg-gray-900/30 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
            <h4 className="font-bold text-base flex items-center gap-2 text-gray-700 dark:text-gray-300 mb-2">
              <FileText className="h-5 w-5" />
              OBSERVAÇÕES ADICIONAIS
            </h4>
            <p className="text-base leading-relaxed">{request.additional_info}</p>
          </div>
        )}

        <Separator className="my-4" />

        {/* ===== SEÇÃO: VALOR DO SERVIÇO ===== */}
        {request.estimated_price && (
          <div className="bg-green-100 dark:bg-green-900/40 rounded-xl p-5 border-2 border-green-400 dark:border-green-600">
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-green-800 dark:text-green-200">
                💰 VALOR DO SERVIÇO:
              </span>
              <span className="text-2xl font-black text-green-600 dark:text-green-400">
                {formatBRL(request.estimated_price)}
              </span>
            </div>
          </div>
        )}

        {/* ===== TEMPO DE ACEITE ===== */}
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-secondary/20 rounded-lg p-3">
          <Clock className="h-5 w-5" />
          <span className="font-medium">Aceito em:</span>
          <span className="font-semibold">{formatAcceptedAt()}</span>
        </div>
      </CardContent>

      <CardFooter className="flex gap-3 pt-4 pb-5">
        {/* Botão "A Caminho" - apenas para usuários cadastrados */}
        {request.status === 'ACCEPTED' && request.client_id && (
          <Button
            variant="default"
            size="lg"
            className="flex-1 bg-orange-500 hover:bg-orange-600 text-lg py-4"
            onClick={() => onMarkOnTheWay(request.id)}
          >
            <Navigation className="h-5 w-5 mr-2" />
            A Caminho
          </Button>
        )}

        {/* Botão "Encerrar" - sempre disponível */}
        <Button
          variant="default"
          size="lg"
          className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-4"
          onClick={() => onFinishService(request.id)}
        >
          <CheckCircle className="h-5 w-5 mr-2" />
          {isGuestUser ? 'Encerrar Serviço' : 'Concluir Serviço'}
        </Button>
      </CardFooter>
    </Card>
  );
};

// ✅ PHASE 1: Memoização para evitar re-renders desnecessários em listas
export const ServiceRequestInProgressCard = React.memo(ServiceRequestInProgressCardComponent, (prevProps, nextProps) => {
  return (
    prevProps.request.id === nextProps.request.id &&
    prevProps.request.status === nextProps.request.status &&
    prevProps.request.estimated_price === nextProps.request.estimated_price &&
    prevProps.onMarkOnTheWay === nextProps.onMarkOnTheWay &&
    prevProps.onFinishService === nextProps.onFinishService
  );
});
