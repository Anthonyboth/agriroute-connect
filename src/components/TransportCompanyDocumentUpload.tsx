import React, { useState } from 'react';
import { DocumentUpload } from './DocumentUpload';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Checkbox } from './ui/checkbox';
import { Label } from './ui/label';
import { CheckCircle2, AlertCircle, FileText, Building2, Shield } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from './ui/alert';

interface TransportCompanyDocumentUploadProps {
  onAllDocumentsComplete: (documents: {
    cnpj_document_url: string;
    antt_document_url: string;
    terms_accepted: boolean;
    acceptedDocumentsResponsibility: boolean;
    acceptedTermsOfUse: boolean;
    acceptedPrivacyPolicy: boolean;
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
  
  const [acceptedDocumentsResponsibility, setAcceptedDocumentsResponsibility] = useState(false);
  const [acceptedTermsOfUse, setAcceptedTermsOfUse] = useState(false);
  const [acceptedPrivacyPolicy, setAcceptedPrivacyPolicy] = useState(false);

  const checkCompletion = (
    cnpj: string, 
    antt: string, 
    docResp: boolean, 
    terms: boolean, 
    privacy: boolean
  ) => {
    const allComplete = !!cnpj && !!antt && docResp && terms && privacy;
    
    if (onDocumentsChange) {
      onDocumentsChange(allComplete);
    }
    
    if (allComplete) {
      onAllDocumentsComplete({
        cnpj_document_url: cnpj,
        antt_document_url: antt,
        terms_accepted: true,
        acceptedDocumentsResponsibility: docResp,
        acceptedTermsOfUse: terms,
        acceptedPrivacyPolicy: privacy
      });
    }
  };

  const updateDocument = (field: 'cnpj_document_url' | 'antt_document_url', url: string) => {
    const newDocuments = { ...documents, [field]: url };
    setDocuments(newDocuments);
    checkCompletion(
      field === 'cnpj_document_url' ? url : documents.cnpj_document_url,
      field === 'antt_document_url' ? url : documents.antt_document_url,
      acceptedDocumentsResponsibility,
      acceptedTermsOfUse,
      acceptedPrivacyPolicy
    );
  };

  const handleDocumentsResponsibilityChange = (checked: boolean) => {
    setAcceptedDocumentsResponsibility(checked);
    checkCompletion(
      documents.cnpj_document_url,
      documents.antt_document_url,
      checked,
      acceptedTermsOfUse,
      acceptedPrivacyPolicy
    );
  };

  const handleTermsOfUseChange = (checked: boolean) => {
    setAcceptedTermsOfUse(checked);
    checkCompletion(
      documents.cnpj_document_url,
      documents.antt_document_url,
      acceptedDocumentsResponsibility,
      checked,
      acceptedPrivacyPolicy
    );
  };

  const handlePrivacyPolicyChange = (checked: boolean) => {
    setAcceptedPrivacyPolicy(checked);
    checkCompletion(
      documents.cnpj_document_url,
      documents.antt_document_url,
      acceptedDocumentsResponsibility,
      acceptedTermsOfUse,
      checked
    );
  };

  const documentsCount = [documents.cnpj_document_url, documents.antt_document_url].filter(Boolean).length;
  const totalDocuments = 2;
  const allDocumentsUploaded = documentsCount === totalDocuments;
  const allTermsAccepted = acceptedDocumentsResponsibility && acceptedTermsOfUse && acceptedPrivacyPolicy;
  const allComplete = allDocumentsUploaded && allTermsAccepted;

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
        <Alert className={allComplete ? 'bg-green-50 border-green-200' : 'bg-blue-50 border-blue-200'}>
          {allComplete ? (
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          ) : (
            <AlertCircle className="h-4 w-4 text-blue-600" />
          )}
          <AlertDescription className={allComplete ? 'text-green-800' : 'text-blue-800'}>
            <strong>{documentsCount} de {totalDocuments} documentos enviados</strong>
            {allComplete && (
              <span className="block mt-1">✅ Tudo pronto! Você pode cadastrar sua transportadora.</span>
            )}
            {allDocumentsUploaded && !allTermsAccepted && (
              <span className="block mt-1">⚠️ Aceite todos os termos para continuar</span>
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

        {/* Seção de Termos e Responsabilidades */}
        <Card className="border-2 border-primary/20 bg-primary/5">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Shield className="h-5 w-5 text-primary" />
              Termos e Responsabilidades
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert className="bg-amber-50 border-amber-200 dark:bg-amber-950/20 dark:border-amber-900">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <AlertTitle className="text-amber-900 dark:text-amber-100">
                Declaração Obrigatória
              </AlertTitle>
              <AlertDescription className="text-amber-800 dark:text-amber-200">
                Antes de finalizar seu cadastro, você deve ler e aceitar os termos abaixo.
              </AlertDescription>
            </Alert>

            <div className="space-y-4 mt-4">
              {/* Checkbox 1: Responsabilidade pelos Documentos */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="documents-responsibility-company"
                  checked={acceptedDocumentsResponsibility}
                  onCheckedChange={(checked) => handleDocumentsResponsibilityChange(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="documents-responsibility-company"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    Declaro que todas as imagens e documentos enviados são verdadeiros, autênticos e de 
                    propriedade da empresa. Estou ciente de que o envio de documentos falsos constitui 
                    crime e pode resultar em responsabilização civil e criminal, além do banimento 
                    permanente da plataforma.
                  </label>
                </div>
              </div>

              {/* Checkbox 2: Termos de Uso */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="terms-of-use-company"
                  checked={acceptedTermsOfUse}
                  onCheckedChange={(checked) => handleTermsOfUseChange(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="terms-of-use-company"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    Li e aceito integralmente os{' '}
                    <a 
                      href="/termos" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Termos de Uso
                    </a>
                    {' '}da plataforma AgriRoute, incluindo todas as cláusulas sobre direitos, 
                    obrigações e responsabilidades.
                  </label>
                </div>
              </div>

              {/* Checkbox 3: Política de Privacidade */}
              <div className="flex items-start space-x-3 p-4 border rounded-lg hover:bg-accent/50 transition-colors">
                <Checkbox
                  id="privacy-policy-company"
                  checked={acceptedPrivacyPolicy}
                  onCheckedChange={(checked) => handlePrivacyPolicyChange(checked === true)}
                  className="mt-1"
                />
                <div className="flex-1">
                  <label
                    htmlFor="privacy-policy-company"
                    className="text-sm font-medium leading-relaxed cursor-pointer"
                  >
                    Li e aceito a{' '}
                    <a 
                      href="/privacidade" 
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline font-semibold"
                      onClick={(e) => e.stopPropagation()}
                    >
                      Política de Privacidade
                    </a>
                    , autorizando o tratamento dos dados da empresa conforme descrito no documento.
                  </label>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

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