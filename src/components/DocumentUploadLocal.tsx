/**
 * DocumentUploadLocal - Componente para upload de documentos sem autenticação
 *
 * Armazena blobs localmente (em memória) para upload após autenticação.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Camera, Check, X, Upload, Loader2 } from 'lucide-react';
import { Capacitor } from '@capacitor/core';
import { Camera as CapCamera, CameraDirection, CameraResultType, CameraSource } from '@capacitor/camera';
import { validateImageQuality } from '@/utils/imageValidator';
import { dataUrlToBlob, getFileExtensionFromMime } from '@/utils/imageDataUrl';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useWebDocumentCamera } from '@/hooks/useWebDocumentCamera';

interface DocumentUploadLocalProps {
  onFileSelect: (blob: Blob, previewUrl: string) => void;
  accept?: string;
  maxSize?: number;
  currentPreview?: string;
  label?: string;
  fileType?: string;
  required?: boolean;
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
  enableQualityCheck = true,
}) => {
  const [processing, setProcessing] = useState(false);
  const [fileName, setFileName] = useState('');
  const [hasFile, setHasFile] = useState(!!currentPreview);

  const isNative = Capacitor.isNativePlatform();

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
    setHasFile(!!currentPreview);
  }, [currentPreview]);

  const processSelectedFile = useCallback(async (file: File) => {
    if (!file) return;

    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > maxSize) {
      toast.error(`Arquivo muito grande. Máximo ${maxSize}MB.`);
      return;
    }

    setProcessing(true);

    try {
      if (enableQualityCheck && file.type.startsWith('image/')) {
        const validationResult = await validateImageQuality(file);
        if (!validationResult.valid) {
          toast.error(`Qualidade insuficiente: ${validationResult.reason}`);
          return;
        }
      }

      const previewUrl = URL.createObjectURL(file);
      const blob = file as Blob;

      setFileName(file.name);
      setHasFile(true);
      onFileSelect(blob, previewUrl);
      toast.success(`${label} selecionado com sucesso!`);
    } catch (error) {
      console.error('[DocumentUploadLocal] Erro ao processar arquivo:', error);
      toast.error(`Erro ao processar ${label.toLowerCase()}`);
    } finally {
      setProcessing(false);
    }
  }, [enableQualityCheck, label, maxSize, onFileSelect]);

  const handleFileChange = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    await processSelectedFile(file);
  }, [processSelectedFile]);

  const handleNativeCameraCapture = useCallback(async () => {
    try {
      console.log('[Camera] Opening native camera for:', fileType);
      const image = await CapCamera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.Uri,
        source: CameraSource.Camera,
        direction: CameraDirection.Rear,
        correctOrientation: true,
        width: 1920,
        height: 1080,
      });

      const uri = getCameraUri(image);
      console.log('[Camera] Got URI, processing image...');

      const processed = await processCameraImage(uri, fileType, {
        maxWidth: 1280,
        quality: 0.8,
      });

      console.log('[StorageUpload] Native file ready:', {
        size: processed.file.size,
        type: processed.file.type,
      });
      await processSelectedFile(processed.file);
    } catch (error: any) {
      const msg = error?.message || String(error);
      const isCancellation = msg === 'User cancelled photos app' || 
                              msg === 'User cancelled' || 
                              msg.includes('User cancelled') ||
                              (msg.toLowerCase() === 'cancelled');
      if (isCancellation) return;
      console.error('[Camera] Native camera error:', { message: msg, fileType });
      toast.error('Erro ao abrir câmera. Tente novamente.');
    }
  }, [fileType, processSelectedFile]);

  const handleGallerySelect = useCallback(() => {
    galleryInputRef.current?.click();
  }, []);

  const handleOpenWebCamera = useCallback(async () => {
    if (!isWebCameraSupported) {
      toast.error('Seu navegador não suporta câmera direta. Use a opção Galeria.');
      return;
    }

    try {
      await openWebCamera();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível abrir a câmera.';
      toast.error(message);
    }
  }, [isWebCameraSupported, openWebCamera]);

  const handleCaptureWebCamera = useCallback(async () => {
    try {
      const capturedFile = await captureWebCameraPhoto(fileType);
      closeWebCamera();
      await processSelectedFile(capturedFile);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Não foi possível capturar a foto.';
      toast.error(message);
    }
  }, [captureWebCameraPhoto, closeWebCamera, fileType, processSelectedFile]);

  const handleRemove = () => {
    setHasFile(false);
    setFileName('');
    
    if (galleryInputRef.current) galleryInputRef.current.value = '';
    onFileSelect(new Blob([]), '');
  };

  const isComplete = hasFile || !!currentPreview;

  return (
    <div className="space-y-2">
      <Label htmlFor={fileType}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <Card className={isComplete ? 'border-primary/40' : ''}>
        <CardContent className="p-4 space-y-3">

          <input
            ref={galleryInputRef}
            id={`${fileType}-gallery`}
            type="file"
            accept={accept}
            onChange={handleFileChange}
            disabled={processing}
            className="hidden"
          />

          {isComplete ? (
            <div className="flex items-center justify-between w-full p-3 border rounded-md bg-primary/10 border-primary/30">
              <div className="flex items-center gap-2 text-foreground min-w-0">
                <Check className="h-4 w-4 shrink-0" />
                <span className="text-sm truncate">{fileName || 'Arquivo selecionado'}</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleRemove}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2">
              {isNative ? (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleNativeCameraCapture}
                  disabled={processing}
                >
                  {processing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
                  Abrir Câmera
                </Button>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={handleOpenWebCamera}
                  disabled={processing || isWebCameraStarting || isWebCameraCapturing}
                >
                  {isWebCameraStarting ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Camera className="h-4 w-4 mr-2" />
                  )}
                  Abrir Câmera
                </Button>
              )}
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={handleGallerySelect}
                disabled={processing}
              >
                <Upload className="h-4 w-4 mr-2" />
                Galeria
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isWebCameraOpen} onOpenChange={(open) => !open && closeWebCamera()}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Capturar documento</DialogTitle>
            <DialogDescription>
              Posicione o documento no enquadramento e toque em “Capturar”.
            </DialogDescription>
          </DialogHeader>

          {webCameraErrorMessage ? (
            <p className="text-sm text-destructive">{webCameraErrorMessage}</p>
          ) : null}

          <div className="overflow-hidden rounded-md border bg-muted">
            <video
              ref={webCameraVideoRef}
              autoPlay
              playsInline
              muted
              className="w-full aspect-[4/3] object-cover"
            />
          </div>

          <div className="flex gap-2">
            <Button type="button" variant="outline" className="flex-1" onClick={closeWebCamera}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="flex-1"
              onClick={handleCaptureWebCamera}
              disabled={processing || isWebCameraStarting || isWebCameraCapturing}
            >
              {isWebCameraCapturing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Camera className="h-4 w-4 mr-2" />
              )}
              Capturar
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DocumentUploadLocal;
