import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, ArrowLeft, Loader2, Search } from 'lucide-react';
import { RegisterIssuerData, useFiscalIssuer } from '@/hooks/useFiscalIssuer';
import { cn } from '@/lib/utils';
import { isValidDocument, formatDocument, getDocumentType } from '@/utils/document';
import { toast } from 'sonner';
import { usePrefilledUserData } from '@/hooks/usePrefilledUserData';
import { ZipCodeService } from '@/services/zipCodeService';
import { supabase } from '@/integrations/supabase/client';

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
  const { loading, registerIssuer, updateIssuer, issuer } = useFiscalIssuer();
  const { fiscal: prefilledFiscal, personal: prefilledPersonal, loading: prefillLoading } = usePrefilledUserData();
  const [localLoading, setLocalLoading] = useState(false);
  const [cepLoading, setCepLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [hasPrefilled, setHasPrefilled] = useState(false);

  // ✅ BUSCA AUTOMÁTICA DE ENDEREÇO E CÓDIGO IBGE PELO CEP
  const fetchAddressByCep = useCallback(async (cep: string) => {
    const cleanCep = cep.replace(/\D/g, '');
    if (cleanCep.length !== 8) return;
    
    setCepLoading(true);
    try {
      if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] Buscando endereço pelo CEP:', cleanCep);
      
      // Buscar endereço via ZipCodeService
      const result = await ZipCodeService.searchZipCode(cleanCep);
      
      if (result) {
        if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] Endereço encontrado:', result);
        
        // Buscar código IBGE da cidade na tabela cities
        let ibgeCode = '';
        if (result.city && result.state) {
          const { data: cityData } = await supabase
            .from('cities')
            .select('ibge_code')
            .ilike('name', result.city)
            .eq('state', result.state)
            .limit(1)
            .maybeSingle();
          
          if (cityData?.ibge_code) {
            ibgeCode = cityData.ibge_code;
            console.log('[FiscalOnboardingStep2] Código IBGE encontrado:', ibgeCode);
          } else {
            console.warn('[FiscalOnboardingStep2] Código IBGE não encontrado para:', result.city, result.state);
          }
        }
        
        // Atualizar formulário com dados encontrados
        const updates: Partial<RegisterIssuerData> = {};
        
        if (result.street && !data.endereco_logradouro) {
          updates.endereco_logradouro = result.street.toUpperCase();
        }
        if (result.neighborhood && !data.endereco_bairro) {
          updates.endereco_bairro = result.neighborhood.toUpperCase();
        }
        if (result.city && !data.endereco_cidade) {
          updates.endereco_cidade = result.city.toUpperCase();
        }
        if (result.state && !data.endereco_uf) {
          updates.endereco_uf = result.state.toUpperCase();
        }
        if (ibgeCode) {
          updates.endereco_ibge = ibgeCode;
        }
        
        if (Object.keys(updates).length > 0) {
          onUpdate(updates);
          toast.success('Endereço preenchido automaticamente');
        }
      } else {
        console.warn('[FiscalOnboardingStep2] CEP não encontrado:', cleanCep);
      }
    } catch (err) {
      console.error('[FiscalOnboardingStep2] Erro ao buscar CEP:', err);
    } finally {
      setCepLoading(false);
    }
  }, [data.endereco_logradouro, data.endereco_bairro, data.endereco_cidade, data.endereco_uf, onUpdate]);

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

    // ✅ Validação de endereço completo
    if (!data.endereco_cep) {
      newErrors.endereco_cep = 'CEP é obrigatório';
    } else if (data.endereco_cep.replace(/\D/g, '').length !== 8) {
      newErrors.endereco_cep = 'CEP inválido (8 dígitos)';
    }

    if (!data.endereco_logradouro) {
      newErrors.endereco_logradouro = 'Logradouro é obrigatório';
    }

    if (!data.endereco_numero) {
      newErrors.endereco_numero = 'Número é obrigatório';
    }

    if (!data.endereco_bairro) {
      newErrors.endereco_bairro = 'Bairro é obrigatório';
    }

    if (!data.endereco_cidade) {
      newErrors.endereco_cidade = 'Cidade é obrigatória';
    }

    if (!data.endereco_uf) {
      newErrors.endereco_uf = 'UF é obrigatória';
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
      // ✅ Buscar código IBGE se ainda não tiver
      let ibgeCode = data.endereco_ibge;
      if (!ibgeCode && data.endereco_cidade && data.endereco_uf) {
        if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] Buscando código IBGE antes de salvar...');
        const { data: cityData } = await supabase
          .from('cities')
          .select('ibge_code')
          .ilike('name', data.endereco_cidade)
          .eq('state', data.endereco_uf)
          .limit(1)
          .maybeSingle();
        
        if (cityData?.ibge_code) {
          ibgeCode = cityData.ibge_code;
          onUpdate({ endereco_ibge: ibgeCode });
        } else {
          console.warn('[FiscalOnboardingStep2] Código IBGE não encontrado! NF-e pode falhar.');
          toast.warning('Código IBGE do município não encontrado. Verifique o nome da cidade.');
        }
      }

      if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] Salvando dados cadastrais do emissor');

      // ✅ Garantir que o código IBGE está no objeto antes de salvar
      const dataWithIbge = { ...data, endereco_ibge: ibgeCode };

      // If issuer already exists, UPDATE the data instead of skipping
      if (issuer) {
        const success = await updateIssuer(dataWithIbge as RegisterIssuerData);
        if (success) {
          onNext();
        }
        return;
      }

      // Register new issuer
      const result = await registerIssuer(dataWithIbge as RegisterIssuerData);
      
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

        {/* Endereço Completo */}
        <div className="space-y-4">
          <h4 className="text-sm font-medium text-muted-foreground border-b pb-2">Endereço do Emissor</h4>
          
          {/* CEP com busca automática */}
          <div className="space-y-2">
            <Label htmlFor="endereco_cep">CEP *</Label>
            <div className="flex gap-2">
              <Input
                id="endereco_cep"
                value={data.endereco_cep || ''}
                onChange={(e) => {
                  const cep = e.target.value.replace(/\D/g, '');
                  const formatted = cep.length > 5 ? `${cep.slice(0, 5)}-${cep.slice(5, 8)}` : cep;
                  onUpdate({ endereco_cep: formatted });
                  
                  // Auto-buscar quando CEP completo
                  if (cep.length === 8) {
                    fetchAddressByCep(cep);
                  }
                }}
                onBlur={(e) => {
                  const cep = e.target.value.replace(/\D/g, '');
                  if (cep.length === 8) {
                    fetchAddressByCep(cep);
                  }
                }}
                placeholder="00000-000"
                maxLength={9}
                className={cn("flex-1", errors.endereco_cep ? 'border-destructive' : '')}
              />
              <Button 
                type="button" 
                variant="outline" 
                size="icon"
                onClick={() => fetchAddressByCep(data.endereco_cep || '')}
                disabled={cepLoading || (data.endereco_cep?.replace(/\D/g, '').length !== 8)}
              >
                {cepLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
            </div>
            {errors.endereco_cep && (
              <p className="text-sm text-destructive">{errors.endereco_cep}</p>
            )}
            {cepLoading && (
              <p className="text-xs text-muted-foreground">Buscando endereço...</p>
            )}
          </div>

          {/* Logradouro e Número */}
          <div className="grid grid-cols-3 gap-4">
            <div className="col-span-2 space-y-2">
              <Label htmlFor="endereco_logradouro">Logradouro *</Label>
              <Input
                id="endereco_logradouro"
                value={data.endereco_logradouro || ''}
                onChange={(e) => onUpdate({ endereco_logradouro: e.target.value.toUpperCase() })}
                placeholder="RUA, AVENIDA, ETC"
                className={errors.endereco_logradouro ? 'border-destructive' : ''}
              />
              {errors.endereco_logradouro && (
                <p className="text-sm text-destructive">{errors.endereco_logradouro}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco_numero">Número *</Label>
              <Input
                id="endereco_numero"
                value={data.endereco_numero || ''}
                onChange={(e) => onUpdate({ endereco_numero: e.target.value })}
                placeholder="123"
                className={errors.endereco_numero ? 'border-destructive' : ''}
              />
              {errors.endereco_numero && (
                <p className="text-sm text-destructive">{errors.endereco_numero}</p>
              )}
            </div>
          </div>

          {/* Complemento e Bairro */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endereco_complemento">Complemento</Label>
              <Input
                id="endereco_complemento"
                value={data.endereco_complemento || ''}
                onChange={(e) => onUpdate({ endereco_complemento: e.target.value.toUpperCase() })}
                placeholder="SALA 101, BLOCO A"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endereco_bairro">Bairro *</Label>
              <Input
                id="endereco_bairro"
                value={data.endereco_bairro || ''}
                onChange={(e) => onUpdate({ endereco_bairro: e.target.value.toUpperCase() })}
                placeholder="BAIRRO"
                className={errors.endereco_bairro ? 'border-destructive' : ''}
              />
              {errors.endereco_bairro && (
                <p className="text-sm text-destructive">{errors.endereco_bairro}</p>
              )}
            </div>
          </div>

          {/* Cidade e UF */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="endereco_cidade">Cidade *</Label>
              <Input
                id="endereco_cidade"
                value={data.endereco_cidade || ''}
                onChange={(e) => onUpdate({ endereco_cidade: e.target.value.toUpperCase() })}
                onBlur={async (e) => {
                  // Buscar código IBGE quando cidade é preenchida manualmente
                  const cidade = e.target.value.trim();
                  const uf = data.endereco_uf;
                  if (cidade && uf && !data.endereco_ibge) {
                    const { data: cityData } = await supabase
                      .from('cities')
                      .select('ibge_code')
                      .ilike('name', cidade)
                      .eq('state', uf)
                      .limit(1)
                      .maybeSingle();
                    
                    if (cityData?.ibge_code) {
                      if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] IBGE encontrado para cidade:', cityData.ibge_code);
                      onUpdate({ endereco_ibge: cityData.ibge_code });
                    }
                  }
                }}
                placeholder="CIDADE"
                className={errors.endereco_cidade ? 'border-destructive' : ''}
              />
              {errors.endereco_cidade && (
                <p className="text-sm text-destructive">{errors.endereco_cidade}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>UF *</Label>
              <Select
                value={data.endereco_uf}
                onValueChange={async (value) => {
                  onUpdate({ endereco_uf: value });
                  
                  // Re-buscar código IBGE se cidade já preenchida
                  const cidade = data.endereco_cidade?.trim();
                  if (cidade && value && !data.endereco_ibge) {
                    const { data: cityData } = await supabase
                      .from('cities')
                      .select('ibge_code')
                      .ilike('name', cidade)
                      .eq('state', value)
                      .limit(1)
                      .maybeSingle();
                    
                    if (cityData?.ibge_code) {
                      if (import.meta.env.DEV) console.log('[FiscalOnboardingStep2] IBGE encontrado para UF:', cityData.ibge_code);
                      onUpdate({ endereco_ibge: cityData.ibge_code });
                    }
                  }
                }}
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
