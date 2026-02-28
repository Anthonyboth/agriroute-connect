import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolvePostAuthRoute, waitForProfile, type ProfileForRouting } from '@/lib/route-after-auth';

// Mock supabase client
const mockMaybeSingle = vi.fn();
const mockLimit = vi.fn(() => ({ maybeSingle: mockMaybeSingle }));
const mockEqStatus = vi.fn(() => ({ limit: mockLimit }));
const mockEqDriver = vi.fn(() => ({ eq: mockEqStatus }));
const mockSelect = vi.fn(() => ({ eq: mockEqDriver }));

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn((table: string) => {
      if (table === 'company_drivers') {
        return { select: mockSelect };
      }
      // profiles table (for waitForProfile)
      return {
        select: vi.fn(() => ({
          eq: vi.fn(() => ({
            maybeSingle: mockMaybeSingle,
          })),
        })),
      };
    }),
  },
}));

/**
 * TESTES END-TO-END DOS 5 FLUXOS DE CADASTRO
 * 
 * Cobre todos os cenários do checklist QA "Apple Tester":
 * - Gate 1: Perfil incompleto → /complete-profile
 * - Gate 2: Motorista autônomo sem aprovação → /awaiting-approval
 * - Gate 3: Dashboard por role
 * - Bypass por URL bloqueado
 * - MOTORISTA_AFILIADO reconhecido
 */
describe('resolvePostAuthRoute — Registration Flow Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================
  // SEÇÃO B — PRODUTOR
  // ===========================
  describe('PRODUTOR flow', () => {
    it('[B1] incomplete profile → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'prod-1', role: 'PRODUTOR', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[B1b] missing only selfie → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'prod-1', role: 'PRODUTOR', status: 'PENDING',
        selfie_url: null, document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[B1c] missing only document → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'prod-1', role: 'PRODUTOR', status: 'PENDING',
        selfie_url: 'https://example.com/selfie.jpg', document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[B2] complete profile → /dashboard/producer', async () => {
      const profile: ProfileForRouting = {
        id: 'prod-1', role: 'PRODUTOR', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/producer');
    });

    it('[B2b] PRODUTOR with PENDING status still gets dashboard (no admin gate)', async () => {
      const profile: ProfileForRouting = {
        id: 'prod-1', role: 'PRODUTOR', status: 'PENDING',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/producer');
    });
  });

  // ===========================
  // SEÇÃO C — PRESTADOR_SERVICOS
  // ===========================
  describe('PRESTADOR_SERVICOS flow', () => {
    it('[C1] incomplete profile → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'prest-1', role: 'PRESTADOR_SERVICOS', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[C2] complete profile → /dashboard/service-provider', async () => {
      const profile: ProfileForRouting = {
        id: 'prest-1', role: 'PRESTADOR_SERVICOS', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/service-provider');
    });
  });

  // ===========================
  // SEÇÃO D — MOTORISTA AUTÔNOMO
  // ===========================
  describe('MOTORISTA autônomo flow', () => {
    it('[D1] incomplete → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[D2] complete + PENDING + no active link → /awaiting-approval', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'PENDING',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/awaiting-approval');
    });

    it('[D3] complete + REJECTED + no active link → /awaiting-approval', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: null, error: null });
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'REJECTED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/awaiting-approval');
    });

    it('[D4] complete + APPROVED → /dashboard/driver', async () => {
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/driver');
    });

    it('[D5] complete + PENDING + has ACTIVE link → /dashboard/driver (affiliated)', async () => {
      mockMaybeSingle.mockResolvedValueOnce({ data: { id: 'link-1' }, error: null });
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'PENDING',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/driver');
    });
  });

  // ===========================
  // SEÇÃO E — MOTORISTA_AFILIADO
  // ===========================
  describe('MOTORISTA_AFILIADO flow', () => {
    it('[E1] incomplete → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'afil-1', role: 'MOTORISTA_AFILIADO', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[E3] complete + APPROVED → /dashboard/driver (skips Gate 2)', async () => {
      const profile: ProfileForRouting = {
        id: 'afil-1', role: 'MOTORISTA_AFILIADO', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      // Gate 2 only checks role === 'MOTORISTA', so MOTORISTA_AFILIADO skips it
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/driver');
      // Verify company_drivers was NOT queried
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('[E3b] complete + PENDING → /dashboard/driver (Gate 2 skipped for MOTORISTA_AFILIADO)', async () => {
      const profile: ProfileForRouting = {
        id: 'afil-1', role: 'MOTORISTA_AFILIADO', status: 'PENDING',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/driver');
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });

  // ===========================
  // SEÇÃO H — TRANSPORTADORA
  // ===========================
  describe('TRANSPORTADORA flow', () => {
    it('[H1] incomplete → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'transp-1', role: 'TRANSPORTADORA', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('[H3] complete → /dashboard/company', async () => {
      const profile: ProfileForRouting = {
        id: 'transp-1', role: 'TRANSPORTADORA', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/dashboard/company');
    });
  });

  // ===========================
  // EDGE CASES
  // ===========================
  describe('Edge cases', () => {
    it('unknown role with complete profile → / (fallback)', async () => {
      const profile: ProfileForRouting = {
        id: 'x-1', role: 'UNKNOWN_ROLE', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/');
    });

    it('empty string selfie_url treated as falsy → /complete-profile', async () => {
      const profile: ProfileForRouting = {
        id: 'x-1', role: 'PRODUTOR', status: 'APPROVED',
        selfie_url: '', document_photo_url: 'https://example.com/doc.jpg',
      };
      expect(await resolvePostAuthRoute(profile)).toBe('/complete-profile');
    });

    it('Gate 1 takes precedence over Gate 2 (MOTORISTA incomplete)', async () => {
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'PENDING',
        selfie_url: null, document_photo_url: null,
      };
      const result = await resolvePostAuthRoute(profile);
      expect(result).toBe('/complete-profile');
      // Should NOT query company_drivers since Gate 1 already returned
      expect(mockSelect).not.toHaveBeenCalled();
    });

    it('MOTORISTA with APPROVED status never checks company_drivers', async () => {
      const profile: ProfileForRouting = {
        id: 'mot-1', role: 'MOTORISTA', status: 'APPROVED',
        selfie_url: 'https://example.com/selfie.jpg',
        document_photo_url: 'https://example.com/doc.jpg',
      };
      await resolvePostAuthRoute(profile);
      expect(mockSelect).not.toHaveBeenCalled();
    });
  });
});

describe('waitForProfile — Polling fallback', () => {
  it('returns /complete-profile when profile not found (null fallback)', async () => {
    // This tests the routeAfterAuth fallback, not waitForProfile directly
    // since waitForProfile depends on real supabase calls
    const { routeAfterAuth } = await import('@/lib/route-after-auth');
    
    // Mock profiles query to always return null
    const { supabase } = await import('@/integrations/supabase/client');
    vi.mocked(supabase.from).mockReturnValue({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    } as any);

    const result = await routeAfterAuth('non-existent-user-id');
    expect(result).toBe('/complete-profile');
  });
});
