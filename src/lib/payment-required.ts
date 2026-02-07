/**
 * Helper para extrair PAYMENT_REQUIRED de respostas do supabase.functions.invoke.
 * 
 * O erro 402 pode vir em:
 *   1. data.code === 'PAYMENT_REQUIRED' (quando edge function retorna JSON com status 200)
 *   2. error.context (quando edge function retorna status 402 — supabase-js wrapa em error)
 * 
 * CT-e e MDF-e tratavam apenas o caso 1. Este helper unifica ambos.
 */

export interface PaymentRequiredResult {
  required: boolean;
  document_ref?: string;
  amount_centavos?: number;
}

/**
 * Extrai informações de PAYMENT_REQUIRED de data ou error do supabase.functions.invoke.
 * 
 * IMPORTANTE: é async porque error.context pode ser um Response object.
 */
export async function extractPaymentRequired(data: any, error: any): Promise<PaymentRequiredResult> {
  // 1. Verificar em data (resposta direta — edge function retornou 200 com code)
  if (data?.code === 'PAYMENT_REQUIRED') {
    return {
      required: true,
      document_ref: data?.document_ref,
      amount_centavos: typeof data?.amount_centavos === 'number' ? data.amount_centavos : undefined,
    };
  }

  // 2. Verificar em error (edge function retornou status != 2xx)
  if (error) {
    const parsed = await parseErrorContext(error);
    if (parsed?.code === 'PAYMENT_REQUIRED') {
      return {
        required: true,
        document_ref: parsed?.document_ref,
        amount_centavos: typeof parsed?.amount_centavos === 'number' ? parsed.amount_centavos : undefined,
      };
    }
  }

  return { required: false };
}

/**
 * Tenta extrair o body JSON de um erro do supabase.functions.invoke.
 * O error.context pode ser um Response object, um objeto plain, ou a mensagem pode conter JSON.
 */
async function parseErrorContext(err: any): Promise<any | null> {
  const ctx = err?.context;

  // Caso 1: context é um Response — clonar e ler JSON
  if (ctx && typeof ctx.clone === 'function') {
    try {
      return await ctx.clone().json();
    } catch { /* ignore */ }
  }

  // Caso 2: context tem .json() diretamente
  if (ctx && typeof ctx.json === 'function') {
    try {
      return await ctx.json();
    } catch { /* ignore */ }
  }

  // Caso 3: context é um objeto plain com .code
  if (ctx && typeof ctx === 'object' && ctx.code) {
    return ctx;
  }

  // Caso 4: Fallback — JSON embutido na mensagem de erro
  const msg = err?.message;
  if (typeof msg === 'string') {
    const start = msg.indexOf('{');
    const end = msg.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      try {
        return JSON.parse(msg.slice(start, end + 1));
      } catch { /* ignore */ }
    }
  }

  return null;
}
