import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Shield, Eye, Lock, Database, Users } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Eye,
      title: 'Coleta de Dados',
      content: [
        'Coletamos apenas os dados necessários para fornecer nossos serviços de logística agrícola.',
        'Dados pessoais: nome, CPF/CNPJ, telefone, endereço e documentos para verificação.',
        'Dados de localização: apenas quando necessário para rastreamento de cargas (com seu consentimento).',
        'Dados de uso: informações sobre como você utiliza nossa plataforma para melhorar nossos serviços.'
      ]
    },
    {
      icon: Database,
      title: 'Uso dos Dados',
      content: [
        'Conectar produtores e transportadores de forma eficiente e segura.',
        'Verificar a identidade e confiabilidade dos usuários da plataforma.',
        'Processar pagamentos e emitir documentos fiscais.',
        'Fornecer suporte ao cliente e resolver disputas.',
        'Melhorar nossos serviços através de análises estatísticas (dados anonimizados).',
        'Cumprir obrigações legais e regulamentares.'
      ]
    },
    {
      icon: Lock,
      title: 'Segurança dos Dados',
      content: [
        'Utilizamos criptografia de ponta para proteger seus dados em trânsito e em repouso.',
        'Servidores seguros com certificação ISO 27001 e controles de acesso rigorosos.',
        'Backups regulares e planos de recuperação de desastres.',
        'Monitoramento 24/7 para detectar e prevenir acessos não autorizados.',
        'Treinamento regular da equipe sobre proteção de dados e privacidade.'
      ]
    },
    {
      icon: Users,
      title: 'Compartilhamento',
      content: [
        'Não vendemos seus dados pessoais para terceiros.',
        'Compartilhamos apenas informações necessárias entre produtores e transportadores para viabilizar o serviço.',
        'Podemos compartilhar dados com prestadores de serviços (processamento de pagamentos, envio de SMS).',
        'Compartilhamento com autoridades quando exigido por lei.',
        'Em caso de fusão ou aquisição, os dados podem ser transferidos (você será notificado).'
      ]
    }
  ];

  const rights = [
    'Acesso: Solicitar cópia dos seus dados pessoais',
    'Retificação: Corrigir dados incorretos ou incompletos',
    'Exclusão: Solicitar a exclusão dos seus dados (direito ao esquecimento)',
    'Portabilidade: Receber seus dados em formato estruturado',
    'Oposição: Se opor ao processamento dos seus dados',
    'Limitação: Limitar o processamento em certas circunstâncias',
    'Revogação: Retirar o consentimento a qualquer momento'
  ];

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
          <Shield className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Política de Privacidade
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Sua privacidade é fundamental para nós. Saiba como coletamos, usamos e protegemos seus dados.
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
              <h2 className="text-2xl font-bold text-foreground mb-4">
                Conformidade com a LGPD
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                A AgriRoute está em total conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018).
                Esta política explica como tratamos seus dados pessoais de acordo com os princípios da LGPD, garantindo
                transparência, segurança e respeito aos seus direitos fundamentais de privacidade.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Data Handling Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sections.map((section) => (
              <Card key={section.title} className="shadow-card hover:shadow-glow transition-smooth">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <div className="p-2 rounded-full bg-primary/10">
                      <section.icon className="h-6 w-6 text-primary" />
                    </div>
                    {section.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-muted-foreground leading-relaxed">
                        • {item}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Rights Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Seus Direitos Garantidos pela LGPD
            </h2>
            <p className="text-muted-foreground">
              Você tem controle total sobre seus dados pessoais
            </p>
          </div>

          <Card className="shadow-card max-w-4xl mx-auto">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {rights.map((right) => (
                  <div key={right} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                    <div className="w-2 h-2 rounded-full bg-primary mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground">{right}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-2xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Dúvidas sobre Privacidade?
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <p className="text-muted-foreground mb-6">
                Entre em contato com nosso Encarregado de Proteção de Dados (DPO) para 
                exercer seus direitos ou esclarecer dúvidas sobre o tratamento dos seus dados.
              </p>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p><strong>Responsável:</strong> Equipe AgriRoute Connect</p>
                <p><strong>Email:</strong> agrirouteconnect@gmail.com</p>
                <p><strong>WhatsApp:</strong> 015 66 9 9942-6656</p>
                <p><strong>Endereço:</strong> Brasil</p>
              </div>
              <Button 
                className="mt-6 gradient-primary text-primary-foreground"
                onClick={() => window.open('mailto:agrirouteconnect@gmail.com?subject=Política de Privacidade AgriRoute', '_blank')}
              >
                Entrar em Contato
              </Button>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Updates Section */}
      <section className="py-12 bg-muted/30">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-xl font-semibold text-foreground mb-4">
            Atualizações desta Política
          </h3>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Esta política pode ser atualizada periodicamente. Notificaremos você sobre mudanças 
            importantes através do email cadastrado ou por meio de avisos em nossa plataforma.
          </p>
        </div>
      </section>
    </div>
  );
};

export default Privacy;