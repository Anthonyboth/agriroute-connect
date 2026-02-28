import { describe, it, expect } from "vitest";
import { normalizeCheckRequesterResponse } from "@/lib/checkFreightRequester";
import type { CheckRequesterResponse } from "@/lib/checkFreightRequester";

// ═══════════════════════════════════════════════════════
// Contract snapshots — if the edge function changes shape,
// these tests BREAK and force a review.
// ═══════════════════════════════════════════════════════

const CANONICAL_REGISTERED: CheckRequesterResponse = {
  success: true,
  requester: {
    type: "REGISTERED",
    has_registration: true,
    producer_id: "abc-123",
    producer_name: "Fazenda Boa Vista",
    producer_status: "APPROVED",
  },
};

const CANONICAL_GUEST: CheckRequesterResponse = {
  success: true,
  requester: {
    type: "GUEST",
    has_registration: false,
    producer_id: null,
    producer_name: null,
    producer_status: null,
  },
};

describe("normalizeCheckRequesterResponse", () => {
  // ── Contract snapshot tests ──────────────────────────
  it("SNAPSHOT: REGISTERED shape matches canonical contract", () => {
    const result = normalizeCheckRequesterResponse(CANONICAL_REGISTERED);
    expect(result).toEqual(CANONICAL_REGISTERED);
  });

  it("SNAPSHOT: GUEST shape matches canonical contract", () => {
    const result = normalizeCheckRequesterResponse(CANONICAL_GUEST);
    expect(result).toEqual(CANONICAL_GUEST);
  });

  // ── Valid shapes ─────────────────────────────────────
  it("accepts valid EN shape with has_registration=true", () => {
    const result = normalizeCheckRequesterResponse(CANONICAL_REGISTERED);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(true);
    expect(result!.requester.type).toBe("REGISTERED");
  });

  it("accepts valid EN shape with has_registration=false", () => {
    const result = normalizeCheckRequesterResponse(CANONICAL_GUEST);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(false);
    expect(result!.requester.type).toBe("GUEST");
  });

  it("accepts shape with extra fields (forward compat)", () => {
    const data = {
      ...CANONICAL_REGISTERED,
      requester: {
        ...CANONICAL_REGISTERED.requester,
        extra_field: "ignored",
      },
    };
    const result = normalizeCheckRequesterResponse(data);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(true);
  });

  // ── Invalid shapes (must ALL return null) ────────────
  it("rejects null input", () => {
    expect(normalizeCheckRequesterResponse(null)).toBeNull();
  });

  it("rejects undefined input", () => {
    expect(normalizeCheckRequesterResponse(undefined)).toBeNull();
  });

  it("rejects empty object", () => {
    expect(normalizeCheckRequesterResponse({})).toBeNull();
  });

  it("rejects success=false", () => {
    expect(normalizeCheckRequesterResponse({ success: false, error: "Not found" })).toBeNull();
  });

  it("rejects missing requester", () => {
    expect(normalizeCheckRequesterResponse({ success: true })).toBeNull();
  });

  it("rejects has_registration as string", () => {
    expect(normalizeCheckRequesterResponse({
      success: true,
      requester: { has_registration: "true" },
    })).toBeNull();
  });

  it("rejects has_registration as undefined", () => {
    expect(normalizeCheckRequesterResponse({
      success: true,
      requester: { type: "REGISTERED" },
    })).toBeNull();
  });

  it("rejects flat shape (THE ORIGINAL BUG)", () => {
    // checkData.has_registration was accessed instead of checkData.requester.has_registration
    expect(normalizeCheckRequesterResponse({
      success: true,
      has_registration: true,
    })).toBeNull();
  });

  it("rejects requester as non-object", () => {
    expect(normalizeCheckRequesterResponse({
      success: true,
      requester: "REGISTERED",
    })).toBeNull();
  });

  it("rejects requester as null", () => {
    expect(normalizeCheckRequesterResponse({
      success: true,
      requester: null,
    })).toBeNull();
  });
});
