// Mapeamento de códigos de erro SEFAZ para mensagens amigáveis
export const SEFAZ_ERROR_MESSAGES: Record<string, { message: string; action?: string }> = {
  '217': {
    message: 'Nota Fiscal não encontrada',
    action: 'Verifique se a chave de acesso está correta',
  },
  '218': {
    message: 'NF-e já cancelada',
    action: 'Esta nota foi cancelada pelo emitente',
  },
  '219': {
    message: 'NF-e negada pela SEFAZ',
    action: 'Entre em contato com o emitente',
  },
  '539': {
    message: 'Esta nota não pertence ao seu CNPJ',
    action: 'Você só pode manifestar notas destinadas a você',
  },
  '573': {
    message: 'Nota já manifestada anteriormente',
    action: 'Esta manifestação já foi registrada',
  },
  '580': {
    message: 'Prazo para manifestação encerrado',
    action: 'O prazo legal de 180 dias foi excedido',
  },
  '593': {
    message: 'Justificativa obrigatória não informada',
    action: 'Informe o motivo da manifestação',
  },
  '594': {
    message: 'Justificativa deve ter no mínimo 15 caracteres',
    action: 'Descreva o motivo com mais detalhes',
  },
  '999': {
    message: 'Instabilidade na SEFAZ',
    action: 'Tente novamente em alguns minutos',
  },
};

// Códigos de evento SEFAZ
export const SEFAZ_EVENT_CODES = {
  ciencia: '210210',
  confirmacao: '210200',
  desconhecimento: '210220',
  nao_realizada: '210240',
} as const;

// Descrição dos eventos para o XML
export const SEFAZ_EVENT_DESCRIPTIONS = {
  ciencia: 'Ciencia da Operacao',
  confirmacao: 'Confirmacao da Operacao',
  desconhecimento: 'Desconhecimento da Operacao',
  nao_realizada: 'Operacao nao Realizada',
} as const;

// Traduzir erro SEFAZ para mensagem amigável
export function translateSefazError(code: string | undefined, fallbackMessage?: string): { 
  message: string; 
  action?: string;
  code?: string;
} {
  if (!code) {
    return {
      message: fallbackMessage || 'Erro desconhecido na manifestação',
      action: 'Tente novamente ou entre em contato com o suporte',
    };
  }

  const known = SEFAZ_ERROR_MESSAGES[code];
  if (known) {
    return { ...known, code };
  }

  return {
    message: fallbackMessage || `Erro na comunicação com SEFAZ (código ${code})`,
    action: 'Tente novamente em alguns minutos',
    code,
  };
}

// Verificar se um código indica erro temporário (pode tentar novamente)
export function isRetryableError(code: string): boolean {
  const retryableCodes = ['999', 'TIMEOUT', 'NETWORK_ERROR'];
  return retryableCodes.includes(code);
}

// Validar formato da chave NF-e
export function validateNfeKey(key: string): { valid: boolean; error?: string } {
  if (!key) {
    return { valid: false, error: 'Chave de acesso não informada' };
  }

  const cleaned = key.replace(/\s+/g, '');

  if (!/^\d+$/.test(cleaned)) {
    return { valid: false, error: 'A chave deve conter apenas números' };
  }

  if (cleaned.length !== 44) {
    return { valid: false, error: `A chave deve ter 44 dígitos (atual: ${cleaned.length})` };
  }

  return { valid: true };
}
