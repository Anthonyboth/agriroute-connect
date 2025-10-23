import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Upload, Check, X, Camera } from 'lucide-react';
import { validateImageQuality } from '@/utils/imageValidator';
import { uploadWithAuthRetry } from '@/utils/authUploadHelper';

interface DocumentUploadProps {
  onUploadComplete: (url: string) => void;
  acceptedTypes?: string[];
  maxSize?: number;
  currentFile?: string;
  label?: string;
  fileType?: string;
  bucketName?: string;
  required?: boolean;
  accept?: string;
  enableQualityCheck?: boolean;
}

export const DocumentUpload: React.FC<DocumentUploadProps> = ({
  onUploadComplete,
  acceptedTypes = ['image/*'],
  maxSize = 5,
  currentFile,
  label = 'Documento',
  fileType = 'document',
  bucketName = 'profile-photos',
  required = false,
  accept = 'image/*,image/heic,image/heif',
  enableQualityCheck = true
}) => {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);
  const [fileName, setFileName] = useState('');

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('Starting file upload...', { fileName: file.name, bucketName, fileType });
    
    // Validação de qualidade de imagem (se habilitado)
    if (enableQualityCheck && file.type.startsWith('image/')) {
      const validationResult = await validateImageQuality(file);
      
      if (!validationResult.valid) {
        toast.error(`Qualidade insuficiente: ${validationResult.reason}`);
        event.target.value = '';
        return;
      }
    }
    
    setUploading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${fileType}_${Date.now()}.${fileExt}`;
      
      // Usar upload com retry de autenticação
      const result = await uploadWithAuthRetry({
        file,
        bucketName,
        fileName
      });
      
      if ('error' in result) {
        if (result.error === 'AUTH_EXPIRED') {
          return; // Já está redirecionando para login
        }
        throw new Error(result.error);
      }
      
      setUploaded(true);
      setFileName(file.name);
      onUploadComplete(result.publicUrl);
      toast.success(`${label} enviado com sucesso!`);
      
    } catch (error) {
      console.error('Error uploading file:', error);
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      toast.error(`Erro ao enviar ${label.toLowerCase()}: ${errorMessage}`);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={fileType}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <Input
              id={fileType}
              type="file"
              accept={accept}
              onChange={handleFileUpload}
              disabled={uploading || uploaded}
              className="hidden"
              capture="environment"
            />
            <Label
              htmlFor={fileType}
              className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                uploaded
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : uploading
                  ? 'border-blue-300 bg-blue-50 text-blue-700'
                  : 'border-gray-300 hover:border-gray-400'
              }`}
            >
              {uploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 mr-2"></div>
                  Enviando...
                </>
              ) : uploaded ? (
                <>
                  <Check className="h-4 w-4 mr-2" />
                  {fileName}
                </>
              ) : (
                <>
                  <Camera className="h-4 w-4 mr-2" />
                  Clique para enviar {label.toLowerCase()}
                </>
              )}
            </Label>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUpload;