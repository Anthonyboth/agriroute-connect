import React, { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MessageSquare, Lightbulb, AlertTriangle, Gift } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';

interface SuggestionModalProps {
  children: React.ReactNode;
}

export const SuggestionModal: React.FC<SuggestionModalProps> = ({ children }) => {
  const { profile } = useAuth();
  const { toast } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    type: '',
    subject: '',
    description: '',
    contact_preference: 'email'
  });

  const suggestionTypes = [
    { value: 'suggestion', label: 'Sugestão de Melhoria', icon: Lightbulb },
    { value: 'complaint', label: 'Reclamação', icon: AlertTriangle },
    { value: 'tip', label: 'Dica', icon: Gift },
    { value: 'other', label: 'Outro', icon: MessageSquare }
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !formData.type || !formData.subject || !formData.description) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      // Create support ticket
      const { error } = await supabase
        .from('support_tickets')
        .insert({
          user_id: profile.id,
          subject: `[${formData.type.toUpperCase()}] ${formData.subject}`,
          description: formData.description,
          category: formData.type.toUpperCase(),
          priority: formData.type === 'complaint' ? 'HIGH' : 'MEDIUM',
          status: 'OPEN'
        });

      if (error) throw error;

      toast({
        title: "Enviado com sucesso!",
        description: "Obrigado pelo seu feedback. Analisaremos sua mensagem em breve.",
      });

      // Reset form
      setFormData({
        type: '',
        subject: '',
        description: '',
        contact_preference: 'email'
      });
      
      setIsOpen(false);
    } catch (error: any) {
      toast({
        title: "Erro ao enviar",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const getTypeIcon = (type: string) => {
    const typeData = suggestionTypes.find(t => t.value === type);
    return typeData ? typeData.icon : MessageSquare;
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            Sugestões, Reclamações e Dicas
          </DialogTitle>
          <DialogDescription>
            Sua opinião é muito importante para nós! Ajude-nos a melhorar o AgriRoute Connect.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="type">Tipo da Mensagem *</Label>
            <Select value={formData.type} onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo da sua mensagem" />
              </SelectTrigger>
              <SelectContent>
                {suggestionTypes.map((type) => {
                  const Icon = type.icon;
                  return (
                    <SelectItem key={type.value} value={type.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        {type.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="subject">Assunto *</Label>
            <Input
              id="subject"
              value={formData.subject}
              onChange={(e) => setFormData(prev => ({ ...prev, subject: e.target.value }))}
              placeholder="Descreva brevemente o assunto"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição Detalhada *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Conte-nos mais detalhes sobre sua sugestão, reclamação ou dica..."
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground">
              {formData.description.length}/1000 caracteres
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="contact_preference">Preferência de Contato</Label>
            <Select 
              value={formData.contact_preference} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, contact_preference: value }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="email">E-mail</SelectItem>
                <SelectItem value="whatsapp">WhatsApp</SelectItem>
                <SelectItem value="phone">Telefone</SelectItem>
                <SelectItem value="no_contact">Não precisa de retorno</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4">
              <h4 className="font-medium text-blue-900 mb-2">Como sua mensagem nos ajuda:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• <strong>Sugestões:</strong> Nos ajudam a criar novas funcionalidades</li>
                <li>• <strong>Reclamações:</strong> Nos permitem corrigir problemas rapidamente</li>
                <li>• <strong>Dicas:</strong> Compartilhe conhecimento com outros usuários</li>
              </ul>
            </CardContent>
          </Card>

          <div className="flex gap-3 justify-end">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => setIsOpen(false)}
              disabled={loading}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Enviando...' : 'Enviar Mensagem'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default SuggestionModal;