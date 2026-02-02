/**
 * Helper para abrir suporte - WhatsApp como canal padrão
 */

// Configuração de contato - WhatsApp é o canal principal
export const SUPPORT_CONFIG = {
  email: 'suporte@agriroute.com.br',
  // Número do WhatsApp do suporte (formato internacional sem +)
  whatsapp: '5565999999999', // TODO: Substituir pelo número real do suporte
  chatEnabled: false, // Habilitar quando chat interno estiver implementado
};

export interface SupportContext {
  screen?: string;
  documentType?: string;
  issuerUf?: string;
  errorCode?: string;
  freightId?: string;
  userId?: string;
  customMessage?: string;
}

/**
 * Abre o suporte via WhatsApp (canal padrão)
 */
export function openSupport(context?: SupportContext): void {
  // Se chat interno estiver habilitado, usar
  if (SUPPORT_CONFIG.chatEnabled) {
    window.dispatchEvent(new CustomEvent('open-support-chat', { detail: context }));
    return;
  }

  // WhatsApp é o canal padrão
  openWhatsAppSupport(context);
}

/**
 * Abre o WhatsApp com mensagem pré-formatada
 */
export function openWhatsAppSupport(context?: SupportContext): void {
  const message = buildWhatsAppMessage(context);
  const whatsappNumber = SUPPORT_CONFIG.whatsapp.replace(/\D/g, ''); // Remove caracteres não numéricos
  const url = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/**
 * Retorna a URL do WhatsApp para uso em links
 */
export function getWhatsAppUrl(context?: SupportContext): string {
  const message = buildWhatsAppMessage(context);
  const whatsappNumber = SUPPORT_CONFIG.whatsapp.replace(/\D/g, '');
  return `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`;
}

/**
 * Retorna o número formatado do WhatsApp para exibição
 */
export function getFormattedWhatsAppNumber(): string {
  const num = SUPPORT_CONFIG.whatsapp;
  if (!num) return '';
  
  // Formata como (XX) XXXXX-XXXX para números brasileiros
  if (num.startsWith('55') && num.length === 13) {
    const ddd = num.substring(2, 4);
    const part1 = num.substring(4, 9);
    const part2 = num.substring(9, 13);
    return `(${ddd}) ${part1}-${part2}`;
  }
  
  return num;
}

function buildWhatsAppMessage(context?: SupportContext): string {
  // Mensagem personalizada tem prioridade
  if (context?.customMessage) {
    return context.customMessage;
  }

  let msg = '🌱 *AgriRoute - Suporte*\n\nOlá! Preciso de ajuda.';
  
  if (context?.screen) {
    msg += `\n\n📍 *Tela:* ${context.screen}`;
  }
  if (context?.documentType) {
    msg += `\n📄 *Documento:* ${context.documentType}`;
  }
  if (context?.issuerUf) {
    msg += `\n🗺️ *Estado:* ${context.issuerUf}`;
  }
  if (context?.freightId) {
    msg += `\n🚚 *Frete:* ${context.freightId}`;
  }
  if (context?.errorCode) {
    msg += `\n⚠️ *Código de erro:* ${context.errorCode}`;
  }
  
  msg += '\n\n*Descreva sua dúvida:*\n';
  
  return msg;
}

function buildEmailBody(context?: SupportContext): string {
  let body = 'Olá,\n\nPreciso de ajuda com o AgriRoute.\n\n';
  
  if (context?.screen) {
    body += `Tela: ${context.screen}\n`;
  }
  if (context?.documentType) {
    body += `Tipo de Documento: ${context.documentType}\n`;
  }
  if (context?.issuerUf) {
    body += `Estado (UF): ${context.issuerUf}\n`;
  }
  if (context?.freightId) {
    body += `ID do Frete: ${context.freightId}\n`;
  }
  if (context?.errorCode) {
    body += `Código de Erro: ${context.errorCode}\n`;
  }
  
  body += '\nDescreva sua dúvida:\n';
  
  return body;
}

/**
 * Fallback para email (caso WhatsApp não funcione)
 */
export function openEmailSupport(context?: SupportContext): void {
  const subject = context?.screen 
    ? `Dúvida sobre ${context.screen} - AgriRoute` 
    : 'Dúvida - AgriRoute';
  
  const body = buildEmailBody(context);
  const url = `mailto:${SUPPORT_CONFIG.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  window.location.href = url;
}

/**
 * Informações de suporte para exibição em componentes
 */
export function getSupportFallbackInfo(): {
  title: string;
  message: string;
  email: string;
  whatsapp: string;
  whatsappFormatted: string;
} {
  return {
    title: 'Falar com Suporte',
    message: 'Entre em contato conosco via WhatsApp para ajuda rápida.',
    email: SUPPORT_CONFIG.email,
    whatsapp: SUPPORT_CONFIG.whatsapp,
    whatsappFormatted: getFormattedWhatsAppNumber(),
  };
}
