import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MessageCircle, Mail, Phone, MapPin, Clock } from 'lucide-react';
import { SUPPORT_PHONE_DISPLAY, SUPPORT_EMAIL } from '@/lib/support-contact';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center">
            Entre em Contato
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          <div className="text-center">
            <p className="text-muted-foreground">
              Fale conosco para suporte, parcerias ou dúvidas sobre nossa plataforma
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card className="shadow-card hover:shadow-glow transition-all">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-success rounded-full mb-4">
                  <MessageCircle className="h-6 w-6 text-success-foreground" />
                </div>
                <h3 className="font-semibold mb-2">WhatsApp</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Atendimento rápido via WhatsApp
                </p>
                <Button 
                  className="w-full"
                  onClick={() => {
                    const message = encodeURIComponent('Olá! Gostaria de saber mais sobre o AgriRoute.');
                    window.open(`https://wa.me/5566992734632?text=${message}`, '_blank');
                  }}
                >
                  Chamar no WhatsApp
                </Button>
              </CardContent>
            </Card>

            <Card className="shadow-card hover:shadow-glow transition-all">
              <CardContent className="p-6 text-center">
                <div className="inline-flex items-center justify-center w-12 h-12 bg-accent rounded-full mb-4">
                  <Mail className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="font-semibold mb-2">E-mail</h3>
                <p className="text-sm font-mono text-foreground mb-2">
                  {SUPPORT_EMAIL}
                </p>
                <p className="text-sm text-muted-foreground mb-4">
                  Envie sua mensagem por e-mail
                </p>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={() => {
                    window.open(`mailto:${SUPPORT_EMAIL}?subject=Contato AgriRoute`, '_blank');
                  }}
                >
                  Enviar E-mail
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-muted/30">
            <CardContent className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                <div className="flex items-center justify-center gap-2">
                  <Clock className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Horário</p>
                    <p className="text-sm text-muted-foreground">Seg-Sex: 8h-18h</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <Phone className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Telefone</p>
                    <p className="text-sm text-muted-foreground">{SUPPORT_PHONE_DISPLAY}</p>
                  </div>
                </div>
                <div className="flex items-center justify-center gap-2">
                  <MapPin className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="font-medium">Localização</p>
                    <p className="text-sm text-muted-foreground">Mato Grosso, Brasil</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="text-center">
            <p className="text-sm text-muted-foreground">
              Respondemos em até 24 horas úteis
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};