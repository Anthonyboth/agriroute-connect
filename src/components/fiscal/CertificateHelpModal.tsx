import React from 'react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  VisuallyHidden,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShieldCheck, 
  FileKey, 
  CheckCircle2, 
  AlertCircle,
  Lock,
  Wallet,
  ClipboardList
} from 'lucide-react';

interface CertificateHelpModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CertificateHelpModal({ open, onOpenChange }: CertificateHelpModalProps) {
  const isMobile = useIsMobile();

  const content = (
    <ScrollArea className="max-h-[70vh] pr-4">
      <div className="space-y-6 pb-4">
        {/* Main title section */}
        <div className="flex items-center gap-3 pb-2 border-b">
          <Lock className="h-6 w-6 text-primary flex-shrink-0" />
          <h3 className="text-lg font-semibold">
            🔐 Como obter um Certificado Digital A1 válido
          </h3>
        </div>

        {/* O que é */}
        <section className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            O que é o Certificado Digital A1?
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O Certificado Digital A1 é um arquivo eletrônico (normalmente no formato .pfx) que funciona como uma identidade digital do CPF ou CNPJ. Ele é usado para assinar digitalmente e emitir documentos fiscais eletrônicos com validade jurídica.
          </p>
        </section>

        {/* Para que serve */}
        <section className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <FileKey className="h-4 w-4 text-primary" />
            Para que serve no AgriRoute?
          </h4>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Ele é necessário para assinar e emitir documentos fiscais como NF-e, CT-e e MDF-e. Sem um certificado A1 válido, a emissão não pode ser concluída.
          </p>
        </section>

        {/* Tipos */}
        <section className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <ClipboardList className="h-4 w-4 text-primary" />
            Tipos de certificado (resumo):
          </h4>
          <ul className="text-sm text-muted-foreground space-y-2 ml-4">
            <li className="flex items-start gap-2">
              <span className="font-medium text-foreground">A1 (arquivo .pfx):</span>
              <span>instalado/armazenado digitalmente, ideal para uso em sistemas.</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="font-medium text-foreground">A3 (cartão/token):</span>
              <span>depende de mídia física e senha, geralmente menos prático para integração.</span>
            </li>
          </ul>
          <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-2">
            <p className="text-sm text-green-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              O AgriRoute utiliza Certificado A1 (.pfx).
            </p>
          </div>
        </section>

        {/* Quem pode obter */}
        <section className="space-y-2">
          <h4 className="font-semibold">Quem pode obter?</h4>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Pessoa Física (CPF)</li>
            <li>Pessoa Jurídica (CNPJ)</li>
            <li>Produtor Rural (conforme regras do seu estado)</li>
          </ul>
        </section>

        {/* Como obter */}
        <section className="space-y-2">
          <h4 className="font-semibold">Como obter (passo a passo geral):</h4>
          <ol className="text-sm text-muted-foreground list-decimal list-inside space-y-2">
            <li>Escolha uma <strong>Autoridade Certificadora</strong> autorizada no Brasil (ICP-Brasil).</li>
            <li>Separe os documentos solicitados (variando por CPF/CNPJ). Em geral: documento oficial, dados do CPF/CNPJ e comprovantes.</li>
            <li>Realize a validação de identidade (presencial ou por videoconferência, conforme disponibilidade).</li>
            <li>Após aprovado, você receberá o arquivo <code className="bg-muted px-1 py-0.5 rounded">.pfx</code> e definirá uma senha.</li>
          </ol>
        </section>

        {/* Documentos */}
        <section className="space-y-2">
          <h4 className="font-semibold">Documentos normalmente solicitados (pode variar):</h4>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Documento de identificação do responsável</li>
            <li>Dados do CPF ou CNPJ</li>
            <li>Comprovante de endereço</li>
            <li>Informações do responsável legal (para empresas)</li>
          </ul>
        </section>

        {/* Validade */}
        <section className="space-y-2">
          <h4 className="font-semibold">Validade:</h4>
          <p className="text-sm text-muted-foreground">
            Normalmente <strong>1 ano</strong> (podendo variar conforme a opção contratada).
          </p>
        </section>

        {/* Custos */}
        <section className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            Custos médios:
          </h4>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
            <p className="text-sm text-blue-800">
              💰 Em média, o Certificado A1 custa entre <strong>R$ 120,00 e R$ 300,00</strong>, dependendo do tipo (CPF/CNPJ), validade e processo de validação.
            </p>
          </div>
        </section>

        {/* Segurança */}
        <section className="space-y-2">
          <h4 className="font-semibold flex items-center gap-2">
            <Lock className="h-4 w-4 text-primary" />
            Segurança e boas práticas:
          </h4>
          <ul className="text-sm text-muted-foreground list-disc list-inside space-y-1">
            <li>Guarde o arquivo .pfx em local seguro.</li>
            <li>Nunca compartilhe o certificado ou a senha.</li>
            <li>A senha não deve ser armazenada em texto.</li>
            <li>Se perder a senha, geralmente é necessário emitir um novo certificado.</li>
            <li>Evite enviar o arquivo por aplicativos de mensagem ou e-mail sem proteção.</li>
          </ul>
        </section>

        {/* Nota importante */}
        <section className="space-y-2">
          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <h4 className="font-semibold text-amber-800 flex items-center gap-2 mb-2">
              <AlertCircle className="h-4 w-4" />
              Nota importante (compliance):
            </h4>
            <p className="text-sm text-amber-700">
              O AgriRoute <strong>não vende certificados digitais</strong> e <strong>não indica fornecedores</strong>. A contratação e a escolha do emissor é de responsabilidade do usuário.
            </p>
          </div>
        </section>
      </div>
    </ScrollArea>
  );

  const footerButton = (
    <Button onClick={() => onOpenChange(false)} className="w-full mt-4">
      Entendi
    </Button>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader className="text-left">
            <DrawerTitle>Como obter um Certificado Digital A1</DrawerTitle>
            <DrawerDescription>
              Tudo o que você precisa saber para obter seu certificado
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            {content}
            {footerButton}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle>Como obter um Certificado Digital A1</DialogTitle>
          <DialogDescription>
            Tudo o que você precisa saber para obter seu certificado
          </DialogDescription>
        </DialogHeader>
        {content}
        {footerButton}
      </DialogContent>
    </Dialog>
  );
}
