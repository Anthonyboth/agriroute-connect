/**
 * Modal de Pagamento PIX para Emissão Fiscal
 * 
 * Exibe QR Code, código PIX e permite verificar status do pagamento
 */

import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Check, RefreshCw, QrCode, Clock, AlertCircle } from 'lucide-react';
import { usePixPayment, PixPaymentData, DocumentType } from '@/hooks/usePixPayment';
import { formatCurrency } from '@/lib/formatters';

interface PixPaymentModalProps {
  open: boolean;
  onClose: () => void;
  issuerId: string;
  documentType: DocumentType;
  documentRef: string;
  amountCentavos: number;
  description?: string;
  freightId?: string;
  onPaymentConfirmed: () => void;
  onPaymentFailed?: (error: string) => void;
}

export function PixPaymentModal({
  open,
  onClose,
  issuerId,
  documentType,
  documentRef,
  amountCentavos,
  description,
  freightId,
  onPaymentConfirmed,
  onPaymentFailed,
}: PixPaymentModalProps) {
  const [pixData, setPixData] = useState<PixPaymentData | null>(null);
  const [copied, setCopied] = useState(false);
  const [checking, setChecking] = useState(false);
  const [expired, setExpired] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const {
    loading,
    createPixPayment,
    checkPaymentStatus,
    copyPixCode,
    clearPayment,
  } = usePixPayment({
    onPaymentConfirmed: () => {
      onPaymentConfirmed();
      onClose();
    },
    onPaymentFailed: (error) => {
      onPaymentFailed?.(error);
    },
  });

  // Criar cobrança PIX ao abrir o modal
  useEffect(() => {
    if (open && !pixData) {
      createPixPayment({
        issuer_id: issuerId,
        document_type: documentType,
        document_ref: documentRef,
        amount_centavos: amountCentavos,
        description,
        freight_id: freightId,
      }).then((data) => {
        if (data) {
          setPixData(data);
        }
      });
    }
  }, [open, issuerId, documentType, documentRef, amountCentavos, description, freightId, createPixPayment, pixData]);

  // Atualizar contador de tempo
  useEffect(() => {
    if (!pixData?.expires_at) return;

    const interval = setInterval(() => {
      const expiresAt = new Date(pixData.expires_at).getTime();
      const now = Date.now();
      const diff = expiresAt - now;

      if (diff <= 0) {
        setExpired(true);
        setTimeLeft('Expirado');
        clearInterval(interval);
        return;
      }

      const minutes = Math.floor(diff / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`);
    }, 1000);

    return () => clearInterval(interval);
  }, [pixData?.expires_at]);

  // Verificar status do pagamento
  const handleCheckStatus = useCallback(async () => {
    if (!pixData?.charge_id) return;

    setChecking(true);
    const status = await checkPaymentStatus({ charge_id: pixData.charge_id });
    setChecking(false);

    if (status?.status === 'paid') {
      onPaymentConfirmed();
      onClose();
    }
  }, [pixData, checkPaymentStatus, onPaymentConfirmed, onClose]);

  // Copiar código PIX
  const handleCopy = useCallback(async () => {
    if (await copyPixCode(pixData?.qr_code)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [pixData, copyPixCode]);

  // Gerar novo PIX
  const handleNewPix = useCallback(() => {
    setPixData(null);
    setExpired(false);
    clearPayment();
    createPixPayment({
      issuer_id: issuerId,
      document_type: documentType,
      document_ref: documentRef,
      amount_centavos: amountCentavos,
      description,
      freight_id: freightId,
    }).then((data) => {
      if (data) {
        setPixData(data);
      }
    });
  }, [clearPayment, createPixPayment, issuerId, documentType, documentRef, amountCentavos, description, freightId]);

  // Cleanup ao fechar
  const handleClose = () => {
    clearPayment();
    setPixData(null);
    setExpired(false);
    setCopied(false);
    onClose();
  };

  const documentTypeLabel = {
    nfe: 'NF-e',
    cte: 'CT-e',
    mdfe: 'MDF-e',
    gta: 'GTA',
  }[documentType] || documentType.toUpperCase();

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-primary" />
            Pagamento via PIX
          </DialogTitle>
          <DialogDescription>
            Escaneie o QR Code ou copie o código para pagar a emissão da {documentTypeLabel}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Valor */}
          <div className="text-center p-4 bg-muted rounded-lg">
            <p className="text-sm text-muted-foreground">Valor da taxa</p>
            <p className="text-3xl font-bold text-primary">
              {formatCurrency(amountCentavos / 100)}
            </p>
          </div>

          {/* Loading */}
          {loading && !pixData && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="text-muted-foreground">Gerando cobrança PIX...</p>
            </div>
          )}

          {/* QR Code */}
          {pixData && !expired && (
            <>
              {/* Timer */}
              <div className="flex items-center justify-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">
                  Expira em: <span className="font-mono font-bold">{timeLeft}</span>
                </span>
              </div>

              {/* QR Code Image ou Placeholder */}
              <div className="flex justify-center">
                {pixData.qr_code_url ? (
                  <img
                    src={pixData.qr_code_url}
                    alt="QR Code PIX"
                    className="w-48 h-48 rounded-lg border"
                  />
                ) : (
                  <div className="w-48 h-48 flex items-center justify-center bg-muted rounded-lg border">
                    <div className="text-center p-4">
                      <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-2" />
                      <p className="text-xs text-muted-foreground">
                        Copie o código PIX abaixo
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {/* Código PIX */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-center">Código PIX (Copia e Cola)</p>
                <div className="relative">
                  <textarea
                    readOnly
                    value={pixData.qr_code}
                    className="w-full h-20 p-3 text-xs font-mono bg-muted rounded-lg border resize-none"
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="absolute top-2 right-2"
                    onClick={handleCopy}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* Botões */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleCopy}
                >
                  {copied ? (
                    <>
                      <Check className="h-4 w-4 mr-2 text-green-500" />
                      Copiado!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copiar código
                    </>
                  )}
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleCheckStatus}
                  disabled={checking}
                >
                  {checking ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4 mr-2" />
                  )}
                  Verificar pagamento
                </Button>
              </div>
            </>
          )}

          {/* Expirado */}
          {expired && (
            <div className="text-center py-4 space-y-4">
              <div className="flex items-center justify-center gap-2 text-destructive">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">PIX expirado</span>
              </div>
              <p className="text-sm text-muted-foreground">
                O tempo para pagamento expirou. Gere um novo código PIX.
              </p>
              <Button onClick={handleNewPix} className="w-full">
                <RefreshCw className="h-4 w-4 mr-2" />
                Gerar novo PIX
              </Button>
            </div>
          )}

          {/* Instruções */}
          <div className="text-xs text-muted-foreground space-y-1 pt-2 border-t">
            <p>1. Abra o app do seu banco</p>
            <p>2. Escolha pagar com PIX (QR Code ou Copia e Cola)</p>
            <p>3. Escaneie o QR Code ou cole o código</p>
            <p>4. Confirme o pagamento e clique em "Verificar pagamento"</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
