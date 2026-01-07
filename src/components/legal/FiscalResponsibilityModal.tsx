import { useState, useRef, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, FileText, AlertTriangle } from 'lucide-react';

interface FiscalResponsibilityModalProps {
  open: boolean;
  onAccept: () => Promise<void>;
  loading?: boolean;
}

export function FiscalResponsibilityModal({ 
  open, 
  onAccept,
  loading = false,
}: FiscalResponsibilityModalProps) {
  const [hasScrolledToEnd, setHasScrolledToEnd] = useState(false);
  const [isChecked, setIsChecked] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setHasScrolledToEnd(false);
      setIsChecked(false);
    }
  }, [open]);

  const handleScroll = (event: React.UIEvent<HTMLDivElement>) => {
    const target = event.target as HTMLDivElement;
    const isAtBottom = Math.abs(target.scrollHeight - target.scrollTop - target.clientHeight) < 10;
    if (isAtBottom) {
      setHasScrolledToEnd(true);
    }
  };

  const handleAccept = async () => {
    if (isChecked && hasScrolledToEnd) {
      await onAccept();
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent className="sm:max-w-lg" onPointerDownOutside={(e) => e.preventDefault()}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2">
            <Shield className="h-6 w-6 text-primary" />
            <DialogTitle>Termo de Responsabilidade Fiscal</DialogTitle>
          </div>
          <DialogDescription>
            Leia atentamente o termo abaixo antes de continuar.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea 
          className="h-[300px] border rounded-md p-4"
          onScrollCapture={handleScroll}
          ref={scrollRef}
        >
          <div className="space-y-4 text-sm">
            <div className="flex items-start gap-2 p-3 bg-warning/10 rounded-lg border border-warning/20">
              <AlertTriangle className="h-5 w-5 text-warning mt-0.5 flex-shrink-0" />
              <p className="text-warning-foreground">
                <strong>IMPORTANTE:</strong> O AgriRoute NÃO é um sistema fiscal homologado e NÃO realiza 
                atos fiscais perante a SEFAZ.
              </p>
            </div>

            <h3 className="font-semibold text-base">TERMO DE RESPONSABILIDADE FISCAL – AGRIROUTE</h3>

            <p>Ao utilizar as funcionalidades fiscais do AgriRoute, declaro que:</p>

            <div className="space-y-3 ml-4">
              <p><strong>1.</strong> Sou integralmente responsável pela emissão, manifestação e porte 
              dos documentos fiscais exigidos por lei, incluindo NF-e, CT-e e GTA.</p>

              <p><strong>2.</strong> Compreendo que o AgriRoute atua exclusivamente como plataforma de 
              <strong> apoio operacional</strong>, organizando informações e orientando sobre obrigações 
              fiscais, sem executar atos fiscais automatizados.</p>

              <p><strong>3.</strong> A manifestação de NF-e é realizada por mim, diretamente no 
              Portal Nacional da NF-e, utilizando meu certificado digital ou login gov.br.</p>

              <p><strong>4.</strong> Reconheço que eventuais autuações, multas ou penalidades 
              decorrentes de irregularidades documentais são de minha <strong>exclusiva responsabilidade</strong>.</p>

              <p><strong>5.</strong> Autorizo o registro das minhas ações no sistema para fins de 
              auditoria interna, conforme a LGPD.</p>

              <p><strong>6.</strong> Nenhum certificado digital, senha ou dado fiscal sensível será 
              armazenado pelo AgriRoute.</p>
            </div>

            <div className="flex items-start gap-2 p-3 bg-muted rounded-lg mt-4">
              <FileText className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-muted-foreground text-xs">
                Este aceite possui validade jurídica nos termos do art. 10, §2º da MP 2.200-2/2001.
                Data e hora do aceite serão registradas.
              </p>
            </div>

            <p className="text-muted-foreground text-xs mt-4">
              Versão do termo: 1.0 | Última atualização: Janeiro/2025
            </p>
          </div>
        </ScrollArea>

        {!hasScrolledToEnd && (
          <p className="text-xs text-muted-foreground text-center">
            Role até o final do termo para continuar
          </p>
        )}

        <div className="flex items-center space-x-2 mt-2">
          <Checkbox 
            id="accept-term" 
            checked={isChecked}
            onCheckedChange={(checked) => setIsChecked(checked === true)}
            disabled={!hasScrolledToEnd}
          />
          <label 
            htmlFor="accept-term" 
            className={`text-sm ${!hasScrolledToEnd ? 'text-muted-foreground' : ''}`}
          >
            Li e aceito o Termo de Responsabilidade Fiscal
          </label>
        </div>

        <DialogFooter>
          <Button 
            onClick={handleAccept}
            disabled={!isChecked || !hasScrolledToEnd || loading}
            className="w-full sm:w-auto"
          >
            {loading ? 'Processando...' : 'Aceitar e Continuar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
