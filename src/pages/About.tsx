import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Truck, Users, MapPin, Shield, Clock, Target, Heart, Award } from 'lucide-react';
import PlatformStats from '@/components/PlatformStats';

const About = () => {
  const navigate = useNavigate();

  const values = [
    {
      icon: Target,
      title: 'Missão',
      description: 'Revolucionar o transporte agrícola brasileiro, conectando produtores e transportadores através de tecnologia inovadora, garantindo eficiência, transparência e segurança em toda a cadeia logística.'
    },
    {
      icon: Heart,
      title: 'Visão',
      description: 'Ser a principal plataforma de logística agrícola do Brasil, contribuindo para o crescimento sustentável do agronegócio e fortalecendo a economia rural.'
    },
    {
      icon: Award,
      title: 'Valores',
      description: 'Transparência, inovação, sustentabilidade, confiabilidade e compromisso com o desenvolvimento do setor agrícola brasileiro.'
    }
  ];

  const features = [
    {
      icon: Truck,
      title: 'Logística Inteligente',
      description: 'Algoritmos avançados para otimização de rotas e matching entre produtores e transportadores.'
    },
    {
      icon: Shield,
      title: 'Segurança Total',
      description: 'Sistema robusto de verificação de documentos e rastreamento em tempo real para máxima segurança.'
    },
    {
      icon: MapPin,
      title: 'Rastreamento GPS',
      description: 'Monitoramento completo das cargas com atualizações em tempo real para produtores e motoristas.'
    },
    {
      icon: Clock,
      title: 'Eficiência Máxima',
      description: 'Redução de tempo de espera e otimização de cargas para maior produtividade.'
    }
  ];

  // Estatísticas dinâmicas removidas daqui; usar componente compartilhado PlatformStats

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button variant="ghost" onClick={() => navigate('/')} className="flex items-center gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Button>
          <div className="flex items-center space-x-2">
            <Leaf className="h-8 w-8 text-primary" />
            <span className="text-2xl font-bold text-foreground">AgriRoute</span>
          </div>
          <div></div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h1 className="text-5xl md:text-6xl font-bold text-primary-foreground mb-6">
            Sobre a AgriRoute
          </h1>
          <p className="text-xl text-primary-foreground/90 max-w-3xl mx-auto">
            Somos a ponte tecnológica que conecta o campo brasileiro aos centros de consumo, 
            revolucionando a logística agrícola com inovação, eficiência e sustentabilidade.
          </p>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {values.map((value, index) => (
              <Card key={index} className="shadow-card hover:shadow-glow transition-smooth">
                <CardContent className="p-8 text-center">
                  <div className="mb-6 inline-flex items-center justify-center w-16 h-16 rounded-full gradient-primary">
                    <value.icon className="h-8 w-8 text-primary-foreground" />
                  </div>
                  <h3 className="text-2xl font-bold text-foreground mb-4">
                    {value.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {value.description}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-foreground mb-4">
              Nossos Números
            </h2>
            <p className="text-xl text-muted-foreground">
              O impacto da AgriRoute no agronegócio brasileiro
            </p>
          </div>
          <PlatformStats />
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20">
        <div className="container mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl font-bold text-foreground mb-6">
              Nossa Tecnologia
            </h2>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Desenvolvemos soluções inovadoras para os desafios da logística agrícola
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

      {/* Story Section */}
      <section className="py-20 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-4xl font-bold text-foreground mb-8">
              Nossa História
            </h2>
            <div className="text-lg text-muted-foreground leading-relaxed space-y-6">
              <p>
                A AgriRoute nasceu da necessidade de digitalizar e otimizar o transporte agrícola brasileiro. 
                Percebemos que produtores rurais enfrentavam dificuldades para encontrar transportadores 
                confiáveis, enquanto motoristas perdiam tempo procurando cargas.
              </p>
              <p>
                Desenvolvemos uma plataforma que conecta esses dois universos de forma inteligente, 
                utilizando tecnologia de ponta para garantir transparência, segurança e eficiência 
                em cada transporte realizado.
              </p>
              <p>
                Hoje, somos a principal plataforma de logística agrícola do Brasil, contribuindo 
                para o fortalecimento do agronegócio nacional e apoiando milhares de famílias 
                que dependem do setor.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <h2 className="text-4xl font-bold text-primary-foreground mb-6">
            Faça Parte da Revolução
          </h2>
          <p className="text-xl text-primary-foreground/90 mb-8 max-w-2xl mx-auto">
            Junte-se a milhares de produtores e motoristas que já escolheram a AgriRoute
          </p>
          <Button 
            size="lg"
            onClick={() => navigate('/')}
            className="bg-background text-foreground text-lg px-8 py-6 rounded-xl hover:scale-105 transition-bounce shadow-xl"
          >
            <Users className="mr-2 h-5 w-5" />
            Começar Agora
          </Button>
        </div>
      </section>
    </div>
  );
};

export default About;