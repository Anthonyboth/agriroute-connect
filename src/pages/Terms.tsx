import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, FileText, Scale, AlertTriangle, CheckCircle } from 'lucide-react';

const Terms = () => {
  const navigate = useNavigate();

  const sections = [
    {
      icon: CheckCircle,
      title: 'Aceitação dos Termos',
      content: [
        'Ao se cadastrar e utilizar a plataforma AgriRoute, você declara ter lido, compreendido e aceito integralmente estes Termos de Uso.',
        'Se você não concordar com qualquer parte destes termos, não deve utilizar nossos serviços.',
        'Estes termos constituem um acordo legal entre você e a AgriRoute.',
        'A utilização continuada da plataforma implica na aceitação de eventuais alterações nos termos.'
      ]
    },
    {
      icon: FileText,
      title: 'Definições e Serviços',
      content: [
        'A AgriRoute é uma plataforma digital que conecta produtores rurais e transportadores.',
        'Produtores: pessoas físicas ou jurídicas que necessitam transportar produtos agrícolas.',
        'Motoristas: pessoas físicas ou jurídicas especializadas no transporte de cargas agrícolas.',
        'Frete: serviço de transporte de cargas acordado entre produtor e motorista através da plataforma.',
        'A AgriRoute atua como intermediadora, facilitando a conexão entre as partes.'
      ]
    },
    {
      icon: Scale,
      title: 'Responsabilidades dos Usuários',
      content: [
        'Fornecer informações verdadeiras, atuais e completas durante o cadastro.',
        'Manter a confidencialidade de suas credenciais de acesso.',
        'Cumprir todas as leis e regulamentos aplicáveis ao transporte de cargas.',
        'Respeitar os acordos firmados através da plataforma.',
        'Não utilizar a plataforma para atividades ilegais ou fraudulentas.',
        'Comunicar imediatamente qualquer uso não autorizado de sua conta.'
      ]
    },
    {
      icon: AlertTriangle,
      title: 'Limitações e Isenções',
      content: [
        'A AgriRoute não é responsável por danos ou perdas decorrentes do transporte das cargas.',
        'Não garantimos a disponibilidade ininterrupta da plataforma.',
        'Não nos responsabilizamos por disputas entre produtores e motoristas.',
        'A plataforma é fornecida "como está", sem garantias expressas ou implícitas.',
        'Nossa responsabilidade é limitada ao valor das taxas pagas pelos serviços.',
        'Recomendamos a contratação de seguros apropriados para as cargas.'
      ]
    }
  ];

  const prohibited = [
    'Criar múltiplas contas com dados falsos',
    'Utilizar a plataforma para atividades ilegais',
    'Publicar conteúdo ofensivo ou inadequado',
    'Tentar hackear ou interferir no funcionamento da plataforma',
    'Reproduzir, distribuir ou modificar o conteúdo da plataforma',
    'Utilizar bots ou scripts automatizados sem autorização',
    'Assediar ou ameaçar outros usuários',
    'Violar direitos de propriedade intelectual'
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
          <FileText className="h-16 w-16 text-primary-foreground mx-auto mb-6" />
          <h1 className="text-4xl md:text-5xl font-bold text-primary-foreground mb-6">
            Termos de Uso
          </h1>
          <p className="text-lg text-primary-foreground/90 max-w-2xl mx-auto">
            Conheça os termos e condições para utilização da plataforma AgriRoute
          </p>
          <p className="text-sm text-primary-foreground/80 mt-4">
            Última atualização: {new Date().toLocaleDateString('pt-BR')}
          </p>
        </div>
      </section>

      {/* Main Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {sections.map((section, index) => (
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
                    {section.content.map((item) => (
                      <li key={item} className="text-muted-foreground leading-relaxed">
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

      {/* Prohibited Activities */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-foreground mb-4">
              Atividades Proibidas
            </h2>
            <p className="text-muted-foreground">
              As seguintes atividades são estritamente proibidas em nossa plataforma
            </p>
          </div>

          <Card className="shadow-card max-w-4xl mx-auto">
            <CardContent className="p-8">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prohibited.map((item) => (
                  <div key={item} className="flex items-start gap-3 p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                    <div className="w-2 h-2 rounded-full bg-destructive mt-2 flex-shrink-0"></div>
                    <span className="text-muted-foreground">{item}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Payment and Fees */}
      <section className="py-16">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Pagamentos e Taxas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  <strong>Taxa de Serviço:</strong> A AgriRoute cobra uma taxa de intermediação de 3% sobre o valor 
                  do frete para manter a plataforma funcionando e garantir a qualidade dos serviços.
                </p>
                <p>
                  <strong>Processamento de Pagamentos:</strong> Os pagamentos são processados através de parceiros 
                  seguros e podem estar sujeitos a taxas adicionais dos processadores.
                </p>
                <p>
                  <strong>Política de Reembolso:</strong> Reembolsos são analisados caso a caso, considerando as 
                  circunstâncias específicas e a política de cancelamento aplicável.
                </p>
                <p>
                  <strong>Impostos:</strong> Todos os valores são acrescidos de impostos conforme legislação vigente.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Legal */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4">
          <Card className="shadow-card max-w-4xl mx-auto">
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Disposições Legais
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4 text-muted-foreground">
                <p>
                  <strong>Lei Aplicável:</strong> Estes termos são regidos pela legislação brasileira, especialmente 
                  pelo Código de Defesa do Consumidor e Marco Civil da Internet.
                </p>
                <p>
                  <strong>Foro:</strong> Fica eleito o foro da comarca de São Paulo, SP, para dirimir quaisquer 
                  controvérsias oriundas destes termos.
                </p>
                <p>
                  <strong>Alterações:</strong> A AgriRoute se reserva o direito de modificar estes termos a qualquer 
                  momento, notificando os usuários através da plataforma ou email.
                </p>
                <p>
                  <strong>Vigência:</strong> Estes termos permanecem em vigor enquanto você utilizar a plataforma AgriRoute.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Contact */}
      <section className="py-16">
        <div className="container mx-auto px-4 text-center">
          <h3 className="text-2xl font-bold text-foreground mb-4">
            Dúvidas sobre os Termos?
          </h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Se você tiver alguma dúvida sobre estes Termos de Uso, entre em contato conosco.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground mb-6">
            <p><strong>Responsável:</strong> Equipe AgriRoute Connect</p>
            <p><strong>Email:</strong> agrirouteconnect@gmail.com</p>
            <p><strong>WhatsApp:</strong> 015 66 9 9942-6656</p>
          </div>
          <Button 
            className="gradient-primary text-primary-foreground"
            onClick={() => window.open('mailto:agrirouteconnect@gmail.com?subject=Termos de Uso AgriRoute', '_blank')}
          >
            Entrar em Contato
          </Button>
        </div>
      </section>
    </div>
  );
};

export default Terms;