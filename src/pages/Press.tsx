import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Newspaper, Download, ExternalLink, Users, Trophy, TrendingUp, Calendar } from 'lucide-react';

const Press = () => {
  const navigate = useNavigate();

  const pressReleases = [
    {
      title: 'AgriRoute Conecta Mais de 10 Mil Produtores Rurais em 2024',
      date: '15 de dezembro, 2024',
      category: 'Milestone',
      summary: 'A plataforma de logística agrícola AgriRoute alcança marca histórica de 10.000 produtores cadastrados, movimentando mais de 1 milhão de toneladas de produtos agrícolas.',
      downloadUrl: '#'
    },
    {
      title: 'AgriRoute Lança Novo Sistema de Avaliações para Motoristas',
      date: '28 de novembro, 2024',
      category: 'Produto',
      summary: 'Nova funcionalidade permite que produtores avaliem transportadores, aumentando a confiança e qualidade dos serviços de frete agrícola.',
      downloadUrl: '#'
    },
    {
      title: 'Parceria Estratégica com Cooperativas do Sul do Brasil',
      date: '10 de outubro, 2024',
      category: 'Parceria',
      summary: 'AgriRoute firma acordo com 15 cooperativas agrícolas da região Sul, facilitando o escoamento da produção de soja e milho.',
      downloadUrl: '#'
    },
    {
      title: 'AgriRoute Recebe Investimento de R$ 50 Milhões',
      date: '5 de setembro, 2024',
      category: 'Investimento',
      summary: 'Rodada Série A liderada pelo fundo AgroTech Ventures acelera expansão da plataforma para todo território nacional.',
      downloadUrl: '#'
    }
  ];

  const mediaKit = [
    {
      title: 'Logos e Identidade Visual',
      description: 'Logos em alta resolução, paleta de cores e guias de uso da marca',
      format: 'ZIP (PNG, SVG, PDF)',
      size: '12 MB'
    },
    {
      title: 'Fotos Oficiais',
      description: 'Banco de imagens da plataforma, equipe e operações',
      format: 'ZIP (JPG)',
      size: '45 MB'
    },
    {
      title: 'Dados e Estatísticas',
      description: 'Números atualizados sobre usuários, transações e crescimento',
      format: 'PDF',
      size: '2 MB'
    },
    {
      title: 'Biografia dos Executivos',
      description: 'Perfis profissionais da liderança da AgriRoute',
      format: 'PDF',
      size: '1 MB'
    }
  ];

  const awards = [
    {
      title: 'Startup Agro do Ano 2024',
      organization: 'AgroTech Summit',
      date: '2024',
      description: 'Reconhecimento pela inovação em logística agrícola'
    },
    {
      title: 'Prêmio Inovação Digital Rural',
      organization: 'Ministério da Agricultura',
      date: '2024',
      description: 'Destaque em soluções digitais para o agronegócio'
    },
    {
      title: 'Top 10 Startups B2B',
      organization: 'Revista Agronegócio',
      date: '2023',
      description: 'Entre as startups mais promissoras do setor'
    }
  ];

  const stats = [
    { value: '10,000+', label: 'Produtores Cadastrados', icon: Users },
    { value: '5,000+', label: 'Motoristas Ativos', icon: Users },
    { value: '1M+', label: 'Toneladas Transportadas', icon: TrendingUp },
    { value: '15', label: 'Estados Atendidos', icon: Trophy }
  ];

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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            {stats.map((stat, index) => (
              <Card key={index} className="text-center shadow-card">
                <CardContent className="p-6">
                  <stat.icon className="h-8 w-8 text-primary mx-auto mb-3" />
                  <div className="text-2xl md:text-3xl font-bold text-primary mb-2">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </CardContent>
              </Card>
            ))}
          </div>
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
            {pressReleases.map((release, index) => (
              <Card key={index} className="shadow-card hover:shadow-glow transition-smooth">
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <Badge variant={getCategoryColor(release.category)}>
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

      {/* Media Kit */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Kit de Imprensa
            </h2>
            <p className="text-muted-foreground">
              Recursos visuais e informativos para veículos de comunicação
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {mediaKit.map((item, index) => (
              <Card key={index} className="shadow-card hover:shadow-glow transition-smooth">
                <CardHeader>
                  <CardTitle className="text-lg">{item.title}</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {item.description}
                  </p>
                  <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                    <span>Formato: {item.format}</span>
                    <span>Tamanho: {item.size}</span>
                  </div>
                  <Button className="w-full gradient-primary text-primary-foreground">
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Awards */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Prêmios e Reconhecimentos
            </h2>
            <p className="text-muted-foreground">
              Honrarias recebidas pela AgriRoute
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl mx-auto">
            {awards.map((award, index) => (
              <Card key={index} className="shadow-card text-center">
                <CardContent className="p-6">
                  <Trophy className="h-12 w-12 text-warning mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-foreground mb-2">
                    {award.title}
                  </h3>
                  <p className="text-sm text-primary mb-2">
                    {award.organization}
                  </p>
                  <p className="text-xs text-muted-foreground mb-3">
                    {award.date}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {award.description}
                  </p>
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
                Entre em contato com nossa equipe de comunicação para entrevistas, 
                informações adicionais ou agendamento de visitas
              </p>
              <div className="space-y-3 text-sm mb-6">
                <div>
                  <strong>Assessoria de Imprensa</strong>
                  <p className="text-muted-foreground">Maria Silva - Gerente de Comunicação</p>
                </div>
                <div>
                  <strong>Responsável:</strong>
                  <p className="text-muted-foreground">Anthony Both - Fundador & CEO</p>
                </div>
                <div>
                  <strong>Email:</strong>
                  <p className="text-muted-foreground">anthony_pva@hotmail.com</p>
                </div>
                <div>
                  <strong>WhatsApp:</strong>
                  <p className="text-muted-foreground">015 66 9 9942-6656</p>
                </div>
              </div>
              <Button 
                className="gradient-primary text-primary-foreground"
                onClick={() => window.open('mailto:anthony_pva@hotmail.com?subject=Contato Imprensa AgriRoute', '_blank')}
              >
                Entrar em Contato
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Newsletter Signup */}
      <section className="py-12">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Newsletter para Jornalistas
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Receba em primeira mão comunicados, novidades e dados exclusivos da AgriRoute
          </p>
          <Button variant="outline" className="border-primary text-primary">
            Inscrever-se na Newsletter
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Press;