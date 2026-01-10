import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  Paperclip, Upload, Image, FileText, Download, 
  Trash2, Eye, X, Camera, File, Loader2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string;
  file_size: number;
  uploaded_by: string;
  uploaded_at: string;
  category: string;
  uploader?: {
    full_name: string;
  };
}

interface FreightAttachmentsProps {
  freightId: string;
  currentUserProfileId: string;
  isParticipant: boolean; // Can upload if participant
  isProducer: boolean;
}

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'application/pdf',
  'image/heic',
  'image/heif'
];

const CATEGORIES = [
  { value: 'carga', label: 'Foto da Carga' },
  { value: 'comprovante', label: 'Comprovante de Entrega' },
  { value: 'nota_fiscal', label: 'Nota Fiscal' },
  { value: 'documento', label: 'Documento' },
  { value: 'avaria', label: 'Registro de Avaria' },
  { value: 'outro', label: 'Outro' }
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export const FreightAttachments: React.FC<FreightAttachmentsProps> = ({
  freightId,
  currentUserProfileId,
  isParticipant,
  isProducer
}) => {
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [selectedCategory, setSelectedCategory] = useState('carga');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchAttachments = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('freight_attachments')
        .select(`
          id, file_name, file_url, file_type, file_size, 
          uploaded_by, uploaded_at, category,
          uploader:profiles!uploaded_by(full_name)
        `)
        .eq('freight_id', freightId)
        .order('uploaded_at', { ascending: false });

      if (error) throw error;
      
      // Normalize uploader data
      const normalized = (data || []).map(item => ({
        ...item,
        uploader: Array.isArray(item.uploader) ? item.uploader[0] : item.uploader
      }));
      
      setAttachments(normalized);
    } catch (error) {
      console.error('[FreightAttachments] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  }, [freightId]);

  useEffect(() => {
    fetchAttachments();
  }, [fetchAttachments]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error('Tipo de arquivo não permitido', {
        description: 'Use: JPG, PNG, WebP, PDF ou HEIC'
      });
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error('Arquivo muito grande', {
        description: 'Máximo permitido: 10MB'
      });
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${freightId}/${Date.now()}.${fileExt}`;
      const filePath = `freight-attachments/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('freight-attachments')
        .upload(filePath, selectedFile, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('freight-attachments')
        .getPublicUrl(filePath);

      // Insert record in database
      const { error: insertError } = await supabase
        .from('freight_attachments')
        .insert({
          freight_id: freightId,
          file_name: selectedFile.name,
          file_url: urlData.publicUrl,
          file_type: selectedFile.type,
          file_size: selectedFile.size,
          uploaded_by: currentUserProfileId,
          category: selectedCategory
        });

      if (insertError) throw insertError;

      toast.success('Anexo enviado com sucesso!');
      setSelectedFile(null);
      fetchAttachments();
    } catch (error: any) {
      console.error('[FreightAttachments] Erro no upload:', error);
      toast.error('Erro ao enviar anexo', {
        description: error.message
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (attachment: Attachment) => {
    // Only uploader or producer can delete
    if (attachment.uploaded_by !== currentUserProfileId && !isProducer) {
      toast.error('Sem permissão para excluir este anexo');
      return;
    }

    try {
      // Extract path from URL
      const urlParts = attachment.file_url.split('/');
      const filePath = urlParts.slice(-2).join('/');

      // Delete from storage
      await supabase.storage
        .from('freight-attachments')
        .remove([`freight-attachments/${filePath}`]);

      // Delete from database
      const { error } = await supabase
        .from('freight_attachments')
        .delete()
        .eq('id', attachment.id);

      if (error) throw error;

      toast.success('Anexo removido');
      fetchAttachments();
    } catch (error: any) {
      console.error('[FreightAttachments] Erro ao excluir:', error);
      toast.error('Erro ao excluir anexo');
    }
  };

  const handlePreview = (url: string) => {
    setPreviewUrl(url);
    setPreviewOpen(true);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const getFileIcon = (type: string) => {
    if (type.startsWith('image/')) {
      return <Image className="h-5 w-5 text-blue-500" />;
    }
    if (type === 'application/pdf') {
      return <FileText className="h-5 w-5 text-red-500" />;
    }
    return <File className="h-5 w-5 text-muted-foreground" />;
  };

  const getCategoryLabel = (value: string) => {
    return CATEGORIES.find(c => c.value === value)?.label || value;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Paperclip className="h-5 w-5" />
            Anexos do Frete
          </span>
          <Badge variant="secondary">{attachments.length} arquivo(s)</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Upload Section - Only for participants */}
        {isParticipant && (
          <div className="p-4 border-2 border-dashed rounded-lg space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="file-upload">Arquivo</Label>
                <Input
                  id="file-upload"
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.heic,.heif"
                  onChange={handleFileSelect}
                  disabled={uploading}
                  className="mt-1"
                />
                {selectedFile && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {selectedFile.name} ({formatFileSize(selectedFile.size)})
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="category">Categoria</Label>
                <select
                  id="category"
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
                  disabled={uploading}
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat.value} value={cat.value}>
                      {cat.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            <Button
              onClick={handleUpload}
              disabled={!selectedFile || uploading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Anexo
                </>
              )}
            </Button>
          </div>
        )}

        {/* Attachments List */}
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando anexos...
          </div>
        ) : attachments.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Paperclip className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum anexo adicionado</p>
            {isParticipant && (
              <p className="text-sm mt-2">
                Adicione fotos da carga, comprovantes ou documentos
              </p>
            )}
          </div>
        ) : (
          <ScrollArea className="h-72">
            <div className="space-y-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors"
                >
                  {getFileIcon(attachment.file_type)}
                  
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{attachment.file_name}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Badge variant="outline" className="text-xs">
                        {getCategoryLabel(attachment.category)}
                      </Badge>
                      <span>{formatFileSize(attachment.file_size)}</span>
                      <span>•</span>
                      <span>
                        {format(new Date(attachment.uploaded_at), "dd/MM HH:mm", { locale: ptBR })}
                      </span>
                      {attachment.uploader?.full_name && (
                        <>
                          <span>•</span>
                          <span>{attachment.uploader.full_name}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    {attachment.file_type.startsWith('image/') && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handlePreview(attachment.file_url)}
                      >
                        <Eye className="h-4 w-4" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      asChild
                    >
                      <a href={attachment.file_url} download target="_blank" rel="noopener noreferrer">
                        <Download className="h-4 w-4" />
                      </a>
                    </Button>
                    {(attachment.uploaded_by === currentUserProfileId || isProducer) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDelete(attachment)}
                        className="text-destructive hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Image Preview Dialog */}
        <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Visualizar Imagem</DialogTitle>
            </DialogHeader>
            {previewUrl && (
              <div className="relative">
                <img
                  src={previewUrl}
                  alt="Preview"
                  className="w-full h-auto max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            )}
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
};
