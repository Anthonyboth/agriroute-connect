/**
 * Scanner de QR Code e código de barras para NF-e
 * Usa html5-qrcode para leitura via câmera
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { devLog } from '@/lib/devLogger';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Camera, QrCode, Barcode, X, Loader2, CheckCircle2, AlertCircle, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { validateNfeKey } from '@/lib/sefaz-errors';

interface NfeCameraQRScannerProps {
  open: boolean;
  onClose: () => void;
  onScan: (accessKey: string) => void;
}

type ScanMode = 'qr' | 'barcode';

export function NfeCameraQRScanner({ open, onClose, onScan }: NfeCameraQRScannerProps) {
  const [mode, setMode] = useState<ScanMode>('qr');
  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [scannedValue, setScannedValue] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const containerIdRef = useRef(`qr-scanner-${Date.now()}`);

  // Formatos suportados
  const qrFormats = [Html5QrcodeSupportedFormats.QR_CODE];
  const barcodeFormats = [
    Html5QrcodeSupportedFormats.CODE_128,
    Html5QrcodeSupportedFormats.CODE_39,
    Html5QrcodeSupportedFormats.ITF,
    Html5QrcodeSupportedFormats.EAN_13,
  ];

  // Iniciar scanner
  const startScanner = useCallback(async () => {
    if (!open) return;
    
    setIsScanning(true);
    setError(null);
    setScannedValue(null);

    try {
      // Criar nova instância com formatos
      const formats = mode === 'qr' ? qrFormats : barcodeFormats;
      
      if (!scannerRef.current) {
        scannerRef.current = new Html5Qrcode(containerIdRef.current, { formatsToSupport: formats, verbose: false });
      }

      await scannerRef.current.start(
        { facingMode: 'environment' },
        {
          fps: 10,
          qrbox: { width: 280, height: mode === 'qr' ? 280 : 120 },
        },
        (decodedText) => {
          devLog('[NfeCameraQRScanner] Scanned:', decodedText);
          handleScanResult(decodedText);
        },
        () => {
          // Ignore error - frame sem código
        }
      );

      setHasPermission(true);
    } catch (err: any) {
      console.error('[NfeCameraQRScanner] Error starting scanner:', err);
      
      if (err.message?.includes('Permission denied')) {
        setHasPermission(false);
        setError('Permissão de câmera negada. Por favor, permita o acesso à câmera.');
      } else {
        setError('Erro ao iniciar a câmera. Tente novamente.');
      }
      
      setIsScanning(false);
    }
  }, [open, mode]);

  // Parar scanner
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
        console.error('[NfeCameraQRScanner] Error stopping scanner:', err);
        try { scanner.clear(); } catch (_) { /* ignore */ }
      }
    }
    setIsScanning(false);
  }, []);

  // Processar resultado do scan
  const handleScanResult = (rawValue: string) => {
    // Limpar valor - remover espaços e caracteres especiais
    const cleanedValue = rawValue.replace(/\s+/g, '').replace(/[^\d]/g, '');
    
    // Validar como chave NF-e
    const validation = validateNfeKey(cleanedValue);
    
    if (validation.valid) {
      setScannedValue(cleanedValue);
      stopScanner();
      toast.success('Chave NF-e capturada com sucesso!');
    } else {
      devLog('[NfeCameraQRScanner] Invalid key:', cleanedValue, validation.error);
      // Não para o scanner para códigos inválidos
    }
  };

  // Confirmar e enviar
  const handleConfirm = () => {
    if (scannedValue) {
      onScan(scannedValue);
      onClose();
    }
  };

  // Tentar novamente
  const handleRetry = () => {
    setScannedValue(null);
    setError(null);
    startScanner();
  };

  // Efeitos
  useEffect(() => {
    if (open) {
      startScanner();
    } else {
      stopScanner();
      setScannedValue(null);
      setError(null);
    }
    
    return () => {
      stopScanner();
    };
  }, [open, startScanner, stopScanner]);

  // Reiniciar ao mudar modo
  useEffect(() => {
    if (open && isScanning) {
      stopScanner().then(() => startScanner());
    }
  }, [mode]);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            <Camera className="h-5 w-5" />
            Escanear NF-e
          </DialogTitle>
          <DialogDescription>
            Aponte a câmera para o QR Code ou código de barras da NF-e
          </DialogDescription>
        </DialogHeader>

        {/* Seletor de modo */}
        <div className="flex gap-2 px-4">
          <Button
            variant={mode === 'qr' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('qr')}
            className="flex-1"
          >
            <QrCode className="h-4 w-4 mr-2" />
            QR Code
          </Button>
          <Button
            variant={mode === 'barcode' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMode('barcode')}
            className="flex-1"
          >
            <Barcode className="h-4 w-4 mr-2" />
            Código de Barras
          </Button>
        </div>

        {/* Área do scanner */}
        <div className="relative bg-black aspect-square max-h-[400px]">
          {/* Container do scanner */}
          <div
            id={containerIdRef.current}
            className="w-full h-full"
            style={{ minHeight: 300 }}
          />

          {/* Overlay de sucesso */}
          {scannedValue && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
              <CheckCircle2 className="h-16 w-16 text-success mb-4" />
              <p className="text-lg font-medium mb-2">Chave capturada!</p>
              <p className="text-xs text-center font-mono bg-white/10 p-2 rounded break-all">
                {scannedValue}
              </p>
            </div>
          )}

          {/* Overlay de erro */}
          {error && (
            <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center text-white p-4">
              <AlertCircle className="h-16 w-16 text-destructive mb-4" />
              <p className="text-center mb-4">{error}</p>
              <Button variant="secondary" onClick={handleRetry}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Tentar novamente
              </Button>
            </div>
          )}

          {/* Loading */}
          {!isScanning && !scannedValue && !error && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Loader2 className="h-8 w-8 animate-spin text-white" />
            </div>
          )}

          {/* Guia visual */}
          {isScanning && !scannedValue && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div
                className={`border-2 border-white/50 rounded-lg ${
                  mode === 'qr' ? 'w-72 h-72' : 'w-72 h-32'
                }`}
              >
                <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-lg" />
                <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-lg" />
                <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-lg" />
                <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-lg" />
              </div>
            </div>
          )}
        </div>

        {/* Ações */}
        <div className="p-4 flex gap-2">
          {scannedValue ? (
            <>
              <Button variant="outline" onClick={handleRetry} className="flex-1">
                <RotateCcw className="h-4 w-4 mr-2" />
                Escanear outro
              </Button>
              <Button onClick={handleConfirm} className="flex-1">
                <CheckCircle2 className="h-4 w-4 mr-2" />
                Usar esta chave
              </Button>
            </>
          ) : (
            <Button variant="outline" onClick={onClose} className="flex-1">
              <X className="h-4 w-4 mr-2" />
              Cancelar
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
