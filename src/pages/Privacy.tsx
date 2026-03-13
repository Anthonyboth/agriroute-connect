import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Shield, Eye, Edit, Trash2, Download, Ban, RefreshCw, Mail, Phone, MapPin, Users, UserCheck, FileText } from 'lucide-react';
import { privacyContent } from '@/components/LegalDocumentDialog';

const Privacy = () => {
  const navigate = useNavigate();

  const lgpdRights = [
    { icon: Eye, title: 'Acesso', description: 'Solicitar cópia de todos os seus dados pessoais armazenados' },
    { icon: Edit, title: 'Retificação', description: 'Corrigir dados incorretos, incompletos ou desatualizados' },
    { icon: Trash2, title: 'Exclusão', description: 'Solicitar a exclusão dos seus dados (direito ao esquecimento)' },
    { icon: Download, title: 'Portabilidade', description: 'Receber seus dados em formato estruturado e legível' },
    { icon: Ban, title: 'Oposição', description: 'Se opor ao processamento dos seus dados para fins específicos' },
    { icon: RefreshCw, title: 'Revogação', description: 'Retirar o consentimento dado anteriormente a qualquer momento' },
  ];

  return (
    <div className="min-h-screen min-h-[100dvh] bg-background overflow-y-auto">
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
          <Shield className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Política de Privacidade
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Sua privacidade é fundamental para nós. Conheça como coletamos, utilizamos e protegemos seus dados pessoais em conformidade com a LGPD.
          </p>
          <p className="text-sm text-primary-foreground/80 mt-4">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </section>

      {/* LGPD Introduction */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card">
            <CardContent className="p-8">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-full bg-primary/10">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <h2 className="text-2xl font-bold text-foreground">
                  Conformidade com a LGPD
                </h2>
              </div>
              <p className="text-muted-foreground leading-relaxed">
                A AgriRoute Connect está em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD — Lei nº 13.709/2018)</strong>.
                Esta política explica de forma clara e transparente como tratamos seus dados pessoais, garantindo segurança,
                transparência e respeito aos seus direitos fundamentais de privacidade.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* All Sections from single source of truth */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-8 max-w-4xl">
          {privacyContent.map((section) => (
            <Card key={section.title} className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-full bg-primary/10">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-3">
                  {section.items.map((item, i) => (
                    <li key={i} className="text-muted-foreground leading-relaxed flex items-start gap-2">
                      <span className="text-primary mt-1">•</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* LGPD Rights Visual Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Seus Direitos Garantidos pela LGPD
            </h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Você tem controle total sobre seus dados pessoais. Conheça seus direitos e como exercê-los.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {lgpdRights.map((right) => (
              <Card key={right.title} className="shadow-card hover:shadow-glow transition-smooth">
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <right.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h4 className="font-semibold text-foreground">{right.title}</h4>
                  </div>
                  <p className="text-muted-foreground text-sm">{right.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="shadow-card max-w-3xl mx-auto mt-8">
            <CardContent className="p-6">
              <p className="text-muted-foreground text-center">
                Para exercer qualquer um desses direitos, entre em contato com nosso DPO (Encarregado de Proteção de Dados)
                através dos canais informados abaixo. Responderemos sua solicitação em até <strong>15 dias úteis</strong>,
                conforme determina a LGPD.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* DPO Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <div className="p-3 rounded-full bg-primary/10 w-fit mx-auto mb-4">
                <UserCheck className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">
                Encarregado de Proteção de Dados (DPO)
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              <p className="text-muted-foreground">
                Nosso DPO é responsável por garantir a conformidade com a LGPD e atender suas solicitações
                relacionadas aos seus dados pessoais.
              </p>

              <div className="space-y-4 text-sm">
                <div className="flex items-center justify-center gap-3">
                  <Users className="h-5 w-5 text-primary" />
                  <span className="text-foreground"><strong>Responsável:</strong> Equipe AgriRoute Connect</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Mail className="h-5 w-5 text-primary" />
                  <span className="text-foreground"><strong>Email:</strong> agrirouteconnect@gmail.com</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <Phone className="h-5 w-5 text-primary" />
                  <span className="text-foreground"><strong>WhatsApp:</strong> (66) 9 9273-4632</span>
                </div>
                <div className="flex items-center justify-center gap-3">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="text-foreground"><strong>Localização:</strong> Brasil</span>
                </div>
              </div>

              <Button
                className="gradient-primary text-primary-foreground"
                onClick={() => window.open('mailto:agrirouteconnect@gmail.com?subject=LGPD - Solicitação de Dados - AgriRoute Connect', '_blank')}
              >
                <Mail className="h-4 w-4 mr-2" />
                Entrar em Contato com o DPO
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
