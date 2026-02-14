import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { BackButton } from '@/components/BackButton';
import { ArrowLeft, Leaf, Cookie, Settings, Eye, Target } from 'lucide-react';

const Cookies = () => {
  const navigate = useNavigate();

  const cookieTypes = [
    {
      icon: Settings,
      title: 'Cookies Essenciais',
      description: 'Necessários para o funcionamento básico da plataforma',
      essential: true,
      examples: [
        'Cookies de sessão para manter você logado',
        'Cookies de segurança e autenticação',
        'Cookies de preferências de idioma',
        'Cookies para lembrar suas configurações'
      ]
    },
    {
      icon: Eye,
      title: 'Cookies Analíticos',
      description: 'Ajudam-nos a entender como você usa nossa plataforma',
      essential: false,
      examples: [
        'Google Analytics para medir tráfego e uso',
        'Cookies para rastrear jornada do usuário',
        'Métricas de performance da plataforma',
        'Análise de comportamento agregado'
      ]
    },
    {
      icon: Target,
      title: 'Cookies de Marketing',
      description: 'Personalizam anúncios e conteúdo relevante',
      essential: false,
      examples: [
        'Cookies para personalizar publicidade',
        'Rastreamento de campanhas de marketing',
        'Integração com redes sociais',
        'Cookies de retargeting'
      ]
    }
  ];

  const thirdPartyServices = [
    {
      name: 'Google Analytics',
      purpose: 'Análise de uso e tráfego da plataforma',
      privacy: 'https://policies.google.com/privacy'
    },
    {
      name: 'Google Maps',
      purpose: 'Serviços de localização e mapas',
      privacy: 'https://policies.google.com/privacy'
    },
    {
      name: 'Stripe',
      purpose: 'Processamento seguro de pagamentos',
      privacy: 'https://stripe.com/privacy'
    },
    {
      name: 'Supabase',
      purpose: 'Banco de dados e autenticação',
      privacy: 'https://supabase.com/privacy'
    }
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <BackButton to="/" />
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
          <Cookie className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Política de Cookies
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Entenda como utilizamos cookies para melhorar sua experiência na AgriRoute
          </p>
          <p className="text-sm text-primary-foreground/80 mt-4">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </section>

      {/* What are Cookies */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-2xl text-center">
                O que são Cookies?
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground leading-relaxed text-center">
                Cookies são pequenos arquivos de texto armazenados no seu dispositivo quando você visita um site. 
                Eles são amplamente utilizados para fazer os sites funcionarem de forma mais eficiente, bem como 
                fornecer informações aos proprietários do site sobre como os usuários interagem com suas páginas.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cookie Types */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Tipos de Cookies Utilizados
            </h2>
            <p className="text-muted-foreground">
              Utilizamos diferentes tipos de cookies para diferentes finalidades
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {cookieTypes.map((type) => (
              <Card key={type.title} className="shadow-card hover:shadow-glow transition-smooth">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${type.essential ? 'bg-primary/10' : 'bg-accent/10'}`}>
                      <type.icon className={`h-6 w-6 ${type.essential ? 'text-primary' : 'text-accent'}`} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        {type.title}
                        {type.essential && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                            Obrigatório
                          </span>
                        )}
                      </div>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground mb-4">
                    {type.description}
                  </p>
                  <ul className="space-y-1">
                    {type.examples.map((example, exampleIndex) => (
                      <li key={exampleIndex} className="text-sm text-muted-foreground">
                        • {example}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Third Party Services */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Serviços de Terceiros
            </h2>
            <p className="text-muted-foreground">
              Alguns cookies são definidos por serviços de terceiros que utilizamos
            </p>
          </div>

          <Card className="shadow-card max-w-4xl mx-auto">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {thirdPartyServices.map((service) => (
                  <div key={service.name} className="p-4 rounded-lg bg-muted/50 border">
                    <h3 className="font-semibold text-foreground mb-2">
                      {service.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {service.purpose}
                    </p>
                    <Button variant="outline" size="sm" asChild>
                      <a href={service.privacy} target="_blank" rel="noopener noreferrer">
                        Ver Política de Privacidade
                      </a>
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Cookie Management */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Gerenciamento de Cookies
            </h2>
            <p className="text-muted-foreground">
              Você tem controle sobre como os cookies são utilizados
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Configurações do Navegador</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Configure seu navegador para bloquear ou aceitar cookies</li>
                  <li>• Exclua cookies existentes a qualquer momento</li>
                  <li>• Configure notificações antes de aceitar cookies</li>
                  <li>• Use modo privado/incógnito para navegação sem cookies</li>
                </ul>
              </CardContent>
            </Card>

            <Card className="shadow-card">
              <CardHeader>
                <CardTitle>Configurações da AgriRoute</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-2 text-muted-foreground">
                  <li>• Gerencie preferências nas configurações da conta</li>
                  <li>• Opte por não receber cookies de marketing</li>
                  <li>• Controle cookies analíticos (quando possível)</li>
                  <li>• Cookies essenciais não podem ser desabilitados</li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Browser Instructions */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-4xl mx-auto">
            <CardHeader>
              <CardTitle className="text-center">
                Como Desabilitar Cookies por Navegador
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-muted-foreground">
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Chrome</h4>
                  <p>Configurações → Avançado → Privacidade e segurança → Configurações de site → Cookies</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Firefox</h4>
                  <p>Configurações → Privacidade e segurança → Cookies e dados de sites</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Safari</h4>
                  <p>Preferências → Privacidade → Cookies e dados de websites</p>
                </div>
                <div>
                  <h4 className="font-semibold text-foreground mb-2">Edge</h4>
                  <p>Configurações → Cookies e permissões de site → Cookies e dados armazenados</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Dúvidas sobre Cookies?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Se você tiver alguma dúvida sobre nossa política de cookies, entre em contato conosco.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground mb-6">
            <p><strong>Email:</strong> agrirouteconnect@gmail.com</p>
            <p><strong>WhatsApp:</strong> (66) 9 9273-4632</p>
          </div>
          <Button className="gradient-primary text-primary-foreground">
            Entrar em Contato
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Cookies;