import React from 'react';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Wrench, 
  MapPin, 
  Calendar, 
  Phone, 
  User,
  Edit,
  X,
  AlertTriangle,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { toUF, formatCityDisplay } from '@/utils/city-deduplication';
import { cn } from '@/lib/utils';

interface ServiceRequestCardProps {
  serviceRequest: any;
  onEdit?: () => void;
  onCancel?: () => void;
}

export const ServiceRequestCard: React.FC<ServiceRequestCardProps> = ({
  serviceRequest,
  onEdit,
  onCancel,
}) => {
  const sr = serviceRequest;

  // Safe field extraction
  const safeParseLocation = (value: any, fallback: string = "Não informado"): string => {
    if (!value) return fallback;
    if (typeof value === "string") {
      if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          if (parsed.address) return parsed.address;
          if (parsed.city && parsed.state) {
            const uf = toUF(parsed.state) || parsed.state;
            return formatCityDisplay(parsed.city, uf);
          }
          if (parsed.city) return parsed.city;
          return fallback;
        } catch {
          return value;
        }
      }
      return value;
    }
    if (typeof value === "object" && value !== null) {
      if (value.address) return value.address;
      if (value.city && value.state) {
        const uf = toUF(value.state) || value.state;
        return formatCityDisplay(value.city, uf);
      }
      if (value.city) return value.city;
    }
    return fallback;
  };

  const origin = safeParseLocation(sr.location_address || sr.origin);
  const destination = safeParseLocation(sr.destination_address || sr.destination);
  
  const serviceTypeLabels: Record<string, string> = {
    GUINCHO: "Guincho",
    MUDANCA_RESIDENCIAL: "Mudança Residencial",
    MUDANCA_COMERCIAL: "Mudança Comercial",
    SERVICO_AGRICOLA: "Serviço Agrícola",
    SERVICO_TECNICO: "Serviço Técnico",
    FRETE_URBANO: "Frete Urbano",
    FRETE_MOTO: "Frete Moto",
    TRANSPORTE_PET: "Transporte de Pet",
    ENTREGA_PACOTES: "Entrega de Pacotes",
    MECANICO: "Mecânico",
    BORRACHEIRO: "Borracheiro",
    ELETRICISTA: "Eletricista",
    SOCORRO_MECANICO: "Socorro Mecânico",
  };

  const serviceTypeLabel = serviceTypeLabels[sr.service_type] || sr.service_type;
  const cargoTitle = sr.problem_description || (serviceTypeLabel ? `Solicitação de ${serviceTypeLabel}` : sr.service_type) || "Serviço solicitado";

  const statusConfig: Record<string, { label: string; className: string }> = {
    OPEN: { label: "Aberto", className: "bg-primary/10 text-primary border-primary/20" },
    ABERTO: { label: "Aberto", className: "bg-primary/10 text-primary border-primary/20" },
    AGUARDANDO: { label: "Aguardando", className: "bg-accent/10 text-accent-foreground border-accent/20" },
    EM_ANDAMENTO: { label: "Em Andamento", className: "bg-primary/15 text-primary border-primary/30" },
    CONCLUIDO: { label: "Concluído", className: "bg-muted text-muted-foreground border-border" },
    CANCELADO: { label: "Cancelado", className: "bg-destructive/10 text-destructive border-destructive/20" },
  };

  const statusInfo = statusConfig[sr.status] || { label: sr.status, className: "bg-muted text-muted-foreground border-border" };

  const urgencyConfig: Record<string, { label: string; className: string }> = {
    LOW: { label: "Baixa", className: "text-muted-foreground" },
    MEDIUM: { label: "Média", className: "text-accent-foreground" },
    HIGH: { label: "Alta", className: "text-destructive" },
  };

  const urgencyInfo = sr.urgency ? urgencyConfig[sr.urgency] : null;

  const canEdit = (sr.status === "OPEN" || sr.status === "ABERTO") && onEdit;
  const canCancel = (sr.status === "OPEN" || sr.status === "ABERTO") && onCancel;

  return (
    <Card className="group bg-card border-border/60 hover:border-border hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden">
      <CardContent className="p-5 space-y-4">
        {/* === HEADER: Título + Status === */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {/* 10% accent — ícone com destaque */}
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Wrench className="h-4.5 w-4.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-2">
                {cargoTitle}
              </h3>
              {/* 30% depth — badge de tipo */}
              <Badge variant="outline" className="mt-1.5 text-[10px] font-medium bg-muted/50 text-muted-foreground border-border/60 px-2 py-0.5">
                {serviceTypeLabel}
              </Badge>
            </div>
          </div>
          {/* 10% accent — badge status */}
          <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5 whitespace-nowrap", statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* === URGÊNCIA === */}
        {urgencyInfo && (
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium",
            urgencyInfo.className
          )}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Urgência: {urgencyInfo.label}
          </div>
        )}

        {/* === LOCALIZAÇÃO — 60% base bg, 30% depth borders === */}
        <div className="rounded-xl border border-border/60 overflow-hidden">
          {/* Origem */}
          <div className="p-3 bg-card">
            <div className="flex items-center gap-2 mb-1">
              <div className="h-2.5 w-2.5 rounded-full bg-primary/60 ring-2 ring-primary/20 flex-shrink-0" />
              <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Origem</span>
            </div>
            <p className="text-sm font-medium text-foreground ml-[18px] line-clamp-2">{origin}</p>
            {(sr.origin_neighborhood || sr.origin_street || sr.origin_number) && (
              <div className="ml-[18px] mt-1 text-[11px] text-muted-foreground/80 space-y-0.5">
                {sr.origin_neighborhood && <p>{sr.origin_neighborhood}</p>}
                {(sr.origin_street || sr.origin_number) && (
                  <p>{[sr.origin_street, sr.origin_number && `nº ${sr.origin_number}`].filter(Boolean).join(', ')}</p>
                )}
              </div>
            )}
          </div>

          {/* Divider + Destino (condicional) */}
          {destination && destination !== "Não informado" && (
            <>
              <div className="border-t border-border/40" />
              <div className="p-3 bg-muted/30">
                <div className="flex items-center gap-2 mb-1">
                  <div className="h-2.5 w-2.5 rounded-full bg-muted-foreground/40 ring-2 ring-muted-foreground/10 flex-shrink-0" />
                  <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Destino</span>
                </div>
                <p className="text-sm font-medium text-foreground ml-[18px] line-clamp-2">{destination}</p>
                {(sr.destination_neighborhood || sr.destination_street || sr.destination_number) && (
                  <div className="ml-[18px] mt-1 text-[11px] text-muted-foreground/80 space-y-0.5">
                    {sr.destination_neighborhood && <p>{sr.destination_neighborhood}</p>}
                    {(sr.destination_street || sr.destination_number) && (
                      <p>{[sr.destination_street, sr.destination_number && `nº ${sr.destination_number}`].filter(Boolean).join(', ')}</p>
                    )}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* === DATA === */}
        {sr.preferred_date && (
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            <span>{format(new Date(sr.preferred_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</span>
          </div>
        )}

        {/* === CONTATO — 30% depth section === */}
        {(sr.contact_name || sr.contact_phone) && (
          <div className="flex items-center gap-3 pt-3 border-t border-border/40">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              {sr.contact_name && (
                <p className="text-xs font-medium text-foreground truncate">{sr.contact_name}</p>
              )}
              {sr.contact_phone && (
                <p className="text-[11px] text-muted-foreground">{sr.contact_phone}</p>
              )}
            </div>
          </div>
        )}
      </CardContent>

      {/* === AÇÕES — botões com regra 60/30/10 === */}
      {(canEdit || canCancel) && (
        <CardFooter className="px-5 pb-4 pt-0 flex gap-2.5">
          {canEdit && (
            <Button
              variant="outline"
              size="sm"
              onClick={onEdit}
              className="flex-1 h-10 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary shadow-sm transition-all duration-200 font-medium"
            >
              <Edit className="h-4 w-4 mr-2" />
              Editar
            </Button>
          )}
          {canCancel && (
            <Button
              variant="outline"
              size="sm"
              onClick={onCancel}
              className="flex-1 h-10 rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive shadow-sm transition-all duration-200 font-medium"
            >
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </CardFooter>
      )}
    </Card>
  );
};
