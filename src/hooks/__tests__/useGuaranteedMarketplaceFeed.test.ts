/**
 * Testes de integração para o feed determinístico de fretes e serviços.
 *
 * Cenários obrigatórios:
 * 1. Frete OPEN → aparece para transportadora com motorista afiliado cobrindo a city/raio
 * 2. Frete OPEN fora de 300km → NÃO aparece, motivo = OUTSIDE_RADIUS_300KM
 * 3. Serviço OPEN → aparece para prestador com city + service_type compatível
 * 4. Serviço OPEN com tipo diferente → NÃO aparece, motivo = SERVICE_TYPE_NOT_ENABLED
 * 5. Sem coordenadas → fallback por city_id funciona
 * 6. Falha de ranking → itens ainda aparecem (visibilidade > ranking)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

// =============================================
// Mocks
// =============================================

const mockRpc = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: () => ({
      select: () => ({ eq: () => ({ order: () => ({ limit: () => ({ data: [], error: null }) }) }) }),
    }),
  },
}));

// Helper: build authoritative feed payload
function authoritativeFeedPayload(freights: any[], services: any[], opts?: {
  fallback_used?: boolean;
  debug?: any;
}) {
  return {
    data: {
      freights,
      service_requests: services,
      metrics: {
        feed_total_eligible: freights.length + services.length,
        feed_total_displayed: freights.length + services.length,
        fallback_used: opts?.fallback_used ?? false,
        role: 'TRANSPORTADORA',
      },
      debug: opts?.debug ?? null,
    },
    error: null,
  };
}

function makeFreight(overrides: Partial<any> = {}) {
  return {
    id: 'freight-1', cargo_type: 'SOJA', weight: 30000,
    origin_city: 'Uberlândia', origin_state: 'MG',
    destination_city: 'São Paulo', destination_state: 'SP',
    price: 5000, urgency: 'LOW', status: 'OPEN',
    service_type: 'CARGA', distance_km: 500,
    required_trucks: 1, accepted_trucks: 0,
    created_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeService(overrides: Partial<any> = {}) {
  return {
    id: 'service-1', kind: 'SERVICE', service_type: 'GUINCHO',
    location_address: 'Uberlândia, MG', location_city: 'Uberlândia',
    location_state: 'MG', problem_description: 'Carro não liga',
    urgency: 'HIGH', status: 'OPEN', created_at: '2026-01-01T00:00:00Z',
    client_id: 'client-1', estimated_price: 200, distance_km: 15,
    ...overrides,
  };
}

// =============================================
// Tests — 6 cenários obrigatórios
// =============================================

describe('Feed Determinístico — 6 Cenários Obrigatórios', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function callFeed(profile: any, opts?: { debug?: boolean }) {
    const { useGuaranteedMarketplaceFeed } = await import('../useGuaranteedMarketplaceFeed');
    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    return result.current.fetchAvailableMarketplaceItems({
      profile,
      debug: opts?.debug ?? false,
    });
  }

  // ─── Cenário 1: Frete OPEN aparece para transportadora ───
  it('Frete OPEN aparece para transportadora com motorista cobrindo city/raio', async () => {
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload([makeFreight({ id: 'f-abc', distance_km: 120 })], [])
    );

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'TRANSPORTADORA',
      company_id: 'company-1',
      service_types: ['CARGA', 'GUINCHO'],
    });

    expect(result.freights).toHaveLength(1);
    expect(result.freights[0].id).toBe('f-abc');
    expect(mockRpc).toHaveBeenCalledWith('get_authoritative_feed', expect.objectContaining({
      p_role: 'TRANSPORTADORA',
    }));
  });

  // ─── Cenário 2: Frete fora de 300km NÃO aparece ───
  it('Frete OPEN fora de 300km NÃO aparece e debug mostra motivo OUTSIDE_RADIUS_300KM', async () => {
    const debug = {
      freight: {
        total_candidates: 1, total_eligible: 0, total_excluded: 1,
        excluded: [{ item_type: 'FREIGHT', item_id: 'f-far', service_type: 'CARGA', reason: 'OUTSIDE_RADIUS_300KM' }],
      },
      excluded_items: [{ item_type: 'FREIGHT', item_id: 'f-far', service_type: 'CARGA', reason: 'OUTSIDE_RADIUS_300KM' }],
    };

    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload([], [], { debug })
    );

    const result = await callFeed(
      { id: 'profile-1', active_mode: 'MOTORISTA', service_types: ['CARGA'] },
      { debug: true },
    );

    expect(result.freights).toHaveLength(0);
    expect(result.debug.freight).toBeTruthy();
    expect(result.debug.freight!.total_excluded).toBe(1);
    expect(result.debug.freight!.excluded[0].reason).toBe('OUTSIDE_RADIUS_300KM');
  });

  // ─── Cenário 3: Serviço OPEN aparece para prestador ───
  it('Serviço OPEN aparece para prestador com city + service_type compatível', async () => {
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload([], [makeService({ id: 'svc-match', service_type: 'GUINCHO' })])
    );

    const result = await callFeed({
      id: 'provider-1',
      active_mode: 'TRANSPORTADORA',
      service_types: ['GUINCHO'],
    });

    expect(result.serviceRequests).toHaveLength(1);
    expect(result.serviceRequests[0].id).toBe('svc-match');
  });

  // ─── Cenário 4: Serviço com tipo diferente NÃO aparece ───
  it('Serviço OPEN com tipo diferente NÃO aparece (tipo incompatível)', async () => {
    // Backend already filters, so it returns empty
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload([], [])
    );

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'TRANSPORTADORA',
      service_types: ['GUINCHO'],
    });

    expect(result.serviceRequests).toHaveLength(0);
  });

  // ─── Cenário 5: Sem coordenadas → fallback city_id ───
  it('Sem coordenadas → fallback por city_id funciona (frete retornado pela RPC)', async () => {
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload(
        [makeFreight({ id: 'f-no-coords', origin_lat: null, origin_lng: null })],
        [],
        { fallback_used: true }
      )
    );

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'MOTORISTA',
      service_types: ['CARGA'],
    });

    expect(result.freights).toHaveLength(1);
    expect(result.freights[0].id).toBe('f-no-coords');
    expect(result.metrics.fallback_used).toBe(true);
  });

  // ─── Cenário 6: Falha de ranking → itens ainda aparecem ───
  it('Falha de ranking → itens ainda aparecem (visibilidade > ranking)', async () => {
    // Simula fallback ativado (ranking falhou, mas itens aparecem)
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload(
        [makeFreight({ id: 'f-no-rank' }), makeFreight({ id: 'f-no-rank-2' })],
        [makeService({ id: 'svc-no-rank' })],
        { fallback_used: true }
      )
    );

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'MOTORISTA',
      service_types: ['CARGA', 'GUINCHO'],
    });

    // Itens DEVEM aparecer mesmo com fallback
    expect(result.freights).toHaveLength(2);
    expect(result.serviceRequests).toHaveLength(1);
    expect(result.metrics.fallback_used).toBe(true);
    expect(result.metrics.feed_total_eligible).toBe(3);
  });
});

// =============================================
// Feed Integrity Guard Tests
// =============================================

describe('Feed Integrity Guard', () => {
  it('Métricas de integridade refletem contagens corretas', async () => {
    mockRpc.mockResolvedValueOnce(
      authoritativeFeedPayload(
        [makeFreight({ id: 'f-1' }), makeFreight({ id: 'f-2' })],
        [makeService({ id: 's-1' })],
      )
    );

    const { useGuaranteedMarketplaceFeed } = await import('../useGuaranteedMarketplaceFeed');
    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());

    const feed = await result.current.fetchAvailableMarketplaceItems({
      profile: { id: 'p-1', active_mode: 'MOTORISTA', service_types: ['CARGA', 'GUINCHO'] },
    });

    expect(feed.metrics.feed_total_eligible).toBe(3);
    expect(feed.metrics.feed_total_displayed).toBe(3);
    expect(feed.metrics.fallback_used).toBe(false);
  });
});
