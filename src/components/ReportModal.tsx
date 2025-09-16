import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle } from 'lucide-react';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedUserId?: string;
  reportedUserName?: string;
}

const reportCategories = [
  { value: 'CONDUCT', label: 'Má Conduta', description: 'Comportamento inadequado ou unprofissional' },
  { value: 'FRAUD', label: 'Fraude', description: 'Atividades fraudulentas ou enganosas' },
  { value: 'HARASSMENT', label: 'Assédio', description: 'Assédio moral, sexual ou discriminação' },
  { value: 'SAFETY', label: 'Segurança', description: 'Práticas inseguras no transporte' },
  { value: 'PAYMENT', label: 'Pagamento', description: 'Problemas com pagamentos ou cobranças' },
  { value: 'VEHICLE', label: 'Veículo', description: 'Problemas com o veículo ou equipamentos' },
  { value: 'CARGO', label: 'Carga', description: 'Danos, perdas ou problemas com a carga' },
  { value: 'OTHER', label: 'Outros', description: 'Outras irregularidades não listadas' }
];

export const ReportModal: React.FC<ReportModalProps> = ({
  isOpen,
  onClose,
  reportedUserId,
  reportedUserName
}) => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: '',
    category: '',
    description: ''
  });


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.email || !formData.category || !formData.description) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Create the report
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: null, // Anonymous report
          reported_user_id: reportedUserId || null,
          reported_user_name: reportedUserName || 'Denúncia Anônima',
          category: formData.category,
          title: `Denúncia via formulário - ${formData.category}`,
          description: `Email para contato: ${formData.email}\n\nDescrição: ${formData.description}`,
          evidence_urls: []
        });

      if (error) throw error;

      toast({
        title: "Denúncia enviada",
        description: "Sua denúncia foi recebida e será analisada pela nossa equipe. Você receberá atualizações no email informado.",
      });

      // Reset form
      setFormData({
        email: '',
        category: '',
        description: ''
      });

      onClose();
      
    } catch (error) {
      console.error('Error submitting report:', error);
      toast({
        title: "Erro",
        description: "Erro ao enviar denúncia. Tente novamente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-orange-500" />
            Reportar Irregularidade
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Warning Card */}
          <Card className="bg-orange-50 border-orange-200 dark:bg-orange-950 dark:border-orange-800">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-orange-800 dark:text-orange-200 mb-1">
                    Denúncias falsas são passíveis de punição
                  </p>
                  <p className="text-orange-700 dark:text-orange-300">
                    Certifique-se de que está reportando uma situação real. Este formulário é anônimo - solicitamos apenas seu email para atualizações.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Email for updates */}
          <div>
            <Label htmlFor="email">Email para Notificações *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="seu@email.com"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Usado apenas para enviar atualizações sobre sua denúncia. Não será divulgado.
            </p>
          </div>

          {/* Category */}
          <div>
            <Label htmlFor="category">Categoria da Irregularidade *</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData(prev => ({ ...prev, category: value }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione a categoria" />
              </SelectTrigger>
              <SelectContent>
                {reportCategories.map(category => (
                  <SelectItem key={category.value} value={category.value}>
                    <div>
                      <div className="font-medium">{category.label}</div>
                      <div className="text-xs text-muted-foreground">{category.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Descrição do Problema *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva o que aconteceu de forma clara e objetiva..."
              rows={6}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Seja específico. Inclua informações relevantes como datas, locais ou nomes de usuários envolvidos.
            </p>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-4">
            <Button type="button" variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button 
              type="submit" 
              disabled={loading}
              className="gradient-primary text-primary-foreground"
            >
              {loading ? 'Enviando...' : 'Enviar Denúncia'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default ReportModal;