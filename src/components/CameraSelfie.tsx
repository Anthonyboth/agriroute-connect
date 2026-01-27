import React, { useCallback, useMemo, useRef, useState } from 'react';
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

  const ids = useMemo(() => {
    const rand = (typeof crypto !== 'undefined' && 'randomUUID' in crypto)
      ? (crypto as any).randomUUID()
      : Math.random().toString(16).slice(2);

    return {
      selfie: `selfie_capture_${rand}`,
      gallery: `selfie_gallery_${rand}`,
    };
  }, []);

  const reset = useCallback(() => {
    setFile(null);
    setPreviewDataUrl(null);
    setMethod(null);
    setConfirming(false);

    if (selfieInputRef.current) selfieInputRef.current.value = '';
    if (galleryInputRef.current) galleryInputRef.current.value = '';
  }, []);

  const readAndPreview = useCallback((picked: File, pickedMethod: UploadMethod) => {
    if (!picked.type.startsWith('image/')) {
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
      toast.success('Imagem pronta para confirmação.');
    };
    reader.onerror = () => {
      toast.error('Erro ao processar imagem. Tente novamente.');
    };
    reader.readAsDataURL(picked);
  }, []);

  const onSelfieChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const picked = event.target.files?.[0];
      if (!picked) return; // usuário cancelou

      readAndPreview(picked, 'CAMERA');

      // reset para permitir nova tentativa, mesmo com o mesmo arquivo
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
              {/* Fluxo 100% nativo: label htmlFor + input dentro do viewport (fixo) */}
              <Button asChild size="lg" className="w-full">
                <label htmlFor={ids.selfie} className="cursor-pointer">
                  <Smartphone className="mr-2 h-5 w-5" />
                  Capturar Selfie (Câmera Frontal)
                </label>
              </Button>

              <Button asChild variant="outline" size="lg" className="w-full">
                <label htmlFor={ids.gallery} className="cursor-pointer">
                  <Upload className="mr-2 h-5 w-5" />
                  Enviar da Galeria
                </label>
              </Button>

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

        {/* Inputs nativos (NÃO usar display:none; manter dentro do viewport) */}
        <input
          ref={selfieInputRef}
          id={ids.selfie}
          type="file"
          accept="image/*"
          capture="user"
          onChange={onSelfieChange}
          style={{
            position: 'fixed',
            top: 8,
            left: 8,
            width: 1,
            height: 1,
            opacity: 0.01,
            zIndex: 2147483647,
          }}
          aria-label="Capturar selfie com câmera frontal"
        />

        <input
          ref={galleryInputRef}
          id={ids.gallery}
          type="file"
          accept="image/*"
          onChange={onGalleryChange}
          style={{
            position: 'fixed',
            top: 8,
            left: 12,
            width: 1,
            height: 1,
            opacity: 0.01,
            zIndex: 2147483647,
          }}
          aria-label="Selecionar imagem da galeria"
        />

        {hasPreview && (
          <div className="sticky bottom-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90 pt-3 pb-1 -mx-6 px-6 border-t">
            <div className="flex gap-2 justify-center">
              <Button type="button" onClick={reset} variant="outline" size="lg" disabled={confirming}>
                <RotateCcw className="mr-2 h-4 w-4" />
                Refazer
              </Button>
              <Button type="button" onClick={confirm} size="lg" className="flex-1" disabled={confirming}>
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