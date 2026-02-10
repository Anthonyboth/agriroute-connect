import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { CheckCircle, FileUp, Info } from 'lucide-react';

interface NfaConfirmationProps {
  accessKey: string;
  onAccessKeyChange: (value: string) => void;
  pdfFile: File | null;
  onPdfFileChange: (file: File | null) => void;
  freightId?: string;
}

export const NfaConfirmation: React.FC<NfaConfirmationProps> = ({
  accessKey,
  onAccessKeyChange,
  pdfFile,
  onPdfFileChange,
  freightId,
}) => {
  const isAccessKeyValid = accessKey.replace(/\s/g, '').length === 44;

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <CheckCircle className="h-5 w-5" />
            Confirmar Emissão da NFA-e
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Cole a chave de acesso da NFA-e emitida e faça upload do DANFA-e (PDF).
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Chave de acesso */}
          <div className="space-y-2">
            <Label htmlFor="nfa-access-key">Chave de Acesso (44 dígitos)</Label>
            <Input
              id="nfa-access-key"
              placeholder="Ex: 51260262965243000111550010000000011666475881"
              value={accessKey}
              onChange={(e) => onAccessKeyChange(e.target.value.replace(/[^0-9]/g, '').slice(0, 44))}
              maxLength={44}
              className={isAccessKeyValid ? 'border-primary' : ''}
            />
            <p className="text-xs text-muted-foreground">
              {accessKey.length}/44 dígitos
              {isAccessKeyValid && (
                <span className="text-green-600 ml-2">✓ Chave válida</span>
              )}
            </p>
          </div>

          {/* Upload PDF */}
          <div className="space-y-2">
            <Label htmlFor="nfa-pdf">DANFA-e (PDF) — opcional</Label>
            <div className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => document.getElementById('nfa-pdf-input')?.click()}
            >
              <FileUp className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
              {pdfFile ? (
                <p className="text-sm font-medium">{pdfFile.name}</p>
              ) : (
                <p className="text-sm text-muted-foreground">Clique para selecionar o PDF do DANFA-e</p>
              )}
            </div>
            <input
              id="nfa-pdf-input"
              type="file"
              accept=".pdf"
              className="hidden"
              onChange={(e) => onPdfFileChange(e.target.files?.[0] || null)}
            />
          </div>

          {/* Vínculo com frete */}
          {freightId && (
            <Alert className="border-primary/30 bg-primary/5">
              <Info className="h-4 w-4" />
              <AlertDescription>
                Esta NFA-e será vinculada automaticamente ao frete <strong>#{freightId.slice(0, 8)}</strong>.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
