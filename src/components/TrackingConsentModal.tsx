import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { AlertTriangle, MapPin, Shield } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TrackingConsentModalProps {
  isOpen: boolean;
  onConsent: (agreed: boolean) => void;
  freightId: string;
}

const CONSENT_TEXT = `Ao aceitar este frete, declaro que li e concordo que: (i) manterei o serviço de localização do meu dispositivo ativo durante toda a execução do frete; (ii) autorizo a coleta e o tratamento dos meus dados de localização, fotos e registros necessários para execução deste contrato; (iii) em caso de desligamento injustificado do rastreamento, desvio de rota ou outras ocorrências graves, autorizo o compartilhamento dos registros com as autoridades competentes e aceito que a plataforma tome medidas administrativas (suspensão, bloqueio, retenção de valores) enquanto durar a investigação.`;

export function TrackingConsentModal({ isOpen, onConsent, freightId }: TrackingConsentModalProps) {
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleConsent = async () => {
    if (!agreed) {
      toast.error("Você deve concordar com os termos para continuar");
      return;
    }

    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Usuário não encontrado");

      // Registrar consentimento
      const { error } = await supabase
        .from('tracking_consents')
        .insert({
          user_id: user.id,
          freight_id: freightId,
          consent_given: true,
          consent_text: CONSENT_TEXT,
          ip_address: null, // Será preenchido pelo backend se necessário
          user_agent: navigator.userAgent
        });

      if (error) throw error;

      onConsent(true);
      toast.success("Consentimento registrado com sucesso");
    } catch (error: any) {
      console.error('Erro ao registrar consentimento:', error);
      toast.error("Erro ao registrar consentimento");
    } finally {
      setLoading(false);
    }
  };

  const handleReject = () => {
    onConsent(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={() => {}}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Shield className="h-6 w-6 text-primary" />
            Termo de Rastreamento e Segurança
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Aviso de Obrigatoriedade */}
          <div className="flex items-start gap-3 p-4 bg-amber-50 border-l-4 border-amber-400 rounded-r-lg">
            <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-amber-800">Rastreamento Obrigatório</h3>
              <p className="text-sm text-amber-700 mt-1">
                O rastreamento GPS é obrigatório durante todo o transporte da carga.
                O desligamento injustificado pode resultar em suspensão da conta.
              </p>
            </div>
          </div>

          {/* Por que precisamos do rastreamento */}
          <div className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Por que precisamos do seu rastreamento?
            </h3>
            <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground ml-6">
              <li>Garantir a segurança da carga e do motorista</li>
              <li>Fornecer informações precisas ao embarcador</li>
              <li>Permitir assistência em caso de emergências</li>
              <li>Cumprir regulamentações de transporte de carga</li>
              <li>Investigar ocorrências suspeitas quando necessário</li>
            </ul>
          </div>

          {/* Termo completo */}
          <div className="border rounded-lg p-4 bg-gray-50">
            <h4 className="font-semibold mb-3">Termos do Serviço de Rastreamento:</h4>
            <div className="text-sm space-y-2 text-gray-700 max-h-48 overflow-y-auto">
              {CONSENT_TEXT}
            </div>
          </div>

          {/* Suas responsabilidades */}
          <div className="space-y-2">
            <h4 className="font-semibold text-sm">Suas responsabilidades:</h4>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside ml-4">
              <li>Manter o GPS ativo durante todo o frete</li>
              <li>Seguir a rota sugerida pelo sistema</li>
              <li>Registrar check-ins nos pontos obrigatórios</li>
              <li>Responder aos alertas do sistema</li>
              <li>Não usar ferramentas de falsificação de localização</li>
            </ul>
          </div>

          {/* Checkbox de consentimento */}
          <div className="flex items-start space-x-3 p-4 border border-primary/20 rounded-lg">
            <Checkbox
              id="consent"
              checked={agreed}
              onCheckedChange={(checked) => setAgreed(checked as boolean)}
              className="mt-1"
            />
            <label htmlFor="consent" className="text-sm cursor-pointer">
              <strong>Eu li, compreendi e concordo</strong> com todos os termos de rastreamento e segurança descritos acima.
              Autorizo a coleta, tratamento e compartilhamento dos meus dados conforme especificado.
            </label>
          </div>

          {/* Botões */}
          <div className="flex gap-3 pt-4">
            <Button
              onClick={handleConsent}
              disabled={!agreed || loading}
              className="flex-1"
            >
              {loading ? "Processando..." : "Aceitar e Continuar"}
            </Button>
            <Button
              variant="outline"
              onClick={handleReject}
              disabled={loading}
              className="flex-1"
            >
              Recusar
            </Button>
          </div>

          {/* Nota sobre privacidade */}
          <div className="text-xs text-muted-foreground text-center">
            Seus dados são protegidos conforme nossa Política de Privacidade e a LGPD.
            O rastreamento é usado exclusivamente para segurança e execução do contrato.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}