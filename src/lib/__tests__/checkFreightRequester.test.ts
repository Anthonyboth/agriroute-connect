import { describe, it, expect } from "vitest";
import { normalizeCheckRequesterResponse } from "@/lib/checkFreightRequester";

describe("normalizeCheckRequesterResponse", () => {
  it("accepts valid EN shape with has_registration=true", () => {
    const data = {
      success: true,
      requester: {
        type: "REGISTERED",
        has_registration: true,
        producer_id: "abc",
        producer_name: "Test",
        producer_status: "APPROVED",
      },
    };
    const result = normalizeCheckRequesterResponse(data);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(true);
  });

  it("accepts valid EN shape with has_registration=false", () => {
    const data = {
      success: true,
      requester: {
        type: "GUEST",
        has_registration: false,
        producer_id: null,
        producer_name: null,
        producer_status: null,
      },
    };
    const result = normalizeCheckRequesterResponse(data);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(false);
  });

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
    const data = { success: false, error: "Not found" };
    expect(normalizeCheckRequesterResponse(data)).toBeNull();
  });

  it("rejects missing requester", () => {
    const data = { success: true };
    expect(normalizeCheckRequesterResponse(data)).toBeNull();
  });

  it("rejects has_registration not boolean (string)", () => {
    const data = {
      success: true,
      requester: { has_registration: "true" },
    };
    expect(normalizeCheckRequesterResponse(data)).toBeNull();
  });

  it("rejects has_registration not boolean (undefined)", () => {
    const data = {
      success: true,
      requester: { type: "REGISTERED" },
    };
    expect(normalizeCheckRequesterResponse(data)).toBeNull();
  });

  it("rejects flat shape (the original bug)", () => {
    // This is exactly the shape that caused the bug:
    // checkData.has_registration was accessed instead of checkData.requester.has_registration
    const data = {
      success: true,
      has_registration: true,
    };
    expect(normalizeCheckRequesterResponse(data)).toBeNull();
  });

  it("accepts shape with extra fields", () => {
    const data = {
      success: true,
      requester: {
        type: "REGISTERED",
        has_registration: true,
        producer_id: "abc",
        producer_name: "Test",
        producer_status: "APPROVED",
        extra_field: "ignored",
      },
    };
    const result = normalizeCheckRequesterResponse(data);
    expect(result).not.toBeNull();
    expect(result!.requester.has_registration).toBe(true);
  });
});
