import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  ArrowRight, 
  ArrowLeft, 
  Loader2, 
  Upload, 
  Key, 
  CheckCircle2, 
  AlertTriangle,
  FileKey,
  ShieldCheck,
  Eye,
  EyeOff
} from 'lucide-react';
import { useFiscalIssuer } from '@/hooks/useFiscalIssuer';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface FiscalOnboardingStep3Props {
  onNext: () => void;
  onBack: () => void;
}

export function FiscalOnboardingStep3({ onNext, onBack }: FiscalOnboardingStep3Props) {
  const { loading, certificate, uploadCertificate, isCertificateValid, getCertificateDaysUntilExpiry } = useFiscalIssuer();
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const hasCertificate = !!certificate;
  const isValid = isCertificateValid();
  const daysUntilExpiry = getCertificateDaysUntilExpiry();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    
    if (selectedFile) {
      // Validate file extension
      const validExtensions = ['.pfx', '.p12'];
      const extension = selectedFile.name.toLowerCase().slice(-4);
      
      if (!validExtensions.some(ext => selectedFile.name.toLowerCase().endsWith(ext))) {
        toast.error('Formato inválido. Use arquivos .pfx ou .p12');
        return;
      }

      // Validate file size (max 10MB)
      if (selectedFile.size > 10 * 1024 * 1024) {
        toast.error('Arquivo muito grande. Máximo: 10MB');
        return;
      }

      setFile(selectedFile);
    }
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error('Selecione um arquivo de certificado');
      return;
    }

    if (!password) {
      toast.error('Informe a senha do certificado');
      return;
    }

    setUploading(true);
    
    try {
      const success = await uploadCertificate(file, password);
      
      if (success) {
        setFile(null);
        setPassword('');
      }
    } finally {
      setUploading(false);
    }
  };

  const handleContinue = () => {
    if (!hasCertificate) {
      toast.error('É necessário enviar um certificado digital');
      return;
    }

    if (!isValid) {
      toast.error('O certificado está vencido. Envie um novo certificado.');
      return;
    }

    onNext();
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Certificado Digital A1</h3>
        <p className="text-muted-foreground text-sm mt-1">
          O certificado é necessário para assinar os documentos fiscais
        </p>
      </div>

      {/* Current certificate status */}
      {hasCertificate && (
        <Card className={isValid ? 'border-green-500/50 bg-green-50/50' : 'border-destructive/50 bg-destructive/5'}>
          <CardContent className="flex items-start gap-4 p-4">
            {isValid ? (
              <ShieldCheck className="h-8 w-8 text-green-600 flex-shrink-0" />
            ) : (
              <AlertTriangle className="h-8 w-8 text-destructive flex-shrink-0" />
            )}
            <div className="flex-1">
              <h4 className="font-medium">
                {isValid ? 'Certificado válido' : 'Certificado vencido'}
              </h4>
              <p className="text-sm text-muted-foreground mt-1">
                {certificate?.subject_cn || 'Certificado Digital A1'}
              </p>
              {certificate?.valid_until && (
                <p className="text-sm mt-1">
                  {isValid ? (
                    <span className="text-green-700">
                      Válido até {format(new Date(certificate.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                      {daysUntilExpiry !== null && daysUntilExpiry <= 30 && (
                        <span className="text-warning ml-2">
                          ({daysUntilExpiry} dias restantes)
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-destructive">
                      Vencido em {format(new Date(certificate.valid_until), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  )}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Upload form */}
      {(!hasCertificate || !isValid) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <FileKey className="h-5 w-5" />
              {hasCertificate ? 'Atualizar Certificado' : 'Enviar Certificado'}
            </CardTitle>
            <CardDescription>
              Arquivo .pfx ou .p12 do seu certificado digital A1
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* File upload */}
            <div className="space-y-2">
              <Label>Arquivo do Certificado *</Label>
              <div className="flex gap-2">
                <Input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleFileSelect}
                  ref={fileInputRef}
                  className="hidden"
                />
                <div 
                  className="flex-1 border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => fileInputRef.current?.click()}
                >
                  {file ? (
                    <div className="flex items-center justify-center gap-2">
                      <Key className="h-5 w-5 text-primary" />
                      <span className="font-medium">{file.name}</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <Upload className="h-8 w-8" />
                      <span>Clique para selecionar o arquivo</span>
                      <span className="text-xs">Formatos aceitos: .pfx, .p12</span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label htmlFor="cert-password">Senha do Certificado *</Label>
              <div className="relative">
                <Input
                  id="cert-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <p className="text-xs text-muted-foreground">
                A senha é usada apenas para validar o certificado e NÃO será armazenada.
              </p>
            </div>

            <Button 
              onClick={handleUpload} 
              disabled={!file || !password || uploading || loading}
              className="w-full"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Certificado
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Security notice */}
      <Alert>
        <ShieldCheck className="h-4 w-4" />
        <AlertDescription>
          Seu certificado é armazenado de forma segura e criptografada. 
          A senha não é armazenada e é usada apenas para validação inicial.
        </AlertDescription>
      </Alert>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onBack} disabled={loading || uploading}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button 
          onClick={handleContinue} 
          className="flex-1" 
          disabled={!hasCertificate || !isValid || loading}
        >
          Continuar
          <ArrowRight className="h-4 w-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}
