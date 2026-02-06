import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals, assertExists } from "https://deno.land/std@0.224.0/assert/mod.ts";

const SUPABASE_URL = Deno.env.get("VITE_SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("VITE_SUPABASE_PUBLISHABLE_KEY")!;

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/create-guest-rural-freight`;

async function invokeGuestFreight(body: Record<string, unknown>, headers?: Record<string, string>) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      ...(headers || {})
    },
    body: JSON.stringify(body)
  });
  const data = await res.json();
  return { status: res.status, data };
}

const validPayload = {
  guest_name: "João da Silva Teste",
  guest_phone: "65987654321",
  guest_document: "52998224725", // CPF válido
  cargo_type: "grao",
  service_type: "CARGA",
  weight: 30000,
  origin_city: "Cuiabá",
  origin_state: "MT",
  destination_city: "São Paulo",
  destination_state: "SP",
  price: 5000,
  pickup_date: "2026-12-01",
  delivery_date: "2026-12-05",
  urgency: "MEDIUM",
  required_trucks: 1,
};

// ─── TESTS ───

Deno.test("create-guest-rural-freight — rejeita payload vazio", async () => {
  const { status, data } = await invokeGuestFreight({});
  assertEquals(status, 400);
  assertExists(data.error);
  assertExists(data.code);
  assertEquals(data.code, "VALIDATION_FAILED");
});

Deno.test("create-guest-rural-freight — rejeita telefone inválido", async () => {
  const { status, data } = await invokeGuestFreight({
    ...validPayload,
    guest_phone: "123" // inválido
  });
  assertEquals(status, 400);
  assertEquals(data.code, "INVALID_PHONE");
});

Deno.test("create-guest-rural-freight — rejeita documento inválido", async () => {
  const { status, data } = await invokeGuestFreight({
    ...validPayload,
    guest_document: "00000000000" // CPF com todos zeros
  });
  assertEquals(status, 400);
  assertEquals(data.code, "INVALID_DOCUMENT");
});

Deno.test("create-guest-rural-freight — rejeita sem nome", async () => {
  const { status, data } = await invokeGuestFreight({
    ...validPayload,
    guest_name: "AB" // menos de 3 caracteres
  });
  assertEquals(status, 400);
  assertEquals(data.code, "VALIDATION_FAILED");
});

Deno.test("create-guest-rural-freight — rejeita data de coleta no passado", async () => {
  const { status, data } = await invokeGuestFreight({
    ...validPayload,
    pickup_date: "2020-01-01"
  });
  assertEquals(status, 400);
  assertEquals(data.code, "INVALID_PICKUP_DATE");
});

Deno.test("create-guest-rural-freight — rejeita preço zero", async () => {
  const { status, data } = await invokeGuestFreight({
    ...validPayload,
    price: 0
  });
  assertEquals(status, 400);
  assertEquals(data.code, "VALIDATION_FAILED");
});

Deno.test("create-guest-rural-freight — aceita payload válido", async () => {
  const { status, data } = await invokeGuestFreight(validPayload);
  // Should be 200 (ALLOWED) or 200 (REVIEW) — both are success
  assertEquals(status, 200);
  assertEquals(data.success, true);
  assertExists(data.requester_type);
  assertEquals(data.requester_type, "GUEST");
});

Deno.test("create-guest-rural-freight — mensagens em PT-BR (sem inglês)", async () => {
  // Test with invalid data to get error message
  const { data } = await invokeGuestFreight({
    ...validPayload,
    guest_phone: "123"
  });
  
  const errorMsg = data.error || "";
  const forbiddenTerms = ["error", "failed", "invalid input", "must be"];
  for (const term of forbiddenTerms) {
    assertEquals(
      errorMsg.toLowerCase().includes(term),
      false,
      `Mensagem de erro contém termo em inglês: "${term}" na mensagem: "${errorMsg}"`
    );
  }
});
