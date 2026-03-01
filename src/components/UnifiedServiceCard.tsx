/**
 * UnifiedServiceCard.tsx
 * 
 * Card padrão para exibição de serviços (service_requests) em todos os painéis.
 * Suporta todos os tipos de serviço e status, com seções condicionais.
 * Design 60/30/10: card bg (60%), muted/border (30%), primary accent (10%).
 */
import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Wrench, MapPin, Calendar, Phone, User, Edit, X,
  AlertTriangle, MessageSquare, Star, Users, Clock,
  DollarSign, Truck, PawPrint, Package, Bike, Zap,
  CheckCircle2
} from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Service type config ──

const SERVICE_TYPE_CONFIG: Record<string, { label: string; icon: React.ElementType }> = {
  GUINCHO: { label: 'Guincho', icon: Truck },
  MECANICO: { label: 'Mecânico', icon: Wrench },
  BORRACHEIRO: { label: 'Borracheiro', icon: Wrench },
  ELETRICISTA: { label: 'Eletricista', icon: Zap },
  SOCORRO_MECANICO: { label: 'Socorro Mecânico', icon: Wrench },
  MUDANCA_RESIDENCIAL: { label: 'Mudança Residencial', icon: Package },
  MUDANCA_COMERCIAL: { label: 'Mudança Comercial', icon: Package },
  MUDANCA: { label: 'Mudança', icon: Package },
  TRANSPORTE_PET: { label: 'Transporte Pet 🐾', icon: PawPrint },
  ENTREGA_PACOTES: { label: 'Entrega de Pacotes 📦', icon: Package },
  SERVICO_AGRICOLA: { label: 'Serviço Agrícola', icon: Wrench },
  SERVICO_TECNICO: { label: 'Serviço Técnico', icon: Wrench },
  FRETE_URBANO: { label: 'Frete Urbano', icon: Truck },
  FRETE_MOTO: { label: 'Moto Frete', icon: Bike },
  MOTO_FRETE: { label: 'Moto Frete', icon: Bike },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  PENDING: { label: 'Aguardando', className: 'bg-muted text-muted-foreground border-border' },
  OPEN: { label: 'Aberto', className: 'bg-primary/10 text-primary border-primary/20' },
  ACCEPTED: { label: 'Aceito', className: 'bg-primary/15 text-primary border-primary/30' },
  ON_THE_WAY: { label: 'A Caminho', className: 'bg-primary/15 text-primary border-primary/30' },
  IN_PROGRESS: { label: 'Em Andamento', className: 'bg-primary/20 text-primary border-primary/30' },
  COMPLETED: { label: 'Concluído', className: 'bg-muted text-muted-foreground border-border' },
  CANCELLED: { label: 'Cancelado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
  DELIVERED: { label: 'Entregue', className: 'bg-muted text-muted-foreground border-border' },
  EXPIRED: { label: 'Expirado', className: 'bg-destructive/10 text-destructive border-destructive/20' },
};

const URGENCY_CONFIG: Record<string, { label: string; className: string }> = {
  LOW: { label: 'Baixa', className: 'text-muted-foreground' },
  MEDIUM: { label: 'Média', className: 'text-accent-foreground' },
  HIGH: { label: 'Alta', className: 'text-destructive' },
};

export interface UnifiedServiceCardProps {
  serviceRequest: any;
  /** Provider info (for ongoing services) */
  provider?: {
    full_name?: string;
    phone?: string;
    rating?: number;
    profile_photo_url?: string;
  } | null;
  /** Client info (for provider-side view) */
  client?: {
    full_name?: string;
    phone?: string;
  } | null;
  /** Role of the viewer */
  viewerRole?: 'CLIENT' | 'PROVIDER' | 'DRIVER';
  /** Action buttons */
  onEdit?: () => void;
  onCancel?: () => void;
  onAccept?: () => void;
  onOpenChat?: () => void;
  /** Accepting state */
  accepting?: boolean;
  /** Extra content to render below (e.g. proposals) */
  children?: React.ReactNode;
}

export const UnifiedServiceCard: React.FC<UnifiedServiceCardProps> = ({
  serviceRequest,
  provider,
  client,
  viewerRole = 'CLIENT',
  onEdit,
  onCancel,
  onAccept,
  onOpenChat,
  accepting = false,
  children,
}) => {
  const sr = serviceRequest;
  const typeConfig = SERVICE_TYPE_CONFIG[sr.service_type] || { label: sr.service_type || 'Serviço', icon: Wrench };
  const Icon = typeConfig.icon;
  const statusInfo = STATUS_CONFIG[sr.status] || { label: sr.status, className: 'bg-muted text-muted-foreground border-border' };
  const urgencyInfo = sr.urgency ? URGENCY_CONFIG[sr.urgency] : null;

  // Location
  const cityName = sr.city_name || sr.location_city || '';
  const state = sr.state || sr.location_state || '';
  const locationAddress = sr.location_address || '';

  // Price
  const price = sr.final_price || sr.estimated_price;

  // Date
  const dateStr = sr.accepted_at || sr.created_at;

  const canEdit = (sr.status === 'OPEN' || sr.status === 'PENDING') && onEdit;
  const canCancel = (sr.status === 'OPEN' || sr.status === 'PENDING') && onCancel;

  return (
    <Card className="group bg-card border-border/60 hover:border-border hover:shadow-md transition-all duration-200 rounded-2xl overflow-hidden">
      <CardContent className="p-5 space-y-3.5">
        {/* ── HEADER: Icon + Title + Status ── */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="flex-shrink-0 w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Icon className="h-[18px] w-[18px] text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-sm leading-snug text-foreground line-clamp-1">
                {typeConfig.label}
              </h3>
              <span className="text-[11px] text-muted-foreground">
                #{sr.id?.slice(0, 8)}
              </span>
            </div>
          </div>
          <Badge variant="outline" className={cn("text-[10px] font-semibold border px-2 py-0.5 whitespace-nowrap", statusInfo.className)}>
            {statusInfo.label}
          </Badge>
        </div>

        {/* ── URGENCY ── */}
        {urgencyInfo && (
          <div className={cn("flex items-center gap-1.5 text-xs font-medium", urgencyInfo.className)}>
            <AlertTriangle className="h-3.5 w-3.5" />
            Urgência: {urgencyInfo.label}
          </div>
        )}

        {/* ── EMERGENCY ── */}
        {sr.is_emergency && (
          <div className="flex items-center gap-1.5 text-xs font-medium text-destructive">
            <AlertTriangle className="h-3.5 w-3.5" />
            Emergência
          </div>
        )}

        {/* ── DESCRIPTION ── */}
        {sr.problem_description && (
          <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
            📝 {sr.problem_description}
          </p>
        )}

        {/* ── LOCATION ── */}
        {(cityName || locationAddress) && (
          <div className="rounded-xl border border-border/60 overflow-hidden">
            <div className="p-3 bg-card">
              <div className="flex items-center gap-2 mb-1">
                <div className="h-2.5 w-2.5 rounded-full bg-primary/60 ring-2 ring-primary/20 flex-shrink-0" />
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Local</span>
              </div>
              {cityName && (
                <p className="text-sm font-semibold text-foreground ml-[18px]">
                  {String(cityName).toUpperCase()}{state ? ` — ${state}` : ''}
                </p>
              )}
              {locationAddress && (
                <p className="text-xs text-muted-foreground ml-[18px] line-clamp-2 mt-0.5">{locationAddress}</p>
              )}
            </div>
          </div>
        )}

        {/* ── META: Date + Price ── */}
        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
          {dateStr && (
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {new Date(dateStr).toLocaleDateString('pt-BR')}
            </span>
          )}
          {price != null && Number(price) > 0 && (
            <span className="flex items-center gap-1 font-semibold text-foreground">
              <DollarSign className="h-3.5 w-3.5" />
              R$ {Number(price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </span>
          )}
          {price == null || Number(price) === 0 ? (
            <span className="flex items-center gap-1 italic">
              <DollarSign className="h-3.5 w-3.5" />
              A combinar
            </span>
          ) : null}
        </div>

        {/* ── PROVIDER INFO (for client view) ── */}
        {provider && provider.full_name && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/40">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{provider.full_name}</p>
              {provider.phone && (
                <a href={`tel:${provider.phone}`} className="text-[11px] text-primary hover:underline flex items-center gap-1">
                  <Phone className="h-3 w-3" />
                  {provider.phone}
                </a>
              )}
            </div>
            {provider.rating && (
              <div className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                <span className="text-xs font-medium">{Number(provider.rating).toFixed(1)}</span>
              </div>
            )}
          </div>
        )}

        {/* ── CLIENT INFO (for provider/driver view) ── */}
        {client && client.full_name && (
          <div className="flex items-center gap-3 pt-2 border-t border-border/40">
            <div className="flex-shrink-0 w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-foreground truncate">{client.full_name}</p>
              {client.phone && (
                <p className="text-[11px] text-muted-foreground">{client.phone}</p>
              )}
            </div>
          </div>
        )}

        {/* ── CHAT BUTTON ── */}
        {onOpenChat && (
          <Button
            variant="outline"
            size="sm"
            className="w-full rounded-xl border-border/60 hover:border-primary/30 hover:bg-primary/5"
            onClick={onOpenChat}
          >
            <MessageSquare className="h-4 w-4 mr-2" />
            Abrir Chat
          </Button>
        )}

        {/* ── ACCEPT BUTTON (for provider/driver) ── */}
        {onAccept && (
          <Button
            className="w-full rounded-xl"
            size="sm"
            onClick={onAccept}
            disabled={accepting}
          >
            {accepting ? 'Aceitando...' : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Aceitar Solicitação
              </>
            )}
          </Button>
        )}

        {/* ── EXTRA CONTENT (proposals, etc.) ── */}
        {children}

        {/* ── EDIT / CANCEL ACTIONS ── */}
        {(canEdit || canCancel) && (
          <div className="flex gap-2.5 pt-2 border-t border-border/40">
            {canEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={onEdit}
                className="flex-1 h-9 rounded-xl border-primary/30 text-primary hover:bg-primary hover:text-primary-foreground hover:border-primary font-medium transition-all duration-200"
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
                className="flex-1 h-9 rounded-xl border-destructive/30 text-destructive hover:bg-destructive hover:text-destructive-foreground hover:border-destructive font-medium transition-all duration-200"
              >
                <X className="h-4 w-4 mr-2" />
                Cancelar
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
