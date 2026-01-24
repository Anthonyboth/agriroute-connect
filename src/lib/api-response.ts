/**
 * Utilitários para padronização de respostas de API e tratamento de erros
 * 
 * Todas as edge functions e respostas de API devem seguir este formato:
 * - success: boolean indicando se a operação foi bem-sucedida
 * - data: dados retornados em caso de sucesso
 * - error_code: código de erro padronizado para tratamento no frontend
 * - message: mensagem legível para o usuário
 * - details: detalhes técnicos (apenas em dev)
 * - correlation_id: ID único para rastreamento de erros
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error_code?: string;
  message?: string;
  details?: unknown;
  correlation_id: string;
}

export interface ApiError {
  code: string;
  message: string;
  userMessage: string;
  httpStatus: number;
}

// Códigos de erro padronizados
export const ERROR_CODES = {
  // Autenticação
  MISSING_AUTH: 'MISSING_AUTH',
  INVALID_TOKEN: 'INVALID_TOKEN',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  UNAUTHORIZED: 'UNAUTHORIZED',
  
  // Perfil
  PROFILE_NOT_FOUND: 'PROFILE_NOT_FOUND',
  PROFILE_ERROR: 'PROFILE_ERROR',
  INVALID_ROLE: 'INVALID_ROLE',
  
  // Fiscal
  ISSUER_NOT_FOUND: 'ISSUER_NOT_FOUND',
  CERTIFICATE_ERROR: 'CERTIFICATE_ERROR',
  SEFAZ_ERROR: 'SEFAZ_ERROR',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  
  // Pagamentos
  PAYMENT_NOT_FOUND: 'PAYMENT_NOT_FOUND',
  PAYMENT_ERROR: 'PAYMENT_ERROR',
  INSUFFICIENT_BALANCE: 'INSUFFICIENT_BALANCE',
  
  // Propostas
  PROPOSAL_NOT_FOUND: 'PROPOSAL_NOT_FOUND',
  PROPOSAL_EXPIRED: 'PROPOSAL_EXPIRED',
  ALREADY_ACCEPTED: 'ALREADY_ACCEPTED',
  
  // Fretes
  FREIGHT_NOT_FOUND: 'FREIGHT_NOT_FOUND',
  FREIGHT_STATUS_ERROR: 'FREIGHT_STATUS_ERROR',
  
  // Geral
  INTERNAL_ERROR: 'INTERNAL_ERROR',
  RATE_LIMITED: 'RATE_LIMITED',
  NETWORK_ERROR: 'NETWORK_ERROR',
  TIMEOUT: 'TIMEOUT',
} as const;

export type ErrorCode = keyof typeof ERROR_CODES;

// Mapeamento de códigos para mensagens amigáveis
const ERROR_MESSAGES: Record<string, string> = {
  [ERROR_CODES.MISSING_AUTH]: 'Você precisa estar logado para realizar esta ação.',
  [ERROR_CODES.INVALID_TOKEN]: 'Sua sessão expirou. Por favor, faça login novamente.',
  [ERROR_CODES.TOKEN_EXPIRED]: 'Sua sessão expirou. Por favor, faça login novamente.',
  [ERROR_CODES.UNAUTHORIZED]: 'Você não tem permissão para realizar esta ação.',
  
  [ERROR_CODES.PROFILE_NOT_FOUND]: 'Perfil não encontrado. Por favor, complete seu cadastro.',
  [ERROR_CODES.PROFILE_ERROR]: 'Erro ao carregar seu perfil. Tente novamente.',
  [ERROR_CODES.INVALID_ROLE]: 'Tipo de conta inválido.',
  
  [ERROR_CODES.ISSUER_NOT_FOUND]: 'Emissor fiscal não encontrado. Configure seus dados fiscais primeiro.',
  [ERROR_CODES.CERTIFICATE_ERROR]: 'Erro no certificado digital. Verifique se está válido.',
  [ERROR_CODES.SEFAZ_ERROR]: 'Erro na comunicação com a SEFAZ. Tente novamente em alguns minutos.',
  [ERROR_CODES.VALIDATION_ERROR]: 'Dados inválidos. Verifique as informações e tente novamente.',
  
  [ERROR_CODES.PAYMENT_NOT_FOUND]: 'Pagamento não encontrado.',
  [ERROR_CODES.PAYMENT_ERROR]: 'Erro ao processar pagamento. Tente novamente.',
  [ERROR_CODES.INSUFFICIENT_BALANCE]: 'Saldo insuficiente para esta operação.',
  
  [ERROR_CODES.PROPOSAL_NOT_FOUND]: 'Proposta não encontrada.',
  [ERROR_CODES.PROPOSAL_EXPIRED]: 'Esta proposta expirou.',
  [ERROR_CODES.ALREADY_ACCEPTED]: 'Esta proposta já foi aceita.',
  
  [ERROR_CODES.FREIGHT_NOT_FOUND]: 'Frete não encontrado.',
  [ERROR_CODES.FREIGHT_STATUS_ERROR]: 'Não é possível realizar esta ação no status atual do frete.',
  
  [ERROR_CODES.INTERNAL_ERROR]: 'Ocorreu um erro interno. Nossa equipe foi notificada.',
  [ERROR_CODES.RATE_LIMITED]: 'Muitas requisições. Aguarde alguns segundos e tente novamente.',
  [ERROR_CODES.NETWORK_ERROR]: 'Erro de conexão. Verifique sua internet.',
  [ERROR_CODES.TIMEOUT]: 'A operação demorou muito. Tente novamente.',
};

/**
 * Gera um ID de correlação único para rastreamento de erros
 */
export function generateCorrelationId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `AR-${timestamp}-${random}`.toUpperCase();
}

/**
 * Cria uma resposta de sucesso padronizada
 */
export function successResponse<T>(data: T, message?: string): ApiResponse<T> {
  return {
    success: true,
    data,
    message,
    correlation_id: generateCorrelationId(),
  };
}

/**
 * Cria uma resposta de erro padronizada
 */
export function errorResponse(
  errorCode: string,
  details?: unknown,
  customMessage?: string
): ApiResponse<null> {
  const correlationId = generateCorrelationId();
  const userMessage = customMessage || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
  
  // Log estruturado para debugging
  if (typeof console !== 'undefined') {
    console.error(`[API Error] ${correlationId}:`, {
      error_code: errorCode,
      details,
      timestamp: new Date().toISOString(),
    });
  }
  
  return {
    success: false,
    error_code: errorCode,
    message: userMessage,
    details: process.env.NODE_ENV === 'development' ? details : undefined,
    correlation_id: correlationId,
  };
}

/**
 * Extrai erro de resposta de edge function
 */
export function extractFunctionError(error: unknown): {
  code: string;
  message: string;
  correlationId?: string;
} {
  if (!error) {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
    };
  }
  
  // Se for um objeto com estrutura conhecida
  if (typeof error === 'object' && error !== null) {
    const err = error as Record<string, unknown>;
    
    // Formato padrão de edge function
    if (err.error_code && typeof err.error_code === 'string') {
      return {
        code: err.error_code,
        message: (err.message as string) || ERROR_MESSAGES[err.error_code] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
        correlationId: err.correlation_id as string | undefined,
      };
    }
    
    // Formato de erro genérico
    if (err.message && typeof err.message === 'string') {
      // Tentar detectar código pelo conteúdo da mensagem
      const message = err.message.toLowerCase();
      
      if (message.includes('not found') || message.includes('não encontrad')) {
        return {
          code: ERROR_CODES.PROFILE_NOT_FOUND,
          message: err.message as string,
        };
      }
      
      if (message.includes('unauthorized') || message.includes('não autorizado')) {
        return {
          code: ERROR_CODES.UNAUTHORIZED,
          message: err.message as string,
        };
      }
      
      return {
        code: ERROR_CODES.INTERNAL_ERROR,
        message: err.message as string,
      };
    }
  }
  
  // Fallback para string
  if (typeof error === 'string') {
    return {
      code: ERROR_CODES.INTERNAL_ERROR,
      message: error,
    };
  }
  
  return {
    code: ERROR_CODES.INTERNAL_ERROR,
    message: ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR],
  };
}

/**
 * Obtém mensagem amigável para o usuário baseada no código de erro
 */
export function getUserFriendlyMessage(errorCode: string): string {
  return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES[ERROR_CODES.INTERNAL_ERROR];
}

/**
 * Determina o status HTTP apropriado para um código de erro
 */
export function getHttpStatus(errorCode: string): number {
  switch (errorCode) {
    case ERROR_CODES.MISSING_AUTH:
    case ERROR_CODES.INVALID_TOKEN:
    case ERROR_CODES.TOKEN_EXPIRED:
      return 401;
    
    case ERROR_CODES.UNAUTHORIZED:
    case ERROR_CODES.INVALID_ROLE:
      return 403;
    
    case ERROR_CODES.PROFILE_NOT_FOUND:
    case ERROR_CODES.ISSUER_NOT_FOUND:
    case ERROR_CODES.PAYMENT_NOT_FOUND:
    case ERROR_CODES.PROPOSAL_NOT_FOUND:
    case ERROR_CODES.FREIGHT_NOT_FOUND:
      return 404;
    
    case ERROR_CODES.RATE_LIMITED:
      return 429;
    
    case ERROR_CODES.VALIDATION_ERROR:
    case ERROR_CODES.ALREADY_ACCEPTED:
    case ERROR_CODES.PROPOSAL_EXPIRED:
    case ERROR_CODES.FREIGHT_STATUS_ERROR:
    case ERROR_CODES.INSUFFICIENT_BALANCE:
      return 422;
    
    case ERROR_CODES.TIMEOUT:
      return 504;
    
    default:
      return 500;
  }
}
