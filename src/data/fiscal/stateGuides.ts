/**
 * Guias Fiscais por Estado (27 UFs)
 * 
 * FONTE: Links oficiais verificados
 * ATUALIZADO: 05/02/2026
 * 
 * ⚠️ NÃO inventar URLs - usar apenas links oficiais verificados
 * ⚠️ Estados sem link específico: orientar buscar no portal da SEFAZ
 */

export type StateUF = 
  | 'AC' | 'AL' | 'AP' | 'AM' | 'BA' | 'CE' | 'DF' | 'ES' | 'GO' 
  | 'MA' | 'MT' | 'MS' | 'MG' | 'PA' | 'PB' | 'PR' | 'PE' | 'PI' 
  | 'RJ' | 'RN' | 'RS' | 'RO' | 'RR' | 'SC' | 'SP' | 'SE' | 'TO';

export type DocumentType = 'NFE' | 'NFA' | 'CTE' | 'MDFE' | 'GTA' | 'NFSE';

export interface CredentialingStep {
  title: string;
  description: string;
  links?: { title: string; url: string }[];
}

export interface DocumentNote {
  whoCan: string;
  prerequisites: string[];
  commonErrors: string[];
  tips?: string[];
}

export interface StateGuide {
  uf: StateUF;
  displayName: string;
  officialPortals: { title: string; url: string }[];
  credentialing: {
    title: string;
    steps: CredentialingStep[];
  };
  documentNotes: Partial<Record<DocumentType, DocumentNote>>;
  specialNotes?: string[];
}

// ============= MATO GROSSO (MT) - COMPLETO =============
// Atualizado: 06/02/2026 - Informações confirmadas com atendimento SEFAZ-MT (SAC0055693)
const MT_GUIDE: StateGuide = {
  uf: 'MT',
  displayName: 'Mato Grosso',
  officialPortals: [
    { title: 'Portal SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
    { title: 'Credenciamento / Senha Contribuinte', url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811' },
    { title: 'Portal de Atendimento (e-PAC)', url: 'https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte' },
    { title: 'Webservice SEFAZ-MT (login com IE)', url: 'https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml' },
    { title: 'Consulta Situação Cadastral', url: 'https://www.sefaz.mt.gov.br/csc/consultapublica/' },
  ],
  credentialing: {
    title: 'Credenciamento SEFAZ-MT',
    steps: [
      {
        title: '1. Solicitação de Senha para Contribuinte',
        description: 'Acesse o portal SEFAZ-MT e escolha "Solicitação de Senha para Contribuinte". Informe seus dados (CNPJ/CPF, Inscrição Estadual).',
        links: [
          { title: 'Solicitar Senha', url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811' },
        ],
      },
      {
        title: '2. Aguardar e-mail com códigos',
        description: 'A SEFAZ enviará um e-mail com o Número de Solicitação e Código de Liberação. Pode levar algumas horas ou dias úteis.',
      },
      {
        title: '3. Liberação de Senha para Contribuinte',
        description: 'Volte ao portal e escolha "Liberação de Senha para Contribuinte". Preencha: Inscrição Estadual, Número de Solicitação, Código de Liberação e sua nova Senha.',
        links: [
          { title: 'Liberar Senha', url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811' },
        ],
      },
      {
        title: '4. Verificar credenciamento NF-e MEI',
        description: 'Acesse o Webservice SEFAZ-MT (não precisa de certificado). Faça login com sua Inscrição Estadual (IE) e a senha criada. Na "Consulta Genérica do Contribuinte", verifique a seção "CREDENCIAMENTOS" — lá aparece o credenciamento para emissão de NF-e MEI.',
        links: [
          { title: 'Webservice SEFAZ-MT (login com IE + senha)', url: 'https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml' },
          { title: 'Portal de Atendimento ao Contribuinte', url: 'https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte' },
        ],
      },
      {
        title: '5. Alternativa: e-PAC (requer e-CNPJ)',
        description: 'O portal e-PAC também permite consultar credenciamentos, mas exige certificado e-CNPJ da empresa para acesso. Use o Webservice (passo 4) se não tiver certificado.',
        links: [
          { title: 'Portal e-PAC (requer e-CNPJ)', url: 'https://www.sefaz.mt.gov.br/epac/' },
        ],
      },
    ],
  },
  documentNotes: {
    NFE: {
      whoCan: 'Empresas com IE ativa e credenciadas. MEI pode emitir voluntariamente se tiver IE e credenciamento.',
      prerequisites: [
        'Inscrição Estadual (IE) ativa no MT',
        'CNAE compatível com venda de mercadorias',
        'Credenciamento como emissor de NF-e na SEFAZ-MT',
        'Certificado Digital A1 válido',
      ],
      commonErrors: [
        'Erro 203: "Emitente não habilitado" - Falta credenciamento NF-e',
        'Erro 230: "IE do destinatário inválida"',
        'Erro 234: "Emitente credenciado, mas não habilitado"',
      ],
      tips: [
        'MEI NÃO é obrigado a emitir NF-e. Pode usar NF-a (Avulsa) no portal SEFAZ.',
        'Verifique seu credenciamento no Webservice SEFAZ-MT: login com IE + senha → Consulta Genérica → CREDENCIAMENTOS.',
        'O login do Webservice é a sua IE (não o CNPJ). A senha é a de contribuinte.',
      ],
    },
    NFA: {
      whoCan: 'Produtor rural, MEI, pequenos comerciantes sem emissão própria.',
      prerequisites: [
        'CPF ou CNPJ ativo',
        'Cadastro no portal SEFAZ-MT',
        'Não requer certificado digital',
      ],
      commonErrors: [
        'Dados cadastrais incompletos',
        'IE do produtor inválida ou suspensa',
      ],
      tips: [
        'NF-a é gratuita e emitida diretamente no portal SEFAZ-MT.',
        'MEI pode (e geralmente deve) usar NF-a ao invés de NF-e.',
      ],
    },
    CTE: {
      whoCan: 'Transportadoras (ETC), TAC credenciado. MEI caminhoneiro pode emitir voluntariamente.',
      prerequisites: [
        'RNTRC ativo na ANTT',
        'Inscrição Estadual de transporte no MT',
        'Credenciamento CT-e na SEFAZ-MT',
        'Certificado Digital A1',
      ],
      commonErrors: [
        'RNTRC vencido ou irregular',
        'Emissor não credenciado para CT-e',
        'Veículo não cadastrado',
      ],
      tips: [
        'TAC MEI não é obrigado a emitir CT-e. Emissão é voluntária.',
        'Para MEI, verifique se realmente precisa de CT-e próprio.',
      ],
    },
    MDFE: {
      whoCan: 'Transportadoras e TAC que emitem CT-e para transporte interestadual.',
      prerequisites: [
        'RNTRC ativo',
        'Credenciamento MDF-e na SEFAZ-MT',
        'Veículo e condutor cadastrados',
        'Certificado Digital A1',
      ],
      commonErrors: [
        'CT-e não autorizado (MDF-e exige CT-e válido)',
        'Condutor não cadastrado no sistema',
      ],
    },
    GTA: {
      whoCan: 'Produtores rurais que movimentam animais vivos.',
      prerequisites: [
        'Cadastro no INDEA-MT (Instituto de Defesa Agropecuária)',
        'Propriedade e rebanho cadastrados',
        'Vacinações em dia (aftosa, brucelose, etc.)',
      ],
      commonErrors: [
        'Propriedade não cadastrada no INDEA',
        'Vacinação não registrada ou vencida',
      ],
      tips: [
        'GTA é emitida pelo INDEA-MT, não pela SEFAZ.',
        'Procure a unidade do INDEA mais próxima.',
      ],
    },
  },
  specialNotes: [
    'MT tem regras específicas para MEI. Consulte a SEFAZ-MT em caso de dúvida.',
    'Para verificar seu credenciamento: Webservice SEFAZ-MT → login com IE + senha → Consulta Genérica → CREDENCIAMENTOS.',
    'O portal e-PAC exige e-CNPJ (certificado). Para consulta sem certificado, use o Webservice.',
    'Login do Webservice: sua Inscrição Estadual (IE). Senha: a senha de contribuinte.',
  ],
};

// ============= TEMPLATE PARA OUTROS ESTADOS =============
// ⚠️ IMPORTANTE: não inventar URLs. Para estados sem link confirmado,
// mostramos apenas o Portal Nacional NF-e e orientamos o usuário a buscar
// o portal oficial da SEFAZ do seu estado.
const createPlaceholderGuide = (uf: StateUF, displayName: string): StateGuide => ({
  uf,
  displayName,
  officialPortals: [
    { title: 'Portal Nacional NF-e', url: 'https://www.nfe.fazenda.gov.br/' },
  ],
  credentialing: {
    title: `Credenciamento SEFAZ-${uf}`,
    steps: [
      {
        title: '1. Acesse o site oficial da SEFAZ do seu estado',
        description: `No momento, ainda não temos o link direto confirmado para a SEFAZ-${uf}. Procure por “portal de serviços”, “e-PAC” ou “credenciamento NF-e” no site oficial da SEFAZ do seu estado.`,
      },
      {
        title: '2. Procure por “Credenciamento” / “Habilitação” / “Emissão de NF-e”',
        description: 'Cada UF tem regras e etapas próprias. Siga o passo a passo do portal oficial.',
      },
      {
        title: '3. Se tiver dúvidas, fale com o suporte',
        description: 'Nós te ajudamos a identificar o caminho correto no seu estado.',
      },
    ],
  },
  documentNotes: {
    NFE: {
      whoCan: 'Empresas com IE ativa e credenciadas na SEFAZ do estado.',
      prerequisites: [
        'Inscrição Estadual (IE) ativa',
        'Credenciamento na SEFAZ',
        'Certificado Digital A1',
      ],
      commonErrors: [
        'Emitente não habilitado',
        'IE inválida',
      ],
    },
    CTE: {
      whoCan: 'Transportadoras e TAC credenciados.',
      prerequisites: [
        'RNTRC ativo',
        'Credenciamento CT-e na SEFAZ',
        'Certificado Digital A1',
      ],
      commonErrors: [
        'RNTRC vencido',
        'Emissor não credenciado',
      ],
    },
  },
  specialNotes: [
    `Links oficiais da SEFAZ-${uf} serão atualizados conforme confirmação.`,
    'Dica: pesquise no Google por “SEFAZ ' + uf + ' credenciamento NF-e”.',
  ],
});

// ============= TODOS OS ESTADOS =============
export const STATE_GUIDES: StateGuide[] = [
  createPlaceholderGuide('AC', 'Acre'),
  createPlaceholderGuide('AL', 'Alagoas'),
  createPlaceholderGuide('AP', 'Amapá'),
  createPlaceholderGuide('AM', 'Amazonas'),
  createPlaceholderGuide('BA', 'Bahia'),
  createPlaceholderGuide('CE', 'Ceará'),
  createPlaceholderGuide('DF', 'Distrito Federal'),
  createPlaceholderGuide('ES', 'Espírito Santo'),
  createPlaceholderGuide('GO', 'Goiás'),
  createPlaceholderGuide('MA', 'Maranhão'),
  MT_GUIDE, // MT completo
  createPlaceholderGuide('MS', 'Mato Grosso do Sul'),
  createPlaceholderGuide('MG', 'Minas Gerais'),
  createPlaceholderGuide('PA', 'Pará'),
  createPlaceholderGuide('PB', 'Paraíba'),
  createPlaceholderGuide('PR', 'Paraná'),
  createPlaceholderGuide('PE', 'Pernambuco'),
  createPlaceholderGuide('PI', 'Piauí'),
  createPlaceholderGuide('RJ', 'Rio de Janeiro'),
  createPlaceholderGuide('RN', 'Rio Grande do Norte'),
  createPlaceholderGuide('RS', 'Rio Grande do Sul'),
  createPlaceholderGuide('RO', 'Rondônia'),
  createPlaceholderGuide('RR', 'Roraima'),
  createPlaceholderGuide('SC', 'Santa Catarina'),
  createPlaceholderGuide('SP', 'São Paulo'),
  createPlaceholderGuide('SE', 'Sergipe'),
  createPlaceholderGuide('TO', 'Tocantins'),
];

// ============= FUNÇÕES AUXILIARES =============

export function getStateGuide(uf: StateUF): StateGuide | undefined {
  return STATE_GUIDES.find(g => g.uf === uf);
}

export function getStateGuideOrDefault(uf: string): StateGuide {
  const guide = STATE_GUIDES.find(g => g.uf === uf);
  return guide || createPlaceholderGuide(uf as StateUF, uf);
}

export function hasCompleteGuide(uf: StateUF): boolean {
  return uf === 'MT'; // Adicionar outros estados conforme forem completados
}

export const ALL_UFS: StateUF[] = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO', 
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI', 
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO'
];
