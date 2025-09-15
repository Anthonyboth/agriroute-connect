import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Phone, Mail, MessageCircle, User } from 'lucide-react';

export const ContactInfo: React.FC = () => {
  const handleWhatsAppClick = () => {
    const phoneNumber = '5566999426656'; // Formato internacional sem espaços
    const message = encodeURIComponent('Olá! Preciso de ajuda com o AgriRoute Connect.');
    window.open(`https://wa.me/${phoneNumber}?text=${message}`, '_blank');
  };

  const handleEmailClick = () => {
    window.open('mailto:anthony_pva@hotmail.com?subject=Suporte AgriRoute Connect', '_blank');
  };

  return (
    <Card className="bg-gradient-to-br from-primary/5 to-primary/10 border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-primary">
          <User className="h-5 w-5" />
          Contato & Suporte
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center space-y-2">
          <h3 className="font-semibold text-lg">Anthony Both</h3>
          <p className="text-sm text-muted-foreground">
            Fundador & CEO do AgriRoute Connect
          </p>
        </div>

        <div className="grid gap-3">
          <Button
            variant="outline"
            className="justify-start gap-3 h-auto p-4"
            onClick={handleWhatsAppClick}
          >
            <div className="flex items-center justify-center w-8 h-8 bg-green-500 rounded-full">
              <MessageCircle className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">WhatsApp</p>
              <p className="text-sm text-muted-foreground">015 66 9 9942-6656</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto p-4"
            onClick={handleEmailClick}
          >
            <div className="flex items-center justify-center w-8 h-8 bg-blue-500 rounded-full">
              <Mail className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">E-mail</p>
              <p className="text-sm text-muted-foreground">anthony_pva@hotmail.com</p>
            </div>
          </Button>

          <Button
            variant="outline"
            className="justify-start gap-3 h-auto p-4"
            onClick={() => window.open('tel:+5566999426656', '_self')}
          >
            <div className="flex items-center justify-center w-8 h-8 bg-gray-500 rounded-full">
              <Phone className="h-4 w-4 text-white" />
            </div>
            <div className="text-left">
              <p className="font-medium">Telefone</p>
              <p className="text-sm text-muted-foreground">015 66 9 9942-6656</p>
            </div>
          </Button>
        </div>

        <div className="text-center pt-2">
          <p className="text-xs text-muted-foreground">
            Estamos aqui para ajudar! Entre em contato a qualquer momento.
          </p>
        </div>
      </CardContent>
    </Card>
  );
};

export default ContactInfo;