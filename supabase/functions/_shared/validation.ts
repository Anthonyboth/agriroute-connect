import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

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
