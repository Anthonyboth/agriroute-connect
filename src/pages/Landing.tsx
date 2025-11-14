import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import AuthModal from '@/components/AuthModal';
import MudancaModal from '@/components/MudancaModal';
import GuestServiceModal from '@/components/GuestServiceModal';
import HowItWorksModal from '@/components/HowItWorksModal';
import { FreightTransportModal } from '@/components/FreightTransportModal';
import { ServicesModal } from '@/components/ServicesModal';
import ServiceRequestModal from '@/components/ServiceRequestModal';
import { ContactModal } from '@/components/ContactModal';
import ReportModal from '@/components/ReportModal';
import { Truck, Users, MapPin, Star, ArrowRight, Leaf, Shield, Clock, Wrench } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import agriRouteLogo from '@/assets/agriroute-logo-158.webp';
import { supabase } from '@/integrations/supabase/client';
import Autoplay from "embla-carousel-autoplay";
import { 
  Carousel, 
  CarouselContent, 
  CarouselItem 
} from "@/components/ui/carousel";
import { lazy, Suspense } from 'react';
import { Skeleton } from '@/components/ui/skeleton';

// Lazy load PlatformStatsSection para economizar bundle inicial
const PlatformStatsSection = lazy(() => 
  import('@/components/PlatformStatsSection').then(module => ({ default: module.PlatformStatsSection }))
);

const Landing: React.FC = () => {
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; initialTab?: 'login' | 'signup' }>({
    isOpen: false,
  });
  
  const partners = [
    { id: 1, name: 'AgriRoute', logo: agriRouteLogo },
    { id: 2, name: 'Parceiro 2', logo: null },
    { id: 3, name: 'Parceiro 3', logo: null },
    { id: 4, name: 'Parceiro 4', logo: null },
    { id: 5, name: 'Parceiro 5', logo: null },
    { id: 6, name: 'Parceiro 6', logo: null },
    { id: 7, name: 'Parceiro 7', logo: null },
    { id: 8, name: 'Parceiro 8', logo: null },
    { id: 9, name: 'Parceiro 9', logo: null },
    { id: 10, name: 'Parceiro 10', logo: null },
  ];
  
  // Filtrar apenas parceiros com logo
  const partnersWithLogo = partners.filter(partner => partner.logo !== null);
  
  const [mudancaModal, setMudancaModal] = useState(false);
  const [guestServiceModal, setGuestServiceModal] = useState<{ isOpen: boolean; serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' }>({
    isOpen: false,
  });
  const [servicesModal, setServicesModal] = useState(false);
  const [freightTransportModal, setFreightTransportModal] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any | null>(null);
  const [howItWorksModal, setHowItWorksModal] = useState<{ isOpen: boolean; userType?: 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' }>({
    isOpen: false,
  });
  const [contactModal, setContactModal] = useState(false);
  const [reportModal, setReportModal] = useState(false);

  const handleGetStarted = (userType: 'PRODUTOR' | 'MOTORISTA') => {
    setHowItWorksModal({ isOpen: true, userType });
  };

  const closeHowItWorksModal = () => {
    setHowItWorksModal({ isOpen: false });
  };

  const handleProceedToDashboard = () => {
    const userType = howItWorksModal.userType;
    if (userType) {
      const route = userType === 'PRODUTOR' ? '/dashboard/producer' : '/dashboard/driver';
      navigate(route);
    }
    closeHowItWorksModal();
  };

  const openAuthModal = (initialTab?: 'login' | 'signup') => {
    setAuthModal({ isOpen: true, initialTab });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false });
  };

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setServicesModal(false);
    setTimeout(() => setRequestModalOpen(true), 0);
  };

  const { profiles, switchProfile, session } = useAuth();
  const redirectedRef = useRef(false);
  // Redirecionamento prioritário por querystring (para links de convite)
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search);
    const inviteCode = searchParams.get('invite');
    const affiliateCompanyId = searchParams.get('cadastro_afiliado');
    const inviteToken = searchParams.get('inviteToken');

    if (inviteCode) {
      navigate(`/company-invite/${inviteCode}`, { replace: true });
      return;
    }

    if (affiliateCompanyId) {
      navigate(`/cadastro-afiliado/${affiliateCompanyId}`, { replace: true });
      return;
    }

    if (inviteToken) {
      navigate(`/cadastro-motorista?inviteToken=${encodeURIComponent(inviteToken)}`, { replace: true });
      return;
    }
  }, [navigate]);

  // Auto-switch para TRANSPORTADORA quando houver perfil TRANSPORTADORA
  useEffect(() => {
    if (redirectedRef.current) return;
    if (!session?.user?.id) return;

    let cancelled = false;

    const checkAndRedirect = async () => {
      try {
        // Buscar perfil TRANSPORTADORA se houver múltiplos perfis
        const transportProfile = profiles.find((p: any) => p.role === 'TRANSPORTADORA');
        if (transportProfile && !cancelled) {
          // Verificar se existe registro em transport_companies
          const { data: company } = await supabase
            .from('transport_companies')
            .select('id')
            .eq('profile_id', transportProfile.id)
            .maybeSingle();

          if (company && !cancelled) {
            redirectedRef.current = true;
            switchProfile(transportProfile.id);
            navigate('/dashboard/company', { replace: true });
            return;
          }
        }

        // Verificar perfil atual
        const { data: profile } = await supabase
          .from('profiles')
          .select('id, role, active_mode')
          .eq('user_id', session.user.id)
          .maybeSingle();

        if (!profile || cancelled) return;

        // Verificar se é transportadora pelo active_mode ou por registro
        const { data: currentCompany } = await supabase
          .from('transport_companies')
          .select('id')
          .eq('profile_id', profile.id)
          .maybeSingle();

        if ((currentCompany || profile.active_mode === 'TRANSPORTADORA') && !cancelled) {
          redirectedRef.current = true;
          navigate('/dashboard/company', { replace: true });
        }
      } catch (e) {
        // Ignore errors to avoid blocking UI
      }
    };

    checkAndRedirect();

    return () => { cancelled = true; };
  }, [navigate, switchProfile, session?.user?.id, profiles]);

  const features = [
    {
      icon: Truck,
      title: 'Logística Inteligente',
      description: 'Conecte produtores e transportadores de forma eficiente e segura.'
    },
    {
      icon: MapPin,
      title: 'Rastreamento em Tempo Real',
      description: 'Acompanhe suas cargas em tempo real com nossa tecnologia avançada.'
    },
    {
      icon: Shield,
      title: 'Transações Seguras',
      description: 'Pagamentos protegidos e contratos digitais para sua tranquilidade.'
    },
    {
      icon: Clock,
      title: 'Entrega Pontual',
      description: 'Otimização de rotas para garantir entregas no prazo.'
    }
  ];


  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Leaf className="h-8 w-8 text-primary" />
              <span className="text-2xl font-bold text-foreground">AgriRoute</span>
            </div>
            <ThemeToggle />
          </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">
                Recursos
              </a>
              <Link to="/sobre" className="text-muted-foreground hover:text-foreground transition-smooth">
                Sobre
              </Link>
              <button 
                onClick={() => setContactModal(true)}
                className="text-muted-foreground hover:text-foreground transition-smooth"
              >
                Contato
              </button>
            </nav>
            <div className="flex items-center space-x-4">
              <Button variant="ghost" onClick={() => navigate('/auth')}> 
                Entrar
              </Button>
              <Button onClick={() => navigate('/auth')} className="gradient-primary text-primary-foreground">
                Cadastrar-se
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setServicesModal(true)}
                className="hidden lg:flex"
              >
                Solicitar Serviço
              </Button>
            </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative min-h-[80vh] flex items-center justify-center overflow-hidden">
        <img 
          src="/hero-truck-night-moon.webp" 
          alt="Logística agrícola moderna"
          className="absolute inset-0 w-full h-full object-cover"
          loading="eager"
          width="1920"
          height="1080"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        
        <div className="relative z-10 container mx-auto px-6 md:px-8 text-center max-w-5xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight px-4">
            <span className="text-foreground">Conectando Quem Precisa</span>
            <span className="block gradient-hero bg-clip-text text-transparent font-extrabold">
              a Quem Resolve
            </span>
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-foreground/80 mb-12 max-w-3xl mx-auto font-medium px-4 leading-relaxed">
            Plataforma para conectar e organizar o transporte agrícola de forma inteligente.
          </p>
          
          {/* Main Action Buttons - Centered Group */}
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-3 md:gap-4">
              <Button 
                size="lg"
                onClick={() => handleGetStarted('PRODUTOR')}
                className="gradient-primary text-primary-foreground text-lg px-8 py-6 rounded-full shadow-glow hover:scale-105 transition-bounce"
              >
                <Users className="mr-2 h-5 w-5" />
                Sou Produtor
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <Button 
                size="lg"
                onClick={() => handleGetStarted('MOTORISTA')}
                className="bg-accent text-accent-foreground text-lg px-8 py-6 rounded-full shadow-elegant hover:scale-105 transition-bounce"
              >
                <Truck className="mr-2 h-5 w-5" />
                Sou Motorista
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
            <div className="mt-3 md:mt-4 flex justify-center">
              <Button 
                variant="outline"
                size="lg"
                onClick={() => setServicesModal(true)}
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground text-base md:text-lg px-8 py-6 rounded-full shadow-elegant hover:scale-105 transition-bounce"
              >
                <Wrench className="mr-2 h-5 w-5" />
                Solicitar sem Cadastro
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section - Lazy loaded */}
      <Suspense fallback={
        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="text-center">
                  <Skeleton className="h-12 w-32 mx-auto mb-2" />
                  <Skeleton className="h-6 w-24 mx-auto" />
                </div>
              ))}
            </div>
          </div>
        </section>
      }>
        <PlatformStatsSection />
      </Suspense>

      {/* Features Section */}
      <section id="features" className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-foreground mb-6">
              Por que escolher a AgriRoute?
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Tecnologia de ponta para otimizar sua cadeia logística agrícola
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <Card key={feature.title} className="shadow-card hover:shadow-glow transition-smooth group">
                <CardContent className="p-8 text-center">
                  <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary">
                    <feature.icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground mb-4 group-hover:text-primary transition-smooth">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-12">
            Pronto para organizar seu transporte com mais eficiência?
          </h2>
          <Button
            size="lg"
            onClick={() => navigate('/auth')}
            className="bg-background text-foreground text-lg px-8 py-6 rounded-xl hover:scale-105 transition-bounce shadow-xl"
          >
            Começar Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Partners Section */}
      {partnersWithLogo.length > 0 && (
        <section className="py-16 bg-muted/10 border-y">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                Parceiros
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Organizações que apoiam nossa plataforma
              </p>
            </div>
            
            <Carousel
              opts={{
                align: "start",
                loop: partnersWithLogo.length > 4,
              }}
              plugins={partnersWithLogo.length > 4 ? [
                Autoplay({
                  delay: 3000,
                  stopOnInteraction: false,
                  stopOnMouseEnter: true,
                })
              ] : []}
              className="w-full max-w-6xl mx-auto"
            >
              <CarouselContent className="-ml-2 md:-ml-4">
                {partnersWithLogo.map((partner) => (
                  <CarouselItem 
                    key={partner.id}
                    className="pl-2 md:pl-4 basis-1/2 md:basis-1/3 lg:basis-1/4"
                  >
                    <div className="p-4">
                      <Card className="border-0 bg-transparent hover:shadow-xl hover:scale-105 transition-all duration-300">
                        <CardContent className="flex aspect-square items-center justify-center p-8">
                          <img 
                            src={partner.logo as string} 
                            alt={partner.name}
                            width="158"
                            height="158"
                            loading="lazy"
                            className="max-w-full max-h-full object-contain grayscale hover:grayscale-0 transition-all duration-300"
                          />
                        </CardContent>
                      </Card>
                    </div>
                  </CarouselItem>
                ))}
              </CarouselContent>
            </Carousel>
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="bg-card border-t py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-6">
                <Leaf className="h-8 w-8 text-primary" />
                <span className="text-2xl font-bold">AgriRoute</span>
              </div>
              <p className="text-muted-foreground mb-4">
                Conectando pessoas no agronegócio brasileiro.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Plataforma</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/sobre" className="hover:text-foreground transition-smooth">Sobre nós</Link></li>
                <li><button onClick={() => setHowItWorksModal({ isOpen: true })} className="hover:text-foreground transition-smooth text-left">Como funciona</button></li>
                <li><Link to="/imprensa" className="hover:text-foreground transition-smooth">Imprensa</Link></li>
                <li><Link to="/carreiras" className="hover:text-foreground transition-smooth">Carreiras</Link></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Suporte</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/cadastro-prestador" className="hover:text-foreground transition-smooth">Ser Prestador</Link></li>
                <li><Link to="/ajuda" className="hover:text-foreground transition-smooth">Central de Ajuda</Link></li>
                <li><button onClick={() => setContactModal(true)} className="hover:text-foreground transition-smooth text-left">Contato</button></li>
                <li><Link to="/status" className="hover:text-foreground transition-smooth">Status</Link></li>
                <li><a href="https://wa.me/5566999426656" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-smooth">WhatsApp</a></li>
              </ul>
            </div>
            
            <div>
              <h3 className="font-semibold text-foreground mb-4">Legal</h3>
              <ul className="space-y-2 text-muted-foreground">
                <li><Link to="/privacidade" className="hover:text-foreground transition-smooth">Privacidade</Link></li>
                <li><Link to="/termos" className="hover:text-foreground transition-smooth">Termos</Link></li>
                <li><Link to="/cookies" className="hover:text-foreground transition-smooth">Cookies</Link></li>
                <li><button onClick={() => setReportModal(true)} className="hover:text-foreground transition-smooth text-left text-muted-foreground">Denunciar</button></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-muted-foreground">
            <p>
              &copy; 2024 AgriRoute. Todos os direitos reservados. | 
              <Link to="/system-test" className="hover:text-foreground transition-smooth ml-1">
                Verificação do Sistema
              </Link>
            </p>
            <p className="text-xs mt-2 md:mt-0">
              Agronegócio representa 24.8% do PIB brasileiro
            </p>
          </div>
        </div>
      </footer>

      <AuthModal 
        isOpen={authModal.isOpen}
        onClose={closeAuthModal}
        initialTab={authModal.initialTab}
      />

      <ContactModal
        isOpen={contactModal}
        onClose={() => setContactModal(false)}
      />

      <GuestServiceModal
        isOpen={guestServiceModal.isOpen}
        onClose={() => setGuestServiceModal({ isOpen: false })}
        serviceType={guestServiceModal.serviceType || 'GUINCHO'}
      />
      
      <MudancaModal
        isOpen={mudancaModal}
        onClose={() => setMudancaModal(false)}
      />

      <ServicesModal 
        isOpen={servicesModal}
        onClose={() => setServicesModal(false)}
        onSelect={handleServiceSelect}
      />

      {selectedService && requestModalOpen && (
        <ServiceRequestModal
          isOpen={true}
          onClose={() => {
            setRequestModalOpen(false);
            setSelectedService(null);
          }}
          serviceId={selectedService.id}
          serviceLabel={selectedService.label}
          serviceDescription={selectedService.description}
          category={selectedService.category}
        />
      )}

      {howItWorksModal.isOpen && (
        <HowItWorksModal
          isOpen={howItWorksModal.isOpen}
          onClose={closeHowItWorksModal}
          userType={howItWorksModal.userType || 'PRODUTOR'}
          onProceed={handleProceedToDashboard}
        />
      )}
      <ReportModal
        isOpen={reportModal}
        onClose={() => setReportModal(false)}
      />
    </div>
  );
};

export default Landing;
