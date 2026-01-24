/**
 * Transforms technical database errors into user-friendly messages
 * Hides sensitive information like table names and technical details
 */
export function getErrorMessage(error: any): string {
  if (!error) return 'Erro desconhecido';
  
  const message = error?.message || error?.error_description || error?.toString?.() || '';
  const code = error?.code || error?.status || '';
  
  // Edge Function errors
  if (message.includes('Edge Function') || 
      message.includes('non-2xx') || 
      message.includes('FunctionsHttpError') ||
      message.includes('FunctionsRelayError')) {
    return 'O serviço está temporariamente indisponível. Tente novamente em alguns instantes';
  }
  
  // Fetch/Network errors in English
  if (message.includes('Failed to fetch') || 
      message.includes('fetch failed') ||
      message.includes('NetworkError') ||
      message.includes('ERR_NETWORK')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente';
  }
  
  // HTTP status codes
  if (code === 500 || message.includes('500') || message.includes('Internal Server Error')) {
    return 'Erro interno do servidor. Tente novamente em alguns instantes';
  }
  if (code === 502 || code === 503 || code === 504 || 
      message.includes('502') || message.includes('503') || message.includes('504') ||
      message.includes('Bad Gateway') || message.includes('Service Unavailable')) {
    return 'Servidor temporariamente indisponível. Tente novamente em alguns minutos';
  }
  if (code === 404 || message.includes('404') || message.includes('Not Found')) {
    return 'Recurso não encontrado';
  }
  if (code === 403 || code === 401 || 
      message.includes('403') || message.includes('401') ||
      message.includes('Unauthorized') || message.includes('Forbidden')) {
    return 'Acesso não autorizado. Faça login novamente';
  }
  if (code === 429 || message.includes('429') || message.includes('Too Many Requests')) {
    return 'Muitas requisições. Aguarde alguns segundos e tente novamente';
  }
  
  // Common English error messages
  if (message.includes('Request failed')) {
    return 'A requisição falhou. Tente novamente';
  }
  if (message.includes('Timeout') || message.includes('timed out')) {
    return 'A operação demorou muito. Tente novamente';
  }
  if (message.includes('Invalid') && message.includes('token')) {
    return 'Sessão expirada. Faça login novamente';
  }
  if (message.includes('undefined') || message.includes('null') || message.includes('Cannot read')) {
    return 'Ocorreu um erro inesperado. Recarregue a página e tente novamente';
  }
  
  // Row Level Security policy violations
  if (message.includes('row-level security policy') || message.includes('violates row-level security')) {
    return 'Você não tem permissão para realizar esta ação';
  }
  
  // Permission denied errors
  if (message.includes('permission denied') || message.includes('access denied')) {
    return 'Acesso negado. Verifique suas permissões';
  }
  
  // Foreign key constraint violations
  if (message.includes('foreign key constraint') || message.includes('violates foreign key')) {
    return 'Não é possível realizar esta operação devido a dependências';
  }
  
  // Unique constraint violations - P9: Tratamento específico para vínculos
  if (message.includes('unique constraint') || message.includes('duplicate key')) {
    if (message.includes('idx_profiles_document_unique') || error?.code === '23505') {
      return 'Este CPF/CNPJ já está em uso em outro cadastro';
    }
    if (message.includes('service_ratings')) {
      return 'Este serviço já foi avaliado por você. Não é possível enviar outra avaliação.';
    }
    if (message.includes('freight_ratings')) {
      return 'Este frete já foi avaliado por você. Não é possível enviar outra avaliação.';
    }
    if (message.includes('freight_assignments_freight_id_driver_id_key')) {
      return 'Este motorista já está atribuído a este frete.';
    }
    // P9: Tratamento específico para vínculos de veículo-motorista
    if (message.includes('company_vehicle_assignments')) {
      return 'Já existe um vínculo entre este motorista e veículo. Remova o vínculo anterior para criar um novo.';
    }
    return 'Este registro já existe no sistema';
  }
  
  // Network/connection errors
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return 'Erro de conexão. Verifique sua internet e tente novamente';
  }
  
  // Authentication errors
  if (message.includes('not authenticated') || message.includes('JWT')) {
    return 'Sessão expirada. Faça login novamente';
  }
  
  // File upload errors
  if (message.includes('upload') || message.includes('file too large') || message.includes('invalid file type')) {
    return 'Erro no upload do arquivo. Verifique o tamanho e formato';
  }
  
  // Validation errors
  if (message.includes('validation') || message.includes('invalid input')) {
    return 'Dados inválidos. Verifique as informações e tente novamente';
  }
  
  // Rate limiting
  if (message.includes('too many requests') || message.includes('rate limit')) {
    return 'Muitas tentativas. Aguarde alguns minutos e tente novamente';
  }
  
  // Payment errors
  if (message.includes('payment') || message.includes('stripe') || message.includes('checkout')) {
    return 'Erro no processamento do pagamento. Tente novamente';
  }
  
  // Profile creation specific errors - show clear messages
  if (message.includes('já possui um perfil') || message.includes('já está cadastrado')) {
    return message; // Return the actual message for profile-specific errors
  }
  
  // Hide any remaining technical database errors and table names
  // But be careful not to hide profile-related errors
  if (message.includes('_') || 
      message.includes('postgres') || 
      message.includes('supabase') ||
      message.includes('table') ||
      message.includes('column') ||
      message.includes('function') ||
      message.includes('constraint') ||
      message.includes('trigger') ||
      message.includes('policy')) {
    return 'Ocorreu um erro no sistema. Tente novamente em alguns instantes';
  }
  
  // For any other technical errors, provide a generic message
  if (message.length > 100 || message.includes('ERROR:') || message.includes('FATAL:')) {
    return 'Ocorreu um erro inesperado. Tente novamente';
  }
  
  // Return the original message only if it's short and user-friendly
  return message;
}

/**
 * Wrapper for toast error messages with consistent formatting
 */
export function showErrorToast(toast: any, title: string, error: any) {
  toast.error(title, {
    description: getErrorMessage(error),
  });
}