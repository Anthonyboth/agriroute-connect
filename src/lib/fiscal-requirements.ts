/**
 * Requisitos Fiscais por UF e Tipo de Documento
 * Fonte de dados local para validação e checklist educativo
 */

export type DocumentType = 'NFE' | 'CTE' | 'MDFE' | 'GTA' | 'NFSE';
export type Severity = 'info' | 'warning' | 'blocker';
export type EvidenceType = 
  | 'A1' 
  | 'IE' 
  | 'CREDENCIAMENTO' 
  | 'RNTRC' 
  | 'VEICULO' 
  | 'CONDUTOR' 
  | 'CADASTRO_PREFEITURA' 
  | 'CADASTRO_MAPA'
  | 'CNPJ'
  | 'ENDERECO';

export interface OfficialLink {
  label: string;
  url: string;
}

export interface FAQ {
  q: string;
  a: string;
}

export interface FiscalRequirement {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  evidenceNeeded: boolean;
  evidenceType?: EvidenceType;
  officialLinks: OfficialLink[];
  tips: string[];
  faq: FAQ[];
}

export interface UFRequirements {
  uf: string;
  ufName: string;
  documents: {
    [key in DocumentType]?: FiscalRequirement[];
  };
  generalNotes: string[];
  sefazPortal: string;
  lastUpdated: string;
}

// ============= REQUISITOS POR TIPO DE DOCUMENTO =============

const NFE_BASE_REQUIREMENTS: FiscalRequirement[] = [
  {
    id: 'nfe-a1',
    title: 'Certificado Digital A1',
    description: 'Para emitir NF-e em produção, você precisa de um certificado digital A1 (.pfx/.p12) válido e com senha.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'A1',
    officialLinks: [
      { label: 'Portal NF-e Nacional', url: 'https://www.nfe.fazenda.gov.br/' },
      { label: 'Lista de Certificadoras', url: 'https://www.iti.gov.br/icp-brasil/estrutura' },
    ],
    tips: [
      'O certificado A1 tem validade de 1 ano',
      'Guarde a senha em local seguro',
      'O certificado deve estar no nome do CNPJ/CPF do emitente',
    ],
    faq: [
      { q: 'Onde compro um certificado A1?', a: 'Em qualquer certificadora credenciada pelo ITI (Instituto Nacional de TI), como Serasa, Certisign, etc.' },
      { q: 'Qual a diferença entre A1 e A3?', a: 'O A1 é um arquivo digital (.pfx), já o A3 é um cartão ou token físico. Usamos A1 por ser mais prático para integração.' },
    ],
  },
  {
    id: 'nfe-cnpj',
    title: 'CNPJ/CPF Ativo na Receita Federal',
    description: 'Seu CNPJ ou CPF deve estar ativo e regular na Receita Federal para emitir documentos fiscais.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CNPJ',
    officialLinks: [
      { label: 'Consulta CNPJ', url: 'https://solucoes.receita.fazenda.gov.br/Servicos/cnpjreva/cnpjreva_solicitacao.asp' },
      { label: 'Consulta CPF', url: 'https://servicos.receita.fazenda.gov.br/Servicos/CPF/ConsultaSituacao/ConsultaPublica.asp' },
    ],
    tips: [
      'Verifique se não há pendências cadastrais',
      'Mantenha o endereço atualizado na Receita',
    ],
    faq: [
      { q: 'Posso emitir NF-e como pessoa física?', a: 'Sim, produtores rurais com CPF podem emitir NF-e de produtor em alguns estados.' },
    ],
  },
  {
    id: 'nfe-endereco',
    title: 'Endereço Completo do Emitente',
    description: 'O endereço deve estar completo: logradouro, número, bairro, cidade, UF e CEP. O código IBGE da cidade é obrigatório.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'ENDERECO',
    officialLinks: [
      { label: 'Busca CEP Correios', url: 'https://buscacepinter.correios.com.br/app/endereco/index.php' },
      { label: 'Códigos IBGE', url: 'https://www.ibge.gov.br/explica/codigos-dos-municipios.php' },
    ],
    tips: [
      'Use sempre o CEP correto e atualizado',
      'O código IBGE é preenchido automaticamente quando você seleciona a cidade',
    ],
    faq: [
      { q: 'O que é código IBGE?', a: 'É um código numérico único que identifica cada município brasileiro. Usamos ele para garantir precisão no endereço.' },
    ],
  },
  {
    id: 'nfe-ie',
    title: 'Inscrição Estadual (IE)',
    description: 'A maioria dos estados exige Inscrição Estadual ativa para emissão de NF-e. Produtores rurais podem usar IE específica.',
    severity: 'warning',
    evidenceNeeded: true,
    evidenceType: 'IE',
    officialLinks: [
      { label: 'SINTEGRA Nacional', url: 'http://www.sintegra.gov.br/' },
    ],
    tips: [
      'Verifique se sua IE está ativa no SINTEGRA',
      'Alguns CNAEs exigem IE obrigatória',
    ],
    faq: [
      { q: 'MEI precisa de IE?', a: 'Depende da atividade. MEI de comércio geralmente precisa; MEI de serviços geralmente não.' },
    ],
  },
  {
    id: 'nfe-credenciamento',
    title: 'Credenciamento SEFAZ (Habilitação)',
    description: 'Além da IE, alguns estados exigem um credenciamento/habilitação específico para emitir NF-e. Sem isso, a emissão é rejeitada.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CREDENCIAMENTO',
    officialLinks: [],
    tips: [
      'O credenciamento pode demorar alguns dias úteis',
      'Geralmente é feito no portal da SEFAZ do seu estado',
      'Pode ser solicitado online na maioria dos estados',
    ],
    faq: [
      { q: 'Como sei se já estou credenciado?', a: 'Consulte no portal SEFAZ do seu estado ou tente emitir uma nota em homologação (teste).' },
    ],
  },
  {
    id: 'nfe-cnae',
    title: 'CNAE Compatível',
    description: 'O código CNAE do seu CNPJ deve ser compatível com a atividade de venda de mercadorias.',
    severity: 'warning',
    evidenceNeeded: false,
    officialLinks: [
      { label: 'Consulta CNAE IBGE', url: 'https://cnae.ibge.gov.br/' },
    ],
    tips: [
      'MEI tem restrições de CNAE para NF-e',
      'Pode ser necessário alterar o CNAE no CNPJ',
    ],
    faq: [
      { q: 'Posso emitir NF-e de qualquer produto?', a: 'Depende do seu CNAE. Se você vende algo fora do seu CNAE registrado, pode haver problemas fiscais.' },
    ],
  },
];

const CTE_BASE_REQUIREMENTS: FiscalRequirement[] = [
  {
    id: 'cte-a1',
    title: 'Certificado Digital A1',
    description: 'Obrigatório para emissão de CT-e em produção.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'A1',
    officialLinks: [
      { label: 'Portal CT-e', url: 'https://www.cte.fazenda.gov.br/' },
    ],
    tips: [
      'O mesmo certificado A1 usado para NF-e pode ser usado para CT-e',
    ],
    faq: [],
  },
  {
    id: 'cte-ie',
    title: 'Inscrição Estadual Ativa',
    description: 'Para emitir CT-e, é obrigatório ter Inscrição Estadual ativa como transportador.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'IE',
    officialLinks: [
      { label: 'SINTEGRA Nacional', url: 'http://www.sintegra.gov.br/' },
    ],
    tips: [
      'A IE deve ser de atividade de transporte',
    ],
    faq: [],
  },
  {
    id: 'cte-credenciamento',
    title: 'Credenciamento CT-e na SEFAZ',
    description: 'Além da IE, você precisa estar credenciado especificamente para emissão de CT-e.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CREDENCIAMENTO',
    officialLinks: [],
    tips: [
      'O credenciamento CT-e é separado do credenciamento NF-e',
    ],
    faq: [],
  },
  {
    id: 'cte-rntrc',
    title: 'RNTRC (Registro Nacional de Transportadores)',
    description: 'O RNTRC é obrigatório para transportadores rodoviários de carga.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'RNTRC',
    officialLinks: [
      { label: 'Portal ANTT', url: 'https://www.gov.br/antt' },
    ],
    tips: [
      'O RNTRC é emitido pela ANTT',
      'Mantenha sempre atualizado',
    ],
    faq: [
      { q: 'Motorista autônomo precisa de RNTRC?', a: 'Sim, mesmo autônomos precisam de RNTRC para operar legalmente.' },
    ],
  },
];

const MDFE_BASE_REQUIREMENTS: FiscalRequirement[] = [
  {
    id: 'mdfe-a1',
    title: 'Certificado Digital A1',
    description: 'Obrigatório para emissão de MDF-e em produção.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'A1',
    officialLinks: [
      { label: 'Portal MDF-e', url: 'https://mdfe-portal.sefaz.rs.gov.br/' },
    ],
    tips: [],
    faq: [],
  },
  {
    id: 'mdfe-credenciamento',
    title: 'Credenciamento MDF-e na SEFAZ',
    description: 'Você precisa estar credenciado especificamente para emissão de MDF-e.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CREDENCIAMENTO',
    officialLinks: [],
    tips: [
      'O credenciamento MDF-e pode ser diferente do CT-e',
    ],
    faq: [],
  },
  {
    id: 'mdfe-veiculo',
    title: 'Veículo Cadastrado',
    description: 'O veículo que realizará o transporte deve estar cadastrado com placa, RENAVAM e dados completos.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'VEICULO',
    officialLinks: [],
    tips: [
      'Cadastre todos os veículos que você utiliza',
    ],
    faq: [],
  },
  {
    id: 'mdfe-condutor',
    title: 'Condutor Cadastrado',
    description: 'O motorista/condutor deve estar cadastrado com CPF e CNH válida.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CONDUTOR',
    officialLinks: [],
    tips: [
      'A CNH deve estar válida e compatível com o veículo',
    ],
    faq: [],
  },
  {
    id: 'mdfe-rntrc',
    title: 'RNTRC (Registro Nacional de Transportadores)',
    description: 'Obrigatório para transportadores rodoviários de carga.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'RNTRC',
    officialLinks: [
      { label: 'Portal ANTT', url: 'https://www.gov.br/antt' },
    ],
    tips: [],
    faq: [],
  },
];

const GTA_BASE_REQUIREMENTS: FiscalRequirement[] = [
  {
    id: 'gta-cadastro-mapa',
    title: 'Cadastro no Órgão Estadual / MAPA',
    description: 'A GTA (Guia de Trânsito Animal) é emitida pelo órgão de defesa agropecuária estadual, vinculado ao MAPA. Não é SEFAZ.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CADASTRO_MAPA',
    officialLinks: [
      { label: 'MAPA - Ministério da Agricultura', url: 'https://www.gov.br/agricultura' },
    ],
    tips: [
      'Cada estado tem seu órgão específico (ex: INDEA-MT, IMA-MG)',
      'O processo é diferente de NF-e/CT-e',
    ],
    faq: [
      { q: 'GTA é documento fiscal?', a: 'Não no sentido tributário. GTA é documento de controle sanitário para trânsito de animais.' },
    ],
  },
  {
    id: 'gta-propriedade',
    title: 'Propriedade Rural Cadastrada',
    description: 'Sua propriedade e rebanho devem estar cadastrados no órgão de defesa agropecuária.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CADASTRO_MAPA',
    officialLinks: [],
    tips: [
      'Mantenha o cadastro do rebanho atualizado',
      'Vacinações em dia são exigidas para emissão de GTA',
    ],
    faq: [],
  },
];

const NFSE_BASE_REQUIREMENTS: FiscalRequirement[] = [
  {
    id: 'nfse-cadastro-prefeitura',
    title: 'Cadastro na Prefeitura',
    description: 'NFS-e é emitida pela Prefeitura do seu município. Cada cidade tem seu próprio sistema.',
    severity: 'blocker',
    evidenceNeeded: true,
    evidenceType: 'CADASTRO_PREFEITURA',
    officialLinks: [],
    tips: [
      'Procure o portal da prefeitura da sua cidade',
      'Cada município tem regras e sistemas diferentes',
      'MEI geralmente emite NFS-e',
    ],
    faq: [
      { q: 'NFS-e e NF-e são a mesma coisa?', a: 'Não. NFS-e é para serviços (municipal). NF-e é para mercadorias (estadual).' },
    ],
  },
];

// ============= REQUISITOS POR UF =============

// Links oficiais SEFAZ-MT para credenciamento
// Atualizado: 06/02/2026 - Confirmado com atendimento SEFAZ-MT (SAC0055693)
const MT_SEFAZ_CREDENCIAMENTO_NFE = {
  label: 'Credenciamento NF-e SEFAZ-MT (OFICIAL)',
  url: 'https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811',
};

const MT_SEFAZ_PORTAL_CONTRIBUINTE = {
  label: 'Portal de Atendimento ao Contribuinte',
  url: 'https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte',
};

const MT_SEFAZ_EPAC = {
  label: 'Portal e-PAC MT (requer e-CNPJ)',
  url: 'https://www.sefaz.mt.gov.br/epac/',
};

const MT_SEFAZ_WEBSERVICE = {
  label: 'Webservice SEFAZ-MT (login IE + senha)',
  url: 'https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml',
};

const MT_REQUIREMENTS: UFRequirements = {
  uf: 'MT',
  ufName: 'Mato Grosso',
  documents: {
    NFE: [
      ...NFE_BASE_REQUIREMENTS.map(req => {
        // Customização específica para credenciamento MT
        if (req.id === 'nfe-credenciamento') {
          return {
            ...req,
            title: 'Credenciamento NF-e SEFAZ-MT',
            description: 'Para emitir NF-e no Mato Grosso, você DEVE estar credenciado como emissor de NF-e na SEFAZ-MT. Sem este credenciamento, a emissão será REJEITADA (código 230 ou similar).',
            severity: 'blocker' as Severity,
            officialLinks: [
              MT_SEFAZ_CREDENCIAMENTO_NFE,
              MT_SEFAZ_WEBSERVICE,
              MT_SEFAZ_PORTAL_CONTRIBUINTE,
              MT_SEFAZ_EPAC,
            ],
            tips: [
              '1. Acesse o link oficial de Credenciamento SEFAZ-MT',
              '2. Solicite "Senha para Contribuinte"',
              '3. Aguarde e-mail da SEFAZ com instruções',
              '4. Acesse "Liberação de Senha para Contribuinte"',
              '5. Crie sua senha e conclua o credenciamento',
              '⚠️ O processo pode levar alguns dias úteis',
            ],
            faq: [
              { q: 'MEI pode emitir NF-e em MT?', a: 'MEI SÓ pode emitir NF-e se tiver Inscrição Estadual (IE) ativa. Caso contrário, utilize a Nota Fiscal Avulsa (NFA) no portal da SEFAZ-MT.' },
              { q: 'Como sei se já estou credenciado?', a: 'Acesse o Webservice SEFAZ-MT (não precisa de certificado). Login: sua Inscrição Estadual (IE). Senha: a senha de contribuinte. Em "Consulta Genérica do Contribuinte", verifique a seção "CREDENCIAMENTOS".' },
              { q: 'Erro 230 - O que significa?', a: 'Significa que seu emissor não está credenciado para NF-e. Siga os passos de credenciamento acima.' },
              { q: 'Qual a diferença entre e-PAC e Webservice?', a: 'O e-PAC requer certificado e-CNPJ da empresa. O Webservice só precisa da IE + senha do contribuinte.' },
            ],
          };
        }
        
        // Customização para Inscrição Estadual MT
        if (req.id === 'nfe-ie') {
          return {
            ...req,
            officialLinks: [
              { label: 'SINTEGRA-MT', url: 'http://www.sintegra.gov.br/' },
              { label: 'Consulta Cadastro SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
              ...req.officialLinks,
            ],
            tips: [
              ...req.tips,
              '⚠️ Em MT, a IE é obrigatória para emissão de NF-e de mercadorias',
              'MEI sem IE deve usar Nota Fiscal Avulsa (NFA)',
            ],
          };
        }
        
        return req;
      }),
      // Regra específica de senha contribuinte MT
      {
        id: 'nfe-mt-epac-senha',
        title: 'Senha de Contribuinte SEFAZ-MT',
        description: 'O Mato Grosso exige senha de contribuinte ativa para credenciamento e consulta de status. O login é feito com a Inscrição Estadual (IE) e a senha criada no portal.',
        severity: 'blocker',
        evidenceNeeded: true,
        evidenceType: 'CREDENCIAMENTO',
        officialLinks: [
          MT_SEFAZ_WEBSERVICE,
          MT_SEFAZ_PORTAL_CONTRIBUINTE,
          MT_SEFAZ_CREDENCIAMENTO_NFE,
        ],
        tips: [
          'A senha de contribuinte é diferente da senha do certificado digital',
          'O login no Webservice é feito com a IE (Inscrição Estadual), não com o CNPJ',
          'O portal e-PAC exige e-CNPJ (certificado). Use o Webservice se não tiver certificado',
          'Para verificar credenciamento: Webservice → Consulta Genérica → CREDENCIAMENTOS',
          'Mantenha a senha em local seguro',
        ],
        faq: [
          { q: 'Esqueci minha senha de contribuinte', a: 'Acesse o portal da SEFAZ-MT e utilize a opção de recuperação de senha.' },
          { q: 'Meu login é o CNPJ ou a IE?', a: 'No Webservice SEFAZ-MT, o login é a Inscrição Estadual (IE). No e-PAC, é o e-CNPJ (certificado digital).' },
        ],
      },
      // Nota Fiscal Avulsa para MEI
      {
        id: 'nfe-mt-nfa-mei',
        title: 'Nota Fiscal Avulsa (NFA) para MEI',
        description: 'MEI sem Inscrição Estadual deve emitir Nota Fiscal Avulsa (NFA) diretamente no portal da SEFAZ-MT, ao invés de NF-e.',
        severity: 'info',
        evidenceNeeded: false,
        officialLinks: [
          { label: 'Portal NFA SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
        ],
        tips: [
          'A NFA é indicada para MEIs que vendem mercadorias esporadicamente',
          'A emissão é feita diretamente no portal da SEFAZ-MT',
          'Não requer certificado digital A1',
        ],
        faq: [
          { q: 'Qual a diferença entre NFA e NF-e?', a: 'NFA é emitida avulsa pelo portal da SEFAZ para quem não tem credenciamento. NF-e é emitida pelo sistema do contribuinte credenciado.' },
        ],
      },
      // SPED MT
      {
        id: 'nfe-mt-sped',
        title: 'Escrituração no SPED (MT)',
        description: 'MT exige escrituração fiscal no SPED. Verifique se sua contabilidade está em dia.',
        severity: 'warning',
        evidenceNeeded: false,
        officialLinks: [
          { label: 'Portal SPED', url: 'http://sped.rfb.gov.br/' },
        ],
        tips: [
          'Consulte seu contador sobre obrigações acessórias',
        ],
        faq: [],
      },
    ],
    CTE: [
      ...CTE_BASE_REQUIREMENTS.map(req => ({
        ...req,
        officialLinks: req.id === 'cte-credenciamento' 
          ? [
              { label: 'Credenciamento CT-e SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
              MT_SEFAZ_EPAC,
              ...req.officialLinks,
            ]
          : req.officialLinks,
      })),
    ],
    MDFE: [
      ...MDFE_BASE_REQUIREMENTS.map(req => ({
        ...req,
        officialLinks: req.id === 'mdfe-credenciamento' 
          ? [
              { label: 'Credenciamento MDF-e SEFAZ-MT', url: 'https://www.sefaz.mt.gov.br/' },
              MT_SEFAZ_EPAC,
              ...req.officialLinks,
            ]
          : req.officialLinks,
      })),
    ],
    GTA: [
      ...GTA_BASE_REQUIREMENTS.map(req => ({
        ...req,
        officialLinks: [
          { label: 'INDEA-MT (Guia GTA)', url: 'http://www.indea.mt.gov.br/' },
          { label: 'Sistema e-Saniagro MT', url: 'https://www.indea.mt.gov.br/esaniagro/' },
          ...req.officialLinks,
        ],
        tips: req.id === 'gta-cadastro-mapa'
          ? [
              ...req.tips,
              'Em MT, a GTA é emitida pelo INDEA-MT',
              'O sistema utilizado é o e-Saniagro',
              'Produtores rurais devem estar cadastrados no INDEA',
            ]
          : req.tips,
      })),
    ],
  },
  generalNotes: [
    '⚠️ MT possui regras específicas de credenciamento. Verifique seu status ANTES de emitir.',
    'Para consultar seu credenciamento: Webservice SEFAZ-MT → login com IE + senha → Consulta Genérica → CREDENCIAMENTOS.',
    'O e-PAC exige certificado e-CNPJ. Para consulta sem certificado, use o Webservice SEFAZ-MT.',
    'MEI sem IE: utilize a Nota Fiscal Avulsa (NFA) ao invés de NF-e.',
    'O INDEA-MT é responsável pela emissão de GTA no estado.',
    'Em caso de rejeição (erro 230 ou 203), verifique seu credenciamento.',
  ],
  sefazPortal: 'https://www.sefaz.mt.gov.br/',
  lastUpdated: '2026-02-06',
};

const FALLBACK_REQUIREMENTS: UFRequirements = {
  uf: 'OUTROS',
  ufName: 'Outras UFs',
  documents: {
    NFE: NFE_BASE_REQUIREMENTS,
    CTE: CTE_BASE_REQUIREMENTS,
    MDFE: MDFE_BASE_REQUIREMENTS,
    GTA: GTA_BASE_REQUIREMENTS,
    NFSE: NFSE_BASE_REQUIREMENTS,
  },
  generalNotes: [
    'As regras podem variar conforme seu estado.',
    'Consulte sempre o portal da SEFAZ da sua UF para informações atualizadas.',
  ],
  sefazPortal: 'https://www.confaz.fazenda.gov.br/',
  lastUpdated: '2026-01-01',
};

// ============= MAPA DE UFs =============

export const UF_REQUIREMENTS_MAP: Record<string, UFRequirements> = {
  MT: MT_REQUIREMENTS,
  // Adicionar outras UFs conforme necessário
  // SP: SP_REQUIREMENTS,
  // MG: MG_REQUIREMENTS,
  // etc.
};

// ============= FUNÇÕES UTILITÁRIAS =============

export function getUFRequirements(uf: string): UFRequirements {
  return UF_REQUIREMENTS_MAP[uf] || FALLBACK_REQUIREMENTS;
}

export function getDocumentRequirements(uf: string, docType: DocumentType): FiscalRequirement[] {
  const ufReqs = getUFRequirements(uf);
  return ufReqs.documents[docType] || [];
}

export function getDocumentInfo(docType: DocumentType): {
  name: string;
  fullName: string;
  description: string;
  whoNeeds: string[];
  authority: string;
} {
  const docs: Record<DocumentType, ReturnType<typeof getDocumentInfo>> = {
    NFE: {
      name: 'NF-e',
      fullName: 'Nota Fiscal Eletrônica (modelo 55)',
      description: 'Documento fiscal para venda de mercadorias e produtos. Emitido pelo vendedor e transmitido à SEFAZ estadual.',
      whoNeeds: [
        'Produtores rurais que vendem produção',
        'Empresas que comercializam produtos',
        'Prestadores que vendem mercadorias junto com serviços',
      ],
      authority: 'SEFAZ (Secretaria da Fazenda Estadual)',
    },
    CTE: {
      name: 'CT-e',
      fullName: 'Conhecimento de Transporte Eletrônico',
      description: 'Documento fiscal que registra a prestação de serviço de transporte de cargas. Obrigatório para transportadores.',
      whoNeeds: [
        'Transportadoras',
        'Motoristas autônomos que fazem frete',
        'Empresas de logística',
      ],
      authority: 'SEFAZ (Secretaria da Fazenda Estadual)',
    },
    MDFE: {
      name: 'MDF-e',
      fullName: 'Manifesto Eletrônico de Documentos Fiscais',
      description: 'Documento que vincula os documentos fiscais (NF-e, CT-e) ao veículo que está realizando o transporte. Obrigatório em viagens interestaduais.',
      whoNeeds: [
        'Transportadoras em viagens interestaduais',
        'Emitentes de NF-e que fazem transporte próprio interestadual',
      ],
      authority: 'SEFAZ (Secretaria da Fazenda Estadual)',
    },
    GTA: {
      name: 'GTA',
      fullName: 'Guia de Trânsito Animal',
      description: 'Documento sanitário que autoriza o trânsito de animais. Não é documento fiscal tributário, mas de controle sanitário.',
      whoNeeds: [
        'Produtores rurais que transportam animais',
        'Pecuaristas',
        'Criadores de gado, cavalos, etc.',
      ],
      authority: 'MAPA / Órgão Estadual de Defesa Agropecuária',
    },
    NFSE: {
      name: 'NFS-e',
      fullName: 'Nota Fiscal de Serviços Eletrônica',
      description: 'Documento fiscal para prestação de serviços. Emitido pela Prefeitura municipal, não pela SEFAZ.',
      whoNeeds: [
        'Prestadores de serviços em geral',
        'MEI que presta serviços',
        'Profissionais autônomos',
      ],
      authority: 'Prefeitura Municipal',
    },
  };

  return docs[docType];
}

export const ALL_DOCUMENT_TYPES: DocumentType[] = ['NFE', 'CTE', 'MDFE', 'GTA', 'NFSE'];

export const BRAZILIAN_UFS = [
  { uf: 'AC', name: 'Acre' },
  { uf: 'AL', name: 'Alagoas' },
  { uf: 'AP', name: 'Amapá' },
  { uf: 'AM', name: 'Amazonas' },
  { uf: 'BA', name: 'Bahia' },
  { uf: 'CE', name: 'Ceará' },
  { uf: 'DF', name: 'Distrito Federal' },
  { uf: 'ES', name: 'Espírito Santo' },
  { uf: 'GO', name: 'Goiás' },
  { uf: 'MA', name: 'Maranhão' },
  { uf: 'MT', name: 'Mato Grosso' },
  { uf: 'MS', name: 'Mato Grosso do Sul' },
  { uf: 'MG', name: 'Minas Gerais' },
  { uf: 'PA', name: 'Pará' },
  { uf: 'PB', name: 'Paraíba' },
  { uf: 'PR', name: 'Paraná' },
  { uf: 'PE', name: 'Pernambuco' },
  { uf: 'PI', name: 'Piauí' },
  { uf: 'RJ', name: 'Rio de Janeiro' },
  { uf: 'RN', name: 'Rio Grande do Norte' },
  { uf: 'RS', name: 'Rio Grande do Sul' },
  { uf: 'RO', name: 'Rondônia' },
  { uf: 'RR', name: 'Roraima' },
  { uf: 'SC', name: 'Santa Catarina' },
  { uf: 'SP', name: 'São Paulo' },
  { uf: 'SE', name: 'Sergipe' },
  { uf: 'TO', name: 'Tocantins' },
];
