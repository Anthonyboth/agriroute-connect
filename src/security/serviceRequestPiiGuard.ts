/**
 * serviceRequestPiiGuard.ts
 *
 * Módulo de proteção de PII (dados pessoais) em solicitações de serviço.
 * Garante que dados sensíveis como telefone, endereço completo e coordenadas
 * NÃO sejam expostos antes do aceite (status OPEN).
 *
 * Regras:
 * - OPEN: apenas cidade, tipo, urgência, descrição resumida
 * - ACCEPTED+: dados completos (contact_name, contact_phone, endereço, coordenadas)
 */

// =============================================================================
// TIPOS
// =============================================================================

export interface ServiceRequestPiiFields {
  contact_phone?: string | null;
  contact_phone_safe?: string | null;
  contact_name?: string | null;
  contact_email?: string | null;
  location_address?: string | null;
  location_address_safe?: string | null;
  location_lat?: number | null;
  location_lng?: number | null;
  city_name?: string | null;
  state?: string | null;
  status?: string;
  provider_id?: string | null;
  [key: string]: unknown;
}

export interface PiiMaskResult {
  masked: boolean;
  reason: string | null;
}

// =============================================================================
// CONSTANTES
// =============================================================================

/** Status que permitem acesso completo a PII (após aceite) */
const PII_VISIBLE_STATUSES = new Set([
  'ACCEPTED',
  'ON_THE_WAY',
  'IN_PROGRESS',
  'COMPLETED',
]);

/** Campos que devem ser mascarados em status OPEN */
const PII_FIELDS_TO_MASK: (keyof ServiceRequestPiiFields)[] = [
  'contact_phone',
  'contact_phone_safe',
  'contact_name',
  'contact_email',
  'location_address',
  'location_address_safe',
  'location_lat',
  'location_lng',
];

// =============================================================================
// FUNÇÕES
// =============================================================================

/**
 * Verifica se PII deve ser visível para o status dado.
 */
export function isPiiVisibleForStatus(status: string): boolean {
  if (!status) return false;
  return PII_VISIBLE_STATUSES.has(status.toUpperCase().trim());
}

/**
 * Mascara dados PII de uma service_request quando status = OPEN.
 * Retorna cópia do objeto com campos sensíveis removidos/mascarados.
 *
 * Em status OPEN:
 *   - contact_phone → null
 *   - contact_name → null
 *   - contact_email → null
 *   - location_address → cidade genérica
 *   - location_lat/lng → null
 *
 * Em ACCEPTED+: retorna dados originais sem alteração.
 */
export function maskServiceRequestPii<T extends ServiceRequestPiiFields>(
  request: T
): T {
  if (!request) return request;

  const status = (request.status || '').toUpperCase().trim();

  // Se status permite PII, retornar sem alteração
  if (isPiiVisibleForStatus(status)) {
    return request;
  }

  // Status OPEN ou desconhecido: mascarar PII
  const masked = { ...request };

  masked.contact_phone = null;
  masked.contact_phone_safe = null;
  masked.contact_name = null;
  masked.contact_email = null;
  masked.location_lat = null;
  masked.location_lng = null;

  // Substituir endereço completo por apenas cidade
  if (request.city_name) {
    masked.location_address = request.state
      ? `${request.city_name}, ${request.state}`
      : request.city_name;
  } else {
    masked.location_address = 'Localização não especificada';
  }
  masked.location_address_safe = masked.location_address;

  return masked;
}

/**
 * Verifica se um campo específico deve ser mascarado.
 */
export function shouldMaskField(
  fieldName: string,
  status: string
): PiiMaskResult {
  if (isPiiVisibleForStatus(status)) {
    return { masked: false, reason: null };
  }

  const isPiiField = PII_FIELDS_TO_MASK.includes(
    fieldName as keyof ServiceRequestPiiFields
  );

  if (isPiiField) {
    return {
      masked: true,
      reason: `Dados de contato só são visíveis após aceitar o serviço.`,
    };
  }

  return { masked: false, reason: null };
}

/**
 * Valida se os dados devem mostrar informações de contato para guest.
 * Guest = client_id === null
 * 
 * Regras:
 * - Se guest (client_id = null): chat indisponível, contato via WhatsApp/Ligação
 * - Se cadastrado (client_id != null): chat disponível
 */
export function getGuestContactRules(clientId: string | null): {
  chatAvailable: boolean;
  chatMessage: string;
  showWhatsApp: boolean;
  showCall: boolean;
} {
  if (!clientId) {
    return {
      chatAvailable: false,
      chatMessage: 'Chat indisponível para solicitante sem cadastro.',
      showWhatsApp: true,
      showCall: true,
    };
  }

  return {
    chatAvailable: true,
    chatMessage: '',
    showWhatsApp: false,
    showCall: false,
  };
}

/**
 * Normaliza número de telefone para uso em href (WhatsApp/tel).
 * Remove todos os caracteres não numéricos.
 */
export function normalizePhoneForHref(phone: string): string {
  if (!phone) return '';
  return phone.replace(/\D/g, '');
}

/**
 * Gera URL do WhatsApp com número normalizado.
 */
export function getWhatsAppUrl(phone: string): string {
  const clean = normalizePhoneForHref(phone);
  return `https://wa.me/55${clean}`;
}

/**
 * Gera href para ligação com número normalizado.
 */
export function getTelUrl(phone: string): string {
  const clean = normalizePhoneForHref(phone);
  return `tel:${clean}`;
}
