import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { AgriChip } from '@/components/ui/AgriChip';
import { 
  Search,
  Clock,
  ShieldCheck,
  CheckCircle,
} from 'lucide-react';
import { ALL_SERVICE_TYPES, CATEGORY_LABELS, getServiceById, canonicalizeServiceId, type ServiceCategory } from '@/lib/service-types';

interface ServiceCatalogGridProps {
  mode: 'provider' | 'driver' | 'client';
  selectedServices?: string[];
  onServiceToggle?: (serviceId: string, checked: boolean) => void;
  onServiceRequest?: (service: any) => void;
  showCheckboxes?: boolean;
  title?: string;
  description?: string;
  initialCategory?: string;
  hideCategoryFilter?: boolean;
}

export const ServiceCatalogGrid: React.FC<ServiceCatalogGridProps> = ({
  mode,
  selectedServices = [],
  onServiceToggle,
  onServiceRequest,
  showCheckboxes = false,
  title,
  description,
  initialCategory,
  hideCategoryFilter = false
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory || 'all');

  // Filter services based on mode
  const allServices = mode === 'driver' 
    ? ALL_SERVICE_TYPES.filter(s => s.categories.includes('freight'))
    : mode === 'provider'
      ? ALL_SERVICE_TYPES.filter(s => !s.categories.includes('freight') && s.providerVisible)
      : ALL_SERVICE_TYPES;
  
  const allTabCount = allServices.length;
    
  const countByCategory = (cat: ServiceCategory) =>
    allServices.filter(s => s.categories.includes(cat)).length;

  const categories = [
    { id: 'all', label: 'Todos os Serviços', count: allTabCount },
    { id: 'agricultural', label: CATEGORY_LABELS.agricultural, count: countByCategory('agricultural') },
    { id: 'logistics', label: CATEGORY_LABELS.logistics, count: countByCategory('logistics') },
    { id: 'technical', label: CATEGORY_LABELS.technical, count: countByCategory('technical') },
    { id: 'urban', label: CATEGORY_LABELS.urban, count: countByCategory('urban') },
    ...(mode !== 'provider' ? [{ id: 'freight', label: CATEGORY_LABELS.freight, count: countByCategory('freight') }] : [])
  ];

  const filteredServices = allServices
    .filter(service => {
      const matchesSearch = service.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           service.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'all' || service.categories.includes(selectedCategory as ServiceCategory);
      
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (a.id === 'OUTROS') return 1;
      if (b.id === 'OUTROS') return -1;
      return a.label.localeCompare(b.label, 'pt-BR');
    });

  return (
    <div className="space-y-6">
      {/* Header */}
      {(title || description) && (
        <div className="text-center">
          {title && <h2 className="text-3xl font-bold mb-2">{title}</h2>}
          {description && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {description}
            </p>
          )}
        </div>
      )}

      {/* Search Bar */}
      <div className="max-w-md mx-auto">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
          <Input
            placeholder="Buscar serviços..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 pr-4 py-3 rounded-full border-2 focus:border-primary"
          />
        </div>
      </div>

      {/* Category Filters */}
      {!hideCategoryFilter && (
        <div className="flex flex-wrap justify-center gap-2">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              size="sm"
              className="rounded-full"
            >
              {category.label}
              <span className="ml-1.5 text-xs opacity-70">{category.count}</span>
            </Button>
          ))}
        </div>
      )}

      {/* Services Grid — AgriServiceCard pattern */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredServices.map((service) => {
          if (!service) return null;
          
          const IconComponent = service.icon;
          const canonicalSelected = selectedServices.map(canonicalizeServiceId);
          const isSelected = canonicalSelected.includes(service.id);
          
          return (
            <Card 
              key={service.id} 
              className={`group flex flex-col min-h-[240px] rounded-2xl border-border bg-card shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer ${
                isSelected && showCheckboxes ? 'ring-2 ring-primary border-primary/30' : ''
              }`}
              onClick={() => {
                if (showCheckboxes && onServiceToggle) {
                  onServiceToggle(service.id, !isSelected);
                }
              }}
            >
              <CardHeader className="pb-3">
                {/* Grid fixo: ícone + título */}
                <div className="grid grid-cols-[44px_1fr] gap-3 items-start">
                  {/* Checkbox antes do ícone se modo seleção */}
                  <div className="relative">
                    {showCheckboxes && (
                      <div className="absolute -top-1 -left-1 z-10">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => onServiceToggle?.(service.id, checked as boolean)}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                    {/* Ícone — 10% acento: primary translúcido */}
                    <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center border border-primary/15 transition-all duration-150 group-hover:bg-primary/15 group-hover:scale-105">
                      <IconComponent className="h-5 w-5" strokeWidth={1.75} />
                    </div>
                  </div>

                  <div className="min-w-0">
                    <CardTitle className="text-base font-bold text-foreground leading-tight truncate group-hover:text-primary transition-colors">
                      {service.label}
                    </CardTitle>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 flex flex-col flex-1">
                {/* Descrição com clamp — 60% base */}
                <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3 flex-1">
                  {service.description}
                </p>
                
                {/* Footer fixo — mt-auto */}
                <div className="mt-auto pt-3 space-y-3">
                  {/* Chips alinhados — AgriChip */}
                  <div className="flex flex-wrap gap-1.5">
                    <AgriChip tone="neutral" icon={<Clock className="h-3 w-3" />}>
                      Resposta rápida
                    </AgriChip>
                    <AgriChip tone="verified" icon={<ShieldCheck className="h-3 w-3" />}>
                      Verificado
                    </AgriChip>
                  </div>

                  {/* CTA — 10% acento */}
                  {!showCheckboxes && onServiceRequest && (
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onServiceRequest(service);
                      }} 
                      className="w-full rounded-xl"
                      size="sm"
                    >
                      Solicitar Serviço
                    </Button>
                  )}

                  {showCheckboxes && isSelected && (
                    <div className="flex items-center justify-center gap-2 text-primary">
                      <CheckCircle className="h-4 w-4" />
                      <span className="text-sm font-medium">Selecionado</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Empty State */}
      {filteredServices.length === 0 && (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">🔍</div>
          <h3 className="text-2xl font-semibold mb-2">Nenhum serviço encontrado</h3>
          <p className="text-muted-foreground mb-6">
            Tente ajustar os filtros ou termo de busca
          </p>
          <Button onClick={() => { setSearchTerm(''); setSelectedCategory('all'); }}>
            Limpar Filtros
          </Button>
        </div>
      )}

      {/* Selection Summary */}
      {showCheckboxes && selectedServices.length > 0 && (() => {
        const canonicalIds = new Set(selectedServices.map(canonicalizeServiceId));
        const count = canonicalIds.size;
        
        return (
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <CheckCircle className="h-4 w-4 text-primary" />
              <span className="font-semibold text-primary">
                {count} {count === 1 ? 'serviço selecionado' : 'serviços selecionados'}
              </span>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedServices.map(serviceId => {
                const service = getServiceById(serviceId);
                return service ? (
                  <Badge key={serviceId} variant="secondary" className="text-xs">
                    {service.label}
                  </Badge>
                ) : null;
              })}
            </div>
          </div>
        );
      })()}
    </div>
  );
};
