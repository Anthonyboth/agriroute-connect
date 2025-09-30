import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  MapPin,
  Clock,
  Shield,
  Star,
  Users,
  Truck,
  Home,
  Wrench
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Header from '@/components/Header';
import { useAuth } from '@/hooks/useAuth';
import ServiceRequestModal from '@/components/ServiceRequestModal';
import CreateFreightModal from '@/components/CreateFreightModal';
import { MudancaModal } from '@/components/MudancaModal';
import GuestServiceModal from '@/components/GuestServiceModal';
import { BackButton } from '@/components/BackButton';
import { ServiceCatalogGrid } from '@/components/ServiceCatalogGrid';

const Services: React.FC = () => {
  const navigate = useNavigate();
  const { profile, signOut } = useAuth();
  const [selectedService, setSelectedService] = useState<any>(null);
  const [showFreightModal, setShowFreightModal] = useState(false);
  const [showMudancaModal, setShowMudancaModal] = useState(false);
  const [showGuestServiceModal, setShowGuestServiceModal] = useState(false);
  const [guestServiceType, setGuestServiceType] = useState<'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO'>('GUINCHO');

  const handleServiceRequest = (service: any) => {
    setSelectedService(service);
  };

  const handleLogout = async () => {
    await signOut();
    navigate('/');
  };

  const handleMenuClick = () => {
    console.log('Menu clicked');
  };

  const handleFreightRequest = (type: 'CARGA' | 'GUINCHO' | 'MUDANCA') => {
    if (type === 'CARGA') {
      setShowFreightModal(true);
    } else if (type === 'MUDANCA') {
      setShowMudancaModal(true);
    } else if (type === 'GUINCHO') {
      setGuestServiceType('GUINCHO');
      setShowGuestServiceModal(true);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header 
        user={{ name: profile?.full_name || 'Usuário', role: (profile?.role as any) || 'GUEST' }}
        onMenuClick={handleMenuClick}
        onLogout={handleLogout}
        userProfile={profile}
        notifications={0}
      />

      <div className="container mx-auto py-8 px-4">
        {/* Back Button */}
        <div className="mb-4">
          <BackButton to="/dashboard/service-provider" />
        </div>

        {/* Services Catalog */}
        <ServiceCatalogGrid
          mode="client"
          onServiceRequest={handleServiceRequest}
          title="Serviços Disponíveis"
          description="Encontre profissionais qualificados para suas necessidades. Conectamos você com os melhores prestadores de serviço da sua região."
        />

        {/* Freight Services Section */}
        <section className="mt-16 mb-12">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Fretes e Transporte</h2>
            <p className="text-lg text-muted-foreground">
              Precisa transportar cargas ou fazer mudanças? Temos a solução ideal para você.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Frete de Carga */}
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <Truck className="h-8 w-8 text-primary" />
                </div>
                <CardTitle className="text-xl">Frete de Carga</CardTitle>
                <CardDescription>
                  Transporte de produtos agrícolas, grãos, fertilizantes e cargas em geral
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Cobertura regional e nacional</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Seguro incluso</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Star className="h-4 w-4" />
                    <span>Motoristas avaliados</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleFreightRequest('CARGA')} 
                  className="w-full"
                >
                  Solicitar Frete
                </Button>
              </CardContent>
            </Card>

            {/* Mudanças e Frete Urbano */}
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                  <Home className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle className="text-xl">Mudanças e Frete Urbano</CardTitle>
                <CardDescription>
                  Mudanças residenciais, comerciais e transporte urbano
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Cobertura urbana</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Users className="h-4 w-4" />
                    <span>Equipe especializada</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Agendamento flexível</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleFreightRequest('MUDANCA')} 
                  className="w-full"
                  variant="outline"
                >
                  Solicitar Mudança
                </Button>
              </CardContent>
            </Card>

            {/* Guincho e Socorro */}
            <Card className="hover:shadow-lg transition-all duration-300">
              <CardHeader className="text-center pb-4">
                <div className="mx-auto w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
                  <Wrench className="h-8 w-8 text-orange-600" />
                </div>
                <CardTitle className="text-xl">Guincho e Socorro</CardTitle>
                <CardDescription>
                  Reboque de veículos, socorro rodoviário e assistência 24h
                </CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <div className="space-y-2 mb-6 text-sm text-muted-foreground">
                  <div className="flex items-center justify-center gap-2">
                    <Clock className="h-4 w-4" />
                    <span>Atendimento 24/7</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <MapPin className="h-4 w-4" />
                    <span>Localização GPS</span>
                  </div>
                  <div className="flex items-center justify-center gap-2">
                    <Shield className="h-4 w-4" />
                    <span>Socorro rápido</span>
                  </div>
                </div>
                <Button 
                  onClick={() => handleFreightRequest('GUINCHO')} 
                  className="w-full"
                  variant="outline"
                >
                  Chamar Guincho
                </Button>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* Call to Action */}
        <section className="text-center py-12 bg-primary/5 rounded-2xl">
          <h2 className="text-2xl font-bold mb-4">Não encontrou o que procura?</h2>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Entre em contato conosco e ajudaremos você a encontrar o serviço ideal
          </p>
          <Button size="lg">
            Falar com Suporte
          </Button>
        </section>

        {/* Frete Urbano - CTA final */}
        <section className="mt-8">
          <div className="max-w-2xl mx-auto text-center">
            <h3 className="text-xl font-semibold mb-2">Precisa de Frete Urbano?</h3>
            <p className="text-muted-foreground mb-4">Transporte rápido dentro da cidade para pequenas e médias cargas.</p>
            <Button size="lg" onClick={() => { setGuestServiceType('FRETE_URBANO'); setShowGuestServiceModal(true); }}>
              Solicitar Frete Urbano
            </Button>
          </div>
        </section>
      </div>

      {/* Modals */}
      {selectedService && (
        <ServiceRequestModal
          isOpen={true}
          onClose={() => setSelectedService(null)}
          serviceId={selectedService.id}
          serviceLabel={selectedService.label}
          serviceDescription={selectedService.description}
          category={selectedService.category}
        />
      )}

      {showFreightModal && (
        <CreateFreightModal
          onFreightCreated={() => {
            setShowFreightModal(false);
            // Opcional: adicionar callback se necessário
          }}
          userProfile={profile}
        />
      )}

      <MudancaModal
        isOpen={showMudancaModal}
        onClose={() => setShowMudancaModal(false)}
      />

      <GuestServiceModal
        isOpen={showGuestServiceModal}
        onClose={() => setShowGuestServiceModal(false)}
        serviceType={guestServiceType}
      />
    </div>
  );
};

export default Services;