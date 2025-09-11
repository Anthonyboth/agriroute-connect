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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center mb-2">
            {isProducer ? 'Como Funciona para Produtores' : 'Como Funciona para Motoristas'}
          </DialogTitle>
          <DialogDescription className="text-center text-lg">
            {isProducer 
              ? 'Conecte sua produção ao destino de forma simples e segura'
              : 'Encontre fretes rentáveis e expanda seu negócio de transporte'
            }
          </DialogDescription>
        </DialogHeader>

        {/* Fluxograma Visual */}
        <div className="my-8">
          <div className="bg-gradient-to-r from-primary/10 to-accent/10 rounded-lg p-6">
            <h3 className="text-lg font-semibold text-center mb-6">
              {isProducer ? '🔄 Fluxo do Produtor' : '🔄 Fluxo do Motorista'}
            </h3>
            <div className="flex flex-wrap justify-center items-center gap-4">
              {steps.map((step, index) => (
                <React.Fragment key={index}>
                  <div className="flex flex-col items-center min-w-[120px] text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center mb-2">
                      <step.icon className="h-6 w-6" />
                    </div>
                    <p className="text-xs font-medium">{step.title}</p>
                  </div>
                  {index < steps.length - 1 && (
                    <div className="text-primary text-2xl">→</div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* Steps Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          {steps.map((step, index) => (
            <Card key={index} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-3 text-lg">
                  <div className="p-2 rounded-full bg-primary/10">
                    <step.icon className="h-5 w-5 text-primary" />
                  </div>
                  {step.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">{step.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Benefits Section */}
        <Card className="bg-gradient-to-r from-primary/5 to-accent/5 border-primary/20">
          <CardHeader>
            <CardTitle className="text-center">
              {isProducer ? '🌟 Vantagens para Produtores' : '🌟 Vantagens para Motoristas'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {isProducer ? (
                <>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Economia de Tempo</h4>
                      <p className="text-sm text-muted-foreground">Encontre transportadores rapidamente</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Preços Competitivos</h4>
                      <p className="text-sm text-muted-foreground">Receba múltiplas propostas</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Segurança Total</h4>
                      <p className="text-sm text-muted-foreground">Motoristas validados e segurados</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Rastreamento</h4>
                      <p className="text-sm text-muted-foreground">Acompanhe sua carga em tempo real</p>
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Mais Fretes</h4>
                      <p className="text-sm text-muted-foreground">Acesso a rede nacional de produtores</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Pagamento Garantido</h4>
                      <p className="text-sm text-muted-foreground">Receba com segurança e rapidez</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Gestão Simples</h4>
                      <p className="text-sm text-muted-foreground">Controle tudo pelo app</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                    <div>
                      <h4 className="font-medium">Crescimento</h4>
                      <p className="text-sm text-muted-foreground">Expanda seu negócio de transporte</p>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Call to Action */}
        <div className="flex justify-center pt-4">
          <Button 
            size="lg" 
            className="px-8 py-3"
            onClick={onProceed || onClose}
          >
            {isProducer ? 'Começar como Produtor' : 'Começar como Motorista'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default HowItWorksModal;