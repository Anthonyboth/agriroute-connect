import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useDriverFreightVisibility } from "./useDriverFreightVisibility";

describe("useDriverFreightVisibility", () => {
  // ─── Rural only ───
  describe("when driver has only CARGA (rural)", () => {
    it("shows rural, hides urban, no tab selector", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.hasRuralFreights).toBe(true);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("canSeeFreightByType allows CARGA, blocks urban types", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType("CARGA")).toBe(true);
      expect(result.current.canSeeFreightByType("GUINCHO")).toBe(false);
      expect(result.current.canSeeFreightByType("MUDANCA")).toBe(false);
      expect(result.current.canSeeFreightByType("FRETE_MOTO")).toBe(false);
      expect(result.current.canSeeFreightByType("ENTREGA_PACOTES")).toBe(false);
      expect(result.current.canSeeFreightByType("TRANSPORTE_PET")).toBe(false);
    });
  });

  // ─── Urban only ───
  describe("when driver has only urban types", () => {
    it("shows urban, hides rural, no tab selector (GUINCHO)", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["GUINCHO"] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("shows urban, hides rural, no tab selector (MUDANCA)", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["MUDANCA"] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("canSeeFreightByType blocks CARGA when only urban", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["GUINCHO", "MUDANCA"] })
      );
      expect(result.current.canSeeFreightByType("CARGA")).toBe(false);
      expect(result.current.canSeeFreightByType("GUINCHO")).toBe(true);
      expect(result.current.canSeeFreightByType("MUDANCA")).toBe(true);
    });
  });

  // ─── Both rural + urban ───
  describe("when driver has both rural and urban types", () => {
    it("shows both and enables tab selector", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA", "GUINCHO"] })
      );
      expect(result.current.hasRuralFreights).toBe(true);
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.showTabSelector).toBe(true);
    });

    it("canSeeFreightByType allows both categories", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA", "MUDANCA", "FRETE_MOTO"] })
      );
      expect(result.current.canSeeFreightByType("CARGA")).toBe(true);
      expect(result.current.canSeeFreightByType("MUDANCA")).toBe(true);
      expect(result.current.canSeeFreightByType("FRETE_MOTO")).toBe(true);
      expect(result.current.canSeeFreightByType("GUINCHO")).toBe(false);
    });
  });

  // ─── Empty / no service types ───
  describe("when driver has no service types", () => {
    it("hides everything when empty array", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: [] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("hides everything when undefined", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: undefined })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("hides everything when null", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: null })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("defaults to rural when defaultToRuralWhenEmpty is true", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: [], defaultToRuralWhenEmpty: true })
      );
      expect(result.current.hasRuralFreights).toBe(true);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
    });
  });

  // ─── Alias normalization ───
  describe("alias normalization", () => {
    it("normalizes FRETE to CARGA", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["FRETE"] })
      );
      expect(result.current.hasRuralFreights).toBe(true);
      expect(result.current.canSeeFreightByType("CARGA")).toBe(true);
    });

    it("normalizes MOTOBOY to FRETE_MOTO", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["MOTOBOY"] })
      );
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.canSeeFreightByType("FRETE_MOTO")).toBe(true);
    });

    it("normalizes REBOQUE to GUINCHO", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["REBOQUE"] })
      );
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.canSeeFreightByType("GUINCHO")).toBe(true);
    });

    it("normalizes MUDANCAS to MUDANCA", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["MUDANCAS"] })
      );
      expect(result.current.canSeeFreightByType("MUDANCA")).toBe(true);
    });

    it("normalizes PET to TRANSPORTE_PET", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["PET"] })
      );
      expect(result.current.canSeeFreightByType("TRANSPORTE_PET")).toBe(true);
    });

    it("normalizes ENTREGA to ENTREGA_PACOTES", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["ENTREGA"] })
      );
      expect(result.current.canSeeFreightByType("ENTREGA_PACOTES")).toBe(true);
    });
  });

  // ─── Invalid / unknown types ───
  describe("invalid service types", () => {
    it("ignores unknown types completely", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["BANANA", "AVIAO", "TREM"] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.normalizedServiceTypes).toEqual([]);
    });

    it("keeps valid types and ignores invalid ones", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA", "INVALID", "GUINCHO"] })
      );
      expect(result.current.normalizedServiceTypes).toEqual(["CARGA", "GUINCHO"]);
      expect(result.current.hasRuralFreights).toBe(true);
      expect(result.current.hasUrbanFreights).toBe(true);
    });
  });

  // ─── canSeeFreightByType edge cases ───
  describe("canSeeFreightByType edge cases", () => {
    it("returns false for null input", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType(null)).toBe(false);
    });

    it("returns false for undefined input", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType(undefined)).toBe(false);
    });

    it("returns false for empty string", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType("")).toBe(false);
    });

    it("is case-insensitive", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType("carga")).toBe(true);
      expect(result.current.canSeeFreightByType("Carga")).toBe(true);
    });

    it("resolves aliases in freight type too", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.canSeeFreightByType("FRETE")).toBe(true);
      expect(result.current.canSeeFreightByType("TRANSPORTE_CARGA")).toBe(true);
    });
  });

  // ─── Deduplication ───
  describe("deduplication", () => {
    it("deduplicates identical types", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA", "CARGA", "CARGA"] })
      );
      expect(result.current.normalizedServiceTypes).toEqual(["CARGA"]);
    });

    it("deduplicates aliases that resolve to same canonical type", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA", "FRETE", "TRANSPORTE_CARGA"] })
      );
      expect(result.current.normalizedServiceTypes).toEqual(["CARGA"]);
    });
  });

  // ─── THE CRITICAL REGRESSION TEST ───
  describe("🚨 REGRESSION: rural tab must NOT appear when only urban is selected", () => {
    it("driver with ONLY GUINCHO must NOT see rural freights", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["GUINCHO"] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.showTabSelector).toBe(false);
      expect(result.current.canSeeFreightByType("CARGA")).toBe(false);
    });

    it("driver with ONLY MUDANCA must NOT see rural freights", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["MUDANCA"] })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
      expect(result.current.canSeeFreightByType("CARGA")).toBe(false);
    });

    it("driver with ONLY urban types must NOT see rural tab", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({
          serviceTypes: ["GUINCHO", "MUDANCA", "FRETE_MOTO", "ENTREGA_PACOTES", "TRANSPORTE_PET"],
        })
      );
      expect(result.current.hasRuralFreights).toBe(false);
      expect(result.current.hasUrbanFreights).toBe(true);
      expect(result.current.showTabSelector).toBe(false);
    });

    it("driver with ONLY CARGA must NOT see urban freights", () => {
      const { result } = renderHook(() =>
        useDriverFreightVisibility({ serviceTypes: ["CARGA"] })
      );
      expect(result.current.hasUrbanFreights).toBe(false);
      expect(result.current.showTabSelector).toBe(false);
      expect(result.current.canSeeFreightByType("GUINCHO")).toBe(false);
      expect(result.current.canSeeFreightByType("MUDANCA")).toBe(false);
    });
  });
});
