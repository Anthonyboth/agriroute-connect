/**
 * src/lib/checkFreightRequester.ts
 * 
 * Helper centralizado para verificar se o solicitante de um frete tem cadastro.
 * Normaliza o schema da resposta e implementa fail-closed correto:
 * - false → solicitante confirmado como sem cadastro (bloquear)
 * - true  → solicitante com cadastro (prosseguir)
 * - null  → erro ou schema inválido (NÃO bloquear — evita falso positivo)
 */

import { supabase } from "@/integrations/supabase/client";

/** Canonical response shape from check-freight-requester edge function */
export interface CheckRequesterResponse {
  success: boolean;
  requester: {
    type: string;
    has_registration: boolean;
    producer_id: string | null;
    producer_name: string | null;
    producer_status: string | null;
  };
}

/**
 * Normalizes the edge function response to a canonical shape.
 * Returns null if the response doesn't match any known shape.
 */
export function normalizeCheckRequesterResponse(data: unknown): CheckRequesterResponse | null {
  if (!data || typeof data !== "object") return null;

  const d = data as Record<string, any>;

  // Standard EN shape
  if (
    d.success === true &&
    d.requester &&
    typeof d.requester === "object" &&
    typeof d.requester.has_registration === "boolean"
  ) {
    return d as CheckRequesterResponse;
  }

  return null;
}

/**
 * Checks if the freight requester has a confirmed registration.
 * 
 * @returns
 * - `true`  → requester has confirmed registration (proceed)
 * - `false` → requester has NO registration (block action)
 * - `null`  → error or invalid response (DO NOT block — fail-open to avoid false positives)
 */
export async function checkFreightRequesterHasRegistration(
  freightId: string
): Promise<boolean | null> {
  try {
    const { data, error } = await supabase.functions.invoke("check-freight-requester", {
      body: { freight_id: freightId },
    });

    if (error) {
      console.warn("[checkFreightRequester] invoke error:", error.message ?? error);
      return null;
    }

    const normalized = normalizeCheckRequesterResponse(data);

    if (!normalized) {
      console.warn(
        "[checkFreightRequester] CONTRACT_MISMATCH — invalid response shape:",
        JSON.stringify(data)?.substring(0, 200)
      );
      return null;
    }

    return normalized.requester.has_registration;
  } catch (err: any) {
    console.warn("[checkFreightRequester] unexpected error:", err?.message ?? err);
    return null;
  }
}
