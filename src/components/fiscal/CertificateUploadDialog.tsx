import React, { useState, useRef } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Upload, Key, Loader2, ShieldCheck, FileKey, CheckCircle2, Eye, EyeOff } from "lucide-react";
import { useFiscalIssuer } from "@/hooks/useFiscalIssuer";
import { toast } from "sonner";

interface CertificateUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void; // ✅ IMPORTANTE: isso precisa disparar refetch no pai
}

export function CertificateUploadDialog({ open, onOpenChange, onSuccess }: CertificateUploadDialogProps) {
  const { loading, uploadCertificate } = useFiscalIssuer();

  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [uploading, setUploading] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setFile(null);
    setPassword("");
    setUploadSuccess(false);
    setShowPassword(false);

    // ✅ importante: limpa o input real do browser (senão fica “preso”)
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    const validExtensions = [".pfx", ".p12"];
    const hasValidExt = validExtensions.some((ext) => selectedFile.name.toLowerCase().endsWith(ext));

    if (!hasValidExt) {
      toast.error("Formato inválido. Use arquivos .pfx ou .p12");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (selectedFile.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo: 10MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setFile(selectedFile);
    setUploadSuccess(false);
  };

  const handleUpload = async () => {
    if (!file) {
      toast.error("Selecione um arquivo de certificado");
      return;
    }

    if (!password) {
      toast.error("Informe a senha do certificado");
      return;
    }

    if (password.length < 4) {
      toast.error("Senha muito curta");
      return;
    }

    setUploading(true);

    try {
      const success = await uploadCertificate(file, password);

      if (!success) {
        toast.error("Não foi possível enviar o certificado");
        return;
      }

      setUploadSuccess(true);

      // ✅ IMPORTANTÍSSIMO:
      // Dispara callback para o componente pai REFETCHAR o status “Não configurado”
      // (o badge só muda se o pai buscar novamente o certificado no banco)
      onSuccess?.();

      // Limpa o formulário, mas mantém a tela de sucesso por 2s
      setFile(null);
      setPassword("");

      setTimeout(() => {
        setUploadSuccess(false);
        onOpenChange(false);
        // reset completo depois de fechar
        resetForm();
      }, 2000);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao enviar certificado", {
        description: e?.message ? String(e.message) : "Tente novamente.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    // ✅ se estiver fechando, só fecha se não estiver uploadando
    if (!nextOpen) {
      if (uploading) return;
      resetForm();
      onOpenChange(false);
      return;
    }

    // ✅ se estiver abrindo, apenas propaga abertura
    onOpenChange(true);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileKey className="h-5 w-5" />
            Upload de Certificado A1
          </DialogTitle>
          <DialogDescription>Envie seu certificado digital para emissão de NF-e</DialogDescription>
        </DialogHeader>

        {uploadSuccess ? (
          <div className="py-8 text-center">
            <CheckCircle2 className="h-16 w-16 mx-auto text-green-600 mb-4" />
            <h3 className="text-lg font-semibold text-green-800">Certificado enviado com sucesso!</h3>
            <p className="text-muted-foreground text-sm mt-2">Atualizando status do certificado...</p>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Arquivo do Certificado *</Label>

              <Input
                type="file"
                accept=".pfx,.p12"
                onChange={handleFileSelect}
                ref={fileInputRef}
                className="hidden"
                disabled={uploading || loading}
              />

              <div
                className={`
                  border-2 border-dashed rounded-lg p-6 text-center cursor-pointer
                  transition-colors hover:border-primary/50
                  ${file ? "border-primary bg-primary/5" : "border-muted"}
                  ${uploading || loading ? "opacity-60 pointer-events-none" : ""}
                `}
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <Key className="h-6 w-6 text-primary" />
                    <div className="text-left">
                      <span className="font-medium block">{file.name}</span>
                      <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-muted-foreground">
                    <Upload className="h-10 w-10" />
                    <span className="font-medium">Clique para selecionar</span>
                    <span className="text-xs">Formatos aceitos: .pfx, .p12</span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="cert-password">Senha do Certificado *</Label>
              <div className="relative">
                <Input
                  id="cert-password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={uploading || loading}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  disabled={uploading || loading}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Alert>
              <ShieldCheck className="h-4 w-4" />
              <AlertDescription className="text-xs">
                A senha é usada apenas para validar o certificado e <strong>NÃO será armazenada</strong>. O certificado
                é criptografado antes do armazenamento.
              </AlertDescription>
            </Alert>

            <Button
              onClick={handleUpload}
              disabled={!file || !password || uploading || loading}
              className="w-full"
              size="lg"
            >
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Enviando certificado...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4 mr-2" />
                  Enviar Certificado
                </>
              )}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
