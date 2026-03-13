import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Leaf, FileText } from 'lucide-react';
import { termsContent } from '@/components/LegalDocumentDialog';

const Terms = () => {
  const navigate = useNavigate();

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

      {/* All Sections */}
      <section className="py-16">
        <div className="container mx-auto px-4 space-y-8 max-w-4xl">
          {termsContent.map((section) => (
            <Card key={section.title} className="shadow-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-full bg-primary/10">
                    <FileText className="h-6 w-6 text-primary" />
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

      {/* Contact */}
      <section className="py-16 bg-muted/30">
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
            <p><strong>WhatsApp:</strong> (66) 9 9273-4632</p>
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
