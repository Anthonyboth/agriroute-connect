import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Shield, Truck, Wrench, Users, HeartPulse, Package, Eye, ShoppingCart } from 'lucide-react';
import type { InsuranceProduct } from '@/hooks/useInsurance';

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const categoryConfig: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
  transporte: { label: 'Transporte', icon: <Truck className="h-4 w-4" />, color: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200' },
  operacional: { label: 'Operacional', icon: <Package className="h-4 w-4" />, color: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200' },
  profissional: { label: 'Profissional', icon: <Users className="h-4 w-4" />, color: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200' },
  pessoal: { label: 'Pessoal', icon: <HeartPulse className="h-4 w-4" />, color: 'bg-rose-100 text-rose-800 dark:bg-rose-900 dark:text-rose-200' },
};

interface InsuranceProductCardProps {
  product: InsuranceProduct;
  onViewDetails: (product: InsuranceProduct) => void;
  onContract: (product: InsuranceProduct) => void;
}

export const InsuranceProductCard = React.memo<InsuranceProductCardProps>(({
  product,
  onViewDetails,
  onContract,
}) => {
  const cat = categoryConfig[product.category] || categoryConfig.transporte;
  const priceLabel = product.pricing_model === 'percentage'
    ? `${product.min_price}% – ${product.max_price}% do valor`
    : `${formatBRL(product.min_price)} – ${formatBRL(product.max_price)}/mês`;

  return (
    <Card className="hover:shadow-md transition-shadow border-primary/20 hover:border-primary/40">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-primary/10">
              <Shield className="h-5 w-5 text-primary" />
            </div>
            <CardTitle className="text-base leading-tight">{product.name}</CardTitle>
          </div>
          <Badge className={`shrink-0 text-xs ${cat.color}`}>
            {cat.icon}
            <span className="ml-1">{cat.label}</span>
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground line-clamp-2">{product.description}</p>

        {product.max_coverage && (
          <div className="text-sm">
            <span className="text-muted-foreground">Cobertura até </span>
            <span className="font-semibold text-foreground">{formatBRL(product.max_coverage)}</span>
          </div>
        )}

        <div className="text-sm">
          <span className="text-muted-foreground">Preço estimado: </span>
          <span className="font-semibold text-primary">{priceLabel}</span>
        </div>

        <div className="flex gap-2 pt-1">
          <Button
            variant="outline"
            size="sm"
            className="flex-1 gap-1"
            type="button"
            onClick={() => onViewDetails(product)}
          >
            <Eye className="h-3.5 w-3.5" />
            Detalhes
          </Button>
          <Button
            size="sm"
            className="flex-1 gap-1"
            type="button"
            onClick={() => onContract(product)}
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            Contratar
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

InsuranceProductCard.displayName = 'InsuranceProductCard';
