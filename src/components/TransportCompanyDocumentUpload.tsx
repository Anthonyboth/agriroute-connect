import React, { useState } from 'react';
import { DocumentUpload } from './DocumentUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { CheckCircle2, AlertCircle, FileText, Building2 } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

interface TransportCompanyDocumentUploadProps {
  onAllDocumentsComplete: (documents: {
    cnpj_document_url: string;
    antt_document_url: string;
    terms_accepted: boolean;
  }) => void;
  onDocumentsChange?: (complete: boolean) => void;
}

export const TransportCompanyDocumentUpload: React.FC<TransportCompanyDocumentUploadProps> = ({
  onAllDocumentsComplete,
  onDocumentsChange
}) => {
  const [documents, setDocuments] = useState({
    cnpj_document_url: '',
    antt_document_url: '',
    terms_accepted: false
  });

  const updateDocument = (field: 'cnpj_document_url' | 'antt_document_url', url: string) => {
    const newDocuments = { ...documents, [field]: url };
    setDocuments(newDocuments);
    
    const allComplete = newDocuments.cnpj_document_url && 
                       newDocuments.antt_document_url && 
                       newDocuments.terms_accepted;
    
    if (onDocumentsChange) {
      onDocumentsChange(allComplete);
    }
    
    if (allComplete) {
      onAllDocumentsComplete(newDocuments);
    }
  };

  const handleTermsChange = (checked: boolean) => {
    const newDocuments = { ...documents, terms_accepted: checked };
    setDocuments(newDocuments);
    
    const allComplete = newDocuments.cnpj_document_url && 
                       newDocuments.antt_document_url && 
                       newDocuments.terms_accepted;
    
    if (onDocumentsChange) {
      onDocumentsChange(allComplete);
    }
    
    if (allComplete) {
      onAllDocumentsComplete(newDocuments);
    }
  };

  const documentsCount = [documents.cnpj_document_url, documents.antt_document_url].filter(Boolean).length;
  const totalDocuments = 2;
  const allDocumentsUploaded = documentsCount === totalDocuments;

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Documentação Obrigatória
        </CardTitle>
        <CardDescription>
          Envie os documentos necessários para aprovação automática da transportadora
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Indicador de progresso */}
        <Alert className={allDocumentsUploaded ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
          {allDocumentsUploaded ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-blue-600" />
          )}
          <AlertDescription className={allDocumentsUploaded ? 'text-green-800' : 'text-blue-800'}>
            <strong>{documentsCount} de {totalDocuments} documentos enviados</strong>
            {allDocumentsUploaded && documents.terms_accepted && (
              <span className="block mt-1">✅ Tudo pronto! Você pode cadastrar sua transportadora.</span>
            )}
            {allDocumentsUploaded && !documents.terms_accepted && (
              <span className="block mt-1">⚠️ Aceite os termos para continuar</span>
            )}
          </AlertDescription>
        </Alert>

        {/* Upload do CNPJ */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">
              1. Documento do CNPJ *
            </Label>
            {documents.cnpj_document_url && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Envie uma foto clara do seu cartão CNPJ ou comprovante de inscrição
          </p>
          <DocumentUpload
            bucketName="transport-documents"
            fileType="cnpj"
            onUploadComplete={(url) => updateDocument('cnpj_document_url', url)}
            accept="image/jpeg,image/jpg,image/png,image/heic"
            maxSize={10}
            label={documents.cnpj_document_url ? "✅ CNPJ enviado" : "Enviar foto do CNPJ"}
            enableQualityCheck={true}
          />
        </div>

        {/* Upload do ANTT */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <Label className="text-base font-semibold">
              2. Registro ANTT *
            </Label>
            {documents.antt_document_url && (
              <CheckCircle2 className="h-5 w-5 text-green-600" />
            )}
          </div>
          <p className="text-sm text-muted-foreground mb-2">
            Envie uma foto do registro ANTT da transportadora
          </p>
          <DocumentUpload
            bucketName="transport-documents"
            fileType="antt"
            onUploadComplete={(url) => updateDocument('antt_document_url', url)}
            accept="image/jpeg,image/jpg,image/png,image/heic"
            maxSize={10}
            label={documents.antt_document_url ? "✅ ANTT enviado" : "Enviar foto do ANTT"}
            enableQualityCheck={true}
          />
        </div>

        {/* Termos e Condições */}
        <div className="border-t pt-4">
          <div className="flex items-start space-x-3">
            <Checkbox
              id="terms"
              checked={documents.terms_accepted}
              onCheckedChange={(checked) => handleTermsChange(checked === true)}
            />
            <div className="grid gap-1.5 leading-none">
              <Label
                htmlFor="terms"
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
              >
                Aceito os termos e condições *
              </Label>
              <p className="text-sm text-muted-foreground">
                Declaro que as informações e documentos fornecidos são verdadeiros e concordo com os{' '}
                <a href="/terms" target="_blank" className="text-primary hover:underline">
                  termos de uso
                </a>{' '}
                e{' '}
                <a href="/privacy" target="_blank" className="text-primary hover:underline">
                  política de privacidade
                </a>
                .
              </p>
            </div>
          </div>
        </div>

        {/* Mensagem informativa */}
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Aprovação Automática:</strong> Após enviar todos os documentos e aceitar os termos,
            sua transportadora será aprovada automaticamente e você terá acesso imediato ao sistema.
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
};
