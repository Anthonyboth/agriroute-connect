import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  MapPin, 
  Star, 
  Clock, 
  Phone, 
  Search,
  Filter,
  User,
  Wrench,
  Car,
  Truck,
  Settings,
  Fuel,
  Zap,
  Shield
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { ServiceRequestModal } from './ServiceRequestModal';

interface ServiceProvider {
  id: string;
  profile_id: string;
  service_type: string;
  service_radius_km: number;
  base_price?: number;
  hourly_rate?: number;
  emergency_service: boolean;
  work_hours_start: string;
  work_hours_end: string;
  works_weekends: boolean;
  works_holidays: boolean;
  specialties: string[];
  certifications: string[];
  service_area_cities: string[];
  equipment_description?: string;
  profiles: {
    full_name: string;
    phone?: string;
    profile_photo_url?: string;
    rating?: number;
    total_ratings?: number;
  };
}

interface ServiceProvidersListingProps {
  isOpen: boolean;
  onClose: () => void;
  serviceType: string;
  serviceTitle: string;
}

const serviceIcons: Record<string, React.ComponentType<any>> = {
  GUINCHO: Truck,
  MECANICO: Settings,
  BORRACHEIRO: Car,
  ELETRICISTA_AUTOMOTIVO: Zap,
  COMBUSTIVEL: Fuel,
  CHAVEIRO: Shield,
  SOLDADOR: Wrench,
  PINTURA: Settings,
  VIDRACEIRO: Settings,
  AR_CONDICIONADO: Settings,
  FREIOS: Settings,
  SUSPENSAO: Settings
};

export const ServiceProvidersListing: React.FC<ServiceProvidersListingProps> = ({
  isOpen,
  onClose,
  serviceType,
  serviceTitle
}) => {
  const { toast } = useToast();
  const [providers, setProviders] = useState<ServiceProvider[]>([]);
  const [filteredProviders, setFilteredProviders] = useState<ServiceProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('');
  const [emergencyFilter, setEmergencyFilter] = useState<boolean | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ServiceProvider | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchProviders();
    }
  }, [isOpen, serviceType]);

  useEffect(() => {
    filterProviders();
  }, [providers, searchTerm, cityFilter, emergencyFilter]);

  const fetchProviders = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_providers')
        .select(`
          *,
          profiles!service_providers_profile_id_fkey (
            full_name,
            phone,
            profile_photo_url,
            rating,
            total_ratings
          )
        `)
        .eq('service_type', serviceType)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setProviders(data || []);
    } catch (error) {
      console.error('Erro ao buscar prestadores:', error);
      toast({
        title: "Erro",
        description: "Erro ao carregar prestadores de serviços.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filterProviders = () => {
    let filtered = [...providers];

    if (searchTerm) {
      filtered = filtered.filter(provider =>
        provider.profiles.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        provider.specialties.some(s => s.toLowerCase().includes(searchTerm.toLowerCase())) ||
        provider.service_area_cities.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }

    if (cityFilter) {
      filtered = filtered.filter(provider =>
        provider.service_area_cities.some(c => 
          c.toLowerCase().includes(cityFilter.toLowerCase())
        )
      );
    }

    if (emergencyFilter !== null) {
      filtered = filtered.filter(provider => 
        provider.emergency_service === emergencyFilter
      );
    }

    setFilteredProviders(filtered);
  };

  const handleRequestService = (provider: ServiceProvider) => {
    setSelectedProvider(provider);
    setShowRequestModal(true);
  };

  const formatWorkingHours = (start: string, end: string) => {
    return `${start.slice(0, 5)} às ${end.slice(0, 5)}`;
  };

  const formatPrice = (price?: number) => {
    if (!price) return 'Sob consulta';
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL'
    }).format(price);
  };

  const ServiceIcon = serviceIcons[serviceType] || Settings;

  const allCities = [...new Set(providers.flatMap(p => p.service_area_cities))];

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-2xl">
              <ServiceIcon className="h-6 w-6" />
              {serviceTitle} Disponíveis
            </DialogTitle>
          </DialogHeader>

          <div className="flex flex-col h-full">
            {/* Filtros */}
            <div className="flex flex-col sm:flex-row gap-4 mb-6 p-4 bg-muted/30 rounded-lg">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, especialidade ou cidade..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              
              <Select value={cityFilter} onValueChange={setCityFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Filtrar por cidade" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todas as cidades</SelectItem>
                  {allCities.map(city => (
                    <SelectItem key={city} value={city}>{city}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={emergencyFilter === null ? '' : emergencyFilter.toString()} onValueChange={(value) => setEmergencyFilter(value === '' ? null : value === 'true')}>
                <SelectTrigger className="w-full sm:w-48">
                  <SelectValue placeholder="Atendimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Todos</SelectItem>
                  <SelectItem value="true">Apenas emergência 24h</SelectItem>
                  <SelectItem value="false">Horário comercial</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Lista de Prestadores */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                </div>
              ) : filteredProviders.length === 0 ? (
                <div className="text-center py-12">
                  <ServiceIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-muted-foreground mb-2">
                    Nenhum prestador encontrado
                  </p>
                  <p className="text-muted-foreground">
                    Tente ajustar os filtros ou aguarde novos cadastros
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {filteredProviders.map((provider) => (
                    <Card key={provider.id} className="hover:shadow-lg transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <Avatar className="h-12 w-12">
                              <AvatarImage src={provider.profiles.profile_photo_url} />
                              <AvatarFallback>
                                <User className="h-6 w-6" />
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <CardTitle className="text-lg">
                                {provider.profiles.full_name}
                              </CardTitle>
                              <div className="flex items-center gap-2 mt-1">
                                {provider.profiles.rating && (
                                  <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                                    <span className="text-sm font-medium">
                                      {provider.profiles.rating.toFixed(1)}
                                    </span>
                                    <span className="text-sm text-muted-foreground">
                                      ({provider.profiles.total_ratings} avaliações)
                                    </span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                          
                          {provider.emergency_service && (
                            <Badge variant="destructive" className="text-xs">
                              Emergência 24h
                            </Badge>
                          )}
                        </div>
                      </CardHeader>

                      <CardContent className="space-y-4">
                        {/* Preços */}
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-muted-foreground">Preço base:</p>
                            <p className="font-medium">{formatPrice(provider.base_price)}</p>
                          </div>
                          <div>
                            <p className="text-muted-foreground">Por hora:</p>
                            <p className="font-medium">{formatPrice(provider.hourly_rate)}</p>
                          </div>
                        </div>

                        {/* Horário de funcionamento */}
                        <div className="flex items-center gap-2 text-sm">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>
                            {formatWorkingHours(provider.work_hours_start, provider.work_hours_end)}
                          </span>
                          {provider.works_weekends && (
                            <Badge variant="outline" className="text-xs ml-2">
                              Fins de semana
                            </Badge>
                          )}
                        </div>

                        {/* Área de atendimento */}
                        <div className="flex items-start gap-2 text-sm">
                          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-muted-foreground">Atende em:</p>
                            <div className="flex flex-wrap gap-1 mt-1">
                              {provider.service_area_cities.slice(0, 3).map(city => (
                                <Badge key={city} variant="secondary" className="text-xs">
                                  {city}
                                </Badge>
                              ))}
                              {provider.service_area_cities.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{provider.service_area_cities.length - 3} cidades
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Especialidades */}
                        {provider.specialties.length > 0 && (
                          <div className="text-sm">
                            <p className="text-muted-foreground mb-1">Especialidades:</p>
                            <div className="flex flex-wrap gap-1">
                              {provider.specialties.slice(0, 3).map(specialty => (
                                <Badge key={specialty} variant="outline" className="text-xs">
                                  {specialty}
                                </Badge>
                              ))}
                              {provider.specialties.length > 3 && (
                                <Badge variant="outline" className="text-xs">
                                  +{provider.specialties.length - 3} mais
                                </Badge>
                              )}
                            </div>
                          </div>
                        )}

                        {/* Botões de ação */}
                        <div className="flex gap-2 pt-2">
                          <Button 
                            onClick={() => handleRequestService(provider)}
                            className="flex-1"
                          >
                            Solicitar Serviço
                          </Button>
                          {provider.profiles.phone && (
                            <Button
                              variant="outline"
                              size="icon"
                              onClick={() => {
                                const phone = provider.profiles.phone?.replace(/\D/g, '');
                                const message = encodeURIComponent(`Olá! Vi seu perfil no AgriRoute e gostaria de solicitar um orçamento para ${serviceTitle.toLowerCase()}.`);
                                window.open(`https://wa.me/55${phone}?text=${message}`, '_blank');
                              }}
                            >
                              <Phone className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {selectedProvider && (
        <ServiceRequestModal
          isOpen={showRequestModal}
          onClose={() => {
            setShowRequestModal(false);
            setSelectedProvider(null);
          }}
          provider={selectedProvider}
          serviceType={serviceType}
          serviceTitle={serviceTitle}
        />
      )}
    </>
  );
};