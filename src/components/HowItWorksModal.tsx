import React from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Truck, Users, MapPin, DollarSign, Clock, FileText } from 'lucide-react';

interface HowItWorksModalProps {
  isOpen: boolean;
  onClose: () => void;
  userType: 'PRODUTOR' | 'MOTORISTA';
  onProceed?: () => void;
}

const HowItWorksModal: React.FC<HowItWorksModalProps> = ({ isOpen, onClose, userType, onProceed }) => {
  const isProducer = userType === 'PRODUTOR';

  const producerSteps = [
    {
      icon: Users,
      title: "1. Cadastre-se",
      description: "Crie sua conta e complete seu perfil com informações da propriedade"
    },
    {
      icon: FileText,
      title: "2. Publique seu Frete",
      description: "Informe origem, destino, tipo de carga, peso e valor desejado"
    },
    {
      icon: Truck,
      title: "3. Receba Propostas",
      description: "Motoristas qualificados enviarão propostas para seu frete"
    },
    {
      icon: CheckCircle,
      title: "4. Escolha o Motorista",
      description: "Analise perfis, avaliações e escolha a melhor proposta"
    },
    {
      icon: MapPin,
      title: "5. Acompanhe em Tempo Real",
      description: "Monitore sua carga durante todo o transporte"
    },
    {
      icon: DollarSign,
      title: "6. Pagamento Seguro",
      description: "Pague apenas após a entrega confirmada"
    }
  ];

  const driverSteps = [
    {
      icon: Users,
      title: "1. Cadastre-se",
      description: "Complete seu perfil com documentos, CNH e dados do veículo"
    },
    {
      icon: FileText,
      title: "2. Validação de Documentos",
      description: "Nossa equipe valida seus documentos para garantir segurança"
    },
    {
      icon: MapPin,
      title: "3. Encontre Fretes",
      description: "Visualize fretes disponíveis na sua região ou rota preferida"
    },
    {
      icon: DollarSign,
      title: "4. Faça sua Proposta",
      description: "Envie propostas competitivas para os fretes que interessam"
    },
    {
      icon: CheckCircle,
      title: "5. Execute o Transporte",
      description: "Colete a carga e realize o transporte com segurança"
    },
    {
      icon: Clock,
      title: "6. Receba o Pagamento",
      description: "Confirme a entrega e receba o pagamento rapidamente"
    }
  ];

  const steps = isProducer ? producerSteps : driverSteps;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-8 relative">
        {/* Custom close button - more visible */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 z-50 w-10 h-10 rounded-full bg-muted hover:bg-muted/80 border-2 border-border hover:border-primary/30 transition-all duration-200 flex items-center justify-center group hover:scale-110 shadow-lg"
          aria-label="Fechar modal"
        >
          <span className="text-xl font-bold text-muted-foreground group-hover:text-primary transition-colors">×</span>
        </button>

        <DialogHeader className="space-y-4 pb-6">
          <DialogTitle className="text-3xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            {isProducer ? 'Como Funciona para Produtores' : 'Como Funciona para Motoristas'}
          </DialogTitle>
          <DialogDescription className="text-center text-lg text-muted-foreground max-w-2xl mx-auto">
            {isProducer 
              ? 'Conecte sua produção ao destino de forma simples e segura'
              : 'Encontre fretes rentáveis e expanda seu negócio de transporte'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Fluxograma Visual Aprimorado */}
        <div className="my-6">
          <div className="relative bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 rounded-2xl p-6 border border-primary/10 shadow-elegant">
            {/* Título com ícone */}
            <div className="text-center mb-6">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <div className="w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                  {isProducer ? '🌾' : '🚛'}
                </div>
                <h3 className="text-xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                  {isProducer ? 'Fluxo do Produtor' : 'Fluxo do Motorista'}
                </h3>
              </div>
            </div>

            {/* Fluxo principal - primeira linha (passos 1-4) */}
            <div className="flex flex-wrap justify-center items-center gap-4 mb-6">
              {steps.slice(0, 4).map((step, index) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-center min-w-[120px] text-center group animate-fade-in" 
                       style={{ animationDelay: `${index * 100}ms` }}>
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-primary to-primary-light text-primary-foreground flex items-center justify-center mb-3 shadow-glow group-hover:scale-110 transition-transform duration-300">
                        <step.icon className="h-7 w-7" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-sm font-bold">
                        {index + 1}
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">{step.title.replace(/^\d+\.\s/, '')}</h4>
                    <p className="text-xs text-muted-foreground max-w-[110px] leading-tight">{step.description}</p>
                  </div>
                  {index < 3 && (
                    <div className="text-primary/60 text-2xl animate-pulse hidden sm:block">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Seta para baixo */}
            <div className="flex justify-center mb-6">
              <div className="text-primary/60 text-3xl animate-bounce">↓</div>
            </div>

            {/* Fluxo secundário - segunda linha (passos 5-6) */}
            <div className="flex justify-center items-center gap-4">
              {steps.slice(4).map((step, index) => (
                <React.Fragment key={index + 4}>
                  <div className="flex flex-col items-center min-w-[120px] text-center group animate-fade-in" 
                       style={{ animationDelay: `${(index + 4) * 100}ms` }}>
                    <div className="relative">
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-accent to-accent text-accent-foreground flex items-center justify-center mb-3 shadow-glow group-hover:scale-110 transition-transform duration-300">
                        <step.icon className="h-7 w-7" />
                      </div>
                      <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold">
                        {index + 5}
                      </div>
                    </div>
                    <h4 className="text-sm font-semibold text-foreground mb-1">{step.title.replace(/^\d+\.\s/, '')}</h4>
                    <p className="text-xs text-muted-foreground max-w-[110px] leading-tight">{step.description}</p>
                  </div>
                  {index < steps.slice(4).length - 1 && (
                    <div className="text-accent/60 text-2xl animate-pulse hidden sm:block">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>

            {/* Decoração de fundo */}
            <div className="absolute top-4 right-4 w-20 h-20 bg-gradient-to-br from-primary/10 to-accent/10 rounded-full blur-xl"></div>
            <div className="absolute bottom-4 left-4 w-16 h-16 bg-gradient-to-br from-accent/10 to-primary/10 rounded-full blur-xl"></div>
          </div>
        </div>

        {/* Steps Cards Detalhados */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {steps.map((step, index) => (
            <Card key={index} className="group hover:shadow-glow transition-all duration-300 hover:scale-[1.02] border-muted animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-base">
                  <div className="relative">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/10 to-accent/10 group-hover:from-primary/20 group-hover:to-accent/20 transition-colors">
                      <step.icon className="h-5 w-5 text-primary" />
                    </div>
                    <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-accent text-accent-foreground flex items-center justify-center text-xs font-bold">
                      {index + 1}
                    </div>
                  </div>
                  <span className="font-semibold">{step.title.replace(/^\d+\.\s/, '')}</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-muted-foreground leading-relaxed text-sm">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section Aprimorada */}
        <Card className="relative overflow-hidden bg-gradient-to-br from-primary/5 via-accent/5 to-secondary/5 border-primary/20 shadow-elegant">
          <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-full blur-2xl"></div>
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent/10 to-transparent rounded-full blur-2xl"></div>
          
          <CardHeader className="relative z-10">
            <CardTitle className="text-center text-xl">
              <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20">
                <span className="text-2xl">{isProducer ? '🌟' : '⚡'}</span>
                <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent font-bold">
                  {isProducer ? 'Vantagens para Produtores' : 'Vantagens para Motoristas'}
                </span>
              </div>
            </CardTitle>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {isProducer ? (
                <>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-primary/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Economia de Tempo</h4>
                      <p className="text-sm text-muted-foreground">Encontre transportadores rapidamente sem intermediários</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-accent/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Preços Competitivos</h4>
                      <p className="text-sm text-muted-foreground">Receba múltiplas propostas e escolha a melhor</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-primary/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Segurança Total</h4>
                      <p className="text-sm text-muted-foreground">Motoristas validados e totalmente segurados</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-accent/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Rastreamento Real</h4>
                      <p className="text-sm text-muted-foreground">Monitore sua carga 24h por dia em tempo real</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-primary/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Mais Fretes</h4>
                      <p className="text-sm text-muted-foreground">Acesso exclusivo à rede nacional de produtores</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-accent/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Pagamento Garantido</h4>
                      <p className="text-sm text-muted-foreground">Receba com total segurança e rapidez</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-primary/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Gestão Simples</h4>
                      <p className="text-sm text-muted-foreground">Controle completo pelo aplicativo mobile</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-4 p-4 rounded-xl bg-card/50 border border-accent/10 hover:shadow-md transition-all group">
                    <div className="p-2 rounded-full bg-success/10 group-hover:bg-success/20 transition-colors">
                      <CheckCircle className="h-6 w-6 text-success" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">Crescimento Real</h4>
                      <p className="text-sm text-muted-foreground">Expanda seu negócio de transporte nacional</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action Aprimorado */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="px-10 py-3 text-base font-semibold bg-gradient-to-r from-primary to-accent hover:from-primary-dark hover:to-accent text-primary-foreground rounded-full shadow-glow hover:shadow-xl hover:scale-105 transition-all duration-300"
            onClick={onProceed || onClose}
          >
            <span className="mr-2">
              {isProducer ? '🌾' : '🚛'}
            </span>
            {isProducer ? 'Começar como Produtor' : 'Começar como Motorista'}
            <span className="ml-2">→</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksModal;