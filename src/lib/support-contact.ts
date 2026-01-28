/**
 * Constantes de contato de suporte da plataforma AgriRoute
 * Centralizadas para facilitar atualizações futuras
 */

export const SUPPORT_PHONE = '5566992734632';
export const SUPPORT_PHONE_DISPLAY = '(66) 9 9273-4632';
export const SUPPORT_EMAIL = 'agrirouteconnect@gmail.com';
export const WHATSAPP_URL = `https://wa.me/${SUPPORT_PHONE}`;
export const SUPPORT_HOURS = 'Seg-Seg: 07h-19h';

/**
 * Gera URL do WhatsApp com mensagem pré-definida
 * @param message - Mensagem opcional para pré-preencher
 * @returns URL completa do WhatsApp
 */
export const getWhatsAppUrl = (message?: string) => {
  const encodedMessage = message ? encodeURIComponent(message) : '';
  return `https://wa.me/${SUPPORT_PHONE}${encodedMessage ? `?text=${encodedMessage}` : ''}`;
};
