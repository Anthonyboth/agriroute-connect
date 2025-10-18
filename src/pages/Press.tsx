import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Newspaper, Download, ExternalLink, Users, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { PlatformStatsSection } from '@/components/PlatformStatsSection';

const Press = () => {
  const navigate = useNavigate();

  const pressReleases = [
    {
      title: 'AgriRoute - Plataforma de Conexão no Agronegócio',
      date: new Date().getFullYear().toString(),
      category: 'Sobre',
      summary: 'A AgriRoute é uma plataforma que conecta produtores rurais, motoristas e prestadores de serviços, facilitando o transporte de produtos agrícolas e a contratação de serviços especializados de forma eficiente e transparente.',
      downloadUrl: '#'
    }
  ];

  // Estatísticas estáticas removidas; usando PlatformStats dinâmico

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Milestone': return 'default';
      case 'Produto': return 'secondary';
      case 'Parceria': return 'outline';
      case 'Investimento': return 'secondary';
      default: return 'secondary';
    }
  };

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
      <section className="py-16 gradient-hero">
        <div className="container mx-auto px-4 text-center">
          <Newspaper className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Sala de Imprensa
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Notícias, comunicados e recursos para jornalistas sobre a AgriRoute
          </p>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <PlatformStatsSection />
        </div>
      </section>

      {/* Press Releases */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Comunicados à Imprensa
            </h2>
            <p className="text-muted-foreground">
              Últimas novidades e marcos da AgriRoute
            </p>
          </div>

          <div className="max-w-4xl mx-auto space-y-6">
            {pressReleases.map((release) => (
              <Card key={release.title} className="shadow-card hover:shadow-glow transition-smooth">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={getCategoryColor(release.category) as any}>
                          {release.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-sm text-muted-foreground">
                          <Calendar className="h-4 w-4" />
                          {release.date}
                        </div>
                      </div>
                      <h3 className="text-xl font-semibold text-foreground mb-3">
                        {release.title}
                      </h3>
                      <p className="text-muted-foreground">
                        {release.summary}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Download className="h-4 w-4 mr-2" />
                      Download PDF
                    </Button>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Ler Online
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Contact Press */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Contato para Imprensa
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Entre em contato para informações sobre a plataforma AgriRoute
              </p>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <strong>Contato:</strong>
                  <p className="text-muted-foreground">Equipe AgriRoute</p>
                </div>
                <div>
                  <strong>Email:</strong>
                  <p className="text-muted-foreground">agrirouteconnect@gmail.com</p>
                </div>
              </div>
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={() => window.open('mailto:agrirouteconnect@gmail.com?subject=Contato Imprensa AgriRoute', '_blank')}
              >
                Entrar em Contato
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

    </div>
  );
};

export default Press;