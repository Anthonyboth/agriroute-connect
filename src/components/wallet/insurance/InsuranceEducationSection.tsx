import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Shield, TrendingUp, Users, Truck } from 'lucide-react';

export const InsuranceEducationSection: React.FC = () => (
  <Card className="bg-primary/5 border-primary/20">
    <CardContent className="p-4 space-y-3">
      <h4 className="font-semibold text-sm flex items-center gap-2">
        <Shield className="h-4 w-4 text-primary" />
        Por que contratar seguro?
      </h4>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="flex items-start gap-2">
          <Truck className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            O transporte de cargas envolve riscos como roubo, acidentes e avarias. O seguro protege você contra prejuízos financeiros.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <TrendingUp className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Motoristas segurados têm prioridade no marketplace e maior confiança dos produtores.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <Users className="h-4 w-4 text-primary mt-0.5 shrink-0" />
          <p className="text-xs text-muted-foreground">
            Proteja sua atividade profissional e garanta a continuidade da sua operação.
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
);
