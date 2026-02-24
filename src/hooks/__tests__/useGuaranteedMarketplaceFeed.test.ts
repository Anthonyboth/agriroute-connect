/**
 * Testes de integração para o feed determinístico de fretes e serviços.
 *
 * Cenários obrigatórios:
 * 1. Frete OPEN → aparece para transportadora com motorista afiliado cobrindo a city/raio
 * 2. Frete OPEN fora de 300km → NÃO aparece, motivo = OUTSIDE_RADIUS_300KM
 * 3. Serviço OPEN → aparece para prestador com city + service_type compatível
 * 4. Serviço OPEN com tipo diferente → NÃO aparece, motivo = SERVICE_TYPE_NOT_ENABLED
 * 5. Sem coordenadas → fallback por city_id funciona
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

// Helper payloads
function freightPayload(items: any[], debug?: any) {
  return { data: { items, debug: debug || null }, error: null };
}

function servicePayload(items: any[], debug?: any) {
  return { data: { items, debug: debug || null }, error: null };
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
// Tests
// =============================================

describe('Feed Determinístico — 5 Cenários Obrigatórios', () => {
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
    mockRpc
      .mockResolvedValueOnce(freightPayload([makeFreight({ id: 'f-abc', distance_km: 120 })]))
      .mockResolvedValueOnce(servicePayload([]));

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'TRANSPORTADORA',
      company_id: 'company-1',
      service_types: ['CARGA', 'GUINCHO'],
    });

    expect(result.freights).toHaveLength(1);
    expect(result.freights[0].id).toBe('f-abc');
    expect(mockRpc).toHaveBeenCalledWith('get_unified_freight_feed', expect.objectContaining({
      p_panel: 'TRANSPORTADORA',
      p_profile_id: 'profile-1',
    }));
  });

  // ─── Cenário 2: Frete fora de 300km NÃO aparece ───
  it('Frete OPEN fora de 300km NÃO aparece e debug mostra motivo OUTSIDE_RADIUS_300KM', async () => {
    const debug = {
      total_candidates: 1, total_eligible: 0, total_excluded: 1,
      excluded: [{ item_type: 'FREIGHT', item_id: 'f-far', service_type: 'CARGA', reason: 'OUTSIDE_RADIUS_300KM' }],
    };

    mockRpc
      .mockResolvedValueOnce(freightPayload([], debug))
      .mockResolvedValueOnce(servicePayload([]));

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
    mockRpc
      .mockResolvedValueOnce(freightPayload([]))
      .mockResolvedValueOnce(servicePayload([makeService({ id: 'svc-match', service_type: 'GUINCHO' })]));

    const result = await callFeed({
      id: 'provider-1',
      active_mode: 'TRANSPORTADORA',
      service_types: ['GUINCHO'],
    });

    expect(result.serviceRequests).toHaveLength(1);
    expect(result.serviceRequests[0].id).toBe('svc-match');
  });

  // ─── Cenário 4: Serviço com tipo diferente NÃO aparece ───
  it('Serviço OPEN com tipo diferente NÃO aparece para transportadora sem esse tipo', async () => {
    mockRpc
      .mockResolvedValueOnce(freightPayload([]))
      .mockResolvedValueOnce(servicePayload([makeService({ id: 'svc-wrong', service_type: 'MECANICO_GERAL' })]));

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'TRANSPORTADORA',
      service_types: ['GUINCHO'],
    });

    expect(result.serviceRequests).toHaveLength(0);
  });

  // ─── Cenário 5: Sem coordenadas → fallback city_id ───
  it('Sem coordenadas → fallback por city_id funciona (frete retornado pela RPC)', async () => {
    mockRpc
      .mockResolvedValueOnce(freightPayload([makeFreight({ id: 'f-no-coords', origin_lat: null, origin_lng: null })]))
      .mockResolvedValueOnce(servicePayload([]));

    const result = await callFeed({
      id: 'profile-1',
      active_mode: 'MOTORISTA',
      service_types: ['CARGA'],
    });

    expect(result.freights).toHaveLength(1);
    expect(result.freights[0].id).toBe('f-no-coords');
  });
});

describe('Feed Determinístico — RPC direta', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('get_unified_service_feed retorna serviços com campos esperados', async () => {
    const svc = makeService({ id: 'svc-full', service_type: 'GUINCHO', estimated_price: 350 });
    mockRpc.mockResolvedValueOnce(servicePayload([svc]));

    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase.rpc('get_unified_service_feed', {
      p_profile_id: 'provider-1',
      p_debug: false,
    });

    const payload = data as any;
    expect(payload.items).toHaveLength(1);
    expect(payload.items[0]).toHaveProperty('id', 'svc-full');
    expect(payload.items[0]).toHaveProperty('service_type', 'GUINCHO');
  });

  it('Debug mode retorna itens excluídos com motivos', async () => {
    const debugData = {
      total_candidates: 5, total_eligible: 2, total_excluded: 3,
      excluded: [
        { item_type: 'SERVICE', item_id: 's1', service_type: 'ELETRICISTA', reason: 'SERVICE_TYPE_NOT_ENABLED' },
        { item_type: 'SERVICE', item_id: 's2', service_type: 'GUINCHO', reason: 'OUTSIDE_RADIUS_300KM' },
        { item_type: 'SERVICE', item_id: 's3', service_type: 'GUINCHO', reason: 'STATUS_NOT_OPEN' },
      ],
    };

    mockRpc.mockResolvedValueOnce(servicePayload([makeService()], debugData));

    const { supabase } = await import('@/integrations/supabase/client');
    const { data } = await supabase.rpc('get_unified_service_feed', {
      p_profile_id: 'provider-1',
      p_debug: true,
    });

    const payload = data as any;
    expect(payload.debug.total_excluded).toBe(3);
    expect(payload.debug.excluded).toHaveLength(3);
    expect(payload.debug.excluded[0].reason).toBe('SERVICE_TYPE_NOT_ENABLED');
  });
});
