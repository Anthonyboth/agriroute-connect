/**
 * Helper para abrir suporte
 */

// Configuração de contato (pode ser atualizada conforme disponibilidade)
export const SUPPORT_CONFIG = {
  email: 'suporte@agriroute.com.br',
  whatsapp: '', // Preencher quando disponível
  chatEnabled: false, // Habilitar quando chat interno estiver implementado
};

export interface SupportContext {
  screen?: string;
  documentType?: string;
  issuerUf?: string;
  errorCode?: string;
}

/**
 * Abre o canal de suporte adequado
 */
export function openSupport(context?: SupportContext): void {
  // Se chat interno estiver habilitado, usar
  if (SUPPORT_CONFIG.chatEnabled) {
    // Disparar evento para abrir chat
    window.dispatchEvent(new CustomEvent('open-support-chat', { detail: context }));
    return;
  }

  // Se tiver WhatsApp configurado
  if (SUPPORT_CONFIG.whatsapp) {
    const message = buildWhatsAppMessage(context);
    const url = `https://wa.me/${SUPPORT_CONFIG.whatsapp}?text=${encodeURIComponent(message)}`;
    window.open(url, '_blank');
    return;
  }

  // Fallback para email
  const subject = context?.screen 
    ? `Dúvida sobre ${context.screen} - AgriRoute` 
    : 'Dúvida sobre Área Fiscal - AgriRoute';
  
  const body = buildEmailBody(context);
  const url = `mailto:${SUPPORT_CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

function buildWhatsAppMessage(context?: SupportContext): string {
  let msg = 'Olá! Preciso de ajuda com a Área Fiscal do AgriRoute.';
  
  if (context?.screen) {
    msg += `\n\nTela: ${context.screen}`;
  }
  if (context?.documentType) {
    msg += `\nDocumento: ${context.documentType}`;
  }
  if (context?.issuerUf) {
    msg += `\nEstado: ${context.issuerUf}`;
  }
  if (context?.errorCode) {
    msg += `\nCódigo de erro: ${context.errorCode}`;
  }
  
  return msg;
}

function buildEmailBody(context?: SupportContext): string {
  let body = 'Olá,\n\nPreciso de ajuda com a Área Fiscal do AgriRoute.\n\n';
  
  if (context?.screen) {
    body += `Tela: ${context.screen}\n`;
  }
  if (context?.documentType) {
    body += `Tipo de Documento: ${context.documentType}\n`;
  }
  if (context?.issuerUf) {
    body += `Estado (UF): ${context.issuerUf}\n`;
  }
  if (context?.errorCode) {
    body += `Código de Erro: ${context.errorCode}\n`;
  }
  
  body += '\nDescreva sua dúvida:\n';
  
  return body;
}

/**
 * Componente de fallback para suporte quando não há chat
 */
export function getSupportFallbackInfo(): {
  title: string;
  message: string;
  email: string;
  whatsapp?: string;
} {
  return {
    title: 'Falar com Suporte',
    message: 'Entre em contato conosco para tirar suas dúvidas sobre a área fiscal.',
    email: SUPPORT_CONFIG.email,
    whatsapp: SUPPORT_CONFIG.whatsapp || undefined,
  };
}
