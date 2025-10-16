import { z } from 'zod';

// Common validations
export const phoneSchema = z.string()
  .min(10, "Telefone deve ter pelo menos 10 dígitos")
  .max(15, "Telefone deve ter no máximo 15 dígitos")
  .regex(/^[\d\s\-\(\)\+]+$/, "Formato de telefone inválido");

export const emailSchema = z.string()
  .email("E-mail inválido")
  .max(255, "E-mail deve ter no máximo 255 caracteres");

import { normalizeDocument, isValidDocument } from '@/utils/document';

export const cpfSchema = z.string()
  .transform(normalizeDocument)
  .refine((doc) => doc.length === 11, "CPF deve ter 11 dígitos")
  .refine((doc) => /^\d{11}$/.test(doc), "CPF inválido");

export const cnpjSchema = z.string()
  .transform(normalizeDocument)
  .refine((doc) => doc.length === 14, "CNPJ deve ter 14 dígitos")
  .refine((doc) => /^\d{14}$/.test(doc), "CNPJ inválido");

export const documentSchema = z.string()
  .transform(normalizeDocument)
  .refine((doc) => doc.length === 11 || doc.length === 14, {
    message: "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)"
  })
  .refine((doc) => isValidDocument(doc), {
    message: "CPF ou CNPJ inválido"
  });

// Freight creation validation
export const freightSchema = z.object({
  cargo_type: z.string()
    .min(1, "Tipo de carga é obrigatório")
    .max(100, "Tipo de carga deve ter no máximo 100 caracteres"),
  weight: z.coerce.number()
    .min(0.1, "Peso deve ser maior que 0.1 kg"),
  origin_address: z.string()
    .min(5, "Endereço de origem deve ter pelo menos 5 caracteres")
    .max(500, "Endereço de origem deve ter no máximo 500 caracteres"),
  destination_address: z.string()
    .min(5, "Endereço de destino deve ter pelo menos 5 caracteres")
    .max(500, "Endereço de destino deve ter no máximo 500 caracteres"),
  price: z.coerce.number()
    .min(1, "Preço deve ser maior que R$ 1")
    .max(1000000, "Preço não pode ser maior que R$ 1.000.000"),
  pickup_date: z.string()
    .refine((date) => new Date(date) >= new Date(), "Data de coleta deve ser futura"),
  delivery_date: z.string()
    .refine((date) => new Date(date) >= new Date(), "Data de entrega deve ser futura"),
  description: z.string()
    .max(1000, "Descrição deve ter no máximo 1000 caracteres")
    .optional(),
});

// User registration validation
export const userRegistrationSchema = z.object({
  full_name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres")
    .regex(/^[a-zA-ZÀ-ÿ\s]+$/, "Nome deve conter apenas letras e espaços"),
  email: emailSchema,
  password: z.string()
    .min(8, "Senha deve ter pelo menos 8 caracteres")
    .max(128, "Senha deve ter no máximo 128 caracteres")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Senha deve conter pelo menos uma letra minúscula, uma maiúscula e um número"),
  phone: phoneSchema,
  document: documentSchema,
  role: z.enum(['PRODUTOR', 'MOTORISTA', 'PRESTADOR_SERVICOS'], {
    errorMap: () => ({ message: "Papel inválido" })
  }),
});

// Contact form validation
export const contactSchema = z.object({
  name: z.string()
    .min(2, "Nome deve ter pelo menos 2 caracteres")
    .max(100, "Nome deve ter no máximo 100 caracteres"),
  email: emailSchema,
  phone: phoneSchema.optional(),
  message: z.string()
    .min(10, "Mensagem deve ter pelo menos 10 caracteres")
    .max(1000, "Mensagem deve ter no máximo 1000 caracteres"),
});

// Payment validation
export const paymentSchema = z.object({
  amount: z.coerce.number()
    .min(1, "Valor deve ser maior que R$ 1")
    .max(1000000, "Valor não pode ser maior que R$ 1.000.000"),
  payment_method: z.enum(['STRIPE', 'PIX', 'DINHEIRO'], {
    errorMap: () => ({ message: "Método de pagamento inválido" })
  }),
  freight_id: z.string().uuid("ID do frete inválido"),
});

// Proposal validation
export const proposalSchema = z.object({
  proposed_price: z.coerce.number()
    .min(1, "Preço proposto deve ser maior que R$ 1")
    .max(1000000, "Preço proposto não pode ser maior que R$ 1.000.000"),
  delivery_estimate_days: z.coerce.number()
    .min(1, "Prazo de entrega deve ser de pelo menos 1 dia")
    .max(365, "Prazo de entrega não pode ser maior que 365 dias")
    .optional(),
  message: z.string()
    .max(500, "Mensagem deve ter no máximo 500 caracteres")
    .optional(),
  freight_id: z.string().uuid("ID do frete inválido"),
});

// Message validation
export const messageSchema = z.object({
  message: z.string()
    .min(1, "Mensagem não pode estar vazia")
    .max(1000, "Mensagem deve ter no máximo 1000 caracteres"),
  freight_id: z.string().uuid("ID do frete inválido"),
});

// URL validation for file uploads
export const fileUrlSchema = z.string()
  .url("URL inválida")
  .refine((url) => url.startsWith('https://'), "URL deve usar HTTPS");

// Validation helper function
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  try {
    const validated = schema.parse(data);
    return { success: true, data: validated };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        errors: error.errors.map(e => e.message)
      };
    }
    return {
      success: false,
      errors: ['Erro de validação desconhecido']
    };
  }
}