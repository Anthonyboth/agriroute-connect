/**
 * Regras de Aptidão Fiscal por Tipo de Usuário
 * 
 * FONTE DE VERDADE CORRETA sobre quem pode emitir o quê
 * Atualizado conforme orientação SEFAZ-MT (05/02/2026)
 * 
 * ⚠️ MEI geralmente emite NF-a (NFA) e não é obrigado a emitir NF-e
 */

import { DocumentType } from './fiscal-requirements';

// Tipos de perfil fiscal
export type FiscalProfileType = 
  | 'PRODUTOR_RURAL'
  | 'TAC_MEI'           // Transportador Autônomo como MEI
  | 'TAC_AUTONOMO'      // Transportador Autônomo PF não-MEI
  | 'TRANSPORTADORA'    // ETC - Empresa de Transporte de Carga
  | 'PRESTADOR_SERVICOS'
  | 'MEI_COMERCIO'
  | 'MEI_SERVICOS'
  | 'EMPRESA_GERAL';

// Status de elegibilidade para cada documento
export type EligibilityStatus = 
  | 'PERMITIDO'         // ✅ Pode emitir normalmente
  | 'DEPENDE'           // ⚠️ Depende de credenciamento/condições
  | 'NAO_APLICAVEL'     // ➖ Não se aplica ao perfil
  | 'VOLUNTARIO'        // 🔄 Não obrigatório, mas pode se credenciar
  | 'RECOMENDADO_NFA';  // 📋 Deve usar NFA ao invés de NF-e

export interface DocumentEligibility {
  docType: DocumentType | 'NFA';
  status: EligibilityStatus;
  label: string;
  description: string;
  requirements?: string[];
  warningMessage?: string;
  recommendedAlternative?: string;
  links?: { label: string; url: string }[];
}

export interface ProfileEligibility {
  profileType: FiscalProfileType;
  label: string;
  description: string;
  documents: DocumentEligibility[];
  generalNotes: string[];
}

// ============= REGRAS DE ELEGIBILIDADE POR PERFIL =============

export const PROFILE_ELIGIBILITY: ProfileEligibility[] = [
  {
    profileType: 'MEI_COMERCIO',
    label: 'MEI (Comércio)',
    description: 'Microempreendedor Individual com atividade de comércio',
    documents: [
      {
        docType: 'NFA',
        status: 'PERMITIDO',
        label: 'NF-a (Nota Fiscal Avulsa)',
        description: 'MEI pode emitir NFA diretamente no portal SEFAZ-MT sem necessidade de credenciamento específico.',
        links: [
          { label: 'Portal NFA SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
        ],
      },
      {
        docType: 'NFE',
        status: 'DEPENDE',
        label: 'NF-e (Nota Fiscal Eletrônica)',
        description: 'MEI NÃO é obrigado a emitir NF-e. Pode ser voluntário, mas exige Inscrição Estadual (IE) ativa e credenciamento SEFAZ.',
        warningMessage: 'MEI geralmente emite NF-a (NFA). NF-e exige credenciamento e IE, não é garantido.',
        requirements: [
          'Inscrição Estadual (IE) ativa',
          'Credenciamento como emissor na SEFAZ',
          'Certificado Digital A1',
          'CNAE compatível com venda de mercadorias',
        ],
        recommendedAlternative: 'Recomendamos usar NF-a (NFA) que é mais simples para MEI.',
      },
      {
        docType: 'CTE',
        status: 'NAO_APLICAVEL',
        label: 'CT-e (Conhecimento de Transporte)',
        description: 'Não se aplica a MEI de comércio.',
      },
      {
        docType: 'MDFE',
        status: 'NAO_APLICAVEL',
        label: 'MDF-e (Manifesto)',
        description: 'Não se aplica a MEI de comércio.',
      },
      {
        docType: 'NFSE',
        status: 'NAO_APLICAVEL',
        label: 'NFS-e (Nota de Serviço)',
        description: 'MEI de comércio não emite NFS-e (apenas serviços).',
      },
      {
        docType: 'GTA',
        status: 'NAO_APLICAVEL',
        label: 'GT-A (Guia de Trânsito Animal)',
        description: 'Não se aplica.',
      },
    ],
    generalNotes: [
      '⚠️ MEI NÃO é obrigado a emitir NF-e. Conforme atendimento SEFAZ-MT, MEI pode emitir NFA (Nota Fiscal Avulsa).',
      'Para emitir NF-e voluntariamente, é necessário ter IE ativa e credenciamento específico.',
      'A NFA é emitida diretamente no portal da SEFAZ, sem certificado digital.',
    ],
  },
  {
    profileType: 'TAC_MEI',
    label: 'TAC como MEI (Caminhoneiro)',
    description: 'Transportador Autônomo de Carga inscrito como MEI',
    documents: [
      {
        docType: 'NFA',
        status: 'PERMITIDO',
        label: 'NF-a (Nota Fiscal Avulsa)',
        description: 'Pode emitir NFA para vendas eventuais.',
      },
      {
        docType: 'NFE',
        status: 'DEPENDE',
        label: 'NF-e (Nota Fiscal Eletrônica)',
        description: 'Não obrigatório para TAC. Se quiser emitir, precisa de IE + credenciamento.',
        warningMessage: 'MEI caminhoneiro geralmente não precisa de NF-e própria.',
        requirements: [
          'Inscrição Estadual (IE) ativa',
          'Credenciamento SEFAZ',
          'Certificado Digital A1',
        ],
      },
      {
        docType: 'CTE',
        status: 'VOLUNTARIO',
        label: 'CT-e (Conhecimento de Transporte)',
        description: 'TAC MEI pode emitir CT-e de forma voluntária, mas não é obrigado. Exige credenciamento específico.',
        warningMessage: 'Não é obrigatório. Exige RNTRC, credenciamento CT-e e certificado digital.',
        requirements: [
          'RNTRC ativo na ANTT',
          'Credenciamento CT-e na SEFAZ',
          'Certificado Digital A1',
          'Prova Eletrônica ANTT (se aplicável)',
        ],
        links: [
          { label: 'Portal ANTT - RNTRC', url: 'https://www.gov.br/antt' },
          { label: 'Prova Eletrônica ANTT', url: 'https://provaeletronica.antt.gov.br/' },
        ],
      },
      {
        docType: 'MDFE',
        status: 'VOLUNTARIO',
        label: 'MDF-e (Manifesto)',
        description: 'Pode ser exigido dependendo do tipo de carga e destino. Voluntário para TAC MEI em muitos casos.',
        requirements: [
          'RNTRC ativo',
          'Credenciamento MDF-e SEFAZ',
          'Veículo e condutor cadastrados',
        ],
      },
      {
        docType: 'NFSE',
        status: 'NAO_APLICAVEL',
        label: 'NFS-e',
        description: 'Não se aplica a transporte de carga.',
      },
      {
        docType: 'GTA',
        status: 'DEPENDE',
        label: 'GT-A (Guia de Trânsito Animal)',
        description: 'Apenas se transportar animais vivos. Emitido pelo órgão de defesa agropecuária.',
      },
    ],
    generalNotes: [
      '⚠️ TAC MEI NÃO é obrigado a emitir CT-e/MDF-e. Pode ser voluntário.',
      'Para emitir CT-e, é necessário RNTRC + credenciamento + certificado digital.',
      'Verifique se o contratante exige documentos específicos.',
      'Para RNTRC, é necessário conta gov.br nível prata ou ouro.',
    ],
  },
  {
    profileType: 'TAC_AUTONOMO',
    label: 'TAC Autônomo (PF)',
    description: 'Transportador Autônomo de Carga pessoa física não-MEI',
    documents: [
      {
        docType: 'CTE',
        status: 'DEPENDE',
        label: 'CT-e (Conhecimento de Transporte)',
        description: 'Pode emitir CT-e se tiver credenciamento e RNTRC.',
        requirements: [
          'RNTRC ativo na ANTT',
          'Credenciamento CT-e na SEFAZ',
          'Certificado Digital A1 (e-CPF)',
        ],
      },
      {
        docType: 'MDFE',
        status: 'DEPENDE',
        label: 'MDF-e (Manifesto)',
        description: 'Pode ser exigido para transporte interestadual.',
        requirements: [
          'RNTRC ativo',
          'Credenciamento MDF-e',
          'Veículo e condutor cadastrados',
        ],
      },
      {
        docType: 'NFE',
        status: 'NAO_APLICAVEL',
        label: 'NF-e',
        description: 'TAC não emite NF-e de mercadorias próprias.',
      },
      {
        docType: 'NFA',
        status: 'NAO_APLICAVEL',
        label: 'NF-a',
        description: 'Não aplicável para serviço de transporte.',
      },
      {
        docType: 'NFSE',
        status: 'NAO_APLICAVEL',
        label: 'NFS-e',
        description: 'Transporte de carga não é serviço municipal.',
      },
      {
        docType: 'GTA',
        status: 'DEPENDE',
        label: 'GT-A',
        description: 'Apenas se transportar animais vivos.',
      },
    ],
    generalNotes: [
      'TAC autônomo precisa de RNTRC para operar legalmente.',
      'Prova Eletrônica da ANTT pode ser exigida para renovação.',
    ],
  },
  {
    profileType: 'TRANSPORTADORA',
    label: 'Transportadora (ETC)',
    description: 'Empresa de Transporte de Carga (pessoa jurídica)',
    documents: [
      {
        docType: 'CTE',
        status: 'PERMITIDO',
        label: 'CT-e (Conhecimento de Transporte)',
        description: 'Documento principal para faturamento do frete. Obrigatório para ETCs.',
        requirements: [
          'CNPJ ativo',
          'Inscrição Estadual de transporte',
          'RNTRC ativo',
          'Credenciamento CT-e SEFAZ',
          'Certificado Digital A1',
        ],
      },
      {
        docType: 'MDFE',
        status: 'PERMITIDO',
        label: 'MDF-e (Manifesto)',
        description: 'Obrigatório para transporte interestadual e agrupamento de CT-es.',
        requirements: [
          'Credenciamento MDF-e SEFAZ',
          'Veículos e condutores cadastrados',
        ],
      },
      {
        docType: 'NFE',
        status: 'DEPENDE',
        label: 'NF-e',
        description: 'Apenas se a transportadora também vender mercadorias próprias.',
        warningMessage: 'Transportadora não vende mercadorias, apenas fatura transporte via CT-e.',
      },
      {
        docType: 'NFA',
        status: 'NAO_APLICAVEL',
        label: 'NF-a',
        description: 'Não aplicável para empresas.',
      },
      {
        docType: 'NFSE',
        status: 'NAO_APLICAVEL',
        label: 'NFS-e',
        description: 'Transporte de carga é tributado via ICMS (CT-e), não ISS.',
      },
      {
        docType: 'GTA',
        status: 'DEPENDE',
        label: 'GT-A',
        description: 'Apenas para transporte de animais vivos.',
      },
    ],
    generalNotes: [
      'ETC emite CT-e para faturar o serviço de transporte.',
      'MDF-e é obrigatório para transporte interestadual.',
      'RNTRC é obrigatório para operar legalmente.',
    ],
  },
  {
    profileType: 'PRODUTOR_RURAL',
    label: 'Produtor Rural',
    description: 'Produtor rural pessoa física ou jurídica',
    documents: [
      {
        docType: 'NFE',
        status: 'DEPENDE',
        label: 'NF-e Produtor',
        description: 'Produtor pode emitir NF-e de produtor se tiver IE e credenciamento.',
        requirements: [
          'Inscrição Estadual de produtor rural',
          'Credenciamento SEFAZ como emissor',
          'Certificado Digital A1',
        ],
      },
      {
        docType: 'NFA',
        status: 'PERMITIDO',
        label: 'NF-a (Nota Fiscal Avulsa)',
        description: 'Produtor pode emitir NFA no portal da SEFAZ.',
      },
      {
        docType: 'GTA',
        status: 'DEPENDE',
        label: 'GT-A (Guia de Trânsito Animal)',
        description: 'Obrigatório para transporte de animais vivos. Emitido pelo órgão de defesa agropecuária.',
        requirements: [
          'Cadastro no INDEA-MT (ou órgão estadual)',
          'Propriedade e rebanho cadastrados',
          'Vacinações em dia',
        ],
        links: [
          { label: 'INDEA-MT', url: 'http://www.indea.mt.gov.br/' },
        ],
      },
      {
        docType: 'CTE',
        status: 'NAO_APLICAVEL',
        label: 'CT-e',
        description: 'Produtor não emite CT-e (é o transportador que emite).',
      },
      {
        docType: 'MDFE',
        status: 'NAO_APLICAVEL',
        label: 'MDF-e',
        description: 'Produtor não emite MDF-e (é o transportador).',
      },
      {
        docType: 'NFSE',
        status: 'NAO_APLICAVEL',
        label: 'NFS-e',
        description: 'Produtor rural não emite NFS-e.',
      },
    ],
    generalNotes: [
      'Produtor rural pode usar NF-a ou NF-e de produtor dependendo do estado.',
      'GTA é obrigatório para movimentação de animais.',
      'Consulte o órgão de defesa agropecuária do seu estado.',
    ],
  },
  {
    profileType: 'PRESTADOR_SERVICOS',
    label: 'Prestador de Serviços',
    description: 'Prestador de serviços (mecânico, técnico, consultoria, etc.)',
    documents: [
      {
        docType: 'NFSE',
        status: 'DEPENDE',
        label: 'NFS-e (Nota de Serviço)',
        description: 'NFS-e é emitida pela prefeitura do município. Cada cidade tem seu sistema.',
        warningMessage: 'AgriRoute não emite NFS-e. Acesse o portal da sua prefeitura.',
        requirements: [
          'Cadastro na Prefeitura',
          'Alvará de funcionamento',
          'CNPJ ou CPF ativo',
        ],
      },
      {
        docType: 'NFE',
        status: 'DEPENDE',
        label: 'NF-e (Nota Fiscal Eletrônica)',
        description: 'Prestador de serviços pode emitir NF-e para venda de produtos ou materiais aplicados no serviço.',
        requirements: [
          'Inscrição Estadual (IE) ativa',
          'Credenciamento SEFAZ como emissor',
          'Certificado Digital A1',
          'CNAE compatível com venda de mercadorias/produtos',
        ],
      },
      {
        docType: 'NFA',
        status: 'DEPENDE',
        label: 'NF-a (Nota Fiscal Avulsa)',
        description: 'Pode usar NF-a para vendas eventuais de produtos.',
      },
      {
        docType: 'CTE',
        status: 'NAO_APLICAVEL',
        label: 'CT-e',
        description: 'Não aplicável para prestadores de serviço (apenas transportadores).',
      },
      {
        docType: 'MDFE',
        status: 'NAO_APLICAVEL',
        label: 'MDF-e',
        description: 'Não aplicável.',
      },
      {
        docType: 'GTA',
        status: 'NAO_APLICAVEL',
        label: 'GT-A',
        description: 'Não aplicável.',
      },
    ],
    generalNotes: [
      'Para serviços puros, emita NFS-e pela prefeitura.',
      'Para venda de produtos/materiais, pode usar NF-e ou NF-a.',
      'AgriRoute não integra com sistemas municipais de NFS-e.',
    ],
  },
];

// ============= FUNÇÕES AUXILIARES =============

/**
 * Retorna as regras de elegibilidade para um perfil
 */
export function getProfileEligibility(profileType: FiscalProfileType): ProfileEligibility | undefined {
  return PROFILE_ELIGIBILITY.find(p => p.profileType === profileType);
}

/**
 * Verifica se um perfil pode emitir determinado documento
 */
export function canEmitDocument(
  profileType: FiscalProfileType, 
  docType: DocumentType | 'NFA'
): EligibilityStatus {
  const profile = getProfileEligibility(profileType);
  if (!profile) return 'NAO_APLICAVEL';
  
  const doc = profile.documents.find(d => d.docType === docType);
  return doc?.status || 'NAO_APLICAVEL';
}

/**
 * Mapeia role do sistema para FiscalProfileType
 */
export function mapRoleToFiscalProfile(
  role: string | undefined,
  isMei: boolean = false
): FiscalProfileType {
  switch (role) {
    case 'PRODUTOR':
      return 'PRODUTOR_RURAL';
    case 'MOTORISTA':
      return isMei ? 'TAC_MEI' : 'TAC_AUTONOMO';
    case 'TRANSPORTADORA':
      return 'TRANSPORTADORA';
    case 'PRESTADOR_SERVICOS':
      return 'PRESTADOR_SERVICOS';
    default:
      return isMei ? 'MEI_COMERCIO' : 'EMPRESA_GERAL';
  }
}

/**
 * Retorna cor do badge por status
 */
export function getStatusBadgeVariant(status: EligibilityStatus): 'default' | 'secondary' | 'destructive' | 'outline' {
  switch (status) {
    case 'PERMITIDO':
      return 'default';
    case 'DEPENDE':
    case 'VOLUNTARIO':
      return 'secondary';
    case 'NAO_APLICAVEL':
      return 'outline';
    case 'RECOMENDADO_NFA':
      return 'default';
    default:
      return 'outline';
  }
}

/**
 * Retorna label amigável do status
 */
export function getStatusLabel(status: EligibilityStatus): string {
  switch (status) {
    case 'PERMITIDO':
      return '✅ Permitido';
    case 'DEPENDE':
      return '⚠️ Depende';
    case 'NAO_APLICAVEL':
      return '➖ Não aplicável';
    case 'VOLUNTARIO':
      return '🔄 Voluntário';
    case 'RECOMENDADO_NFA':
      return '📋 Use NF-a';
    default:
      return status;
  }
}

/**
 * Retorna o label amigável do perfil fiscal (sem underscores)
 */
export function getProfileLabel(profileType: FiscalProfileType): string {
  const profile = getProfileEligibility(profileType);
  return profile?.label || profileType.replace(/_/g, ' ');
}
