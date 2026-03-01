import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { SignedAvatarImage } from '@/components/ui/signed-avatar-image';
import { Clock, CheckCircle, XCircle, Truck, Star, Building2 } from 'lucide-react';
import type { PendingDeliveryItem } from '@/hooks/usePendingDeliveryConfirmations';
import { getCanonicalFreightPrice } from '@/lib/freightPriceContract';

interface PendingDeliveryConfirmationCardProps {
  item: PendingDeliveryItem;
  onConfirmDelivery: () => void;
  onDispute?: () => void;
  isHighlighted?: boolean;
}

export const PendingDeliveryConfirmationCard: React.FC<PendingDeliveryConfirmationCardProps> = ({
  item,
  onConfirmDelivery,
  onDispute,
  isHighlighted = false,
}) => {
  // ✅ Contrato canônico: nunca formata preço manualmente
  const priceDisplay = getCanonicalFreightPrice({
    pricing_type: (item.freight as any).pricing_type,
    price_per_ton: (item.freight as any).price_per_ton,
    price_per_km: (item.freight as any).price_per_km,
    price: item.agreed_price || item.freight.price,
    required_trucks: item.freight.required_trucks,
    weight: (item.freight as any).weight,
    distance_km: (item.freight as any).distance_km,
  });
  return (
    <Card 
      className={`h-full flex flex-col border-amber-200 ${
        isHighlighted 
          ? 'bg-yellow-50 dark:bg-yellow-900/20 shadow-xl animate-pulse border-l-yellow-500' 
          : 'bg-amber-50/50'
      } border-l-4 border-l-amber-500`}
    >
      <CardHeader className="pb-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-2 flex-1 min-w-0">
            {/* Indicador de Multi-carreta */}
            {item.freight.required_trucks > 1 && (
              <div className="flex items-center gap-1 text-xs text-blue-600 font-medium">
                <Truck className="h-3 w-3" />
                <span>Frete Multi-carreta ({item.freight.required_trucks} carretas)</span>
              </div>
            )}
            
            <h4 className="font-semibold text-lg line-clamp-1">
              {item.freight.cargo_type}
            </h4>
            <p className="text-sm text-muted-foreground line-clamp-1">
              {item.freight.origin_city || item.freight.origin_address} → {item.freight.destination_city || item.freight.destination_address}
            </p>
            
            {/* Badge de urgência */}
            <div className={`inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-bold ${
              item.deliveryDeadline.isCritical 
                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400' 
                : item.deliveryDeadline.isUrgent 
                ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' 
                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
            }`}>
              <Clock className="h-3 w-3" />
              {item.deliveryDeadline.displayText}
            </div>
            
            <p className="text-xs font-medium text-amber-700 mt-2">
              ⏰ Entrega reportada - Aguardando confirmação
            </p>
          </div>
          
          <div className="text-right flex-shrink-0 space-y-2">
            <Badge variant="secondary" className="bg-amber-100 text-amber-800 border-amber-300 whitespace-nowrap">
              Aguardando Confirmação
            </Badge>
            <p className="text-lg font-bold text-green-600 whitespace-nowrap">
              {priceDisplay.primaryLabel}
            </p>
            {priceDisplay.secondaryLabel && (
              <p className="text-xs text-muted-foreground">
                {priceDisplay.secondaryLabel}
              </p>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4 h-full pt-0">
        {/* Dados do motorista */}
        <div className="bg-secondary/30 rounded-lg p-3">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <SignedAvatarImage src={item.driver.profile_photo_url} alt={item.driver.full_name} />
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {item.driver.full_name?.charAt(0) || 'M'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="font-medium truncate">{item.driver.full_name}</p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {item.driver.rating && (
                  <span className="flex items-center gap-0.5">
                    <Star className="h-3 w-3 text-yellow-500 fill-yellow-500" />
                    {Number(item.driver.rating).toFixed(1)}
                  </span>
                )}
                {item.company && (
                  <span className="flex items-center gap-0.5 text-blue-600">
                    <Building2 className="h-3 w-3" />
                    {item.company.company_name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Informações adicionais */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="min-w-0">
            <p className="font-medium text-xs text-muted-foreground">Reportado em:</p>
            <p className="text-foreground text-xs">
              {new Date(item.deliveryDeadline.reportedAt).toLocaleString('pt-BR')}
            </p>
          </div>
          <div className="min-w-0">
            <p className="font-medium text-xs text-muted-foreground">Prazo confirmação:</p>
            <p className="text-foreground text-xs">
              72h após reportado
            </p>
          </div>
        </div>

        {/* Botões de ação: apenas Confirmar e Contestar */}
        <div className="mt-auto grid grid-cols-2 gap-3">
          <Button 
            size="sm" 
            variant="destructive"
            type="button"
            className="w-full"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onDispute?.();
            }}
          >
            <XCircle className="h-4 w-4 mr-1.5" />
            Contestar
          </Button>
          <Button 
            size="sm" 
            type="button"
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              onConfirmDelivery();
            }}
          >
            <CheckCircle className="h-4 w-4 mr-1.5" />
            Confirmar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
