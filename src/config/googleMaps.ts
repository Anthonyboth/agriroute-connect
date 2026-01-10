/**
 * Configuração centralizada do Google Maps
 * 
 * A API Key é definida aqui para garantir que todos os componentes
 * que usam Google Maps tenham acesso consistente à chave.
 */

// API Key do Google Maps - fallback para env se disponível
export const GOOGLE_MAPS_API_KEY = 
  import.meta.env.VITE_GOOGLE_MAPS_API_KEY || 
  'AIzaSyC319MDPuNpdWq5dQb-kmwuXppuHLiFzhg';

// Validação da configuração
export const isGoogleMapsConfigured = (): boolean => {
  return Boolean(GOOGLE_MAPS_API_KEY && GOOGLE_MAPS_API_KEY.length > 0);
};

// Helper para obter mensagem de erro detalhada
export const getGoogleMapsErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    
    if (message.includes('referernotallowed')) {
      return 'Domínio não autorizado nas configurações da API Key';
    }
    if (message.includes('apinotactivated') || message.includes('api not activated')) {
      return 'Maps JavaScript API não está ativada no Google Cloud Console';
    }
    if (message.includes('billingnotenabledmapError') || message.includes('billing')) {
      return 'Faturamento não habilitado no Google Cloud Console';
    }
    if (message.includes('invalidkey') || message.includes('invalid key')) {
      return 'API Key inválida';
    }
    if (message.includes('expiredkey')) {
      return 'API Key expirada';
    }
    
    return error.message;
  }
  
  return 'Erro desconhecido ao carregar o mapa';
};
