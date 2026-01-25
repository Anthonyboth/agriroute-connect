import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Loader2 } from 'lucide-react';
import { RegisterIssuerData, useFiscalIssuer } from '@/hooks/useFiscalIssuer';
import { isValidDocument, formatDocument, getDocumentType } from '@/utils/document';
import { toast } from 'sonner';
import { usePrefilledUserData } from '@/hooks/usePrefilledUserData';

interface FiscalOnboardingStep2Props {
  data: Partial<RegisterIssuerData>;
  onUpdate: (updates: Partial<RegisterIssuerData>) => void;
  onNext: () => void;
  onBack: () => void;
}

const REGIME_TRIBUTARIO_OPTIONS = [
  { value: 'simples_nacional', label: 'Simples Nacional' },
  { value: 'simples_nacional_excesso', label: 'Simples Nacional - Excesso de Sublimite' },
  { value: 'lucro_presumido', label: 'Lucro Presumido' },
  { value: 'lucro_real', label: 'Lucro Real' },
];

const UF_OPTIONS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 'MA', 'MT', 'MS', 
  'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 
  'SP', 'SE', 'TO'
];

export function FiscalOnboardingStep2({ data, onUpdate, onBack, onNext }: FiscalOnboardingStep2Props) {
  const { loading, registerIssuer, issuer } = useFiscalIssuer();
  const { fiscal: prefilledFiscal, personal: prefilledPersonal, loading: prefillLoading } = usePrefilledUserData();
  const [localLoading, setLocalLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasPrefilled, setHasPrefilled] = useState(false);

  const isCNPJ = data.issuer_type === 'CNPJ' || data.issuer_type === 'MEI';

  // ✅ PREFILL AUTOMÁTICO: Preencher dados do perfil do usuário
  useEffect(() => {
    if (prefillLoading || hasPrefilled) return;
    
    // Verificar se há dados para prefill e se os campos estão vazios
    if (prefilledFiscal && !data.cpf_cnpj && !data.razao_social) {
      const updates: Partial<RegisterIssuerData> = {};
      
      if (!data.cpf_cnpj && prefilledFiscal.cnpj_cpf) {
        updates.cpf_cnpj = prefilledFiscal.cnpj_cpf;
      }
      if (!data.razao_social && prefilledFiscal.razao_social) {
        updates.razao_social = prefilledFiscal.razao_social;
      }
      if (!data.nome_fantasia && prefilledFiscal.nome_fantasia) {
        updates.nome_fantasia = prefilledFiscal.nome_fantasia;
      }
      if (!data.inscricao_estadual && prefilledFiscal.inscricao_estadual) {
        updates.inscricao_estadual = prefilledFiscal.inscricao_estadual;
      }
      if (!data.email_fiscal && prefilledFiscal.email) {
        updates.email_fiscal = prefilledFiscal.email;
      }
      if (!data.telefone_fiscal && prefilledFiscal.telefone) {
        updates.telefone_fiscal = prefilledFiscal.telefone;
      }
      if (!data.endereco_logradouro && prefilledFiscal.logradouro) {
        updates.endereco_logradouro = prefilledFiscal.logradouro;
      }
      if (!data.endereco_numero && prefilledFiscal.numero) {
        updates.endereco_numero = prefilledFiscal.numero;
      }
      if (!data.endereco_bairro && prefilledFiscal.bairro) {
        updates.endereco_bairro = prefilledFiscal.bairro;
      }
      if (!data.endereco_cidade && prefilledFiscal.municipio) {
        updates.endereco_cidade = prefilledFiscal.municipio;
      }
      if (!data.endereco_uf && prefilledFiscal.uf) {
        updates.endereco_uf = prefilledFiscal.uf;
      }
      if (!data.endereco_cep && prefilledFiscal.cep) {
        updates.endereco_cep = prefilledFiscal.cep;
      }
      
      if (Object.keys(updates).length > 0) {
        onUpdate(updates);
      }
      setHasPrefilled(true);
    }
  }, [prefillLoading, prefilledFiscal, data, onUpdate, hasPrefilled]);

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!data.cpf_cnpj) {
      newErrors.cpf_cnpj = isCNPJ ? 'CNPJ é obrigatório' : 'CPF é obrigatório';
    } else if (!isValidDocument(data.cpf_cnpj)) {
      newErrors.cpf_cnpj = isCNPJ ? 'CNPJ inválido' : 'CPF inválido';
    }

    if (!data.razao_social) {
      newErrors.razao_social = isCNPJ ? 'Razão social é obrigatória' : 'Nome completo é obrigatório';
    }

    if (!data.regime_tributario) {
      newErrors.regime_tributario = 'Regime tributário é obrigatório';
    }

    if (!data.endereco_uf) {
      newErrors.endereco_uf = 'UF é obrigatória';
    }

    if (!data.endereco_cidade) {
      newErrors.endereco_cidade = 'Cidade é obrigatória';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validateForm()) {
      toast.error('Corrija os erros antes de continuar');
      return;
    }

    setLocalLoading(true);
    
    try {
      // If issuer already exists, just go to next step
      if (issuer) {
        onNext();
        return;
      }

      // Register new issuer
      const result = await registerIssuer(data as RegisterIssuerData);
      
      if (result) {
        onNext();
      }
    } finally {
      setLocalLoading(false);
    }
  };

  const handleDocumentChange = (value: string) => {
    // Format as user types
    const formatted = formatDocument(value.replace(/\D/g, ''));
    onUpdate({ cpf_cnpj: formatted });
    
    // Clear error when user starts typing
    if (errors.cpf_cnpj) {
      setErrors(prev => ({ ...prev, cpf_cnpj: '' }));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Dados Cadastrais</h3>
        <p className="text-muted-foreground text-sm mt-1">
          Informe os dados fiscais do emissor
        </p>
      </div>

      <div className="grid gap-4">
        {/* CPF/CNPJ */}
        <div className="space-y-2">
          <Label htmlFor="cpf_cnpj">{isCNPJ ? 'CNPJ' : 'CPF'} *</Label>
          <Input
            id="cpf_cnpj"
            value={data.cpf_cnpj || ''}
            onChange={(e) => handleDocumentChange(e.target.value)}
            placeholder={isCNPJ ? '00.000.000/0000-00' : '000.000.000-00'}
            maxLength={isCNPJ ? 18 : 14}
            className={errors.cpf_cnpj ? 'border-destructive' : ''}
          />
          {errors.cpf_cnpj && (
            <p className="text-sm text-destructive">{errors.cpf_cnpj}</p>
          )}
        </div>

        {/* Razão Social / Nome */}
        <div className="space-y-2">
          <Label htmlFor="razao_social">{isCNPJ ? 'Razão Social' : 'Nome Completo'} *</Label>
          <Input
            id="razao_social"
            value={data.razao_social || ''}
            onChange={(e) => onUpdate({ razao_social: e.target.value.toUpperCase() })}
            placeholder={isCNPJ ? 'EMPRESA LTDA' : 'NOME COMPLETO'}
            className={errors.razao_social ? 'border-destructive' : ''}
          />
          {errors.razao_social && (
            <p className="text-sm text-destructive">{errors.razao_social}</p>
          )}
        </div>

        {/* Nome Fantasia (only for CNPJ) */}
        {isCNPJ && (
          <div className="space-y-2">
            <Label htmlFor="nome_fantasia">Nome Fantasia</Label>
            <Input
              id="nome_fantasia"
              value={data.nome_fantasia || ''}
              onChange={(e) => onUpdate({ nome_fantasia: e.target.value.toUpperCase() })}
              placeholder="NOME FANTASIA"
            />
          </div>
        )}

        {/* Inscrição Estadual */}
        <div className="space-y-2">
          <Label htmlFor="inscricao_estadual">Inscrição Estadual</Label>
          <Input
            id="inscricao_estadual"
            value={data.inscricao_estadual || ''}
            onChange={(e) => onUpdate({ inscricao_estadual: e.target.value.replace(/\D/g, '') })}
            placeholder="Deixe em branco se isento"
          />
        </div>

        {/* Regime Tributário */}
        <div className="space-y-2">
          <Label>Regime Tributário *</Label>
          <Select
            value={data.regime_tributario}
            onValueChange={(value) => onUpdate({ regime_tributario: value })}
          >
            <SelectTrigger className={errors.regime_tributario ? 'border-destructive' : ''}>
              <SelectValue placeholder="Selecione o regime" />
            </SelectTrigger>
            <SelectContent>
              {REGIME_TRIBUTARIO_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.regime_tributario && (
            <p className="text-sm text-destructive">{errors.regime_tributario}</p>
          )}
        </div>

        {/* CNAE (only for CNPJ) */}
        {isCNPJ && (
          <div className="space-y-2">
            <Label htmlFor="cnae_principal">CNAE Principal</Label>
            <Input
              id="cnae_principal"
              value={data.cnae_principal || ''}
              onChange={(e) => onUpdate({ cnae_principal: e.target.value.replace(/\D/g, '') })}
              placeholder="4930-2/02"
              maxLength={9}
            />
            <p className="text-xs text-muted-foreground">
              Ex: 4930-2/02 (Transporte rodoviário de carga)
            </p>
          </div>
        )}

        {/* Endereço */}
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>UF *</Label>
            <Select
              value={data.endereco_uf}
              onValueChange={(value) => onUpdate({ endereco_uf: value })}
            >
              <SelectTrigger className={errors.endereco_uf ? 'border-destructive' : ''}>
                <SelectValue placeholder="UF" />
              </SelectTrigger>
              <SelectContent>
                {UF_OPTIONS.map((uf) => (
                  <SelectItem key={uf} value={uf}>
                    {uf}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.endereco_uf && (
              <p className="text-sm text-destructive">{errors.endereco_uf}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="endereco_cidade">Cidade *</Label>
            <Input
              id="endereco_cidade"
              value={data.endereco_cidade || ''}
              onChange={(e) => onUpdate({ endereco_cidade: e.target.value.toUpperCase() })}
              placeholder="CIDADE"
              className={errors.endereco_cidade ? 'border-destructive' : ''}
            />
            {errors.endereco_cidade && (
              <p className="text-sm text-destructive">{errors.endereco_cidade}</p>
            )}
          </div>
        </div>

        {/* Email Fiscal */}
        <div className="space-y-2">
          <Label htmlFor="email_fiscal">E-mail para documentos fiscais</Label>
          <Input
            id="email_fiscal"
            type="email"
            value={data.email_fiscal || ''}
            onChange={(e) => onUpdate({ email_fiscal: e.target.value.toLowerCase() })}
            placeholder="fiscal@empresa.com"
          />
        </div>
      </div>

      <div className="flex gap-4 pt-4">
        <Button variant="outline" onClick={onBack} disabled={loading || localLoading}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <Button onClick={handleSubmit} className="flex-1" disabled={loading || localLoading}>
          {(loading || localLoading) ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              Continuar
              <ArrowRight className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
