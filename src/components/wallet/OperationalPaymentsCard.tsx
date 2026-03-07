import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Fuel, Route, Wrench, CircleDot, Shield, Car, ChevronRight
} from 'lucide-react';
import { OperationalPaymentModal } from './OperationalPaymentModal';

export type ExpenseCategory =
  | 'combustivel'
  | 'pedagio'
  | 'manutencao'
  | 'pneus'
  | 'seguro'
  | 'servicos_automotivos';

interface CategoryConfig {
  key: ExpenseCategory;
  label: string;
  icon: React.ReactNode;
  description: string;
  color: string;
}

const CATEGORIES: CategoryConfig[] = [
  {
    key: 'combustivel',
    label: 'Combustível',
    icon: <Fuel className="h-5 w-5" />,
    description: 'Postos parceiros',
    color: 'text-orange-500',
  },
  {
    key: 'pedagio',
    label: 'Pedágio',
    icon: <Route className="h-5 w-5" />,
    description: 'Concessionárias',
    color: 'text-blue-500',
  },
  {
    key: 'manutencao',
    label: 'Manutenção',
    icon: <Wrench className="h-5 w-5" />,
    description: 'Oficinas parceiras',
    color: 'text-yellow-500',
  },
  {
    key: 'pneus',
    label: 'Pneus',
    icon: <CircleDot className="h-5 w-5" />,
    description: 'Fornecedores',
    color: 'text-muted-foreground',
  },
  {
    key: 'seguro',
    label: 'Seguro',
    icon: <Shield className="h-5 w-5" />,
    description: 'Seguradoras',
    color: 'text-primary',
  },
  {
    key: 'servicos_automotivos',
    label: 'Serviços Automotivos',
    icon: <Car className="h-5 w-5" />,
    description: 'Serviços gerais',
    color: 'text-accent',
  },
];

interface OperationalPaymentsCardProps {
  availableBalance: number;
  creditAvailable: number;
  role: string;
}

export const OperationalPaymentsCard: React.FC<OperationalPaymentsCardProps> = ({
  availableBalance,
  creditAvailable,
  role,
}) => {
  const [selectedCategory, setSelectedCategory] = useState<ExpenseCategory | null>(null);

  // Only show for drivers and transportadoras
  if (role === 'PRODUTOR') return null;

  const formatBRL = (v: number) =>
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

  const totalCapacity = availableBalance + creditAvailable;

  return (
    <>
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base font-semibold text-foreground">
              Pagamentos Operacionais
            </CardTitle>
            <Badge variant="outline" className="text-xs font-normal text-muted-foreground">
              Em breve: parceiros
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Pague despesas do caminhão com saldo ou crédito — tudo em um só lugar
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Capacity summary */}
          <div className="flex items-center gap-4 p-3 rounded-lg bg-muted/40 border border-border/40">
            <div className="flex-1">
              <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Capacidade de pagamento</p>
              <p className="text-lg font-bold text-foreground">{formatBRL(totalCapacity)}</p>
            </div>
            <div className="text-right space-y-0.5">
              <p className="text-[11px] text-muted-foreground">
                Saldo: <span className="text-foreground font-medium">{formatBRL(availableBalance)}</span>
              </p>
              {creditAvailable > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  Crédito: <span className="text-accent font-medium">{formatBRL(creditAvailable)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Category grid */}
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                type="button"
                onClick={() => setSelectedCategory(cat.key)}
                className="flex flex-col items-center gap-1.5 p-3 rounded-lg border border-border/40 bg-background hover:bg-muted/50 hover:border-border transition-all group min-h-[76px]"
              >
                <div className={`${cat.color} group-hover:scale-110 transition-transform`}>
                  {cat.icon}
                </div>
                <span className="text-[11px] font-medium text-foreground text-center leading-tight">
                  {cat.label}
                </span>
              </button>
            ))}
          </div>

          {/* Partner integration teaser */}
          <div className="flex items-center gap-2 p-2.5 rounded-md bg-accent/[0.06] border border-accent/15">
            <Fuel className="h-3.5 w-3.5 text-accent shrink-0" />
            <p className="text-[11px] text-muted-foreground flex-1">
              Parceiros de combustível e pedágio em breve — pague direto pelo app com cashback
            </p>
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
          </div>
        </CardContent>
      </Card>

      <OperationalPaymentModal
        open={selectedCategory !== null}
        onClose={() => setSelectedCategory(null)}
        category={selectedCategory || 'combustivel'}
        categoryConfig={CATEGORIES.find(c => c.key === selectedCategory) || CATEGORIES[0]}
        availableBalance={availableBalance}
        creditAvailable={creditAvailable}
      />
    </>
  );
};
