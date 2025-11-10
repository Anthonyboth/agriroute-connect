import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

// Normalize document (remove non-digits)
function normalizeDocument(doc: string): string {
  return doc.replace(/\D/g, '');
}

// Validate CPF algorithm
function validateCPF(cpf: string): boolean {
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;
  
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i)) * (10 - i);
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cpf.charAt(9)) !== firstDigit) return false;
  
  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i)) * (11 - i);
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(cpf.charAt(10)) === secondDigit;
}

// Validate CNPJ algorithm
function validateCNPJ(cnpj: string): boolean {
  if (cnpj.length !== 14 || /^(\d)\1{13}$/.test(cnpj)) return false;
  
  let sum = 0;
  let weight = 2;
  for (let i = 11; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  let remainder = sum % 11;
  let firstDigit = remainder < 2 ? 0 : 11 - remainder;
  if (parseInt(cnpj.charAt(12)) !== firstDigit) return false;
  
  sum = 0;
  weight = 2;
  for (let i = 12; i >= 0; i--) {
    sum += parseInt(cnpj.charAt(i)) * weight;
    weight = weight === 9 ? 2 : weight + 1;
  }
  remainder = sum % 11;
  let secondDigit = remainder < 2 ? 0 : 11 - remainder;
  return parseInt(cnpj.charAt(13)) === secondDigit;
}

// Validate document (CPF or CNPJ)
function isValidDocument(doc: string): boolean {
  const normalized = normalizeDocument(doc);
  if (normalized.length === 11) return validateCPF(normalized);
  if (normalized.length === 14) return validateCNPJ(normalized);
  return false;
}

// Document schema with preprocessing
export const documentNumberSchema = z.string()
  .transform(normalizeDocument)
  .refine((doc) => doc.length === 11 || doc.length === 14, {
    message: "Documento deve ser CPF (11 dígitos) ou CNPJ (14 dígitos)"
  })
  .refine((doc) => isValidDocument(doc), {
    message: "CPF ou CNPJ inválido"
  });

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): T {
  try {
    return schema.parse(data);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Response(
        JSON.stringify({ 
          error: 'Invalid input', 
          details: error.errors.map(e => ({
            field: e.path.join('.'),
            message: e.message
          }))
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
    throw error;
  }
}

// Common validation schemas
export const uuidSchema = z.string().uuid('Invalid UUID format');
export const amountSchema = z.number().min(1, 'Amount must be at least 1').max(1000000, 'Amount cannot exceed 1,000,000');
export const pixKeySchema = z.string().min(11, 'Invalid PIX key').max(100, 'PIX key too long');
export const textSchema = (maxLength: number = 500) => z.string().max(maxLength, `Text cannot exceed ${maxLength} characters`);
export const coordinateSchema = z.number().min(-90).max(90);
export const longitudeSchema = z.number().min(-180).max(180);

// Error Report Schema with comprehensive validation
export const ErrorReportSchema = z.object({
  errorType: z.enum(['FRONTEND', 'BACKEND', 'DATABASE', 'NETWORK', 'PAYMENT'], {
    errorMap: () => ({ message: 'Invalid error type' })
  }),
  errorCategory: z.enum(['SIMPLE', 'CRITICAL'], {
    errorMap: () => ({ message: 'Invalid error category' })
  }),
  errorMessage: z.string()
    .min(1, 'Error message required')
    .max(1000, 'Error message too long (max 1000 chars)'),
  errorStack: z.string()
    .max(5000, 'Stack trace too long (max 5000 chars)')
    .optional(),
  errorCode: z.string()
    .max(50, 'Error code too long (max 50 chars)')
    .optional(),
  module: z.string()
    .max(200, 'Module name too long (max 200 chars)')
    .optional(),
  functionName: z.string()
    .max(200, 'Function name too long (max 200 chars)')
    .optional(),
  route: z.string()
    .max(500, 'Route too long (max 500 chars)')
    .optional(),
  userId: z.string()
    .uuid('Invalid user ID format')
    .optional(),
  userEmail: z.string()
    .email('Invalid email format')
    .max(255, 'Email too long (max 255 chars)')
    .optional(),
  autoCorrectionAttempted: z.boolean().default(false),
  autoCorrectionAction: z.string()
    .max(500, 'Auto-correction action too long')
    .optional(),
  autoCorrectionSuccess: z.boolean().optional(),
  metadata: z.record(z.string(), z.unknown())
    .optional()
});

export type ErrorReport = z.infer<typeof ErrorReportSchema>;

/**
 * Sanitizes an error report by truncating fields and removing deep objects
 */
export function sanitizeErrorReport(report: ErrorReport): ErrorReport {
  return {
    ...report,
    errorMessage: report.errorMessage.slice(0, 1000),
    errorStack: report.errorStack?.slice(0, 5000),
    metadata: report.metadata ? {
      ...report.metadata,
      _sanitized: true,
      _timestamp: new Date().toISOString()
    } : undefined
  };
}
