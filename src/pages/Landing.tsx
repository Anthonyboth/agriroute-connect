import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import AuthModal from '@/components/AuthModal';
import GuinchoModal from '@/components/GuinchoModal';
import MudancaModal from '@/components/MudancaModal';
import GuestServiceModal from '@/components/GuestServiceModal';
import HowItWorksModal from '@/components/HowItWorksModal';
import { ServicesModal } from '@/components/ServicesModal';
import { ContactModal } from '@/components/ContactModal';
import { Truck, Users, MapPin, Star, ArrowRight, Leaf, Shield, Clock, Wrench, Home, MessageCircle, Mail } from 'lucide-react';
import heroImage from '@/assets/hero-logistics.jpg';
import { supabase } from '@/integrations/supabase/client';

const Landing = () => {
  const navigate = useNavigate();
  const [authModal, setAuthModal] = useState<{ isOpen: boolean; initialTab?: 'login' | 'signup' }>({
    isOpen: false,
  });
  const [guinchoModal, setGuinchoModal] = useState(false);
  const [mudancaModal, setMudancaModal] = useState(false);
  const [guestServiceModal, setGuestServiceModal] = useState<{ isOpen: boolean; serviceType?: 'GUINCHO' | 'MUDANCA' | 'FRETE_URBANO' }>({
    isOpen: false,
  });
  const [servicesModal, setServicesModal] = useState(false);
  const [howItWorksModal, setHowItWorksModal] = useState<{ isOpen: boolean; userType?: 'PRODUTOR' | 'MOTORISTA' }>({
    isOpen: false,
  });
  const [contactModal, setContactModal] = useState(false);
  const [realStats, setRealStats] = useState({
    totalProducers: 0,
    totalDrivers: 0,
    totalWeight: 0,
    completedFreights: 0,
    totalUsers: 0,
    averageRating: 0
  });

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

  const fetchRealStats = async () => {
    try {
      const { data, error } = await supabase.rpc('get_platform_stats');
      if (error) throw error;

      if (data && data.length > 0) {
        const row = data[0] as any;
        setRealStats({
          totalProducers: Number(row.produtores) || 0,
          totalDrivers: Number(row.motoristas) || 0,
          totalWeight: Math.round(Number(row.peso_total) || 0),
          completedFreights: Number(row.fretes_entregues) || 0,
          totalUsers: Number(row.total_usuarios) || 0,
          averageRating: Math.round(((Number(row.avaliacao_media) || 0) * 10)) / 10,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar estatísticas:', error);
    }
  };

  useEffect(() => {
    fetchRealStats();

    const interval = setInterval(fetchRealStats, 30000);

    const channel = supabase
      .channel('landing-stats')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => fetchRealStats())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'freights' }, () => fetchRealStats())
      .subscribe();

    return () => {
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, []);

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

  const stats = [
    { 
      value: realStats.totalProducers > 0 ? `${realStats.totalProducers.toLocaleString()}` : '0', 
      label: 'Produtores Conectados' 
    },
    { 
      value: realStats.totalDrivers > 0 ? `${realStats.totalDrivers.toLocaleString()}` : '0', 
      label: 'Motoristas Ativos' 
    },
    { 
      value: realStats.totalWeight > 0 ? `${(realStats.totalWeight / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}k ton` : '0 ton', 
      label: 'Toneladas Transportadas' 
    },
    { 
      value: realStats.averageRating > 0 ? `${realStats.averageRating.toFixed(1)}★` : '0★', 
      label: 'Avaliação Média' 
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">AgriRoute</span>
          </div>
            <nav className="hidden md:flex items-center space-x-6">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-smooth">
                Recursos
              </a>
              <a href="/sobre" className="text-muted-foreground hover:text-foreground transition-smooth">
                Sobre
              </a>
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
        <div
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{
            backgroundImage: `url(${heroImage})`,
          }}
        >
          <div className="absolute inset-0 bg-gradient-to-r from-background/90 via-background/50 to-transparent" />
        </div>
        
        <div className="relative z-10 container mx-auto px-6 md:px-8 text-center max-w-5xl">
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold mb-8 leading-tight px-4">
            <span className="text-foreground">Conectando o Campo</span>
            <span className="block gradient-hero bg-clip-text text-transparent font-extrabold">
              ao Destino
            </span>
          </h1>
          <p className="text-lg md:text-xl lg:text-2xl text-foreground/80 mb-12 max-w-3xl mx-auto font-medium px-4 leading-relaxed">
            A plataforma que revoluciona o transporte agrícola brasileiro, 
            conectando produtores e transportadores de forma inteligente.
          </p>
          
          {/* Main Action Buttons in 2x2 Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 max-w-4xl mx-auto px-4">
            <Button 
              size="lg"
              onClick={() => handleGetStarted('PRODUTOR')}
              className="gradient-primary text-primary-foreground text-lg px-8 py-6 rounded-xl shadow-glow hover:scale-105 transition-bounce"
            >
              <Users className="mr-2 h-5 w-5" />
              Sou Produtor
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              size="lg"
              onClick={() => handleGetStarted('MOTORISTA')}
              className="bg-accent text-accent-foreground text-lg px-8 py-6 rounded-xl shadow-elegant hover:scale-105 transition-bounce"
            >
              <Truck className="mr-2 h-5 w-5" />
              Sou Motorista
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            
            <Button 
              variant="outline"
              onClick={() => setServicesModal(true)}
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6 rounded-xl shadow-elegant hover:scale-105 transition-bounce"
            >
              <Wrench className="mr-2 h-5 w-5" />
              Preciso de Guincho ou Serviços
            </Button>
            <Button 
              variant="outline"
              onClick={() => setGuestServiceModal({ isOpen: true, serviceType: 'MUDANCA' })}
              className="border-accent text-accent hover:bg-accent hover:text-accent-foreground text-lg px-8 py-6 rounded-xl shadow-elegant hover:scale-105 transition-bounce"
            >
              <Home className="mr-2 h-5 w-5" />
              Preciso de Frete Urbano ou Mudança
            </Button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
              Nossos Números
            </h2>
            <p className="text-lg text-muted-foreground">
              Resultados que comprovam nossa excelência
            </p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center shadow-card">
                <CardContent className="p-6">
                  <div className="text-3xl md:text-4xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

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
            {features.map((feature, index) => (
              <Card key={index} className="shadow-card hover:shadow-glow transition-smooth group">
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
          <h2 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Pronto para revolucionar seu negócio?
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-12 max-w-2xl mx-auto">
            Junte-se à maior rede de logística agrícola do Brasil
          </p>
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
                Conectando produtores e transportadores no agronegócio brasileiro.
              </p>
              <div className="flex space-x-4 text-sm text-muted-foreground">
                <span>+5.000 usuários</span>
                <span>•</span>
                <span>4.8★ avaliação</span>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Plataforma</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/sobre" className="hover:text-foreground transition-smooth">Sobre nós</a></li>
                <li><button onClick={() => setHowItWorksModal({ isOpen: true })} className="hover:text-foreground transition-smooth text-left">Como funciona</button></li>
                <li><a href="/imprensa" className="hover:text-foreground transition-smooth">Imprensa</a></li>
                <li><button onClick={() => setContactModal(true)} className="hover:text-foreground transition-smooth text-left">Carreiras</button></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Suporte</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/cadastro-prestador" className="hover:text-foreground transition-smooth">Ser Prestador</a></li>
                <li><a href="#contact" className="hover:text-foreground transition-smooth">Central de Ajuda</a></li>
                <li><a href="mailto:anthony_pva@hotmail.com" className="hover:text-foreground transition-smooth">Contato</a></li>
                <li><a href="/status" className="hover:text-foreground transition-smooth">Status</a></li>
                <li><a href="https://wa.me/5566999426656" target="_blank" rel="noopener noreferrer" className="hover:text-foreground transition-smooth">WhatsApp</a></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4">Legal</h4>
              <ul className="space-y-2 text-muted-foreground">
                <li><a href="/privacidade" className="hover:text-foreground transition-smooth">Privacidade</a></li>
                <li><a href="/termos" className="hover:text-foreground transition-smooth">Termos</a></li>
                <li><a href="/cookies" className="hover:text-foreground transition-smooth">Cookies</a></li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col md:flex-row justify-between items-center text-muted-foreground">
            <p>
              &copy; 2024 AgriRoute. Todos os direitos reservados. | 
              <a href="/system-test" className="hover:text-foreground transition-smooth ml-1">
                Verificação do Sistema
              </a>
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

      <GuinchoModal
        isOpen={guinchoModal}
        onClose={() => setGuinchoModal(false)}
      />
      
      <MudancaModal
        isOpen={mudancaModal}
        onClose={() => setMudancaModal(false)}
      />

      <ServicesModal 
        isOpen={servicesModal}
        onClose={() => setServicesModal(false)}
      />

      {howItWorksModal.userType && (
        <HowItWorksModal
          isOpen={howItWorksModal.isOpen}
          onClose={closeHowItWorksModal}
          userType={howItWorksModal.userType}
          onProceed={handleProceedToDashboard}
        />
      )}
    </div>
  );
};

export default Landing;