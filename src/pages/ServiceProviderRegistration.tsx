import React from 'react';
import { ServiceProviderRegistrationForm } from '@/components/ServiceProviderRegistrationForm';
import { ResponsiveLayout } from '@/components/ResponsiveLayout';
import { BackButton } from '@/components/BackButton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Shield, CheckCircle, Clock, FileText } from 'lucide-react';

const ServiceProviderRegistration = () => {
  const [showForm, setShowForm] = React.useState(false);

  const steps = [
    {
      icon: FileText,
      title: 'Documentação',
      description: 'Prepare seus documentos pessoais, CNH (se necessário), comprovantes e certificações'
    },
    {
      icon: Shield,
      title: 'Cadastro Completo',
      description: 'Preencha todas as informações profissionais e financeiras'
    },
    {
      icon: Clock,
      title: 'Análise',
      description: 'Aguarde a análise e aprovação do administrador'
    },
    {
      icon: CheckCircle,
      title: 'Aprovação',
      description: 'Comece a receber solicitações na sua região'
    }
  ];

  const requiredDocuments = [
    'RG e CPF (frente e verso)',
    'Comprovante de endereço atualizado',
    'CNH válida (para serviços que requerem deslocamento)',
    'Certificações profissionais (se houver)',
    'Documentos da empresa (CNPJ/MEI - opcional)',
    'Foto pessoal'
  ];

  return (
    <ResponsiveLayout>
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5">
        <div className="container mx-auto px-4 py-8">
          <BackButton />
          
          <div className="max-w-4xl mx-auto space-y-8">
            {/* Header */}
            <div className="text-center space-y-4">
              <h1 className="text-4xl font-bold">
                Cadastro de Prestador de Serviços
              </h1>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Torne-se um prestador de serviços automotivos e comece a receber 
                solicitações de clientes na sua região
              </p>
            </div>

            {/* Como Funciona */}
            <Card>
              <CardHeader>
                <CardTitle className="text-center">Como Funciona</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {steps.map((step, index) => {
                    const IconComponent = step.icon;
                    return (
                      <div key={index} className="text-center space-y-3">
                        <div className="flex justify-center">
                          <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center">
                            <IconComponent className="w-8 h-8 text-primary" />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <h3 className="font-semibold">{step.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {step.description}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            {/* Documentos Necessários */}
            <Card>
              <CardHeader>
                <CardTitle>Documentos Necessários</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {requiredDocuments.map((doc, index) => (
                    <div key={index} className="flex items-center space-x-3">
                      <CheckCircle className="w-5 h-5 text-green-500 flex-shrink-0" />
                      <span className="text-sm">{doc}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Tipos de Serviço */}
            <Card>
              <CardHeader>
                <CardTitle>Tipos de Serviços Disponíveis</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {[
                    'Guincho/Reboque',
                    'Mecânico',
                    'Borracheiro',
                    'Eletricista Automotivo',
                    'Entrega de Combustível',
                    'Chaveiro',
                    'Soldador',
                    'Pintura Automotiva',
                    'Vidraceiro',
                    'Ar Condicionado',
                    'Sistema de Freios',
                    'Suspensão'
                  ].map((service, index) => (
                    <div 
                      key={index}
                      className="p-3 bg-primary/5 rounded-lg text-center text-sm font-medium"
                    >
                      {service}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Benefícios */}
            <Card>
              <CardHeader>
                <CardTitle>Benefícios de ser um Prestador</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    </div>
                    <h3 className="font-semibold">Clientes Garantidos</h3>
                    <p className="text-sm text-muted-foreground">
                      Receba solicitações diretamente de clientes na sua região
                    </p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mx-auto">
                      <Shield className="w-6 h-6 text-blue-600" />
                    </div>
                    <h3 className="font-semibold">Pagamento Seguro</h3>
                    <p className="text-sm text-muted-foreground">
                      Sistema de pagamento integrado com PIX e transferência
                    </p>
                  </div>
                  <div className="text-center space-y-2">
                    <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mx-auto">
                      <Clock className="w-6 h-6 text-purple-600" />
                    </div>
                    <h3 className="font-semibold">Flexibilidade</h3>
                    <p className="text-sm text-muted-foreground">
                      Defina seus horários, preços e área de atendimento
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* CTA */}
            <div className="text-center">
              <button
                onClick={() => setShowForm(true)}
                className="bg-primary text-primary-foreground hover:bg-primary/90 px-8 py-4 rounded-lg text-lg font-semibold transition-colors"
              >
                Começar Cadastro
              </button>
            </div>
          </div>
        </div>
      </div>

      <ServiceProviderRegistrationForm
        isOpen={showForm}
        onClose={() => setShowForm(false)}
      />
    </ResponsiveLayout>
  );
};

export default ServiceProviderRegistration;