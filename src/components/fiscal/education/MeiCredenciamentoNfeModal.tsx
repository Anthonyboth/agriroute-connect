/**
 * Modal de Verificação de Credenciamento NF-e para MEI
 * 
 * Exigência legal: MEI não é automaticamente habilitado para NF-e.
 * A SEFAZ (especialmente MT) exige credenciamento explícito.
 * Sem credenciamento → Rejeição 203 (Emissor não habilitado).
 * 
 * Este modal bloqueia PIX e emissão até confirmação manual.
 */

import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Checkbox } from '@/components/ui/checkbox';
import {
  AlertTriangle,
  ExternalLink,
  MessageCircle,
  XCircle,
  Search,
  FileText,
} from 'lucide-react';

interface MeiCredenciamentoNfeModalProps {
  open: boolean;
  onClose: () => void;
  onConfirmed: () => void;
  onCancelEmission: () => void;
  onUseNfa?: () => void;
}

export const MeiCredenciamentoNfeModal: React.FC<MeiCredenciamentoNfeModalProps> = ({
  open,
  onClose,
  onConfirmed,
  onCancelEmission,
  onUseNfa,
}) => {
  const [credenciamentoConfirmed, setCredenciamentoConfirmed] = useState(false);

  const handleConfirm = () => {
    if (!credenciamentoConfirmed) return;
    onConfirmed();
  };

  const handleVerificarCredenciamento = () => {
    window.open('https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte', '_blank');
  };

  const handlePortalAlternativo = () => {
    window.open('https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml', '_blank');
  };

  const handleContactSupport = () => {
    const message = encodeURIComponent(
      `🌱 *AgriRoute - Dúvida sobre Credenciamento NF-e (MEI)*\n\n` +
      `Olá! Sou MEI e preciso de ajuda para verificar meu credenciamento NF-e na SEFAZ.\n\n` +
      `Por favor, me orientem sobre os próximos passos.`
    );
    window.open(`https://wa.me/5566992734632?text=${message}`, '_blank');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onInteractOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Credenciamento obrigatório para emissão de NF-e (MEI)
          </DialogTitle>
          <DialogDescription>
            Verificação exigida pela SEFAZ antes de prosseguir com a emissão
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Mensagem principal */}
          <Alert className="border-destructive/40 bg-destructive/5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <AlertTitle className="text-destructive font-semibold">
              Atenção — Você é MEI
            </AlertTitle>
            <AlertDescription className="space-y-3 mt-2">
              <p>
                Você é MEI e <strong>não está automaticamente autorizado</strong> a emitir NF-e.
              </p>
              <p>
                Mesmo com CNPJ ativo, Inscrição Estadual e Certificado A1, a SEFAZ exige{' '}
                <strong>credenciamento específico</strong> para NF-e.
              </p>
              <p className="text-destructive font-medium">
                Caso você tente emitir sem esse credenciamento, sua nota será{' '}
                <strong>rejeitada pela SEFAZ</strong> (Rejeição 203 — Emissor não habilitado).
              </p>
            </AlertDescription>
          </Alert>

          {/* Como verificar */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <p className="font-semibold text-sm flex items-center gap-2">
              <Search className="h-4 w-4" />
              Como verificar seu credenciamento na SEFAZ-MT:
            </p>
            <ol className="list-decimal list-inside text-sm space-y-2 ml-1">
              <li>
                Acesse o <strong>Portal de Atendimento ao Contribuinte</strong>
              </li>
              <li>
                Faça login com:
                <ul className="list-disc list-inside ml-4 mt-1 space-y-1 text-muted-foreground">
                  <li><strong>Usuário:</strong> sua Inscrição Estadual</li>
                  <li><strong>Senha:</strong> Senha do Contribuinte</li>
                </ul>
              </li>
              <li>
                Navegue até: <strong>Cadastro → Credenciamentos → Emissão de NF-e</strong>
              </li>
            </ol>
          </div>

          {/* Botões de ação */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Button
              variant="default"
              className="w-full"
              onClick={handleVerificarCredenciamento}
            >
              <Search className="h-4 w-4 mr-2" />
              Verificar meu credenciamento na SEFAZ
              <ExternalLink className="h-3 w-3 ml-1" />
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handlePortalAlternativo}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Portal alternativo (sem certificado)
            </Button>

            <Button
              variant="outline"
              className="w-full"
              onClick={handleContactSupport}
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Falar com suporte
            </Button>

            {onUseNfa && (
              <Button
                variant="secondary"
                className="w-full"
                onClick={onUseNfa}
              >
                <FileText className="h-4 w-4 mr-2" />
                Emitir NF-a (alternativa para MEI)
              </Button>
            )}
          </div>

          {/* Checkbox de responsabilidade */}
          <div className="border border-destructive/30 bg-destructive/5 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="mei-credenciamento-confirm"
                checked={credenciamentoConfirmed}
                onCheckedChange={(checked) => setCredenciamentoConfirmed(checked === true)}
                className="mt-0.5"
              />
              <label
                htmlFor="mei-credenciamento-confirm"
                className="text-sm cursor-pointer leading-relaxed"
              >
                Declaro que verifiquei meu credenciamento na SEFAZ e estou autorizado a emitir NF-e como MEI.
              </label>
            </div>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t">
            <Button
              variant="ghost"
              onClick={onCancelEmission}
              className="text-muted-foreground"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Cancelar emissão de NF-e
            </Button>

            <Button
              onClick={handleConfirm}
              disabled={!credenciamentoConfirmed}
            >
              Continuar com a emissão
            </Button>
          </div>

          {/* Aviso legal */}
          <p className="text-xs text-muted-foreground text-center">
            Esta verificação é uma exigência legal da SEFAZ. O AgriRoute não se responsabiliza 
            por rejeições decorrentes de falta de credenciamento.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default MeiCredenciamentoNfeModal;
