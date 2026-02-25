import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';

// Mock supabase
const mockRpc = vi.fn();
const mockFrom = vi.fn();
const mockGetUser = vi.fn();

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    rpc: (...args: any[]) => mockRpc(...args),
    from: (...args: any[]) => {
      const result = mockFrom(...args);
      return result;
    },
    auth: {
      getUser: () => mockGetUser(),
    },
  },
}));

import { useGuaranteedMarketplaceFeed } from '../useGuaranteedMarketplaceFeed';

describe('useGuaranteedMarketplaceFeed - Filtros de Marketplace', () => {
  const mockProfile = {
    id: 'profile-1',
    user_id: 'user-1',
    role: 'MOTORISTA',
    active_mode: 'MOTORISTA',
    service_types: ['CARGA', 'GUINCHO'],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
  });

  it('envia p_types quando filtro de tipos é definido', async () => {
    mockRpc.mockResolvedValue({
      data: { freights: [], service_requests: [], metrics: { feed_total_eligible: 0, feed_total_displayed: 0, fallback_used: false, role: 'MOTORISTA' }, debug: null },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ data: [{ city_id: 'city-1' }], error: null }) }) }),
    });

    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    await act(async () => {
      await result.current.fetchAvailableMarketplaceItems({
        profile: mockProfile,
        filterTypes: ['CARGA', 'GUINCHO'],
        filterSort: 'PRICE_DESC',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('get_authoritative_feed', expect.objectContaining({
      p_types: ['CARGA', 'GUINCHO'],
      p_sort: 'PRICE_DESC',
    }));
  });

  it('envia p_expiry_bucket quando filtro de expiração é definido', async () => {
    mockRpc.mockResolvedValue({
      data: { freights: [], service_requests: [], metrics: { feed_total_eligible: 0, feed_total_displayed: 0, fallback_used: false, role: 'MOTORISTA' }, debug: null },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ data: [{ city_id: 'city-1' }], error: null }) }) }),
    });

    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    await act(async () => {
      await result.current.fetchAvailableMarketplaceItems({
        profile: mockProfile,
        filterExpiryBucket: 'NOW_6H',
      });
    });

    expect(mockRpc).toHaveBeenCalledWith('get_authoritative_feed', expect.objectContaining({
      p_expiry_bucket: 'NOW_6H',
    }));
  });

  it('NÃO envia p_types quando selectedTypes está vazio', async () => {
    mockRpc.mockResolvedValue({
      data: { freights: [], service_requests: [], metrics: { feed_total_eligible: 0, feed_total_displayed: 0, fallback_used: false, role: 'MOTORISTA' }, debug: null },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ data: [{ city_id: 'city-1' }], error: null }) }) }),
    });

    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    await act(async () => {
      await result.current.fetchAvailableMarketplaceItems({
        profile: mockProfile,
        filterTypes: [],
      });
    });

    const calledParams = mockRpc.mock.calls[0][1];
    expect(calledParams.p_types).toBeUndefined();
  });

  it('NÃO envia p_expiry_bucket quando é ALL', async () => {
    mockRpc.mockResolvedValue({
      data: { freights: [], service_requests: [], metrics: { feed_total_eligible: 0, feed_total_displayed: 0, fallback_used: false, role: 'MOTORISTA' }, debug: null },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ data: [{ city_id: 'city-1' }], error: null }) }) }),
    });

    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    await act(async () => {
      await result.current.fetchAvailableMarketplaceItems({
        profile: mockProfile,
        filterExpiryBucket: 'ALL',
      });
    });

    const calledParams = mockRpc.mock.calls[0][1];
    expect(calledParams.p_expiry_bucket).toBeUndefined();
  });

  it('retorna metrics.filters da RPC', async () => {
    const mockFilters = { types: ['CARGA'], expiry_bucket: 'NOW_6H', sort: 'PRICE_DESC' };
    mockRpc.mockResolvedValue({
      data: {
        freights: [{ id: 'f1', origin_city_id: 'city-1', expires_at: '2026-02-26T00:00:00Z' }],
        service_requests: [],
        metrics: { feed_total_eligible: 1, feed_total_displayed: 1, fallback_used: false, role: 'MOTORISTA', filters: mockFilters },
        debug: null,
      },
      error: null,
    });
    mockFrom.mockReturnValue({
      select: () => ({ eq: () => ({ eq: () => ({ data: [{ city_id: 'city-1' }], error: null }) }) }),
    });

    const { result } = renderHook(() => useGuaranteedMarketplaceFeed());
    let feedResult: any;
    await act(async () => {
      feedResult = await result.current.fetchAvailableMarketplaceItems({
        profile: mockProfile,
        filterTypes: ['CARGA'],
        filterExpiryBucket: 'NOW_6H',
        filterSort: 'PRICE_DESC',
      });
    });

    expect(feedResult.metrics.filters).toEqual(mockFilters);
  });
});
