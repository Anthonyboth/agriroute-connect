// Sprint 1: Performance optimization - removed dead carousel code
// P0 HOTFIX: Restaurado SafeAuthModal para cadastro com seleção por cards
import React, { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ThemeToggle } from '@/components/ThemeToggle';
import { Skeleton } from '@/components/ui/skeleton';
import { PlatformStatsSection } from '@/components/LazyComponents';
// MobileMenu lazy-loaded - uses Radix Sheet, defer to avoid ui-vendor chunk on initial load
const MobileMenu = lazy(() => import('@/components/MobileMenu').then(m => ({ default: m.MobileMenu })));
// AuthModal lazy-loaded - only needed on user click
const AuthModal = lazy(() => import('@/components/AuthModal'));

// Intersection Observer wrapper for deferred loading
const LazyStatsSection = () => {
  const [shouldLoad, setShouldLoad] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: '200px' }
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref}>
      {shouldLoad ? (
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
      ) : (
        <section className="py-16 bg-muted/30" style={{ minHeight: '200px' }}>
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
      )}
    </div>
  );
};

// Lazy load modals - only load when user opens them
const MudancaModal = lazy(() => import('@/components/MudancaModal'));
const GuestServiceModal = lazy(() => import('@/components/GuestServiceModal'));
const HowItWorksModal = lazy(() => import('@/components/HowItWorksModal'));
const FreightTransportModal = lazy(() => import('@/components/FreightTransportModal').then(m => ({ default: m.FreightTransportModal })));
const ServicesModal = lazy(() => import('@/components/ServicesModal').then(m => ({ default: m.ServicesModal })));
const ServiceRequestModal = lazy(() => import('@/components/ServiceRequestModal'));
const ReportModal = lazy(() => import('@/components/ReportModal'));

// ContactSupportModal lazy-loaded - only needed on user click
const ContactSupportModal = lazy(() => import('@/components/contact/ContactSupportModal').then(m => ({ default: m.ContactSupportModal })));

// Lazy load icons - only import what's needed
import Truck from 'lucide-react/dist/esm/icons/truck';
import Users from 'lucide-react/dist/esm/icons/users';
import MapPin from 'lucide-react/dist/esm/icons/map-pin';
import Star from 'lucide-react/dist/esm/icons/star';
import ArrowRight from 'lucide-react/dist/esm/icons/arrow-right';
import Leaf from 'lucide-react/dist/esm/icons/leaf';
import Shield from 'lucide-react/dist/esm/icons/shield';
import FileText from 'lucide-react/dist/esm/icons/file-text';
import Wrench from 'lucide-react/dist/esm/icons/wrench';
import { useHeroBackground } from '@/hooks/useHeroBackground';
import { useParallax } from '@/hooks/useParallax';

const Landing: React.FC = () => {
  const navigate = useNavigate();
  // P0 HOTFIX: Removido authModal state - cadastro agora é via /auth direto
  
  const { desktopUrl: heroDesktop, mobileUrl: heroMobile } = useHeroBackground();
  const { ref: parallaxRef, style: parallaxStyle } = useParallax(0.2);
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
  const [authModal, setAuthModal] = useState(false);
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

  // P0 HOTFIX: Removido openAuthModal, closeAuthModal - causava loop infinito

  const handleServiceSelect = (service: any) => {
    setSelectedService(service);
    setServicesModal(false);
    setTimeout(() => setRequestModalOpen(true), 0);
  };

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
      icon: FileText,
      title: 'Documentação Eletrônica',
      description: 'Emissão de MDF-e, CT-e, NF-e, armazenamento e rastreio de GT-a e emissão assistida de NF-a para MEI.'
    }
  ];


  return (
    <div className="min-h-screen bg-background isolate" style={{ contain: 'layout' }}>
      {/* Header - Fixed height to prevent CLS. z-50 is sufficient since Sheet uses z-[9998+] */}
      <header className="border-b bg-card/80 sticky top-0 z-50 h-[72px] supports-[backdrop-filter]:bg-card/50 supports-[backdrop-filter]:backdrop-blur-sm">
        <div className="container mx-auto px-4 pr-2 sm:pr-4 flex items-center justify-between h-full">
          <div className="flex items-center space-x-2 sm:space-x-4">
            <div className="flex items-center space-x-2">
              <Leaf className="h-8 w-8 text-primary" />
              <span className="text-xl sm:text-2xl font-bold text-foreground">AgriRoute</span>
            </div>
          </div>
          
          {/* Desktop Navigation - P0: Contato RECRIADO com modal simples inline */}
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">Recursos</a>
            <button type="button" onClick={() => navigate('/sobre')} className="text-muted-foreground hover:text-foreground transition-smooth">Sobre</button>
            <button type="button" onClick={() => setContactModal(true)} className="text-muted-foreground hover:text-foreground transition-smooth">Contato</button>
          </nav>
          
          {/* Actions - P0 HOTFIX: Botão Cadastrar-se RESTAURADO com SafeAuthModal */}
          <div className="flex items-center space-x-2 sm:space-x-3">
            <ThemeToggle />
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setAuthModal(true);
              }}
              className="hidden md:flex gradient-primary text-primary-foreground font-medium"
            > 
              Cadastrar-se
            </Button>
            <Button 
              type="button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                navigate('/auth?mode=login');
              }}
              className="hidden md:flex bg-orange-500 hover:bg-orange-600 text-gray-900 font-medium"
            > 
              Entrar
            </Button>
            <Suspense fallback={
              <button className="flex-shrink-0 md:hidden inline-flex items-center justify-center h-10 w-10 rounded-md hover:bg-accent/50" aria-label="Menu de navegação">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
              </button>
            }>
              <MobileMenu 
                onContactClick={() => setContactModal(true)}
                onSignupClick={() => setAuthModal(true)}
              />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Hero Section - Fixed height to prevent CLS */}
      <section 
        ref={parallaxRef as React.RefObject<HTMLElement>}
        className="hero-section relative h-screen min-h-[600px] w-full flex items-center justify-center overflow-hidden" 
        style={{ contain: 'layout paint' }}
      >
        {/* Hero background with inline placeholder for faster LCP */}
        <div 
          className="absolute inset-0 bg-[#1a1a2e]"
          aria-hidden="true"
        />
        <picture className="absolute inset-0 -top-[15%] -bottom-[15%]" style={parallaxStyle}>
          <source
            media="(max-width: 640px)"
            srcSet={heroMobile}
            type="image/webp"
          />
          <img 
            src={heroDesktop}
            srcSet={`${heroMobile} 640w, ${heroDesktop} 1920w`}
            sizes="100vw"
            alt="Logística agrícola moderna - caminhão transportando carga agrícola"
            className="absolute inset-0 w-full h-full object-cover"
            loading="eager"
            fetchPriority="high"
            decoding="async"
            width="1920"
            height="1080"
          />
        </picture>
        <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        
        <div className="hero-content relative z-10 container mx-auto px-6 md:px-8 text-center max-w-5xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight px-4">
            <span className="text-foreground">Conectando Quem Precisa</span>
            <span className="block text-gradient-hero font-extrabold">
              a Quem Resolve
            </span>
          </h1>
          
          {/* Main Action Buttons - Stack vertically on mobile, horizontal on desktop */}
          <div className="max-w-3xl mx-auto px-4">
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 md:gap-4">
              <Button 
                size="lg"
                onClick={() => handleGetStarted('PRODUTOR')}
                className="gradient-primary text-primary-foreground text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-glow hover:scale-105 transition-bounce w-full sm:w-auto"
              >
                <Users className="mr-2 h-5 w-5 flex-shrink-0" />
                Sou Produtor
                <ArrowRight className="ml-2 h-5 w-5 flex-shrink-0" />
              </Button>
              <Button 
                size="lg"
                onClick={() => handleGetStarted('MOTORISTA')}
                className="bg-accent text-accent-foreground text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-elegant hover:scale-105 transition-bounce w-full sm:w-auto"
              >
                <Truck className="mr-2 h-5 w-5 flex-shrink-0" />
                Sou Motorista
                <ArrowRight className="ml-2 h-5 w-5 flex-shrink-0" />
              </Button>
            </div>
            <div className="mt-3 md:mt-4 flex justify-center">
              <Button 
                variant="outline"
                size="lg"
                onClick={() => setServicesModal(true)}
                className="border-accent text-accent hover:bg-accent hover:text-accent-foreground text-base sm:text-lg px-6 sm:px-8 py-5 sm:py-6 rounded-full shadow-elegant hover:scale-105 transition-bounce w-full sm:w-auto max-w-sm"
                aria-label="Solicitar sem Cadastro"
              >
                <Wrench className="mr-2 h-5 w-5 flex-shrink-0" aria-hidden="true" />
                Solicitar sem Cadastro
              </Button>
            </div>
          </div>
        </div>
      </section>

  {/* Stats Section - Deferred until visible */}
      <LazyStatsSection />

      {/* Features Section - deferred rendering until scrolled into view */}
      <section id="features" className="py-20" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 600px' }}>
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
      <section className="py-20 gradient-hero" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 300px' }}>
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-12 drop-shadow-lg">
            Pronto para organizar seu transporte com mais eficiência?
          </h2>
          <Button
            size="lg"
            type="button"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              navigate('/auth?mode=signup');
            }}
            className="bg-background text-foreground text-lg px-8 py-6 rounded-xl hover:scale-105 transition-bounce shadow-xl"
          >
            Começar Agora
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-card border-t py-12" style={{ contentVisibility: 'auto', containIntrinsicSize: 'auto 400px' }}>
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
                <li><a href="https://wa.me/5566992734632" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-smooth">WhatsApp: (66) 9 9273-4632</a></li>
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
              &copy; 2025 AgriRoute. Todos os direitos reservados. | 
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

      {/* P0 HOTFIX: SafeAuthModal REMOVIDO - cadastro agora é via página /auth */}
      {/* P0 HOTFIX: ContactModal antigo REMOVIDO - usando ContactSupportModal novo no final */}

      <Suspense fallback={null}>
        <GuestServiceModal
          isOpen={guestServiceModal.isOpen}
          onClose={() => setGuestServiceModal({ isOpen: false })}
          serviceType={guestServiceModal.serviceType || 'GUINCHO'}
        />
      </Suspense>
      
      <Suspense fallback={null}>
        <MudancaModal
          isOpen={mudancaModal}
          onClose={() => setMudancaModal(false)}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ServicesModal 
          isOpen={servicesModal}
          onClose={() => setServicesModal(false)}
          onSelect={handleServiceSelect}
        />
      </Suspense>

      <Suspense fallback={null}>
        <ServiceRequestModal
          isOpen={requestModalOpen && !!selectedService}
          onClose={() => {
            setRequestModalOpen(false);
            setSelectedService(null);
          }}
          serviceId={selectedService?.id || ""}
          serviceLabel={selectedService?.label || ""}
          serviceDescription={selectedService?.description || ""}
          category={selectedService?.category || "technical"}
        />
      </Suspense>

      <Suspense fallback={null}>
        <HowItWorksModal
          isOpen={howItWorksModal.isOpen}
          onClose={closeHowItWorksModal}
          userType={howItWorksModal.userType || 'PRODUTOR'}
          onProceed={handleProceedToDashboard}
        />
      </Suspense>
      
      <Suspense fallback={null}>
        <ReportModal
          isOpen={reportModal}
          onClose={() => setReportModal(false)}
        />
      </Suspense>

      {/* Modal de Contato - lazy loaded */}
      <Suspense fallback={null}>
        <ContactSupportModal
          isOpen={contactModal}
          onClose={() => setContactModal(false)}
        />
      </Suspense>


      {/* AuthModal - lazy loaded */}
      {authModal && (
        <Suspense fallback={null}>
          <AuthModal
            isOpen={authModal}
            onClose={() => setAuthModal(false)}
            initialTab="signup"
            renderMode="inline"
          />
        </Suspense>
      )}

    </div>
  );
};

export default Landing;
