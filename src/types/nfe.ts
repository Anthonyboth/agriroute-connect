export interface NFeDocument {
  id: string;
  access_key: string;
  issuer_cnpj: string;
  issuer_name: string;
  number: string;
  series: string;
  issue_date: string;
  value: number;
  status: 'pending' | 'manifested' | 'rejected' | 'cancelled';
  manifestation_type?: ManifestationType;
  manifestation_date?: string;
  manifestation_justification?: string;
  manifestation_mode?: 'assisted' | 'legacy';
  portal_redirect_at?: string;
  user_declaration_at?: string;
  freight_id?: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

// Tipos de manifestação conforme padrão SEFAZ
export type ManifestationType = 
  | 'ciencia'              // 210210 - Ciência da Operação
  | 'confirmacao'          // 210200 - Confirmação da Operação  
  | 'desconhecimento'      // 210220 - Desconhecimento da Operação
  | 'nao_realizada';       // 210240 - Operação Não Realizada

// Tipos legados (para compatibilidade)
export type LegacyManifestationType = 
  | 'operation_confirmed'
  | 'operation_unknown' 
  | 'rejection'
  | 'cancellation';

// Mapeamento de tipos legados para novos
export const LEGACY_TO_NEW_TYPE: Record<LegacyManifestationType, ManifestationType> = {
  'operation_confirmed': 'confirmacao',
  'operation_unknown': 'desconhecimento',
  'rejection': 'nao_realizada',
  'cancellation': 'nao_realizada',
};

// Códigos SEFAZ para cada tipo de manifestação
export const MANIFESTATION_EVENT_CODES: Record<ManifestationType, string> = {
  'ciencia': '210210',
  'confirmacao': '210200',
  'desconhecimento': '210220',
  'nao_realizada': '210240',
};

export interface NFeManifestationPayload {
  access_key: string;
  manifestation_type: ManifestationType;
  justification?: string;
  freight_id?: string;
}

export interface NFeFilter {
  status?: string;
  freight_id?: string;
}

// Informações sobre cada tipo de manifestação
export interface ManifestationOption {
  value: ManifestationType;
  label: string;
  description: string;
  icon: string;
  color: string;
  requiresJustification: boolean;
  sefazCode: string;
}

export const MANIFESTATION_OPTIONS: ManifestationOption[] = [
  {
    value: 'ciencia',
    label: 'Ciência da Operação',
    description: 'Declara que você tomou conhecimento da nota fiscal. Não confirma a operação.',
    icon: 'eye',
    color: 'text-blue-600',
    requiresJustification: false,
    sefazCode: '210210',
  },
  {
    value: 'confirmacao',
    label: 'Confirmação da Operação',
    description: 'Confirma que a operação foi realizada conforme descrito na NF-e.',
    icon: 'check-circle',
    color: 'text-success',
    requiresJustification: false,
    sefazCode: '210200',
  },
  {
    value: 'desconhecimento',
    label: 'Desconhecimento da Operação',
    description: 'Declara que não reconhece a operação descrita na NF-e.',
    icon: 'help-circle',
    color: 'text-warning',
    requiresJustification: true,
    sefazCode: '210220',
  },
  {
    value: 'nao_realizada',
    label: 'Operação Não Realizada',
    description: 'Declara que a operação foi emitida mas não foi concluída.',
    icon: 'x-circle',
    color: 'text-destructive',
    requiresJustification: true,
    sefazCode: '210240',
  },
];
