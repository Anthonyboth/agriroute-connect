import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNfe } from '@/hooks/useNfe';
import { useNfeOfflineCache } from '@/hooks/useNfeOfflineCache';
import { Loader2, FileText, Camera, Keyboard, CheckCircle2, AlertCircle, WifiOff } from 'lucide-react';
import { NFeDocument } from '@/types/nfe';
import { NfeCameraScanner } from './NfeCameraScanner';
import { validateNfeKey } from '@/lib/sefaz-errors';
import { cn } from '@/lib/utils';

interface NfeScannerDialogProps {
  open: boolean;
  onClose: () => void;
  freightId?: string;
  onSuccess?: (nfe: NFeDocument) => void;
}

type ScanStep = 'scan' | 'confirm' | 'processing' | 'success';

export function NfeScannerDialog({ open, onClose, freightId, onSuccess }: NfeScannerDialogProps) {
  const [accessKey, setAccessKey] = useState('');
  const [detectedKey, setDetectedKey] = useState<string | null>(null);
  const [step, setStep] = useState<ScanStep>('scan');
  const [activeTab, setActiveTab] = useState<'camera' | 'manual'>('camera');
  const [keyError, setKeyError] = useState<string | null>(null);
  
  const { loading, scanNfe } = useNfe();
  const { saveKey, isOnline } = useNfeOfflineCache();

  const handleKeyDetected = (key: string) => {
    setDetectedKey(key);
    setAccessKey(key);
    setStep('confirm');
    setKeyError(null);
  };

  const handleManualSubmit = () => {
    const validation = validateNfeKey(accessKey);
    if (!validation.valid) {
      setKeyError(validation.error || 'Chave inválida');
      return;
    }
    setDetectedKey(accessKey);
    setStep('confirm');
    setKeyError(null);
  };

  const handleConfirmScan = async () => {
    if (!detectedKey) return;

    // Se offline, salvar no cache
    if (!isOnline) {
      saveKey(detectedKey, freightId);
      setStep('success');
      return;
    }

    setStep('processing');
    
    const nfe = await scanNfe(detectedKey, freightId);
    
    if (nfe) {
      setStep('success');
      if (onSuccess) {
        onSuccess(nfe);
      }
      // Fechar após sucesso
      setTimeout(() => {
        resetAndClose();
      }, 1500);
    } else {
      // Voltar para confirmar com erro
      setStep('confirm');
    }
  };

  const resetAndClose = () => {
    setAccessKey('');
    setDetectedKey(null);
    setStep('scan');
    setKeyError(null);
    setActiveTab('camera');
    onClose();
  };

  const handleEditKey = () => {
    setStep('scan');
    setActiveTab('manual');
  };

  const formatAccessKey = (key: string) => {
    return key.replace(/(.{4})/g, '$1 ').trim();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            {step === 'scan' && 'Escanear NF-e'}
            {step === 'confirm' && 'Confirmar Chave'}
            {step === 'processing' && 'Processando...'}
            {step === 'success' && 'NF-e Registrada'}
          </DialogTitle>
        </DialogHeader>

        {/* Indicador offline */}
        {!isOnline && (
          <Alert variant="default" className="border-warning bg-warning/10">
            <WifiOff className="h-4 w-4 text-warning" />
            <AlertDescription>
              Você está offline. A chave será salva e sincronizada quando a conexão voltar.
            </AlertDescription>
          </Alert>
        )}

        {/* Etapa: Escanear */}
        {step === 'scan' && (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'camera' | 'manual')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="camera" className="flex items-center gap-2">
                <Camera className="h-4 w-4" />
                Câmera
              </TabsTrigger>
              <TabsTrigger value="manual" className="flex items-center gap-2">
                <Keyboard className="h-4 w-4" />
                Digitar
              </TabsTrigger>
            </TabsList>

            <TabsContent value="camera" className="mt-4">
              <NfeCameraScanner
                onKeyDetected={handleKeyDetected}
                onError={(err) => console.error('Erro câmera:', err)}
              />
            </TabsContent>

            <TabsContent value="manual" className="mt-4 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="access-key">Chave de Acesso</Label>
                <Input
                  id="access-key"
                  placeholder="Digite os 44 dígitos da chave"
                  value={accessKey}
                  onChange={(e) => {
                    // Apenas números
                    const cleaned = e.target.value.replace(/\D/g, '');
                    setAccessKey(cleaned);
                    setKeyError(null);
                  }}
                  maxLength={44}
                  className={cn(
                    "font-mono",
                    keyError && "border-destructive"
                  )}
                />
                <div className="flex justify-between text-xs">
                  <span className={cn(
                    "text-muted-foreground",
                    keyError && "text-destructive"
                  )}>
                    {keyError || 'A chave deve ter exatamente 44 dígitos'}
                  </span>
                  <span className="text-muted-foreground">
                    {accessKey.length}/44
                  </span>
                </div>
              </div>

              <Button 
                onClick={handleManualSubmit} 
                disabled={accessKey.length !== 44}
                className="w-full"
              >
                Verificar Chave
              </Button>
            </TabsContent>
          </Tabs>
        )}

        {/* Etapa: Confirmar */}
        {step === 'confirm' && detectedKey && (
          <div className="space-y-4 py-4">
            <div className="text-center">
              <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
              <p className="text-lg font-medium">Chave NF-e Detectada</p>
            </div>

            <div className="bg-muted/50 rounded-lg p-4 border">
              <Label className="text-xs text-muted-foreground">Chave de Acesso (44 dígitos)</Label>
              <p className="font-mono text-sm break-all mt-1">
                {formatAccessKey(detectedKey)}
              </p>
            </div>

            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={handleEditKey}
                className="flex-1"
              >
                Editar
              </Button>
              <Button 
                onClick={handleConfirmScan}
                disabled={loading}
                className="flex-1"
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirmar
              </Button>
            </div>
          </div>
        )}

        {/* Etapa: Processando */}
        {step === 'processing' && (
          <div className="py-8 text-center">
            <Loader2 className="h-16 w-16 animate-spin text-primary mx-auto mb-4" />
            <p className="text-lg font-medium">Consultando NF-e...</p>
            <p className="text-sm text-muted-foreground mt-2">
              Aguarde enquanto buscamos os dados
            </p>
          </div>
        )}

        {/* Etapa: Sucesso */}
        {step === 'success' && (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 text-success mx-auto mb-4" />
            <p className="text-lg font-medium">
              {isOnline ? 'NF-e registrada com sucesso!' : 'Chave salva para sincronização'}
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              {isOnline 
                ? 'A nota fiscal foi adicionada ao sistema'
                : 'Será sincronizada quando você estiver online'
              }
            </p>
          </div>
        )}

        {/* Footer */}
        {step === 'scan' && (
          <DialogFooter>
            <Button variant="outline" onClick={resetAndClose}>
              Cancelar
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
