// Mapeamento completo de códigos de rejeição SEFAZ para NF-e
// Cada erro inclui: título, descrição detalhada e instruções de correção

export interface SefazNfeError {
  code: string;
  title: string;
  description: string;
  cause: string;
  solution: string[];
  category: 'emitente' | 'destinatario' | 'produto' | 'fiscal' | 'certificado' | 'sistema';
  severity: 'error' | 'warning' | 'info';
}

export const SEFAZ_NFE_ERRORS: Record<string, SefazNfeError> = {
  // ============= EMITENTE =============
  '203': {
    code: '203',
    title: 'Emitente não habilitado para NF-e',
    description: 'O CNPJ do emitente não está credenciado para emitir NF-e na SEFAZ do estado.',
    cause: 'A empresa não completou o processo de credenciamento para emissão de NF-e.',
    solution: [
      'Acesse o portal da SEFAZ do seu estado',
      'Solicite o credenciamento para emissão de NF-e',
      'Aguarde a aprovação (pode levar alguns dias)',
      'MEIs geralmente só podem emitir NFS-e (serviços), não NF-e (produtos)',
    ],
    category: 'emitente',
    severity: 'error',
  },
  '207': {
    code: '207',
    title: 'CNPJ do emitente inválido',
    description: 'O CNPJ informado para o emitente não é válido ou está formatado incorretamente.',
    cause: 'Dígitos verificadores incorretos ou formatação inválida.',
    solution: [
      'Verifique se o CNPJ foi digitado corretamente',
      'Confirme o CNPJ no cartão CNPJ da Receita Federal',
      'Atualize o cadastro fiscal no sistema',
    ],
    category: 'emitente',
    severity: 'error',
  },
  '209': {
    code: '209',
    title: 'IE do emitente inválida',
    description: 'A Inscrição Estadual do emitente não corresponde ao padrão do estado.',
    cause: 'IE não cadastrada, incorreta ou com dígitos verificadores inválidos.',
    solution: [
      'Verifique a IE no Cadastro de Contribuintes do estado',
      'Acesse o SINTEGRA para consultar a situação cadastral',
      'Atualize a IE no cadastro fiscal do sistema',
    ],
    category: 'emitente',
    severity: 'error',
  },
  '230': {
    code: '230',
    title: 'IE do emitente não cadastrada',
    description: 'A Inscrição Estadual do emitente não está cadastrada na SEFAZ para emissão de NF-e.',
    cause: 'O emitente não possui credenciamento ativo para NF-e ou a IE está suspensa/cancelada.',
    solution: [
      'Acesse o portal da SEFAZ do seu estado',
      'Verifique se a IE está ativa e credenciada',
      'MEIs precisam verificar se podem emitir NF-e (produto) ou apenas NFS-e (serviço)',
      'Se for transportadora, pode ser necessário emitir CT-e ao invés de NF-e',
      'Entre em contato com a SEFAZ para regularizar',
    ],
    category: 'emitente',
    severity: 'error',
  },
  '236': {
    code: '236',
    title: 'Emitente em situação irregular',
    description: 'A empresa está com pendências fiscais na SEFAZ.',
    cause: 'Existem débitos, declarações pendentes ou irregularidades cadastrais.',
    solution: [
      'Consulte a situação fiscal no portal da SEFAZ',
      'Regularize pendências de ICMS ou declarações',
      'Entre em contato com seu contador',
    ],
    category: 'emitente',
    severity: 'error',
  },

  // ============= DESTINATÁRIO =============
  '208': {
    code: '208',
    title: 'CNPJ/CPF do destinatário inválido',
    description: 'O documento do destinatário não passou na validação.',
    cause: 'CPF ou CNPJ com dígitos verificadores incorretos.',
    solution: [
      'Verifique se o CPF/CNPJ foi digitado corretamente',
      'Confirme os dados com o destinatário',
      'CPF deve ter 11 dígitos, CNPJ deve ter 14 dígitos',
    ],
    category: 'destinatario',
    severity: 'error',
  },
  '210': {
    code: '210',
    title: 'IE do destinatário inválida',
    description: 'A Inscrição Estadual do destinatário não é válida para o estado informado.',
    cause: 'IE incorreta ou não corresponde ao padrão do estado do destinatário.',
    solution: [
      'Consulte a IE do destinatário no SINTEGRA',
      'Se o destinatário não for contribuinte, deixe o campo IE vazio ou use "ISENTO"',
      'Verifique se o estado (UF) do destinatário está correto',
    ],
    category: 'destinatario',
    severity: 'error',
  },
  '211': {
    code: '211',
    title: 'Destinatário não é contribuinte de ICMS',
    description: 'O destinatário informado não possui inscrição estadual ativa.',
    cause: 'Operação para não-contribuinte requer indicação específica.',
    solution: [
      'Deixe o campo IE vazio ou coloque "ISENTO"',
      'Verifique se o CFOP é adequado para não-contribuinte',
      'Para pessoa física, não informe IE',
    ],
    category: 'destinatario',
    severity: 'warning',
  },
  '215': {
    code: '215',
    title: 'Endereço do destinatário incompleto',
    description: 'Faltam informações obrigatórias no endereço do destinatário.',
    cause: 'Campos como logradouro, bairro, município ou CEP estão vazios ou inválidos.',
    solution: [
      'Preencha todos os campos do endereço do destinatário',
      'Verifique se o CEP está correto (8 dígitos)',
      'Confirme o código IBGE do município',
      'O estado (UF) deve ter 2 letras',
    ],
    category: 'destinatario',
    severity: 'error',
  },

  // ============= PRODUTOS/ITENS =============
  '325': {
    code: '325',
    title: 'NCM inexistente',
    description: 'O código NCM informado não existe na tabela oficial.',
    cause: 'NCM digitado incorretamente ou código fictício utilizado.',
    solution: [
      'Consulte a tabela NCM no site da Receita Federal',
      'Para produtos, use o NCM correspondente à mercadoria',
      'NCM "00000000" pode ser usado para serviços (quando aplicável)',
      'Exemplos: Soja=12019000, Milho=10059010, Café=09011110',
    ],
    category: 'produto',
    severity: 'error',
  },
  '328': {
    code: '328',
    title: 'CFOP inválido para a operação',
    description: 'O CFOP informado não é válido ou não corresponde ao tipo de operação.',
    cause: 'CFOP incompatível com a natureza da operação ou com o estado do destinatário.',
    solution: [
      'Verifique se o CFOP é adequado para a operação',
      'Operações estaduais: CFOPs iniciados em 5 (saída) ou 1 (entrada)',
      'Operações interestaduais: CFOPs iniciados em 6 (saída) ou 2 (entrada)',
      'Consulte a tabela de CFOPs',
    ],
    category: 'produto',
    severity: 'error',
  },
  '338': {
    code: '338',
    title: 'Unidade de medida inválida',
    description: 'A unidade comercial informada não é reconhecida.',
    cause: 'Código de unidade fora do padrão.',
    solution: [
      'Use unidades padronizadas: UN (unidade), KG (quilograma), LT (litro), M (metro), CX (caixa)',
      'Consulte a tabela de unidades de medida aceitas pela SEFAZ',
    ],
    category: 'produto',
    severity: 'error',
  },
  '610': {
    code: '610',
    title: 'Valor do ICMS incorreto',
    description: 'O cálculo do ICMS não está correto conforme a alíquota aplicada.',
    cause: 'Diferença entre o valor calculado e o valor informado.',
    solution: [
      'Revise a alíquota de ICMS aplicada',
      'Verifique a base de cálculo do imposto',
      'Consulte seu contador sobre a tributação correta',
    ],
    category: 'fiscal',
    severity: 'error',
  },
  '611': {
    code: '611',
    title: 'Valor total dos produtos inválido',
    description: 'A soma dos valores dos itens não corresponde ao total informado.',
    cause: 'Erro de cálculo ou arredondamento.',
    solution: [
      'Revise os valores unitários e quantidades de cada item',
      'Verifique se o valor total está correto',
      'Atenção aos centavos e arredondamentos',
    ],
    category: 'fiscal',
    severity: 'error',
  },

  // ============= CERTIFICADO =============
  '280': {
    code: '280',
    title: 'Certificado digital expirado',
    description: 'O certificado A1 utilizado está vencido.',
    cause: 'Data de validade do certificado ultrapassada.',
    solution: [
      'Adquira um novo certificado digital A1',
      'Faça upload do novo certificado no sistema',
      'Certificados A1 têm validade de 1 ano',
    ],
    category: 'certificado',
    severity: 'error',
  },
  '281': {
    code: '281',
    title: 'Certificado digital revogado',
    description: 'O certificado foi cancelado pela autoridade certificadora.',
    cause: 'Certificado foi revogado por solicitação ou suspeita de comprometimento.',
    solution: [
      'Entre em contato com a autoridade certificadora',
      'Adquira um novo certificado digital',
    ],
    category: 'certificado',
    severity: 'error',
  },
  '282': {
    code: '282',
    title: 'Certificado não corresponde ao emitente',
    description: 'O CNPJ do certificado é diferente do CNPJ do emitente da NF-e.',
    cause: 'Certificado digital de outra empresa ou filial.',
    solution: [
      'Use o certificado digital da mesma empresa emitente',
      'Verifique se o CNPJ do certificado é o mesmo do cadastro fiscal',
      'Para filiais, pode ser necessário certificado específico',
    ],
    category: 'certificado',
    severity: 'error',
  },

  // ============= SISTEMA/SEFAZ =============
  '108': {
    code: '108',
    title: 'Serviço paralisado momentaneamente',
    description: 'A SEFAZ está temporariamente fora do ar.',
    cause: 'Manutenção programada ou instabilidade nos servidores.',
    solution: [
      'Aguarde alguns minutos e tente novamente',
      'Consulte o status da SEFAZ do estado',
      'Em caso de urgência, utilize a contingência',
    ],
    category: 'sistema',
    severity: 'warning',
  },
  '109': {
    code: '109',
    title: 'Serviço paralisado sem previsão',
    description: 'A SEFAZ está indisponível sem previsão de retorno.',
    cause: 'Problemas técnicos graves nos sistemas da SEFAZ.',
    solution: [
      'Aguarde a normalização do serviço',
      'Acompanhe comunicados da SEFAZ',
      'Considere usar modo de contingência',
    ],
    category: 'sistema',
    severity: 'error',
  },
  '999': {
    code: '999',
    title: 'Erro não catalogado',
    description: 'Ocorreu um erro não previsto na comunicação com a SEFAZ.',
    cause: 'Erro genérico do sistema.',
    solution: [
      'Tente novamente em alguns minutos',
      'Verifique se todos os dados estão corretos',
      'Entre em contato com o suporte se persistir',
    ],
    category: 'sistema',
    severity: 'error',
  },

  // ============= DUPLICIDADE =============
  '204': {
    code: '204',
    title: 'Duplicidade de NF-e',
    description: 'Já existe uma NF-e autorizada com os mesmos dados.',
    cause: 'A nota já foi emitida anteriormente.',
    solution: [
      'Verifique no painel se a NF-e já foi autorizada',
      'Consulte o número da nota no sistema',
      'Se precisar reemitir, altere a referência',
    ],
    category: 'fiscal',
    severity: 'warning',
  },
  '539': {
    code: '539',
    title: 'Duplicidade de número de NF-e',
    description: 'O número da nota já foi utilizado para outra emissão.',
    cause: 'Conflito na sequência numérica das notas.',
    solution: [
      'O sistema gerará automaticamente um novo número',
      'Tente emitir novamente',
    ],
    category: 'sistema',
    severity: 'warning',
  },
};

// Função para extrair código de erro da mensagem SEFAZ
export function extractSefazErrorCode(message: string): string | null {
  // Padrão comum: "Rejeicao: Mensagem [Código XXX]" ou "código XXX" ou apenas número no início
  const patterns = [
    /\[(?:Código\s*)?(\d{3})\]/i,
    /código\s*(\d{3})/i,
    /cStat[=:]\s*(\d{3})/i,
    /^(\d{3})[\s:-]/,
    /rejeição\s*(\d{3})/i,
  ];
  
  for (const pattern of patterns) {
    const match = message.match(pattern);
    if (match) return match[1];
  }
  
  return null;
}

// Função para analisar mensagem de erro e retornar informações estruturadas
export function parseSefazError(errorMessage: string): SefazNfeError | null {
  const code = extractSefazErrorCode(errorMessage);
  
  if (code && SEFAZ_NFE_ERRORS[code]) {
    return SEFAZ_NFE_ERRORS[code];
  }
  
  // Tentar identificar erro pela descrição
  const lowerMsg = errorMessage.toLowerCase();
  
  if (lowerMsg.includes('ncm') && (lowerMsg.includes('inexistente') || lowerMsg.includes('inválid'))) {
    return SEFAZ_NFE_ERRORS['325'];
  }
  
  if (lowerMsg.includes('ie') && lowerMsg.includes('emitente') && (lowerMsg.includes('não cadastrada') || lowerMsg.includes('nao cadastrada'))) {
    return SEFAZ_NFE_ERRORS['230'];
  }
  
  if (lowerMsg.includes('ie') && lowerMsg.includes('emitente') && lowerMsg.includes('inválid')) {
    return SEFAZ_NFE_ERRORS['209'];
  }
  
  if (lowerMsg.includes('cnpj') && lowerMsg.includes('emitente') && lowerMsg.includes('inválid')) {
    return SEFAZ_NFE_ERRORS['207'];
  }
  
  if (lowerMsg.includes('cnpj') && lowerMsg.includes('destinatário') && lowerMsg.includes('inválid')) {
    return SEFAZ_NFE_ERRORS['208'];
  }
  
  if (lowerMsg.includes('certificado') && lowerMsg.includes('expirado')) {
    return SEFAZ_NFE_ERRORS['280'];
  }
  
  if (lowerMsg.includes('cfop') && lowerMsg.includes('inválid')) {
    return SEFAZ_NFE_ERRORS['328'];
  }
  
  if (lowerMsg.includes('duplicidade')) {
    return SEFAZ_NFE_ERRORS['204'];
  }
  
  if (lowerMsg.includes('serviço') && lowerMsg.includes('paralisado')) {
    return SEFAZ_NFE_ERRORS['108'];
  }
  
  if (lowerMsg.includes('credencia') || lowerMsg.includes('habilita')) {
    return SEFAZ_NFE_ERRORS['203'];
  }
  
  return null;
}

// Função para obter erro genérico quando não é possível identificar
export function getGenericSefazError(originalMessage: string): SefazNfeError {
  return {
    code: 'DESCONHECIDO',
    title: 'Erro na emissão de NF-e',
    description: originalMessage,
    cause: 'Não foi possível identificar a causa específica do erro.',
    solution: [
      'Verifique se todos os dados estão preenchidos corretamente',
      'Confirme que o emissor está credenciado na SEFAZ',
      'Verifique se o certificado digital está válido',
      'Tente novamente em alguns minutos',
      'Entre em contato com o suporte se o problema persistir',
    ],
    category: 'sistema',
    severity: 'error',
  };
}

// Categorias em português
export const CATEGORY_LABELS: Record<SefazNfeError['category'], string> = {
  emitente: 'Dados do Emitente',
  destinatario: 'Dados do Destinatário',
  produto: 'Produtos/Itens',
  fiscal: 'Tributação/Valores',
  certificado: 'Certificado Digital',
  sistema: 'Sistema/SEFAZ',
};

// Cores por categoria
export const CATEGORY_COLORS: Record<SefazNfeError['category'], string> = {
  emitente: 'bg-blue-100 text-blue-800 border-blue-200',
  destinatario: 'bg-purple-100 text-purple-800 border-purple-200',
  produto: 'bg-orange-100 text-orange-800 border-orange-200',
  fiscal: 'bg-green-100 text-green-800 border-green-200',
  certificado: 'bg-red-100 text-red-800 border-red-200',
  sistema: 'bg-gray-100 text-gray-800 border-gray-200',
};
