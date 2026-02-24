import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Brain, Truck, Home, Wrench, ArrowRight, Check, X } from 'lucide-react';

const DEMO_FREIGHTS = [
  {
    id: '1',
    cargo: 'Soja 45 toneladas',
    service: 'CARGA',
    origin: 'Sorriso, MT',
    destination: 'Paranaguá, PR',
    price: 'R$ 8.500',
    compatible: { CARGA: true, MUDANCA: false, GUINCHO: false }
  },
  {
    id: '2', 
    cargo: 'Mudança residencial',
    service: 'MUDANCA',
    origin: 'São Paulo, SP',
    destination: 'Campinas, SP',
    price: 'R$ 1.200',
    compatible: { CARGA: false, MUDANCA: true, GUINCHO: false }
  },
  {
    id: '3',
    cargo: 'Socorro veicular',
    service: 'GUINCHO',
    origin: 'BR-364 km 850',
    destination: 'Cuiabá, MT',
    price: 'R$ 450',
    compatible: { CARGA: false, MUDANCA: false, GUINCHO: true }
  },
  {
    id: '4',
    cargo: 'Fertilizantes 25t',
    service: 'CARGA',
    origin: 'Campo Grande, MS',
    destination: 'Dourados, MS',
    price: 'R$ 2.800',
    compatible: { CARGA: true, MUDANCA: false, GUINCHO: false }
  }
];

const DRIVER_TYPES = [
  { 
    id: 'CARGA', 
    label: 'Motorista Carga', 
    icon: Truck, 
    color: 'bg-primary/10 text-primary border-primary/20',
    services: ['CARGA']
  },
  { 
    id: 'MUDANCA', 
    label: 'Motorista Mudanças', 
    icon: Home, 
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    services: ['MUDANCA']
  },
  { 
    id: 'GUINCHO', 
    label: 'Motorista Guincho', 
    icon: Wrench, 
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    services: ['GUINCHO']
  }
];

export const MatchIntelligentDemo: React.FC = () => {
  const getServiceIcon = (service: string) => {
    switch (service) {
      case 'CARGA': return Truck;
      case 'MUDANCA': return Home;
      case 'GUINCHO': return Wrench;
      default: return Truck;
    }
  };

  const getServiceColor = (service: string) => {
    switch (service) {
      case 'CARGA': return 'bg-primary/10 text-primary border-primary/20';
      case 'MUDANCA': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'GUINCHO': return 'bg-orange-100 text-orange-800 border-orange-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  return (
    // ✅ CORREÇÃO CSS: Card com largura total e centralizado
    <Card className="w-full max-w-4xl mx-auto">
      <CardHeader className="text-center sm:text-left">
        <CardTitle className="flex items-center justify-center sm:justify-start gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Como Funciona o Match Inteligente
        </CardTitle>
        <CardDescription>
          Veja como diferentes tipos de motorista veem diferentes fretes compatíveis
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {DRIVER_TYPES.map((driverType, driverIndex) => {
          const IconComponent = driverType.icon;
          
          return (
            <div key={driverType.id}>
              <div className="flex flex-wrap items-center gap-2 mb-4">
                <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                  <IconComponent className="h-5 w-5" />
                  <span className="font-semibold">{driverType.label}</span>
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">Vê apenas fretes compatíveis:</span>
              </div>

              <div className="grid gap-3 ml-0 sm:ml-6">
                {DEMO_FREIGHTS.map((freight) => {
                  const FreightIcon = getServiceIcon(freight.service);
                  const isCompatible = freight.compatible[driverType.id as keyof typeof freight.compatible];
                  
                  return (
                    <div 
                      key={`${driverType.id}-${freight.id}`}
                      className={`flex flex-col gap-3 p-3 rounded-lg border transition-all sm:flex-row sm:items-center sm:justify-between ${
                        isCompatible 
                          ? 'bg-green-50 border-green-200' 
                          : 'bg-red-50 border-red-200 opacity-50'
                      }`}
                    >
                      <div className="flex items-start gap-3 min-w-0 flex-1">
                        <div className={`p-2 rounded shrink-0 ${isCompatible ? 'bg-green-100' : 'bg-red-100'}`}>
                          {isCompatible ? (
                            <Check className="h-4 w-4 text-green-600" />
                          ) : (
                            <X className="h-4 w-4 text-red-600" />
                          )}
                        </div>
                        
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <FreightIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                            <span className="font-medium break-words">{freight.cargo}</span>
                            <Badge className={getServiceColor(freight.service)}>
                              {freight.service === 'CARGA' ? 'Carga' : 
                               freight.service === 'MUDANCA' ? 'Mudança' : 'Guincho'}
                            </Badge>
                          </div>
                          <div className="text-xs text-muted-foreground mt-1 break-words sm:hidden">
                            {freight.origin} → {freight.destination}
                          </div>
                        </div>
                      </div>

                      <div className="text-left sm:text-right shrink-0">
                        <div className="font-semibold text-green-600">{freight.price}</div>
                        <div className="text-xs text-muted-foreground hidden sm:block">
                          {freight.origin} → {freight.destination}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {driverIndex < DRIVER_TYPES.length - 1 && (
                <Separator className="my-6" />
              )}
            </div>
          );
        })}

        {/* Resumo dos Benefícios */}
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 mt-6">
          <h4 className="font-semibold text-primary mb-2">Benefícios do Sistema Inteligente:</h4>
          <ul className="space-y-1 text-sm text-muted-foreground">
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              <span>Motoristas de carga só veem cargas agrícolas</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              <span>Motoristas de mudança só veem mudanças residenciais/comerciais</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              <span>Motoristas de guincho só veem chamadas de socorro</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              <span>Reduz tempo perdido com fretes incompatíveis</span>
            </li>
            <li className="flex items-center gap-2">
              <Check className="h-3 w-3 text-primary" />
              <span>Aumenta eficiência e satisfação dos motoristas</span>
            </li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};