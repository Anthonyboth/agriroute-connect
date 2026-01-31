/**
 * DocumentUploadLocal - Componente para upload de documentos sem autenticação
 * 
 * Este componente armazena os arquivos localmente em memória (como Blob)
 * para fazer upload somente após a autenticação do usuário.
 * 
 * Usado em fluxos de cadastro onde o usuário ainda não está logado.
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, Check, X, FileImage, Loader2 } from 'lucide-react';
import { validateImageQuality } from '@/utils/imageValidator';

interface DocumentUploadLocalProps {
  /** Callback quando arquivo é selecionado - recebe o Blob e preview URL */
  onFileSelect: (blob: Blob, previewUrl: string) => void;
  /** Tipos de arquivo aceitos */
  accept?: string;
  /** Tamanho máximo em MB */
  maxSize?: number;
  /** URL de preview atual (para mostrar status) */
  currentPreview?: string;
  /** Label do campo */
  label?: string;
  /** ID único do campo */
  fileType?: string;
  /** Se é obrigatório */
  required?: boolean;
  /** Habilitar verificação de qualidade de imagem */
  enableQualityCheck?: boolean;
}

export const DocumentUploadLocal: React.FC<DocumentUploadLocalProps> = ({
  onFileSelect,
  accept = 'image/*,image/heic,image/heif',
  maxSize = 5,
  currentPreview,
  label = 'Documento',
  fileType = 'document',
  required = false,
  enableQualityCheck = true
}) => {
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [hasFile, setHasFile] = useState(!!currentPreview);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    console.log('[DocumentUploadLocal] Arquivo selecionado:', {
      name: file.name,
      size: file.size,
      type: file.type,
      label
    });

    // Validar tamanho
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${maxSize}MB.`);
      event.target.value = '';
      return;
    }

    setProcessing(true);

    try {
      // Validação de qualidade de imagem (se habilitado e for imagem)
      if (enableQualityCheck && file.type.startsWith('image/')) {
        const validationResult = await validateImageQuality(file);
        
        if (!validationResult.valid) {
          toast.error(`Qualidade insuficiente: ${validationResult.reason}`);
          event.target.value = '';
          setProcessing(false);
          return;
        }
      }

      // Criar preview URL local
      const previewUrl = URL.createObjectURL(file);
      
      // Converter para Blob (já é um Blob/File)
      const blob = file as Blob;

      console.log('[DocumentUploadLocal] Arquivo processado com sucesso:', {
        name: file.name,
        previewUrl: previewUrl.substring(0, 50) + '...'
      });

      setFileName(file.name);
      setHasFile(true);
      
      // Callback com blob e preview
      onFileSelect(blob, previewUrl);
      
      toast.success(`${label} selecionado com sucesso!`);

    } catch (error) {
      console.error('[DocumentUploadLocal] Erro ao processar arquivo:', error);
      toast.error(`Erro ao processar ${label.toLowerCase()}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleRemove = () => {
    setHasFile(false);
    setFileName('');
    if (inputRef.current) {
      inputRef.current.value = '';
    }
    // Limpar com string vazia
    onFileSelect(new Blob([]), '');
  };

  const isComplete = hasFile || !!currentPreview;

  return (
    <div className="space-y-2">
      <Label htmlFor={fileType}>
        {label} {required && <span className="text-red-500">*</span>}
      </Label>
      <Card className={isComplete ? 'border-green-300' : ''}>
        <CardContent className="p-4">
          <div className="flex items-center gap-2">
            <Input
              ref={inputRef}
              id={fileType}
              type="file"
              accept={accept}
              onChange={handleFileChange}
              disabled={processing}
              className="hidden"
              capture="environment"
            />
            
            {isComplete ? (
              <div className="flex items-center justify-between w-full">
                <div className="flex items-center gap-2 text-green-700">
                  <Check className="h-4 w-4" />
                  <span className="text-sm truncate max-w-[200px]">
                    {fileName || 'Arquivo selecionado'}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRemove}
                  className="text-red-500 hover:text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <Label
                htmlFor={fileType}
                className={`flex items-center justify-center w-full p-3 border-2 border-dashed rounded-md cursor-pointer transition-colors ${
                  processing
                    ? 'border-blue-300 bg-blue-50 text-blue-700'
                    : 'border-gray-300 hover:border-primary hover:bg-primary/5'
                }`}
              >
                {processing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processando...
                  </>
                ) : (
                  <>
                    <Camera className="h-4 w-4 mr-2" />
                    Clique para selecionar {label.toLowerCase()}
                  </>
                )}
              </Label>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUploadLocal;
