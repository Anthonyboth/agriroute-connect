import { z } from 'zod';
import { normalizeDocument, isValidDocument } from '@/utils/document';

// CRITICAL SECURITY: Input validation schemas to prevent injection attacks

// Common validation patterns
const phoneRegex = /^\+?[\d\s\-\(\)]+$/;
const emailSchema = z.string().email().max(255);
const phoneSchema = z.string().regex(phoneRegex, "Formato de telefone inválido").min(10).max(20);

// Document schema with preprocessing
const documentSchema = z.string()
  .transform(normalizeDocument)
  .refine((doc) => doc.length === 11 || doc.length === 14, {
    message: "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)"
  })
  .refine((doc) => isValidDocument(doc), {
    message: "CPF ou CNPJ inválido"
  });

// User/Profile validation
export const profileSchema = z.object({
  full_name: z.string().trim().min(2, "Nome deve ter pelo menos 2 caracteres").max(100),
  email: emailSchema,
  phone: phoneSchema,
  document: documentSchema,
  role: z.enum(['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICO', 'ADMIN']),
});

// Freight validation
export const freightSchema = z.object({
  cargo_type: z.string().trim().min(2).max(100),
  weight: z.number().positive(), // Remove weight limit to allow heavy freight
  origin_address: z.string().trim().min(5).max(500),
  destination_address: z.string().trim().min(5).max(500),
  pickup_date: z.string().refine((date) => new Date(date) > new Date(), {
    message: "Data de coleta deve ser futura"
  }),
  delivery_date: z.string().refine((date) => new Date(date) > new Date(), {
    message: "Data de entrega deve ser futura"
  }),
  price: z.number().positive().max(1000000),
  description: z.string().max(1000).optional(),
  urgency: z.enum(['LOW', 'MEDIUM', 'HIGH']),
});

// Payment validation
export const paymentSchema = z.object({
  amount: z.number().positive().max(1000000),
  payment_method: z.enum(['CREDIT_CARD', 'PIX', 'BANK_TRANSFER']),
  freight_id: z.string().uuid(),
});

// Message validation
export const messageSchema = z.object({
  message: z.string().trim().min(1).max(2000),
  freight_id: z.string().uuid(),
  message_type: z.enum(['TEXT', 'IMAGE']).default('TEXT'),
});

// Proposal validation
export const proposalSchema = z.object({
  freight_id: z.string().uuid(),
  proposed_price: z.number().positive().max(1000000),
  delivery_estimate_days: z.number().int().positive().max(365).optional(),
  message: z.string().max(500).optional(),
});

// External payment validation
export const externalPaymentSchema = z.object({
  freight_id: z.string().uuid(),
  amount: z.number().positive().max(1000000),
  notes: z.string().max(500).optional(),
});

// Rating validation
export const ratingSchema = z.object({
  rated_user_id: z.string().uuid(),
  freight_id: z.string().uuid().optional(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

// Service request validation
export const serviceRequestSchema = z.object({
  service_type: z.string().trim().min(2).max(100),
  contact_name: z.string().trim().min(2).max(100),
  contact_phone: phoneSchema,
  city_name: z.string().trim().min(2).max(100).optional(),
  state: z.string().trim().min(2).max(50).optional(),
  payload: z.record(z.any()),
});

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; error: string } {
  try {
    const result = schema.parse(data);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const message = error.errors.map(e => `${e.path.join('.')}: ${e.message}`).join(', ');
      return { success: false, error: message };
    }
    return { success: false, error: 'Erro de validação desconhecido' };
  }
}

// Sanitization helpers
export const sanitizeHtml = (input: string): string => {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, '') // Remove event handlers
    .trim();
};

export const sanitizeInput = (input: string): string => {
  return input
    .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters  
    .trim()
    .substring(0, 10000); // Limit length
};

/**
 * sanitizeForDisplaySafe - Sanitiza texto para exibição segura em innerHTML/popups.
 * Combina sanitizeHtml + sanitizeInput para máxima proteção contra XSS.
 */
export const sanitizeForDisplaySafe = (text: string): string => {
  return sanitizeHtml(sanitizeInput(text));
};

/**
 * isValidCoordinate - Valida coordenadas geográficas antes de persistência.
 * Rejeita 0,0 e coordenadas fora dos limites aproximados do Brasil.
 */
export const isValidCoordinate = (lat: number, lng: number): boolean => {
  // Rejeitar 0,0 (coordenada nula)
  if (lat === 0 && lng === 0) return false;
  
  // Rejeitar NaN/Infinity
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  
  // Limites aproximados do Brasil (com margem)
  // Lat: -33.75 a 5.27 | Lng: -73.99 a -34.79
  const BRAZIL_BOUNDS = {
    minLat: -35,
    maxLat: 7,
    minLng: -75,
    maxLng: -33,
  };
  
  return (
    lat >= BRAZIL_BOUNDS.minLat &&
    lat <= BRAZIL_BOUNDS.maxLat &&
    lng >= BRAZIL_BOUNDS.minLng &&
    lng <= BRAZIL_BOUNDS.maxLng
  );
};