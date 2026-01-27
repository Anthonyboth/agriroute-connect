import React, { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Camera, RotateCcw, Check, X, Upload, AlertTriangle, Smartphone } from 'lucide-react';
import { toast } from 'sonner';

interface CameraSelfieProps {
  onCapture: (imageBlob: Blob, uploadMethod: 'CAMERA' | 'GALLERY') => void;
  onCancel?: () => void;
  autoStart?: boolean; // mantido por compatibilidade (não pode abrir câmera sem gesto do usuário)
}

type UploadMethod = 'CAMERA' | 'GALLERY';

export const CameraSelfie: React.FC<CameraSelfieProps> = ({ onCapture, onCancel }) => {
  const selfieInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [method, setMethod] = useState<UploadMethod | null>(null);
  const [confirming, setConfirming] = useState(false);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewDataUrl(null);
    setMethod(null);
    setConfirming(false);
    if (selfieInputRef.current) selfieInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }, []);

  const readAndPreview = useCallback((picked: File, pickedMethod: UploadMethod) => {
    const isImage = picked.type?.startsWith('image/') || picked.name?.match(/\.(jpg|jpeg|png|webp|heic|heif)$/i);
    if (!isImage) {
      toast.error('Por favor, selecione uma imagem válida.');
      return;
    }

    // 10MB (evita travamentos com imagens gigantes)
    if (picked.size > 10 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string | undefined;
      if (!result) {
        toast.error('Não foi possível processar a imagem.');
        return;
      }
      setFile(picked);
      setMethod(pickedMethod);
      setPreviewDataUrl(result);
    };
    reader.onerror = () => {
      toast.error('Erro ao processar imagem. Tente novamente.');
    };
    reader.readAsDataURL(picked);
  }, []);

  const onSelfieChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (!picked) return;

      readAndPreview(picked, 'CAMERA');
      event.target.value = '';
    },
    [readAndPreview]
  );

  const onGalleryChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (!picked) return;
      readAndPreview(picked, 'GALLERY');
      event.target.value = '';
    },
    [readAndPreview]
  );

  const confirm = useCallback(async () => {
    if (!file || !method) return;

    try {
      setConfirming(true);
      const buf = await file.arrayBuffer();
      const blob = new Blob([buf], { type: file.type || 'image/jpeg' });
      onCapture(blob, method);
    } catch (e) {
      console.error('❌ Erro ao confirmar selfie:', e);
      toast.error('Erro ao confirmar selfie. Tente novamente.');
    } finally {
      setConfirming(false);
    }
  }, [file, method, onCapture]);

  const hasPreview = Boolean(previewDataUrl);

  return (
    <Card className="w-full max-w-md mx-auto max-h-[90vh] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className="flex items-center gap-2">
          <Camera className="h-5 w-5" />
          Selfie para Verificação
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4 overflow-y-auto flex-1">
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            <strong>IMPORTANTE:</strong> A selfie deve mostrar seu rosto claramente junto com um documento de identidade (RG/CNH) ao lado do rosto para verificação.
          </AlertDescription>
        </Alert>

        <div className="relative bg-muted rounded-lg overflow-hidden min-h-[300px] max-h-[50vh]">
          {!hasPreview ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-4">
              {/*
                Input DENTRO do label para manter o gesto do usuário (compatível com mobile e webview)
              */}
              <label className="relative w-full cursor-pointer">
                <input
                  ref={selfieInputRef}
                  type="file"
                  accept="image/*"
                  capture="user"
                  onChange={onSelfieChange}
                  className="absolute inset-0 w-full h-full opacity-[0.01] cursor-pointer"
                  style={{ zIndex: 10 }}
                  aria-label="Capturar selfie com câmera frontal"
                />
                <Button 
                  asChild 
                  size="lg" 
                  className="w-full pointer-events-none bg-primary hover:bg-primary/90 text-primary-foreground"
                >
                  <span>
                    <Camera className="mr-2 h-5 w-5" />
                    Capturar Selfie
                  </span>
                </Button>
              </label>

              <label className="relative w-full cursor-pointer">
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*"
                  onChange={onGalleryChange}
                  className="absolute inset-0 w-full h-full opacity-[0.01] cursor-pointer"
                  style={{ zIndex: 10 }}
                  aria-label="Selecionar imagem da galeria"
                />
                <Button asChild variant="outline" size="lg" className="w-full pointer-events-none">
                  <span>
                    <Upload className="mr-2 h-5 w-5" />
                    Enviar da Galeria
                  </span>
                </Button>
              </label>

              {onCancel && (
                <Button type="button" variant="ghost" onClick={onCancel} className="w-full">
                  <X className="mr-2 h-4 w-4" />
                  Cancelar
                </Button>
              )}
            </div>
          ) : (
            <img src={previewDataUrl ?? ''} alt="Selfie capturada" className="w-full h-full object-cover" />
          )}
        </div>

        {hasPreview && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
            <div className="flex gap-2 justify-center">
              <Button type="button" onClick={reset} variant="outline" size="lg" disabled={confirming}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer
              </Button>
              <Button 
                type="button" 
                onClick={confirm} 
                size="lg" 
                className="flex-1 bg-primary hover:bg-primary/90 text-primary-foreground" 
                disabled={confirming}
              >
                <Check className="mr-2 h-4 w-4" />
                {confirming ? 'Confirmando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        )}

        <p className="text-xs text-muted-foreground text-center">
          {method === 'CAMERA'
            ? '✅ Selfie capturada da câmera'
            : method === 'GALLERY'
              ? '✅ Imagem selecionada da galeria'
              : 'Escolha como enviar sua selfie com documento'}
        </p>
      </CardContent>
    </Card>
  );
};

export default CameraSelfie;