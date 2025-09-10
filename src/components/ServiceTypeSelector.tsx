import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Truck, Wrench, Home } from 'lucide-react';
import { cn } from '@/lib/utils';

export type ServiceType = 'CARGA' | 'GUINCHO' | 'MUDANCA';

interface ServiceTypeSelectorProps {
  selectedType: ServiceType;
  onTypeChange: (type: ServiceType) => void;
  className?: string;
}

export const ServiceTypeSelector: React.FC<ServiceTypeSelectorProps> = ({
  selectedType,
  onTypeChange,
  className
}) => {
  const services = [
    {
      type: 'CARGA' as ServiceType,
      icon: Truck,
      title: 'Transporte de Carga',
      description: 'Grãos, fertilizantes e produtos agrícolas',
      color: 'text-primary'
    },
    {
      type: 'GUINCHO' as ServiceType,
      icon: Wrench,
      title: 'Serviço de Guincho',
      description: 'Reboque de veículos e equipamentos',
      color: 'text-warning'
    },
    {
      type: 'MUDANCA' as ServiceType,
      icon: Home,
      title: 'Mudanças',
      description: 'Transporte de móveis e pertences',
      color: 'text-accent'
    }
  ];

  return (
    <div className={cn("grid grid-cols-1 md:grid-cols-3 gap-4", className)}>
      {services.map((service) => {
        const Icon = service.icon;
        const isSelected = selectedType === service.type;
        
        return (
          <Card 
            key={service.type}
            className={cn(
              "cursor-pointer transition-all duration-200 hover:shadow-glow",
              isSelected 
                ? "ring-2 ring-primary shadow-glow bg-primary/5" 
                : "hover:shadow-card"
            )}
            onClick={() => onTypeChange(service.type)}
          >
            <CardContent className="p-6 text-center">
              <div className={cn(
                "mb-4 inline-flex items-center justify-center w-16 h-16 rounded-full",
                isSelected ? "gradient-primary" : "bg-muted"
              )}>
                <Icon className={cn(
                  "h-8 w-8",
                  isSelected ? "text-primary-foreground" : service.color
                )} />
              </div>
              <h3 className={cn(
                "text-lg font-semibold mb-2",
                isSelected ? "text-primary" : "text-foreground"
              )}>
                {service.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                {service.description}
              </p>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ServiceTypeSelector;