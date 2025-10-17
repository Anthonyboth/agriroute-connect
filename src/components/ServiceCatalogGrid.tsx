import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { 
  Search,
  Clock,
  Shield,
  CheckCircle,
  MoreHorizontal
} from 'lucide-react';
import { ALL_SERVICE_TYPES, CATEGORY_LABELS, getServiceById } from '@/lib/service-types';

// Mapa de equivalências entre IDs canônicos e duplicatas
const EQUIVALENTS: Record<string, string[]> = {
  CARGA: ['CARGA_FREIGHT'],
  CARGA_FREIGHT: ['CARGA'],
  GUINCHO: ['GUINCHO_FREIGHT'],
  GUINCHO_FREIGHT: ['GUINCHO'],
};

// Normaliza IDs para canônicos
const toCanonical = (id: string): string => {
  if (id === 'CARGA_FREIGHT') return 'CARGA';
  if (id === 'GUINCHO_FREIGHT') return 'GUINCHO';
  return id;
};

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
  // For drivers: only show freight services (category 'freight')
  // For providers: show all service types EXCEPT freight AND only providerVisible
  // For clients: show all services
  const allServices = mode === 'driver' 
    ? ALL_SERVICE_TYPES.filter(s => s.category === 'freight')
    : mode === 'provider'
      ? ALL_SERVICE_TYPES.filter(s => s.category !== 'freight' && s.providerVisible)
      : ALL_SERVICE_TYPES;
  
  // Para motoristas na aba "Todos", mostrar todos os serviços de frete (ignorar hideFromAllTab)
  const allTabCount = mode === 'driver' 
    ? allServices.length 
    : allServices.filter(s => !s.hideFromAllTab).length;
    
  const countByCategory = (cat: 'agricultural' | 'logistics' | 'technical' | 'urban' | 'freight') =>
    allServices.filter(s => s.category === cat && !s.showOnlyInAllTab).length;

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
      const matchesCategory = selectedCategory === 'all' || service.category === selectedCategory;
      
      // Para motoristas, mostrar todos os serviços na aba "Todos"
      const showInCurrentTab = mode === 'driver' && selectedCategory === 'all'
        ? true  // Motoristas veem todos os 4 cards na aba "Todos"
        : selectedCategory === 'all' 
          ? !service.hideFromAllTab  // Outros modos mantêm a lógica original
          : (!service.showOnlyInAllTab || selectedCategory === 'all');
      
      return matchesSearch && matchesCategory && showInCurrentTab;
    })
    .sort((a, b) => {
      if (a.id === 'OUTROS') return 1;
      if (b.id === 'OUTROS') return -1;
      return a.label.localeCompare(b.label, 'pt-BR');
    });

  const getServiceIcon = (category: string) => {
    switch (category) {
      case 'agricultural': return '🚜';
      case 'freight': return '🚛';
      case 'logistics': return '📦';
      case 'technical': return '🔧';
      case 'urban': return '🏘️';
      default: return '⚙️';
    }
  };

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
        <div className="flex flex-wrap justify-center gap-3">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant={selectedCategory === category.id ? "default" : "outline"}
              onClick={() => setSelectedCategory(category.id)}
              className="rounded-full"
            >
              {category.label}
              <Badge variant="secondary" className="ml-2">
                {category.count}
              </Badge>
            </Button>
          ))}
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {filteredServices.map((service) => {
          // Proteção contra service undefined
          if (!service) {
            console.warn('Service not found in catalog');
            return null;
          }
          
          const IconComponent = service.icon;
          // Verificar se está selecionado considerando equivalentes
          const equivalents = EQUIVALENTS[service.id] || [];
          const isSelected = selectedServices.includes(service.id) || 
                            equivalents.some(eq => selectedServices.includes(eq));
          
          return (
            <Card 
              key={service.id} 
              className={`hover:shadow-lg transition-all duration-300 cursor-pointer group flex flex-col ${
                isSelected && showCheckboxes ? 'ring-2 ring-primary' : ''
              }`}
              onClick={() => {
                if (showCheckboxes && onServiceToggle) {
                  onServiceToggle(service.id, !isSelected);
                }
              }}
            >
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 flex-1">
                    {showCheckboxes && (
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={(checked) => onServiceToggle?.(service.id, checked as boolean)}
                        onClick={(e) => e.stopPropagation()}
                      />
                    )}
                    <div className={`p-3 rounded-lg ${service.color}`}>
                      <IconComponent className="h-6 w-6" />
                    </div>
                    <div>
                      <CardTitle className="text-lg group-hover:text-primary transition-colors">
                        {service.label}
                      </CardTitle>
                      <div className="flex items-center gap-1 mt-1">
                        <span className="text-xs font-medium text-muted-foreground">
                          {getServiceIcon(service.category)} {CATEGORY_LABELS[service.category as keyof typeof CATEGORY_LABELS]}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <CardContent className="pt-0 flex flex-col flex-1">
                {/* Área de conteúdo que pode crescer */}
                <div className="flex-1">
                  <CardDescription className="mb-4 leading-relaxed">
                    {service.description}
                  </CardDescription>
                  
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <div className="flex items-center gap-1">
                      <Clock className="h-4 w-4" />
                      <span>Resposta rápida</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Shield className="h-4 w-4" />
                      <span>Verificado</span>
                    </div>
                  </div>
                </div>
                
                {/* Botão fixado no fundo */}
                <div className="mt-auto">
                  {!showCheckboxes && onServiceRequest && (
                    <Button 
                      onClick={(e) => {
                        e.stopPropagation();
                        onServiceRequest(service);
                      }} 
                      className="w-full group-hover:bg-primary group-hover:text-primary-foreground transition-all"
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
        // Normalizar para IDs canônicos e contar únicos
        const canonicalIds = new Set(selectedServices.map(toCanonical));
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
                // Procurar primeiro no allServices
                let service = allServices.find(s => s.id === serviceId);
                
                // Se não encontrar, procurar pelo equivalente
                if (!service) {
                  const equivalents = EQUIVALENTS[serviceId] || [];
                  for (const eq of equivalents) {
                    service = allServices.find(s => s.id === eq);
                    if (service) break;
                  }
                }
                
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
