import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Settings, Calculator, AlertTriangle, Check, 
  DollarSign, Scale, Truck, Info
} from 'lucide-react';
import { toast } from 'sonner';

interface NegotiationRules {
  enforceAnttMinimum: boolean;
  anttFlexPercentage: number;
  includeToll: boolean;
  tollEstimate: number;
  pricePerTon: number;
  minPricePerKm: number;
  showBreakdown: boolean;
}

interface NegotiationRulesModalProps {
  isOpen: boolean;
  onClose: () => void;
  producerId: string;
}

const DEFAULT_RULES: NegotiationRules = {
  enforceAnttMinimum: true,
  anttFlexPercentage: 0,
  includeToll: false,
  tollEstimate: 0,
  pricePerTon: 0,
  minPricePerKm: 0,
  showBreakdown: true
};

const STORAGE_KEY_PREFIX = 'negotiation_rules_';

export const NegotiationRulesModal: React.FC<NegotiationRulesModalProps> = ({
  isOpen,
  onClose,
  producerId
}) => {
  const [rules, setRules] = useState<NegotiationRules>(DEFAULT_RULES);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isOpen && producerId) {
      loadRules();
    }
  }, [isOpen, producerId]);

  const loadRules = async () => {
    setLoading(true);
    try {
      // Load from localStorage (table doesn't exist yet)
      const storageKey = `${STORAGE_KEY_PREFIX}${producerId}`;
      const stored = localStorage.getItem(storageKey);
      
      if (stored) {
        setRules(JSON.parse(stored));
      }
    } catch (error) {
      console.error('[NegotiationRulesModal] Erro ao carregar:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save to localStorage
      const storageKey = `${STORAGE_KEY_PREFIX}${producerId}`;
      localStorage.setItem(storageKey, JSON.stringify(rules));

      toast.success('Regras de negociação salvas!');
      onClose();
    } catch (error: any) {
      console.error('[NegotiationRulesModal] Erro ao salvar:', error);
      toast.error('Erro ao salvar regras', {
        description: error.message
      });
    } finally {
      setSaving(false);
    }
  };

  const validateProposal = (
    proposedPrice: number, 
    anttMinimum: number, 
    weightTons: number, 
    distanceKm: number
  ): { valid: boolean; issues: string[]; suggestions: string[] } => {
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check ANTT minimum
    if (rules.enforceAnttMinimum && anttMinimum > 0) {
      const minAllowed = anttMinimum * (1 - rules.anttFlexPercentage / 100);
      if (proposedPrice < minAllowed) {
        issues.push(`Valor abaixo do mínimo ANTT (R$ ${minAllowed.toFixed(2)})`);
        suggestions.push(`Aumente para pelo menos R$ ${minAllowed.toFixed(2)}`);
      }
    }

    // Check price per ton
    if (rules.pricePerTon > 0 && weightTons > 0) {
      const minByTon = rules.pricePerTon * weightTons;
      if (proposedPrice < minByTon) {
        issues.push(`Abaixo de R$ ${rules.pricePerTon}/ton`);
        suggestions.push(`Mínimo por tonelagem: R$ ${minByTon.toFixed(2)}`);
      }
    }

    // Check price per km
    if (rules.minPricePerKm > 0 && distanceKm > 0) {
      const minByKm = rules.minPricePerKm * distanceKm;
      if (proposedPrice < minByKm) {
        issues.push(`Abaixo de R$ ${rules.minPricePerKm}/km`);
        suggestions.push(`Mínimo por km: R$ ${minByKm.toFixed(2)}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  };

  // Example calculation for preview
  const exampleCalc = {
    distance: 500,
    weight: 30,
    anttMinimum: 2500,
    proposedPrice: 2200
  };
  
  const exampleValidation = validateProposal(
    exampleCalc.proposedPrice,
    exampleCalc.anttMinimum,
    exampleCalc.weight,
    exampleCalc.distance
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Regras de Negociação
          </DialogTitle>
          <DialogDescription>
            Configure as regras para validar propostas e explicar o cálculo aos motoristas
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="py-8 text-center text-muted-foreground">
            Carregando configurações...
          </div>
        ) : (
          <div className="space-y-6">
            {/* ANTT Rules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Scale className="h-4 w-4" />
                  Tabela ANTT
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Exigir mínimo ANTT</Label>
                    <p className="text-xs text-muted-foreground">
                      Rejeitar propostas abaixo da tabela oficial
                    </p>
                  </div>
                  <Switch
                    checked={rules.enforceAnttMinimum}
                    onCheckedChange={(v) => setRules({ ...rules, enforceAnttMinimum: v })}
                  />
                </div>

                {rules.enforceAnttMinimum && (
                  <div>
                    <Label htmlFor="antt-flex">Flexibilidade permitida (%)</Label>
                    <Input
                      id="antt-flex"
                      type="number"
                      min={0}
                      max={20}
                      value={rules.anttFlexPercentage}
                      onChange={(e) => setRules({ ...rules, anttFlexPercentage: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Aceitar até {rules.anttFlexPercentage}% abaixo do mínimo ANTT
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Price Rules */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Valores Mínimos
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="price-per-ton">Mínimo por tonelada (R$)</Label>
                    <Input
                      id="price-per-ton"
                      type="number"
                      min={0}
                      step={0.01}
                      value={rules.pricePerTon}
                      onChange={(e) => setRules({ ...rules, pricePerTon: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="price-per-km">Mínimo por km (R$)</Label>
                    <Input
                      id="price-per-km"
                      type="number"
                      min={0}
                      step={0.01}
                      value={rules.minPricePerKm}
                      onChange={(e) => setRules({ ...rules, minPricePerKm: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Toll Configuration */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Truck className="h-4 w-4" />
                  Pedágio
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Incluir pedágio no cálculo</Label>
                    <p className="text-xs text-muted-foreground">
                      Somar estimativa de pedágio ao valor mínimo
                    </p>
                  </div>
                  <Switch
                    checked={rules.includeToll}
                    onCheckedChange={(v) => setRules({ ...rules, includeToll: v })}
                  />
                </div>

                {rules.includeToll && (
                  <div>
                    <Label htmlFor="toll-estimate">Estimativa de pedágio (R$)</Label>
                    <Input
                      id="toll-estimate"
                      type="number"
                      min={0}
                      step={0.01}
                      value={rules.tollEstimate}
                      onChange={(e) => setRules({ ...rules, tollEstimate: parseFloat(e.target.value) || 0 })}
                      className="mt-1"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Display Options */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Info className="h-4 w-4" />
                  Transparência
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Mostrar breakdown do cálculo</Label>
                    <p className="text-xs text-muted-foreground">
                      Exibir como o valor mínimo foi calculado
                    </p>
                  </div>
                  <Switch
                    checked={rules.showBreakdown}
                    onCheckedChange={(v) => setRules({ ...rules, showBreakdown: v })}
                  />
                </div>
              </CardContent>
            </Card>

            {/* Example Validation */}
            <Alert variant={exampleValidation.valid ? 'default' : 'destructive'}>
              <Calculator className="h-4 w-4" />
              <AlertDescription>
                <p className="font-medium mb-2">Exemplo de Validação:</p>
                <p className="text-sm">
                  Proposta de R$ {exampleCalc.proposedPrice} para {exampleCalc.distance}km / {exampleCalc.weight}t
                </p>
                {exampleValidation.valid ? (
                  <div className="flex items-center gap-2 mt-2 text-green-600">
                    <Check className="h-4 w-4" />
                    Proposta válida com as regras atuais
                  </div>
                ) : (
                  <div className="mt-2 space-y-1">
                    {exampleValidation.issues.map((issue, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <AlertTriangle className="h-3 w-3" />
                        {issue}
                      </div>
                    ))}
                  </div>
                )}
              </AlertDescription>
            </Alert>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button variant="outline" onClick={onClose}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Salvando...' : 'Salvar Regras'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

// Export validation function for use in proposal components
export const validateProposalWithRules = async (
  producerId: string,
  proposedPrice: number,
  anttMinimum: number,
  weightTons: number,
  distanceKm: number
): Promise<{ valid: boolean; issues: string[]; suggestions: string[] }> => {
  try {
    // Load rules from localStorage
    const storageKey = `${STORAGE_KEY_PREFIX}${producerId}`;
    const stored = localStorage.getItem(storageKey);
    
    if (!stored) {
      return { valid: true, issues: [], suggestions: [] };
    }

    const rules: NegotiationRules = JSON.parse(stored);
    const issues: string[] = [];
    const suggestions: string[] = [];

    // Check ANTT minimum
    if (rules.enforceAnttMinimum && anttMinimum > 0) {
      const minAllowed = anttMinimum * (1 - (rules.anttFlexPercentage || 0) / 100);
      if (proposedPrice < minAllowed) {
        issues.push(`Valor abaixo do mínimo ANTT (R$ ${minAllowed.toFixed(2)})`);
        suggestions.push(`Aumente para pelo menos R$ ${minAllowed.toFixed(2)}`);
      }
    }

    // Check price per ton
    if (rules.pricePerTon > 0 && weightTons > 0) {
      const minByTon = rules.pricePerTon * weightTons;
      if (proposedPrice < minByTon) {
        issues.push(`Abaixo de R$ ${rules.pricePerTon}/ton`);
        suggestions.push(`Mínimo por tonelagem: R$ ${minByTon.toFixed(2)}`);
      }
    }

    // Check price per km
    if (rules.minPricePerKm > 0 && distanceKm > 0) {
      const minByKm = rules.minPricePerKm * distanceKm;
      if (proposedPrice < minByKm) {
        issues.push(`Abaixo de R$ ${rules.minPricePerKm}/km`);
        suggestions.push(`Mínimo por km: R$ ${minByKm.toFixed(2)}`);
      }
    }

    return {
      valid: issues.length === 0,
      issues,
      suggestions
    };
  } catch (error) {
    console.error('[validateProposalWithRules] Erro:', error);
    return { valid: true, issues: [], suggestions: [] };
  }
};