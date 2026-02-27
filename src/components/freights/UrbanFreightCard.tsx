/**
 * UrbanFreightCard.tsx
 * Card dedicado para fretes urbanos (FRETE_MOTO, FRETE_URBANO, etc.)
 * Segue o mesmo padrão visual do FreightCard rural, com adaptações para service_requests
 */

import React from "react";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Calendar,
  DollarSign,
  Clock,
  Edit,
  X,
  Bike,
  Package,
  Truck,
  ArrowRight,
  AlertTriangle,
} from "lucide-react";
import { formatBRL, formatDate } from "@/lib/formatters";
import { safeText } from "@/lib/safe-text";

interface UrbanFreightCardProps {
  serviceRequest: {
    id: string;
    service_type: string;
    status: string;
    problem_description?: string | null;
    location_address?: string | null;
    city_name?: string | null;
    state?: string | null;
    additional_info?: string | null;
    estimated_price?: number | null;
    final_price?: number | null;
    preferred_datetime?: string | null;
    created_at?: string | null;
    urgency?: string | null;
  };
  onEdit?: () => void;
  onCancel?: () => void;
}

export const UrbanFreightCard: React.FC<UrbanFreightCardProps> = ({
  serviceRequest,
  onEdit,
  onCancel,
}) => {
  const sr = serviceRequest;

  // ============================================
  // HELPERS: Safe field extraction
  // ============================================
  
  /**
   * Safely parse origin/destination from potential JSON or string fields
   */
  const safeParseLocation = (value: any, fallback: string = "Não informado"): string => {
    if (!value) return fallback;
    
    // If it's already a string, clean and return
    if (typeof value === "string") {
      // Check if it looks like JSON
      if (value.trim().startsWith("{") || value.trim().startsWith("[")) {
        try {
          const parsed = JSON.parse(value);
          // Try to extract meaningful fields from parsed JSON
          if (parsed.address) return parsed.address;
          if (parsed.city && parsed.state) return `${parsed.city}, ${parsed.state}`;
          if (parsed.city) return parsed.city;
          if (parsed.location) return parsed.location;
          // If we can't extract, return fallback
          return fallback;
        } catch {
          // Not valid JSON, return as-is
          return value;
        }
      }
      return value;
    }
    
    // If it's an object, try to extract location info
    if (typeof value === "object") {
      try {
        if (value.address) return value.address;
        if (value.city && value.state) return `${value.city}, ${value.state}`;
        if (value.city) return value.city;
        if (value.location) return value.location;
      } catch {
        // Ignore extraction errors
      }
      return fallback;
    }
    
    return fallback;
  };

  // ============================================
  // DERIVED DATA
  // ============================================
  
  // Origin: Prefer city_name + state, fallback to location_address
  const originDisplay = (() => {
    if (sr.city_name && sr.state) {
      return `${safeText(sr.city_name)}, ${safeText(sr.state)}`;
    }
    if (sr.city_name) {
      return safeText(sr.city_name);
    }
    if (sr.location_address) {
      return safeParseLocation(sr.location_address, "Origem não informada");
    }
    return "Origem não informada";
  })();

  // Destination: Parse from additional_info or show fallback
  const destinationDisplay = (() => {
    if (sr.additional_info) {
      return safeParseLocation(sr.additional_info, "Destino informado na descrição");
    }
    return "Destino informado na descrição";
  })();

  // Title based on service type
  const getTitle = (): string => {
    switch (sr.service_type) {
      case "FRETE_MOTO":
        return "Frete Moto (Carretinha 500kg)";
      case "FRETE_URBANO":
        return "Frete Urbano";
      default:
        return sr.problem_description || "Frete Urbano";
    }
  };

  // Icon based on service type
  const getIcon = () => {
    switch (sr.service_type) {
      case "FRETE_MOTO":
        return <Bike className="h-5 w-5 text-blue-500" />;
      case "FRETE_URBANO":
        return <Truck className="h-5 w-5 text-purple-500" />;
      default:
        return <Package className="h-5 w-5 text-primary" />;
    }
  };

  // Status badge
  const getStatusBadge = () => {
    const status = sr.status?.toUpperCase() || "OPEN";
    switch (status) {
      case "OPEN":
      case "ABERTO":
        return (
          <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-300">
            Aberto
          </Badge>
        );
      case "ACCEPTED":
      case "ACEITO":
        return (
          <Badge variant="default">
            Aceito
          </Badge>
        );
      case "IN_PROGRESS":
        return (
          <Badge variant="secondary">
            Em Andamento
          </Badge>
        );
      case "CANCELLED":
      case "CANCELADO":
        return (
          <Badge variant="destructive">
            Cancelado
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            {status}
          </Badge>
        );
    }
  };

  // Urgency badge
  const getUrgencyBadge = () => {
    const urgency = sr.urgency?.toUpperCase() || "MEDIUM";
    switch (urgency) {
      case "HIGH":
        return (
          <Badge variant="destructive" className="text-xs">
            Alta Prioridade
          </Badge>
        );
      case "LOW":
        return (
          <Badge variant="secondary" className="text-xs">
            Baixa Prioridade
          </Badge>
        );
      default:
        return (
          <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300">
            Prioridade Média
          </Badge>
        );
    }
  };

  // Pickup date display
  const pickupDate = sr.preferred_datetime || sr.created_at;
  const pickupDateFormatted = pickupDate ? formatDate(pickupDate) : "Não informada";
  
  // Check if pickup is today
  const isToday = pickupDate ? new Date(pickupDate).toDateString() === new Date().toDateString() : false;

  // Price display
  const price = sr.estimated_price || sr.final_price || 0;
  const priceFormatted = formatBRL(price);

  return (
    <Card
      data-testid="urban-freight-card"
      className="hover:shadow-lg transition-all duration-300 hover:scale-[1.02] border-2 border-border/60 overflow-hidden"
    >
      {/* HEADER */}
      <CardHeader className="pb-2 flex-shrink-0">
        <div className="space-y-2">
          {/* ROW 1: Icon + Title */}
          <div className="flex items-center gap-2">
            {getIcon()}
            <h3 className="font-semibold text-foreground text-base">
              {getTitle()}
            </h3>
          </div>

          {/* ROW 2: Status Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {getUrgencyBadge()}
            {getStatusBadge()}
            
            {/* Today badge */}
            {isToday && (
              <Badge variant="destructive" className="flex items-center gap-1 text-xs">
                <AlertTriangle className="h-3 w-3" />
                Coleta hoje
              </Badge>
            )}

            {/* Moto capacity badge */}
            {sr.service_type === "FRETE_MOTO" && (
              <Badge variant="outline" className="text-xs bg-yellow-50 text-yellow-700 border-yellow-300">
                <AlertTriangle className="h-3 w-3 mr-1" />
                Máx. 500kg
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <Separator />

      {/* CONTENT */}
      <CardContent className="py-4 space-y-4">
        {/* Origin/Destination */}
        <div className="space-y-2">
          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-green-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Origem</p>
              <p className="text-sm font-medium truncate" title={originDisplay}>
                {originDisplay}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 ml-0.5">
            <ArrowRight className="h-3 w-3 text-muted-foreground" />
          </div>

          <div className="flex items-start gap-2">
            <div className="flex-shrink-0 mt-0.5">
              <div className="w-2 h-2 rounded-full bg-red-500" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-muted-foreground">Destino</p>
              <p className="text-sm font-medium truncate" title={destinationDisplay}>
                {destinationDisplay}
              </p>
            </div>
          </div>
        </div>

        {/* Description */}
        {sr.problem_description && (
          <div className="bg-muted/50 rounded-md p-2">
            <p className="text-xs text-muted-foreground line-clamp-2">
              {safeText(sr.problem_description)}
            </p>
          </div>
        )}

        {/* Date & Price Row */}
        <div className="grid grid-cols-2 gap-4">
          {/* Date */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Coleta</p>
              <p className="text-sm font-medium">{pickupDateFormatted}</p>
            </div>
          </div>

          {/* Price */}
          <div className="flex items-center gap-2">
            <DollarSign className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Valor</p>
              <p className="text-sm font-bold text-green-600">{priceFormatted}</p>
            </div>
          </div>
        </div>
      </CardContent>

      {/* FOOTER: Action Buttons */}
      <CardFooter className="pt-0 pb-4 px-4 flex gap-2">
        <Button
          variant="outline"
          size="sm"
          className="flex-1 border-primary/30 text-primary hover:bg-primary/10 hover:border-primary/50"
          onClick={onEdit}
        >
          <Edit className="h-4 w-4 mr-1" />
          Editar
        </Button>
        <Button
          variant="destructive"
          size="sm"
          className="flex-1"
          onClick={onCancel}
        >
          <X className="h-4 w-4 mr-1" />
          Cancelar
        </Button>
      </CardFooter>
    </Card>
  );
};
