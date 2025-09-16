import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AlertTriangle, FileText, Upload, X } from 'lucide-react';

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
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    reportedUserId: reportedUserId || '',
    reportedUserName: reportedUserName || '',
    category: '',
    title: '',
    description: '',
    evidenceFiles: [] as File[]
  });

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles = files.filter(file => {
      const isValidType = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'].includes(file.type);
      const isValidSize = file.size <= 5 * 1024 * 1024; // 5MB
      return isValidType && isValidSize;
    });

    if (validFiles.length < files.length) {
      toast({
        title: "Alguns arquivos foram ignorados",
        description: "Apenas imagens (JPG, PNG) e PDFs até 5MB são aceitos.",
        variant: "destructive",
      });
    }

    setFormData(prev => ({
      ...prev,
      evidenceFiles: [...prev.evidenceFiles, ...validFiles].slice(0, 5) // Max 5 files
    }));
  };

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      evidenceFiles: prev.evidenceFiles.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!user) {
      toast({
        title: "Erro",
        description: "Você precisa estar logado para fazer uma denúncia.",
        variant: "destructive",
      });
      return;
    }

    if (!formData.reportedUserId || !formData.category || !formData.title || !formData.description) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      // Upload evidence files if any
      const evidenceUrls: string[] = [];
      
      for (const file of formData.evidenceFiles) {
        const fileName = `${Date.now()}-${file.name}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('freight-attachments')
          .upload(`reports/${fileName}`, file);

        if (uploadError) throw uploadError;
        
        if (uploadData) {
          const { data: { publicUrl } } = supabase.storage
            .from('freight-attachments')
            .getPublicUrl(uploadData.path);
          evidenceUrls.push(publicUrl);
        }
      }

      // Create the report
      const { error } = await supabase
        .from('user_reports')
        .insert({
          reporter_id: user.id,
          reported_user_id: formData.reportedUserId,
          reported_user_name: formData.reportedUserName,
          category: formData.category,
          title: formData.title,
          description: formData.description,
          evidence_urls: evidenceUrls
        });

      if (error) throw error;

      toast({
        title: "Denúncia enviada",
        description: "Sua denúncia foi recebida e será analisada pela nossa equipe.",
      });

      // Reset form
      setFormData({
        reportedUserId: '',
        reportedUserName: '',
        category: '',
        title: '',
        description: '',
        evidenceFiles: []
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

  const selectedCategory = reportCategories.find(cat => cat.value === formData.category);

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
                    Certifique-se de que está reportando uma situação real. Denúncias falsas podem resultar em suspensão da conta.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* User Info */}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="reportedUserId">ID do Usuário Reportado *</Label>
              <Input
                id="reportedUserId"
                value={formData.reportedUserId}
                onChange={(e) => setFormData(prev => ({ ...prev, reportedUserId: e.target.value }))}
                placeholder="ID ou e-mail do usuário"
                required
              />
            </div>
            <div>
              <Label htmlFor="reportedUserName">Nome do Usuário</Label>
              <Input
                id="reportedUserName"
                value={formData.reportedUserName}
                onChange={(e) => setFormData(prev => ({ ...prev, reportedUserName: e.target.value }))}
                placeholder="Nome (se souber)"
              />
            </div>
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
            {selectedCategory && (
              <p className="text-sm text-muted-foreground mt-1">
                {selectedCategory.description}
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <Label htmlFor="title">Título da Denúncia *</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              placeholder="Resuma o problema em uma frase"
              required
            />
          </div>

          {/* Description */}
          <div>
            <Label htmlFor="description">Descrição Detalhada *</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Descreva detalhadamente o que aconteceu, quando, onde e como..."
              rows={5}
              required
            />
            <p className="text-xs text-muted-foreground mt-1">
              Seja específico e objetivo. Inclua datas, horários e locais quando relevante.
            </p>
          </div>

          {/* Evidence Upload */}
          <div>
            <Label htmlFor="evidence">Evidências (Opcional)</Label>
            <div className="border-2 border-dashed border-muted-foreground/25 rounded-lg p-6 text-center">
              <Upload className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground mb-4">
                Anexe prints, fotos ou documentos que comprovem a irregularidade
              </p>
              <Input
                type="file"
                multiple
                accept="image/*,.pdf"
                onChange={handleFileUpload}
                className="hidden"
                id="evidence"
              />
              <Label htmlFor="evidence" className="cursor-pointer">
                <Button type="button" variant="outline" asChild>
                  <span>Selecionar Arquivos</span>
                </Button>
              </Label>
              <p className="text-xs text-muted-foreground mt-2">
                Máximo 5 arquivos • JPG, PNG, PDF • Até 5MB cada
              </p>
            </div>

            {/* Uploaded Files */}
            {formData.evidenceFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                <Label>Arquivos Selecionados:</Label>
                <div className="space-y-2">
                  {formData.evidenceFiles.map((file, index) => (
                    <div key={index} className="flex items-center justify-between p-2 bg-muted rounded">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        <span className="text-sm">{file.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {(file.size / 1024 / 1024).toFixed(1)}MB
                        </Badge>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFile(index)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            )}
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