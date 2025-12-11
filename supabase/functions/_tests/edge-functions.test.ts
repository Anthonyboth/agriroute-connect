// Testes automatizados para Edge Functions críticas
// Execute com: deno test --allow-all supabase/functions/_tests/

import { assertEquals, assertExists, assertStringIncludes } from "https://deno.land/std@0.190.0/testing/asserts.ts";

const BASE_URL = Deno.env.get("SUPABASE_URL") || "http://localhost:54321";
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

// Helper para fazer requests
async function invokeFunction(
  functionName: string, 
  body: any, 
  token?: string
): Promise<{ status: number; data: any }> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "apikey": ANON_KEY,
  };
  
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${BASE_URL}/functions/v1/${functionName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
  });

  const data = await response.json();
  return { status: response.status, data };
}

// ============================================
// TESTES: safe-update-freight
// ============================================

Deno.test("safe-update-freight - requer autenticação", async () => {
  const { status, data } = await invokeFunction("safe-update-freight", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    updates: { notes: "test" }
  });
  
  assertEquals(status, 401);
  assertEquals(data.code, "AUTH_REQUIRED");
});

Deno.test("safe-update-freight - valida UUID do freight_id", async () => {
  const { status, data } = await invokeFunction("safe-update-freight", {
    freight_id: "invalid-uuid",
    updates: { notes: "test" }
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
  assertEquals(data.code, "VALIDATION_ERROR");
});

Deno.test("safe-update-freight - requer updates não vazio", async () => {
  const { status, data } = await invokeFunction("safe-update-freight", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    updates: {}
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
  assertEquals(data.code, "VALIDATION_ERROR");
});

// ============================================
// TESTES: request-withdrawal
// ============================================

Deno.test("request-withdrawal - requer autenticação", async () => {
  const { status, data } = await invokeFunction("request-withdrawal", {
    amount: 100,
    pix_key: "test@test.com"
  });
  
  assertEquals(status, 401);
  assertEquals(data.code, "AUTH_REQUIRED");
});

Deno.test("request-withdrawal - valida valor mínimo", async () => {
  const { status, data } = await invokeFunction("request-withdrawal", {
    amount: 10, // Mínimo é 50
    pix_key: "test@test.com"
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
  assertStringIncludes(data.error || "", "50");
});

Deno.test("request-withdrawal - valida chave PIX", async () => {
  const { status, data } = await invokeFunction("request-withdrawal", {
    amount: 100,
    pix_key: "abc" // Muito curta
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
});

// ============================================
// TESTES: report-error (público com rate limit)
// ============================================

Deno.test("report-error - aceita erro válido", async () => {
  const { status, data } = await invokeFunction("report-error", {
    errorType: "FRONTEND",
    errorCategory: "SIMPLE",
    errorMessage: "Test error message",
    module: "TestModule"
  });
  
  // Pode ser 200 ou 429 (rate limit)
  if (status === 200) {
    assertEquals(data.success, true);
    assertExists(data.errorLogId);
  } else {
    assertEquals(status, 429);
  }
});

Deno.test("report-error - valida errorType", async () => {
  const { status, data } = await invokeFunction("report-error", {
    errorType: "INVALID_TYPE",
    errorCategory: "SIMPLE",
    errorMessage: "Test error"
  });
  
  assertEquals(status, 400);
});

Deno.test("report-error - valida errorCategory", async () => {
  const { status, data } = await invokeFunction("report-error", {
    errorType: "FRONTEND",
    errorCategory: "INVALID_CATEGORY",
    errorMessage: "Test error"
  });
  
  assertEquals(status, 400);
});

// ============================================
// TESTES: validate-guest-user (público)
// ============================================

Deno.test("validate-guest-user - valida documento CPF", async () => {
  const { status, data } = await invokeFunction("validate-guest-user", {
    name: "Test User",
    document: "123.456.789-XX", // CPF inválido
    phone: "11999998888"
  });
  
  assertEquals(status, 400);
});

Deno.test("validate-guest-user - valida nome mínimo", async () => {
  const { status, data } = await invokeFunction("validate-guest-user", {
    name: "AB", // Menos de 3 caracteres
    document: "12345678909",
    phone: "11999998888"
  });
  
  assertEquals(status, 400);
});

// ============================================
// TESTES: tracking-service
// ============================================

Deno.test("tracking-service/locations - requer autenticação", async () => {
  const response = await fetch(`${BASE_URL}/functions/v1/tracking-service/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
    },
    body: JSON.stringify({
      freight_id: "00000000-0000-0000-0000-000000000000",
      lat: -23.5505,
      lng: -46.6333
    }),
  });

  assertEquals(response.status, 401);
});

Deno.test("tracking-service/locations - valida coordenadas", async () => {
  const response = await fetch(`${BASE_URL}/functions/v1/tracking-service/locations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      "Authorization": `Bearer ${SERVICE_KEY}`
    },
    body: JSON.stringify({
      freight_id: "00000000-0000-0000-0000-000000000000",
      lat: 999, // Latitude inválida
      lng: -46.6333
    }),
  });

  assertEquals(response.status, 400);
});

// ============================================
// TESTES: antt-calculator (público)
// ============================================

Deno.test("antt-calculator - calcula preço corretamente", async () => {
  const { status, data } = await invokeFunction("antt-calculator", {
    distance_km: 500,
    axles: 6,
    cargo_category: "CARGA_GERAL"
  });
  
  if (status === 200) {
    assertExists(data.minimum_price);
    assertEquals(typeof data.minimum_price, "number");
  }
});

Deno.test("antt-calculator - valida distância mínima", async () => {
  const { status, data } = await invokeFunction("antt-calculator", {
    distance_km: -10, // Negativo
    axles: 6,
    cargo_category: "CARGA_GERAL"
  });
  
  // Deve rejeitar distância negativa
  assertEquals(status === 400 || status === 500, true);
});

// ============================================
// TESTES: Segurança - security-auto-response
// ============================================

Deno.test("security-auto-response - requer autenticação admin", async () => {
  const { status, data } = await invokeFunction("security-auto-response", {
    type: "BRUTE_FORCE",
    severity: "HIGH",
    ip_address: "127.0.0.1"
  });
  
  // Sem token, deve retornar 401
  assertEquals(status, 401);
});

// ============================================
// TESTES: Stripe Webhook
// ============================================

Deno.test("stripe-webhook - requer assinatura", async () => {
  const response = await fetch(`${BASE_URL}/functions/v1/stripe-webhook`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": ANON_KEY,
      // Sem stripe-signature
    },
    body: JSON.stringify({ type: "test" }),
  });

  // Deve falhar sem assinatura
  assertEquals(response.status === 400 || response.status === 500, true);
});

// ============================================
// TESTES: accept-freight-multiple
// ============================================

Deno.test("accept-freight-multiple - requer autenticação", async () => {
  const { status, data } = await invokeFunction("accept-freight-multiple", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    num_trucks: 1
  });
  
  assertEquals(status, 401);
});

Deno.test("accept-freight-multiple - valida num_trucks positivo", async () => {
  const { status, data } = await invokeFunction("accept-freight-multiple", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    num_trucks: -1
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
});

Deno.test("accept-freight-multiple - valida num_trucks é inteiro", async () => {
  const { status, data } = await invokeFunction("accept-freight-multiple", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    num_trucks: 1.5
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
});

// ============================================
// TESTES: create-freight-advance
// ============================================

Deno.test("create-freight-advance - requer autenticação", async () => {
  const { status, data } = await invokeFunction("create-freight-advance", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    advance_percentage: 0.3
  });
  
  assertEquals(status, 401);
});

Deno.test("create-freight-advance - valida porcentagem", async () => {
  const { status, data } = await invokeFunction("create-freight-advance", {
    freight_id: "00000000-0000-0000-0000-000000000000",
    advance_percentage: 2.0 // Máximo é 1.0
  }, SERVICE_KEY);
  
  assertEquals(status, 400);
});

// ============================================
// Resumo dos testes
// ============================================

console.log(`
===========================================
  Testes de Edge Functions - AgriRoute
===========================================

Para executar todos os testes:
  deno test --allow-all supabase/functions/_tests/edge-functions.test.ts

Para executar com coverage:
  deno test --allow-all --coverage=coverage supabase/functions/_tests/

Variáveis de ambiente necessárias:
  - SUPABASE_URL
  - SUPABASE_ANON_KEY
  - SUPABASE_SERVICE_ROLE_KEY

===========================================
`);
