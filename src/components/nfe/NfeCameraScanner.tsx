import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { devLog } from '@/lib/devLogger';
import { Button } from '@/components/ui/button';
import { Camera, Flashlight, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface NfeCameraScannerProps {
  onKeyDetected: (accessKey: string) => void;
  onError?: (error: string) => void;
  className?: string;
}

type ScannerStatus = 'idle' | 'scanning' | 'detected' | 'error';

const NFE_KEY_REGEX = /\d{44}/;

export function NfeCameraScanner({ onKeyDetected, onError, className }: NfeCameraScannerProps) {
  const [status, setStatus] = useState<ScannerStatus>('idle');
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [torchEnabled, setTorchEnabled] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const scannerId = 'nfe-camera-scanner';

  const extractNfeKey = useCallback((rawValue: string): string | null => {
    // Remove espaços e caracteres especiais
    const cleaned = rawValue.replace(/\s+/g, '').replace(/[^0-9]/g, '');
    const match = cleaned.match(NFE_KEY_REGEX);
    return match ? match[0] : null;
  }, []);

  const handleScanSuccess = useCallback((decodedText: string) => {
    const key = extractNfeKey(decodedText);
    
    if (key) {
      devLog('[NfeCameraScanner] Chave NF-e detectada:', key);
      setDetectedKey(key);
      setStatus('detected');
      
      // Vibrar para feedback tátil (se disponível)
      if (navigator.vibrate) {
        navigator.vibrate(200);
      }
      
      // Parar scanner após detectar
      if (scannerRef.current) {
        scannerRef.current.stop().catch(console.error);
      }
    }
  }, [extractNfeKey]);

  const handleScanError = useCallback((error: string) => {
    // Ignorar erros de "QR code não encontrado" que são normais durante o scan
    if (error.includes('No QR code') || error.includes('No barcode')) {
      return;
    }
    console.warn('[NfeCameraScanner] Erro:', error);
  }, []);

  const startScanner = useCallback(async () => {
    try {
      setStatus('scanning');
      setErrorMessage(null);
      setDetectedKey(null);

      const scanner = new Html5Qrcode(scannerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.ITF,
        ],
        verbose: false,
      });
      
      scannerRef.current = scanner;

      const config = {
        fps: 10,
        qrbox: { width: 280, height: 180 },
        aspectRatio: 1.7777778,
      };

      await scanner.start(
        { facingMode: 'environment' },
        config,
        handleScanSuccess,
        handleScanError
      );

      // Verificar se tem flash disponível
      const capabilities = scanner.getRunningTrackCapabilities();
      // @ts-ignore - torch pode não estar tipado
      setHasTorch(!!capabilities?.torch);

    } catch (err: any) {
      console.error('[NfeCameraScanner] Erro ao iniciar câmera:', err);
      setStatus('error');
      const message = err.message || 'Não foi possível acessar a câmera';
      setErrorMessage(message);
      onError?.(message);
    }
  }, [handleScanSuccess, handleScanError, onError]);

  const stopScanner = useCallback(async () => {
    const scanner = scannerRef.current;
    if (scanner) {
      scannerRef.current = null;
      try {
        const state = scanner.getState();
        // Only stop if currently scanning (state 2 = SCANNING)
        if (state === 2) {
          await scanner.stop();
        }
        scanner.clear();
      } catch (err) {
        console.error('[NfeCameraScanner] Erro ao parar scanner:', err);
        try { scanner.clear(); } catch (_) { /* ignore */ }
      }
    }
    setStatus('idle');
  }, []);

  const toggleTorch = useCallback(async () => {
    if (scannerRef.current && hasTorch) {
      try {
        // @ts-ignore - applyVideoConstraints pode não estar tipado corretamente
        await scannerRef.current.applyVideoConstraints({
          // @ts-ignore
          advanced: [{ torch: !torchEnabled }],
        });
        setTorchEnabled(!torchEnabled);
      } catch (err) {
        console.error('[NfeCameraScanner] Erro ao alternar lanterna:', err);
      }
    }
  }, [hasTorch, torchEnabled]);

  const confirmKey = useCallback(() => {
    if (detectedKey) {
      onKeyDetected(detectedKey);
    }
  }, [detectedKey, onKeyDetected]);

  const retryScanning = useCallback(() => {
    setDetectedKey(null);
    setStatus('idle');
    startScanner();
  }, [startScanner]);

  // Cleanup ao desmontar
  useEffect(() => {
    return () => {
      const scanner = scannerRef.current;
      if (scanner) {
        scannerRef.current = null;
        try {
          const state = scanner.getState();
          if (state === 2) {
            scanner.stop().then(() => scanner.clear()).catch(() => {
              try { scanner.clear(); } catch (_) { /* ignore */ }
            });
          } else {
            scanner.clear();
          }
        } catch (_) { /* ignore */ }
      }
    };
  }, []);

  // Auto-start quando componente monta
  useEffect(() => {
    startScanner();
  }, []);

  return (
    <div className={cn('flex flex-col gap-4', className)}>
      {/* Área do Scanner */}
      <div className="relative w-full aspect-video bg-muted rounded-lg overflow-hidden">
        {/* Container do scanner */}
        <div 
          id={scannerId} 
          ref={containerRef}
          className={cn(
            'w-full h-full',
            status === 'detected' && 'hidden'
          )}
        />

        {/* Overlay quando detectado */}
        {status === 'detected' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 p-4">
            <CheckCircle2 className="h-16 w-16 text-success mb-4" />
            <p className="text-lg font-medium text-center mb-2">Chave NF-e detectada!</p>
            <p className="text-sm text-muted-foreground text-center font-mono break-all px-4">
              {detectedKey}
            </p>
          </div>
        )}

        {/* Overlay de erro */}
        {status === 'error' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95 p-4">
            <AlertCircle className="h-16 w-16 text-destructive mb-4" />
            <p className="text-lg font-medium text-center mb-2">Erro ao acessar câmera</p>
            <p className="text-sm text-muted-foreground text-center">
              {errorMessage || 'Verifique as permissões do navegador'}
            </p>
          </div>
        )}

        {/* Loading */}
        {status === 'idle' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/95">
            <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
            <p className="text-sm text-muted-foreground">Iniciando câmera...</p>
          </div>
        )}

        {/* Controles do scanner */}
        {status === 'scanning' && (
          <>
            {/* Guia de escaneamento */}
            <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
              <div className="border-2 border-primary/50 rounded-lg w-[70%] aspect-[16/10] relative">
                <div className="absolute top-0 left-0 w-6 h-6 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-6 h-6 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-6 h-6 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-6 h-6 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>

            {/* Lanterna */}
            {hasTorch && (
              <Button
                variant="secondary"
                size="icon"
                className="absolute top-4 right-4"
                onClick={toggleTorch}
              >
                <Flashlight className={cn('h-5 w-5', torchEnabled && 'text-warning')} />
              </Button>
            )}

            {/* Instrução */}
            <div className="absolute bottom-4 left-0 right-0 text-center">
              <p className="text-sm text-white bg-black/50 inline-block px-4 py-2 rounded-full">
                Aponte para o QR Code ou código de barras
              </p>
            </div>
          </>
        )}
      </div>

      {/* Botões de ação */}
      <div className="flex gap-3">
        {status === 'detected' && (
          <>
            <Button 
              variant="outline" 
              onClick={retryScanning}
              className="flex-1"
            >
              Escanear Novamente
            </Button>
            <Button 
              onClick={confirmKey}
              className="flex-1"
            >
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Confirmar Chave
            </Button>
          </>
        )}

        {status === 'error' && (
          <Button 
            onClick={startScanner}
            className="w-full"
          >
            <Camera className="mr-2 h-4 w-4" />
            Tentar Novamente
          </Button>
        )}
      </div>
    </div>
  );
}
