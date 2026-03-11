import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';

import { toast } from 'sonner';
import { Upload, Check, Camera, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { validateImageQuality } from '@/utils/imageValidator';
import { uploadWithAuthRetry } from '@/utils/authUploadHelper';
import { InlineSpinner } from '@/components/ui/AppSpinner';
import { dataUrlToBlob, getFileExtensionFromMime } from '@/utils/imageDataUrl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWebDocumentCamera } from '@/hooks/useWebDocumentCamera';

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
  const [uploaded, setUploaded] = useState(!!currentFile);
  const [fileName, setFileName] = useState('');

  const platform = Capacitor.getPlatform();
  const isNative = Capacitor.isNativePlatform() || platform === 'ios' || platform === 'android';

  const galleryInputRef = useRef<HTMLInputElement>(null);
  const {
    videoRef: webCameraVideoRef,
    isSupported: isWebCameraSupported,
    isOpen: isWebCameraOpen,
    isStarting: isWebCameraStarting,
    isCapturing: isWebCameraCapturing,
    errorMessage: webCameraErrorMessage,
    openCamera: openWebCamera,
    closeCamera: closeWebCamera,
    capturePhoto: captureWebCameraPhoto,
  } = useWebDocumentCamera({ facingMode: 'environment' });

  useEffect(() => {
    if (currentFile) {
      setUploaded(true);
    }
  }, [currentFile]);

  const isAcceptedType = useCallback(
    (file: File) => {
      if (!acceptedTypes.length) return true;

      return acceptedTypes.some((accepted) => {
        if (accepted === '*/*') return true;
        if (accepted.endsWith('/*')) {
          const prefix = accepted.replace('/*', '/');
          return file.type.startsWith(prefix);
        }
        return file.type === accepted;
      });
    },
    [acceptedTypes]
  );

  const processFileUpload = useCallback(async (file: File) => {
    if (!file) return;

    if (!isAcceptedType(file)) {
      toast.error('Tipo de arquivo não permitido.');
      return;
    }

    if (enableQualityCheck && file.type.startsWith('image/')) {
      const validationResult = await validateImageQuality(file);
      if (!validationResult.valid) {
        toast.error(`Qualidade insuficiente: ${validationResult.reason}`);
        return;
      }
    }

    setUploading(true);

    try {
      const fileExt = file.name.split('.').pop() || getFileExtensionFromMime(file.type);

      const result = await uploadWithAuthRetry({
        file,
        bucketName,
        fileType,
        fileExt,
      });

      if ('error' in result) {
        if (result.error === 'AUTH_EXPIRED') return;
        throw new Error(result.error);
      }

      setUploaded(true);
      setFileName(file.name);
      onUploadComplete(result.publicUrl);
      toast.success(`${label} enviado com sucesso!`);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
      if (errorMessage.includes('autenticad')) {
        toast.error('Sessão expirada. Por favor, faça login novamente.');
      } else {
        toast.error(`Erro ao enviar ${label.toLowerCase()}: ${errorMessage}`);
      }
    } finally {
      setUploading(false);
    }
  }, [bucketName, enableQualityCheck, fileType, isAcceptedType, label, onUploadComplete]);

  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processFileUpload(file);
  }, [processFileUpload]);

  const handleNativeCameraCapture = useCallback(async () => {

    try {
      console.log('[DocumentUpload] Opening native camera for:', fileType);
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        correctOrientation: true,
        width: 1920,
        height: 1080,
      });

      if (!image.dataUrl) {
        toast.error('Não foi possível capturar a imagem.');
        return;
      }

      let blob: Blob;
      try {
        blob = dataUrlToBlob(image.dataUrl);
      } catch (convErr) {
        console.error('[DocumentUpload] dataUrlToBlob failed:', convErr);
        toast.error('Erro ao processar imagem. Tente novamente.');
        return;
      }

      if (!blob.size) {
        toast.error('Imagem inválida. Tente novamente.');
        return;
      }

      const mime = blob.type || 'image/jpeg';
      const ext = getFileExtensionFromMime(mime);
      const nativeFile = new File([blob], `${fileType}_${Date.now()}.${ext}`, { type: mime });

      console.log('[DocumentUpload] Native file created:', { size: nativeFile.size, type: mime, fileType });
      await processFileUpload(nativeFile);
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isCancellation = msg === 'User cancelled photos app' || 
                              msg === 'User cancelled' || 
                              msg.includes('User cancelled') ||
                              (msg.toLowerCase() === 'cancelled');
      if (isCancellation) return;
      console.error('[DocumentUpload] Native camera error:', { message: msg, fileType });
      toast.error('Erro ao abrir câmera. Tente novamente.');
    }
  }, [fileType, processFileUpload]);

  const handleGallerySelect = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  return (
    <div className="space-y-2">
      <Label htmlFor={fileType}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Card>
        <CardContent className="p-4">
          <input
            ref={galleryInputRef}
            type="file"
            accept={accept}
            onChange={handleFileUpload}
            disabled={uploading || uploaded}
            className="hidden"
          />

          {uploading ? (
            <div className="flex items-center justify-center w-full p-3 border-2 border-dashed rounded-md border-primary/30 bg-primary/10 text-foreground">
              <InlineSpinner />
              Enviando...
            </div>
          ) : uploaded ? (
            <div className="flex items-center justify-center w-full p-3 border-2 border-dashed rounded-md border-primary/40 bg-primary/10 text-foreground">
              <Check className="h-4 w-4 mr-2" />
              {fileName || 'Documento enviado'}
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {isNative ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleNativeCameraCapture}
                  disabled={uploading || uploaded}
                >
                  <Camera className="h-4 w-4 mr-2" />
                  Abrir Câmera
                </Button>
              ) : (
                <>
                  <input
                    id={cameraInputId}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleFileUpload}
                    disabled={uploading || uploaded}
                    className="sr-only"
                    aria-label={`Capturar ${label.toLowerCase()} com a câmera`}
                  />
                  <Button asChild type="button" variant="outline" className="flex-1">
                    <label htmlFor={cameraInputId} className="cursor-pointer">
                      <Camera className="h-4 w-4 mr-2" />
                      Abrir Câmera
                    </label>
                  </Button>
                </>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleGallerySelect}
                disabled={uploading || uploaded}
              >
                <Upload className="h-4 w-4 mr-2" />
                Galeria
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default DocumentUpload;
