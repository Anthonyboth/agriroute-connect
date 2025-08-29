import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AuthModal } from "@/components/AuthModal";
import { Truck, Package, MapPin, Shield, Clock, Star, ArrowRight, Play } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import heroImage from "@/assets/hero-logistics.jpg";
import agriRouteLogo from "@/assets/agriroute-logo.png";

export default function Landing() {
  const [authModal, setAuthModal] = useState({ isOpen: false, tab: 'login' as 'login' | 'signup' });
  const navigate = useNavigate();

  const handleGetStarted = (type: 'PRODUTOR' | 'MOTORISTA') => {
    // For demo purposes, direct navigation based on user type
    if (type === 'PRODUTOR') {
      navigate('/dashboard/producer');
    } else {
      navigate('/dashboard/driver');
    }
  };

  const openAuthModal = (tab: 'login' | 'signup' = 'signup') => {
    setAuthModal({ isOpen: true, tab });
  };

  const closeAuthModal = () => {
    setAuthModal({ isOpen: false, tab: 'login' });
  };

  const features = [
    {
      icon: MapPin,
      title: "Rastreamento em Tempo Real",
      description: "Acompanhe sua carga do ponto de origem até o destino final"
    },
    {
      icon: Shield,
      title: "Segurança Garantida",
      description: "Motoristas verificados e cargas seguradas para sua tranquilidade"
    },
    {
      icon: Clock,
      title: "Entrega no Prazo",
      description: "Sistema inteligente de otimização de rotas e prazos"
    },
    {
      icon: Star,
      title: "Avaliações Confiáveis",
      description: "Sistema de reputação para produtores e motoristas"
    }
  ];

  const stats = [
    { number: "15K+", label: "Fretes Realizados" },
    { number: "2.5K+", label: "Motoristas Ativos" },
    { number: "800+", label: "Produtores Cadastrados" },
    { number: "98%", label: "Satisfação dos Clientes" }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={agriRouteLogo} alt="AgriRoute" className="h-8 w-8" />
            <div>
              <h1 className="text-xl font-bold gradient-primary bg-clip-text text-transparent">
                AgriRoute
              </h1>
              <p className="text-xs text-muted-foreground">Logística Agrícola</p>
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            <Button variant="ghost">Sobre</Button>
            <Button variant="ghost">Contato</Button>
            <Button variant="outline" onClick={() => openAuthModal('login')}>Entrar</Button>
            <Button variant="hero" onClick={() => openAuthModal('signup')}>Cadastre-se</Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div 
          className="absolute inset-0 bg-cover bg-center bg-no-repeat"
          style={{ backgroundImage: `url(${heroImage})` }}
        />
        <div className="absolute inset-0 bg-primary/85" />
        
        <div className="relative container py-24 text-center text-white">
          <Badge variant="secondary" className="mb-6 text-primary">
            🚚 Plataforma #1 em Logística Agrícola
          </Badge>
          
          <h1 className="text-5xl md:text-6xl font-bold mb-6 leading-tight">
            Conectamos
            <span className="block gradient-hero bg-clip-text text-transparent">
              Produtores & Motoristas
            </span>
          </h1>
          
          <p className="text-xl md:text-2xl mb-8 max-w-3xl mx-auto opacity-90">
            A plataforma completa para transporte de cargas agrícolas. 
            Encontre fretes, gerencie entregas e aumente sua eficiência.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-12">
            <Button 
              variant="hero" 
              size="xl" 
              onClick={() => handleGetStarted('PRODUTOR')}
            >
              <Package className="mr-2 h-5 w-5" />
              Sou Produtor
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
            <Button 
              variant="outline" 
              size="xl"
              className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              onClick={() => handleGetStarted('MOTORISTA')}
            >
              <Truck className="mr-2 h-5 w-5" />
              Sou Motorista
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>

          <Button variant="ghost" className="text-white/80 hover:text-white">
            <Play className="mr-2 h-4 w-4" />
            Assistir demonstração
          </Button>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/50">
        <div className="container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-4xl font-bold text-primary mb-2">
                  {stat.number}
                </div>
                <div className="text-muted-foreground">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-16">
            <Badge variant="outline" className="mb-4">
              Por que escolher AgriRoute?
            </Badge>
            <h2 className="text-4xl font-bold mb-6">
              Tecnologia que transforma
              <span className="block text-primary">o transporte agrícola</span>
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Utilizamos as mais avançadas tecnologias para conectar produtores 
              e motoristas de forma eficiente e segura.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature, index) => (
              <Card key={index} className="text-center gradient-card shadow-card hover:shadow-elegant transition-smooth">
                <CardContent className="p-8">
                  <div className="w-16 h-16 rounded-full gradient-primary flex items-center justify-center mx-auto mb-6">
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold mb-4">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground">
                    {feature.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-muted/50">
        <div className="container text-center">
          <h2 className="text-4xl font-bold mb-6">
            Pronto para revolucionar
            <span className="block text-primary">sua logística agrícola?</span>
          </h2>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de produtores e motoristas que já confiam 
            na AgriRoute para suas operações logísticas.
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button variant="hero" size="xl">
              <Package className="mr-2 h-5 w-5" />
              Começar como Produtor
            </Button>
            <Button variant="outline" size="xl">
              <Truck className="mr-2 h-5 w-5" />
              Começar como Motorista
            </Button>
          </div>
        </div>
      </section>

      {/* Auth Modal */}
      <AuthModal 
        isOpen={authModal.isOpen}
        onClose={closeAuthModal}
        initialTab={authModal.tab}
      />

      {/* Footer */}
      <footer className="border-t py-12 bg-background">
        <div className="container">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-3 mb-4">
                <img src={agriRouteLogo} alt="AgriRoute" className="h-8 w-8" />
                <div>
                  <h3 className="font-bold text-lg">AgriRoute</h3>
                  <p className="text-sm text-muted-foreground">Logística Agrícola</p>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                Conectando o agronegócio brasileiro através de tecnologia 
                e inovação em logística.
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Produto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Para Produtores</li>
                <li>Para Motoristas</li>
                <li>Preços</li>
                <li>API</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Sobre nós</li>
                <li>Blog</li>
                <li>Carreiras</li>
                <li>Contato</li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold mb-4">Suporte</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>Central de Ajuda</li>
                <li>Documentação</li>
                <li>Status do Sistema</li>
                <li>Segurança</li>
              </ul>
            </div>
          </div>
          
          <div className="border-t mt-12 pt-8 flex flex-col sm:flex-row justify-between items-center">
            <p className="text-sm text-muted-foreground">
              © 2024 AgriRoute. Todos os direitos reservados.
            </p>
            <div className="flex gap-6 text-sm text-muted-foreground">
              <span>Termos de Uso</span>
              <span>Privacidade</span>
              <span>Cookies</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}