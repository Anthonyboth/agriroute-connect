import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, Shield, Eye, Lock, Database, Users, FileText, Clock, Globe, Mail, Phone, MapPin, UserCheck, Trash2, Download, Edit, Ban, RefreshCw } from 'lucide-react';

const Privacy = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: Eye,
      title: '1. Quem Somos',
      content: [
        'A AgriRoute Connect é uma plataforma digital de logística agrícola que conecta produtores rurais e motoristas de caminhão para transporte de cargas.',
        'Nosso objetivo é facilitar o escoamento da produção agrícola brasileira de forma segura, eficiente e rastreável.',
        'Operamos como intermediários tecnológicos, fornecendo ferramentas para negociação, rastreamento GPS e gestão de fretes.',
        'Respeitamos sua privacidade e tratamos seus dados com responsabilidade, conforme a legislação brasileira.'
      ]
    },
    {
      icon: Database,
      title: '2. Quais Dados Coletamos',
      subsections: [
        {
          subtitle: '2.1 Dados de Cadastro',
          items: [
            'Nome completo e CPF/CNPJ para identificação',
            'Endereço de e-mail e número de telefone para contato',
            'Endereço completo para logística',
            'Documentos: CNH, RNTRC, comprovante de propriedade do veículo (motoristas)',
            'Dados bancários/PIX para pagamentos'
          ]
        },
        {
          subtitle: '2.2 Dados de Localização',
          items: [
            'Coordenadas GPS durante o transporte (apenas com consentimento explícito)',
            'Histórico de rotas realizadas',
            'Localização aproximada para matching de fretes disponíveis'
          ]
        },
        {
          subtitle: '2.3 Dados de Uso da Plataforma',
          items: [
            'Histórico de fretes realizados e propostas enviadas',
            'Avaliações e comentários recebidos/enviados',
            'Mensagens trocadas no chat da plataforma',
            'Logs de acesso e atividades para segurança'
          ]
        },
        {
          subtitle: '2.4 Dados Coletados Automaticamente',
          items: [
            'Endereço IP e informações do dispositivo',
            'Tipo de navegador e sistema operacional',
            'Cookies essenciais para funcionamento da plataforma'
          ]
        }
      ]
    },
    {
      icon: FileText,
      title: '3. Como Utilizamos Seus Dados',
      content: [
        'Criar e gerenciar sua conta na plataforma AgriRoute',
        'Conectar produtores e motoristas de forma inteligente (matching)',
        'Processar pagamentos e transferências via Stripe/PIX',
        'Emitir documentos fiscais obrigatórios (MDF-e, CT-e)',
        'Rastrear cargas em tempo real durante o transporte',
        'Enviar notificações sobre status dos fretes e atualizações',
        'Fornecer suporte ao cliente e resolver disputas',
        'Melhorar nossos serviços através de análises estatísticas (dados anonimizados)',
        'Cumprir obrigações legais e regulamentares (ANTT, Receita Federal)',
        'Prevenir fraudes e garantir a segurança da plataforma'
      ]
    },
    {
      icon: Lock,
      title: '4. Segurança e Proteção dos Dados',
      content: [
        'Criptografia TLS/SSL em todas as comunicações entre seu dispositivo e nossos servidores',
        'Senhas armazenadas com hash bcrypt (nunca em texto plano)',
        'Autenticação segura com tokens JWT e refresh tokens',
        'Row Level Security (RLS) no banco de dados garantindo isolamento de dados',
        'Backups automáticos diários com retenção de 30 dias',
        'Monitoramento 24/7 para detectar e prevenir acessos não autorizados',
        'Alertas automáticos via Telegram para a equipe de segurança',
        'Revisão periódica de acessos e permissões dos colaboradores',
        'Infraestrutura hospedada em servidores seguros (Supabase/AWS)'
      ]
    },
    {
      icon: Users,
      title: '5. Compartilhamento de Dados',
      content: [
        'Nunca vendemos seus dados pessoais para terceiros.',
        'Compartilhamos informações necessárias entre produtores e motoristas apenas para viabilizar o frete (nome, telefone, localização).',
        'Processadores de pagamento (Stripe) recebem dados financeiros necessários para transações.',
        'Serviços de comunicação (SMS, push notifications) para envio de alertas.',
        'APIs governamentais (SEFAZ) para emissão de documentos fiscais.',
        'Autoridades competentes quando exigido por lei ou ordem judicial.',
        'Em caso de fusão ou aquisição, os dados podem ser transferidos (você será notificado previamente).'
      ]
    }
  ];

  const lgpdRights = [
    { icon: Eye, title: 'Acesso', description: 'Solicitar cópia de todos os seus dados pessoais armazenados' },
    { icon: Edit, title: 'Retificação', description: 'Corrigir dados incorretos, incompletos ou desatualizados' },
    { icon: Trash2, title: 'Exclusão', description: 'Solicitar a exclusão dos seus dados (direito ao esquecimento)' },
    { icon: Download, title: 'Portabilidade', description: 'Receber seus dados em formato estruturado e legível' },
    { icon: Ban, title: 'Oposição', description: 'Se opor ao processamento dos seus dados para fins específicos' },
    { icon: RefreshCw, title: 'Revogação', description: 'Retirar o consentimento dado anteriormente a qualquer momento' }
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
            Sua privacidade é fundamental para nós. Conheça como coletamos, utilizamos e protegemos seus dados pessoais em conformidade com a LGPD.
          </p>
          <p className="text-sm text-primary-foreground/80 mt-4">
            Última atualização: 02 de dezembro de 2025
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
                A AgriRoute Connect está em total conformidade com a <strong>Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)</strong>.
                Esta política explica de forma clara e transparente como tratamos seus dados pessoais, garantindo segurança, 
                transparência e respeito aos seus direitos fundamentais de privacidade. Ao utilizar nossa plataforma, 
                você concorda com as práticas descritas neste documento.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Main Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-8">
          {sections.map((section) => (
            <Card key={section.title} className="shadow-card hover:shadow-glow transition-smooth">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-full bg-primary/10">
                    <section.icon className="h-6 w-6 text-primary" />
                  </div>
                  {section.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                {section.content && (
                  <ul className="space-y-3">
                    {section.content.map((item, itemIndex) => (
                      <li key={itemIndex} className="text-muted-foreground leading-relaxed flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
                {section.subsections && (
                  <div className="space-y-6">
                    {section.subsections.map((sub, subIndex) => (
                      <div key={subIndex}>
                        <h4 className="font-semibold text-foreground mb-3">{sub.subtitle}</h4>
                        <ul className="space-y-2 pl-4">
                          {sub.items.map((item, itemIndex) => (
                            <li key={itemIndex} className="text-muted-foreground leading-relaxed flex items-start gap-2">
                              <span className="text-primary/70 mt-1">◦</span>
                              <span>{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      {/* LGPD Rights Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              6. Seus Direitos Garantidos pela LGPD
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
                7. Encarregado de Proteção de Dados (DPO)
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
                  <span className="text-foreground"><strong>WhatsApp:</strong> +55 15 66 9 9942-6656</span>
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

      {/* Data Retention Section */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                8. Armazenamento e Retenção de Dados
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Seus dados pessoais são armazenados pelo tempo necessário para cumprir as finalidades descritas 
                nesta política, respeitando os seguintes prazos:
              </p>
              <ul className="space-y-3">
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Dados de conta ativa:</strong> enquanto você mantiver sua conta na plataforma</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Dados financeiros e fiscais:</strong> 5 anos após a transação (obrigação legal)</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Logs de segurança:</strong> 6 meses para detecção de fraudes</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Dados de localização:</strong> 90 dias após conclusão do frete</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span><strong>Após exclusão da conta:</strong> dados anonimizados podem ser mantidos para estatísticas</span>
                </li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Updates Section */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-3xl mx-auto">
            <CardHeader>
              <CardTitle className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-primary/10">
                  <Globe className="h-6 w-6 text-primary" />
                </div>
                9. Atualizações desta Política
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground leading-relaxed">
                Esta política pode ser atualizada periodicamente para refletir mudanças em nossas práticas ou 
                na legislação aplicável. Quando realizarmos alterações significativas:
              </p>
              <ul className="space-y-2">
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Notificaremos você por e-mail cadastrado</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Exibiremos um aviso em destaque na plataforma</span>
                </li>
                <li className="text-muted-foreground flex items-start gap-2">
                  <span className="text-primary mt-1">•</span>
                  <span>Atualizaremos a data de "última atualização" no topo desta página</span>
                </li>
              </ul>
              <p className="text-muted-foreground leading-relaxed">
                Recomendamos que você revise esta política periodicamente para estar sempre informado sobre 
                como protegemos seus dados.
              </p>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <section className="py-8 bg-muted/50 border-t">
        <div className="container mx-auto px-4 text-center">
          <p className="text-sm text-muted-foreground">
            © 2025 AgriRoute Connect. Todos os direitos reservados.
          </p>
          <p className="text-xs text-muted-foreground mt-2">
            Documento em conformidade com a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018)
          </p>
        </div>
      </section>
    </div>
  );
};

export default Privacy;
