import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  PawPrint, 
  Upload, 
  FileUp,
  Info,
  Loader2,
  CheckCircle
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

interface GtaUploadDialogProps {
  isOpen: boolean;
  onClose: () => void;
  freightId?: string;
}

export const GtaUploadDialog: React.FC<GtaUploadDialogProps> = ({
  isOpen,
  onClose,
  freightId,
}) => {
  const { profile } = useAuth();
  const [isUploading, setIsUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  
  const [formData, setFormData] = useState({
    numero: '',
    data_emissao: '',
    uf_origem: '',
    uf_destino: '',
    especie_animal: '',
    quantidade: '',
    observacoes: '',
  });

  const updateField = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validar tipo
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        toast.error('Formato não suportado. Use PDF, JPG, PNG ou WebP.');
        return;
      }
      
      // Validar tamanho (5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo 5MB.');
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleSubmit = async () => {
    if (!selectedFile) {
      toast.error('Selecione um arquivo');
      return;
    }

    if (!formData.numero || !formData.data_emissao) {
      toast.error('Preencha o número e data de emissão');
      return;
    }

    setIsUploading(true);

    try {
      // Upload do arquivo para bucket existente
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `gta_${Date.now()}.${fileExt}`;
      const filePath = `${profile?.user_id}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('freight-attachments')
        .upload(filePath, selectedFile);

      if (uploadError) throw uploadError;

      // Gerar signed URL (bucket é privado)
      const { data: signedData } = await supabase.storage
        .from('freight-attachments')
        .createSignedUrl(filePath, 3600);

      const fileUrl = signedData?.signedUrl || filePath;

      // Persistir metadados na tabela freight_sanitary_documents
      if (freightId) {
        const { error: insertError } = await supabase
          .from('freight_sanitary_documents')
          .insert({
            freight_id: freightId,
            document_type: 'GTA',
            document_number: formData.numero,
            issue_date: formData.data_emissao,
            file_url: filePath,
            origin_property: formData.uf_origem || null,
            destination_property: formData.uf_destino || null,
            animal_count: formData.quantidade ? parseInt(formData.quantidade) : null,
            notes: [
              formData.especie_animal ? `Espécie: ${formData.especie_animal}` : '',
              formData.observacoes || '',
            ].filter(Boolean).join(' | ') || null,
            validation_status: 'pending',
            created_by: profile?.id || null,
          });

        if (insertError) throw insertError;
      }

      toast.success('GT-A enviada com sucesso!', {
        description: `Número: ${formData.numero}${freightId ? ' — vinculada ao frete' : ' — sem frete vinculado'}`,
      });
      
      onClose();
    } catch (error: any) {
      console.error('Erro ao enviar GT-A:', error);
      toast.error('Erro ao enviar GT-A', {
        description: error.message || 'Tente novamente',
      });
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PawPrint className="h-5 w-5 text-amber-600" />
            Upload GT-A
          </DialogTitle>
          <DialogDescription>
            Guia de Transporte Animal (documento externo)
          </DialogDescription>
        </DialogHeader>

        <Alert className="border-blue-500/30 bg-blue-500/5">
          <Info className="h-4 w-4 text-blue-600" />
          <AlertDescription className="text-sm">
            A GT-A é emitida pelos órgãos de defesa agropecuária estaduais e não pode ser 
            gerada via API. Faça upload do documento emitido pela sua UF.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          {/* Upload Area */}
          <div>
            <Label>Arquivo GT-A *</Label>
            <Card 
              className={`border-dashed cursor-pointer hover:bg-muted/50 transition-colors ${
                selectedFile ? 'border-green-500 bg-green-500/5' : ''
              }`}
              onClick={() => document.getElementById('gta-file')?.click()}
            >
              <CardContent className="flex flex-col items-center justify-center py-8">
                {selectedFile ? (
                  <>
                    <CheckCircle className="h-10 w-10 text-green-600 mb-2" />
                    <p className="font-medium">{selectedFile.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(selectedFile.size / 1024).toFixed(1)} KB
                    </p>
                  </>
                ) : (
                  <>
                    <FileUp className="h-10 w-10 text-muted-foreground mb-2" />
                    <p className="font-medium">Clique para selecionar</p>
                    <p className="text-sm text-muted-foreground">
                      PDF, JPG, PNG ou WebP (máx. 5MB)
                    </p>
                  </>
                )}
              </CardContent>
            </Card>
            <input
              id="gta-file"
              type="file"
              accept=".pdf,.jpg,.jpeg,.png,.webp"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Dados do GT-A */}
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="numero">Número do GT-A *</Label>
              <Input
                id="numero"
                value={formData.numero}
                onChange={(e) => updateField('numero', e.target.value)}
                placeholder="000000000"
              />
            </div>
            <div>
              <Label htmlFor="data_emissao">Data de Emissão *</Label>
              <Input
                id="data_emissao"
                type="date"
                value={formData.data_emissao}
                onChange={(e) => updateField('data_emissao', e.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="uf_origem">UF Origem</Label>
              <Input
                id="uf_origem"
                value={formData.uf_origem}
                onChange={(e) => updateField('uf_origem', e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="SP"
              />
            </div>
            <div>
              <Label htmlFor="uf_destino">UF Destino</Label>
              <Input
                id="uf_destino"
                value={formData.uf_destino}
                onChange={(e) => updateField('uf_destino', e.target.value.toUpperCase())}
                maxLength={2}
                placeholder="MG"
              />
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <Label htmlFor="especie_animal">Espécie Animal</Label>
              <Input
                id="especie_animal"
                value={formData.especie_animal}
                onChange={(e) => updateField('especie_animal', e.target.value)}
                placeholder="Bovinos, Suínos, etc."
              />
            </div>
            <div>
              <Label htmlFor="quantidade">Quantidade</Label>
              <Input
                id="quantidade"
                type="number"
                value={formData.quantidade}
                onChange={(e) => updateField('quantidade', e.target.value)}
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="observacoes">Observações</Label>
            <Textarea
              id="observacoes"
              value={formData.observacoes}
              onChange={(e) => updateField('observacoes', e.target.value)}
              placeholder="Informações adicionais..."
              rows={2}
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancelar
          </Button>
          <Button 
            onClick={handleSubmit} 
            disabled={isUploading || !selectedFile}
            className="bg-amber-600 hover:bg-amber-700"
          >
            {isUploading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Enviando...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Enviar GT-A
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
