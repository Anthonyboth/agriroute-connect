import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Search, MessageCircle, Mail, Phone, FileText, Truck, Users, Shield, CreditCard, HelpCircle, Clock, CheckCircle } from 'lucide-react';

const Help = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  
  const faqCategories = [
    {
      id: 'general',
      title: 'Geral',
      icon: HelpCircle,
      questions: [
        {
          question: "O que é a AgriRoute?",
          answer: "A AgriRoute é uma plataforma digital que conecta produtores rurais e transportadores, facilitando o transporte de commodities agrícolas de forma eficiente e segura."
        },
        {
          question: "Como funciona a plataforma?",
          answer: "Os produtores cadastram suas necessidades de transporte, e os motoristas podem visualizar e aceitar os fretes disponíveis. A plataforma cuida de todo o processo, desde a negociação até o pagamento."
        },
        {
          question: "A AgriRoute é gratuita?",
          answer: "O cadastro e uso básico da plataforma são gratuitos. Cobramos apenas uma pequena taxa de serviço sobre os fretes realizados."
        }
      ]
    },
    {
      id: 'producer',
      title: 'Para Produtores',
      icon: Users,
      questions: [
        {
          question: "Como cadastrar um frete?",
          answer: "Acesse sua conta, clique em 'Novo Frete', preencha os dados da carga (origem, destino, peso, tipo de produto) e publique. Os motoristas poderão visualizar e fazer propostas."
        },
        {
          question: "Como escolher o melhor motorista?",
          answer: "Avalie as propostas considerando preço, prazo, avaliações de outros usuários e histórico do motorista na plataforma."
        },
        {
          question: "Posso acompanhar minha carga?",
          answer: "Sim! Nossa plataforma oferece rastreamento em tempo real, permitindo acompanhar a localização da sua carga durante todo o transporte."
        }
      ]
    },
    {
      id: 'driver',
      title: 'Para Motoristas',
      icon: Truck,
      questions: [
        {
          question: "Como encontrar fretes disponíveis?",
          answer: "Acesse o painel de fretes, use os filtros para encontrar cargas na sua região e que sejam compatíveis com seu veículo."
        },
        {
          question: "Como fazer uma proposta?",
          answer: "Clique no frete desejado, analise os detalhes e faça sua proposta com preço e prazo de entrega. O produtor avaliará e poderá aceitar."
        },
        {
          question: "Quando recebo o pagamento?",
          answer: "O pagamento é liberado automaticamente após a confirmação da entrega pelo produtor, geralmente em até 24 horas."
        }
      ]
    },
    {
      id: 'payment',
      title: 'Pagamentos',
      icon: CreditCard,
      questions: [
        {
          question: "Quais formas de pagamento são aceitas?",
          answer: "Aceitamos PIX, cartão de crédito, débito e boleto bancário. Todos os pagamentos são processados de forma segura."
        },
        {
          question: "Como funciona o pagamento dos fretes?",
          answer: "O produtor paga o frete antecipadamente. O valor fica retido na plataforma e é liberado para o motorista após a confirmação da entrega."
        },
        {
          question: "Posso solicitar adiantamento?",
          answer: "Sim, motoristas podem solicitar adiantamento de até 50% do valor do frete para cobrir despesas da viagem."
        }
      ]
    },
    {
      id: 'security',
      title: 'Segurança',
      icon: Shield,
      questions: [
        {
          question: "Como a AgriRoute garante a segurança?",
          answer: "Todos os usuários passam por verificação de documentos, utilizamos criptografia para proteger dados e temos um sistema de avaliações para construir confiança."
        },
        {
          question: "O que fazer em caso de problema no transporte?",
          answer: "Entre em contato imediatamente com nosso suporte. Temos uma equipe especializada para resolver conflitos e problemas operacionais."
        },
        {
          question: "Existe seguro para as cargas?",
          answer: "Oferecemos opções de seguro para as cargas transportadas. Consulte nossa equipe comercial para mais detalhes."
        }
      ]
    }
  ];

  const contactOptions = [
    {
      title: "Chat Online",
      description: "Fale conosco em tempo real",
      icon: MessageCircle,
      action: "Iniciar Chat",
      available: "24/7"
    },
    {
      title: "E-mail",
      description: "agrirouteconnect@gmail.com",
      icon: Mail,
      action: "Enviar E-mail",
      available: "Resposta em até 4h"
    },
    {
      title: "WhatsApp",
      description: "(66) 9 9273-4632",
      icon: Phone,
      action: "Chamar no WhatsApp",
      available: "Seg-Sex: 8h-18h"
    }
  ];

  const quickGuides = [
    {
      title: "Primeiro Frete - Guia do Produtor",
      description: "Aprenda a cadastrar seu primeiro frete em 5 minutos",
      duration: "5 min",
      type: "Vídeo"
    },
    {
      title: "Como ser um Motorista Parceiro",
      description: "Passo a passo para começar a trabalhar na plataforma",
      duration: "8 min",
      type: "Tutorial"
    },
    {
      title: "Rastreamento de Cargas",
      description: "Como acompanhar suas cargas em tempo real",
      duration: "3 min",
      type: "Guia"
    },
    {
      title: "Sistema de Pagamentos",
      description: "Entenda como funcionam os pagamentos na plataforma",
      duration: "6 min",
      type: "Vídeo"
    }
  ];

  const filteredFAQs = faqCategories.map(category => ({
    ...category,
    questions: category.questions.filter(
      q => q.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
           q.answer.toLowerCase().includes(searchQuery.toLowerCase())
    )
  })).filter(category => category.questions.length > 0);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Button 
            variant="ghost" 
            onClick={() => navigate('/')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar ao Início
          </Button>
          <h1 className="text-2xl font-bold">Central de Ajuda</h1>
          <div className="w-24" />
        </div>
      </header>

      <main className="container mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h1 className="text-4xl md:text-5xl font-bold mb-6 gradient-hero bg-clip-text text-transparent">
            Como podemos ajudar?
          </h1>
          <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
            Encontre respostas rápidas ou entre em contato com nossa equipe de suporte
          </p>
          
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 text-muted-foreground h-5 w-5" />
            <Input
              placeholder="Buscar por assunto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-12 h-14 text-lg"
            />
          </div>
        </div>

        <Tabs defaultValue="faq" className="space-y-8">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="faq">Perguntas Frequentes</TabsTrigger>
            <TabsTrigger value="guides">Guias Rápidos</TabsTrigger>
            <TabsTrigger value="contact">Contato</TabsTrigger>
          </TabsList>

          {/* FAQ Section */}
          <TabsContent value="faq" className="space-y-8">
            {searchQuery ? (
              <div className="space-y-6">
                <h2 className="text-2xl font-bold">Resultados da busca</h2>
                {filteredFAQs.length > 0 ? (
                  filteredFAQs.map((category) => (
                    <Card key={category.id}>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                          <category.icon className="h-5 w-5" />
                          {category.title}
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <Accordion type="single" collapsible>
                          {category.questions.map((item, itemIndex) => (
                            <AccordionItem key={`${category.id}-${itemIndex}`} value={`${category.id}-${itemIndex}`}>
                              <AccordionTrigger>{item.question}</AccordionTrigger>
                              <AccordionContent>{item.answer}</AccordionContent>
                            </AccordionItem>
                          ))}
                        </Accordion>
                      </CardContent>
                    </Card>
                  ))
                ) : (
                  <Card>
                    <CardContent className="p-12 text-center">
                      <HelpCircle className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                      <h3 className="text-xl font-semibold mb-2">Nenhum resultado encontrado</h3>
                      <p className="text-muted-foreground">Tente buscar com outras palavras ou entre em contato conosco.</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : (
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {faqCategories.map((category) => (
                  <Card key={category.id} className="hover:shadow-glow transition-shadow">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <category.icon className="h-5 w-5 text-primary" />
                        {category.title}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <Accordion type="single" collapsible>
                        {category.questions.map((item, itemIndex) => (
                          <AccordionItem key={`${category.id}-${itemIndex}`} value={`${category.id}-${itemIndex}`}>
                            <AccordionTrigger className="text-left">{item.question}</AccordionTrigger>
                            <AccordionContent>{item.answer}</AccordionContent>
                          </AccordionItem>
                        ))}
                      </Accordion>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Quick Guides */}
          <TabsContent value="guides" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Guias Rápidos</h2>
              <p className="text-muted-foreground">Tutoriais passo a passo para usar a plataforma</p>
            </div>
            
            <div className="grid md:grid-cols-2 gap-6">
              {quickGuides.map((guide) => (
                <Card key={guide.title} className="hover:shadow-glow transition-shadow">
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{guide.type}</Badge>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Clock className="h-4 w-4" />
                          {guide.duration}
                        </span>
                      </div>
                      <FileText className="h-6 w-6 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{guide.title}</h3>
                    <p className="text-muted-foreground mb-4">{guide.description}</p>
                    <Button variant="outline" className="w-full">
                      Acessar Guia
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Contact */}
          <TabsContent value="contact" className="space-y-8">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-bold mb-4">Entre em Contato</h2>
              <p className="text-muted-foreground">Nossa equipe está pronta para ajudar você</p>
            </div>
            
            <div className="grid md:grid-cols-3 gap-6 mb-12">
              {contactOptions.map((option) => (
                <Card key={option.title} className="hover:shadow-glow transition-shadow">
                  <CardContent className="p-6 text-center">
                    <div className="bg-primary/10 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4">
                      <option.icon className="h-8 w-8 text-primary" />
                    </div>
                    <h3 className="text-lg font-semibold mb-2">{option.title}</h3>
                    <p className="text-muted-foreground mb-2">{option.description}</p>
                    <div className="flex items-center justify-center gap-1 text-sm text-muted-foreground mb-4">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      {option.available}
                    </div>
                    <Button className="w-full gradient-primary text-primary-foreground">
                      {option.action}
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Status Banner */}
            <Card className="bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="bg-green-500 rounded-full w-3 h-3"></div>
                  <div>
                    <h3 className="font-semibold text-green-800 dark:text-green-200">
                      Todos os sistemas operacionais
                    </h3>
                    <p className="text-green-700 dark:text-green-300 text-sm">
                      Última verificação: há 2 minutos • <Link to="/status" className="underline">Ver detalhes</Link>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Help;