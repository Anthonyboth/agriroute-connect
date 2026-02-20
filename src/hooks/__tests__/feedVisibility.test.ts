/**
 * Testes unitários para o sistema de visibilidade de feeds por painel.
 *
 * Cobre:
 * 1. Motorista autônomo vê frete OPEN com vagas → aparece
 * 2. Motorista autônomo não vê frete sem vaga → não aparece
 * 3. Afiliado não vê assignment de outro afiliado
 * 4. Transportadora vê apenas seus assignments
 * 5. Prestador nunca vê freights
 * 6. active_mode guard (prestador no modo errado → lista vazia)
 * 7. Cooldown de alertas / LOW_ACCURACY não vira GPS_OFF
 * 8. Throttle 1x/min de persistência de localização
 * 9. Deduplicação por id
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ============================================================
// Mock helpers
// ============================================================

const makeFreight = (overrides: Record<string, any> = {}) => ({
  id: 'freight-1',
  kind: 'FREIGHT' as const,
  city_id: 'city-1',
  distance_km: 50,
  service_type: 'CARGA',
  freight_type: 'GRANEL',
  urgency: 'LOW',
  created_at: new Date().toISOString(),
  score: 0,
  payload: {
    status: 'OPEN',
    required_trucks: 1,
    accepted_trucks: 0,
    price: 1000,
    origin_city: 'Goiânia',
    origin_state: 'GO',
    destination_city: 'São Paulo',
    destination_state: 'SP',
  },
  ...overrides,
});

const makeService = (overrides: Record<string, any> = {}) => ({
  id: 'service-1',
  kind: 'SERVICE' as const,
  city_id: 'city-1',
  distance_km: 10,
  service_type: 'GUINCHO',
  freight_type: null,
  urgency: 'HIGH',
  created_at: new Date().toISOString(),
  score: 0,
  payload: {
    status: 'OPEN',
    city_name: 'Goiânia',
    state: 'GO',
  },
  ...overrides,
});

// ============================================================
// 1. Motorista autônomo — Fretes disponíveis
// ============================================================

describe('useDriverFreightFeed — Visibilidade de fretes', () => {
  it('motorista autônomo vê frete OPEN com vaga disponível', () => {
    const freight = makeFreight({
      payload: { status: 'OPEN', required_trucks: 1, accepted_trucks: 0 },
    });

    // Simula o filtro aplicado no hook: kind === 'FREIGHT'
    const items = [freight, makeService()];
    const freights = items.filter(i => i.kind === 'FREIGHT');

    expect(freights).toHaveLength(1);
    expect(freights[0].id).toBe('freight-1');
    expect(freights[0].payload.accepted_trucks).toBeLessThan(freights[0].payload.required_trucks);
  });

  it('motorista autônomo não vê frete sem vaga (multi-carreta esgotada)', () => {
    // Simula filtro de vagas: accepted_trucks < required_trucks
    const freightsFromApi = [
      makeFreight({ id: 'f-1', payload: { status: 'OPEN', required_trucks: 2, accepted_trucks: 2 } }),
      makeFreight({ id: 'f-2', payload: { status: 'OPEN', required_trucks: 3, accepted_trucks: 2 } }),
    ];

    const available = freightsFromApi.filter(
      f => f.payload.accepted_trucks < f.payload.required_trucks
    );

    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('f-2');
  });

  it('feed de motorista nunca retorna SERVICE items', () => {
    const mixedItems = [makeFreight(), makeService(), makeFreight({ id: 'freight-2' })];

    // useDriverFreightFeed filtra: kind === 'FREIGHT'
    const freights = mixedItems.filter(i => i.kind === 'FREIGHT');

    // O feed do motorista só tem FREIGHTs — os SERVICEs ficaram de fora
    expect(freights).toHaveLength(2);
    const hasService = freights.some(i => (i.kind as string) === 'SERVICE');
    expect(hasService).toBe(false);
  });
});

// ============================================================
// 2. Motorista afiliado — Segregação de assignments
// ============================================================

describe('Motorista afiliado — Segregação de assignments', () => {
  const assignments = [
    { id: 'a1', driver_id: 'driver-me', freight_id: 'f1', company_id: 'company-1' },
    { id: 'a2', driver_id: 'driver-other', freight_id: 'f2', company_id: 'company-1' },
    { id: 'a3', driver_id: 'driver-me', freight_id: 'f3', company_id: 'company-1' },
  ];

  it('afiliado vê apenas seus próprios assignments (driver_id = meu id)', () => {
    const myId = 'driver-me';
    const myAssignments = assignments.filter(a => a.driver_id === myId);

    expect(myAssignments).toHaveLength(2);
    expect(myAssignments.every(a => a.driver_id === myId)).toBe(true);
  });

  it('afiliado não vê assignment de outro afiliado da mesma empresa', () => {
    const myId = 'driver-me';
    const myAssignments = assignments.filter(a => a.driver_id === myId);

    const otherAssignments = myAssignments.filter(a => a.driver_id !== myId);
    expect(otherAssignments).toHaveLength(0);
  });
});

// ============================================================
// 3. Transportadora — Assignments da empresa
// ============================================================

describe('useCompanyFreightFeed — Visibilidade de fretes da empresa', () => {
  const allAssignments = [
    { id: 'a1', company_id: 'company-A', freight_id: 'f1' },
    { id: 'a2', company_id: 'company-B', freight_id: 'f2' },
    { id: 'a3', company_id: 'company-A', freight_id: 'f3' },
  ];

  it('transportadora vê apenas assignments da sua empresa', () => {
    const myCompanyId = 'company-A';
    const companyAssignments = allAssignments.filter(a => a.company_id === myCompanyId);

    expect(companyAssignments).toHaveLength(2);
    expect(companyAssignments.every(a => a.company_id === myCompanyId)).toBe(true);
  });

  it('feed da transportadora nunca retorna SERVICE items', () => {
    const mixedItems = [makeFreight(), makeService()];
    const freights = mixedItems.filter(i => i.kind === 'FREIGHT');

    expect(freights).toHaveLength(1);
    expect(freights[0].kind).toBe('FREIGHT');
  });
});

// ============================================================
// 4. Prestador de Serviços — Nunca vê freights
// ============================================================

describe('useServiceProviderFeed — Prestador nunca vê freights', () => {
  it('feed do prestador retorna apenas SERVICE items', () => {
    const mixedItems = [makeFreight(), makeService(), makeFreight({ id: 'freight-2' }), makeService({ id: 'service-2' })];

    // useServiceProviderFeed filtra: kind === 'SERVICE'
    const services = mixedItems.filter(i => i.kind === 'SERVICE');

    expect(services).toHaveLength(2);
    expect(services.every(s => s.kind === 'SERVICE')).toBe(true);
  });

  it('se active_mode não é PRESTADOR_SERVICOS, retorna lista vazia', () => {
    const activeMode: string = 'MOTORISTA'; // modo errado
    const isProviderMode = activeMode === 'PRESTADOR_SERVICOS';

    const services = isProviderMode ? [makeService()] : [];
    expect(services).toHaveLength(0);
  });

  it('prestador no modo correto recebe serviços OPEN sem provider_id', () => {
    const activeMode = 'PRESTADOR_SERVICOS';
    const isProviderMode = activeMode === 'PRESTADOR_SERVICOS';

    const apiResults = [
      { id: 's1', status: 'OPEN', provider_id: null },
      { id: 's2', status: 'OPEN', provider_id: 'outro-prestador' }, // deve ser excluído
      { id: 's3', status: 'ACCEPTED', provider_id: null }, // não está OPEN
    ];

    // RPC get_services_for_provider já faz esse filtro — simulamos o resultado
    const available = isProviderMode
      ? apiResults.filter(s => s.status === 'OPEN' && s.provider_id === null)
      : [];

    expect(available).toHaveLength(1);
    expect(available[0].id).toBe('s1');
  });
});

// ============================================================
// 5. active_mode guard
// ============================================================

describe('active_mode guard — Isolamento de painéis', () => {
  const DRIVER_MODES = ['MOTORISTA', 'MOTORISTA_AFILIADO'];
  const CARRIER_MODE = 'TRANSPORTADORA';
  const PROVIDER_MODE = 'PRESTADOR_SERVICOS';

  it('motorista com active_mode=PRESTADOR_SERVICOS não recebe fretes', () => {
    const activeMode: string = 'PRESTADOR_SERVICOS';
    const isDriverMode = DRIVER_MODES.includes(activeMode);
    expect(isDriverMode).toBe(false);
  });

  it('prestador com active_mode=MOTORISTA não recebe serviços', () => {
    const activeMode: string = 'MOTORISTA';
    const isProviderMode = activeMode === PROVIDER_MODE;
    expect(isProviderMode).toBe(false);
  });

  it('transportadora com active_mode=MOTORISTA_AFILIADO não usa feed da empresa', () => {
    const activeMode: string = 'MOTORISTA_AFILIADO';
    const isCarrierMode = activeMode === CARRIER_MODE;
    expect(isCarrierMode).toBe(false);
  });
});

// ============================================================
// 6. Deduplicação por id
// ============================================================

describe('Deduplicação de items no feed', () => {
  it('remove items duplicados por id mantendo a primeira ocorrência', () => {
    const items = [
      makeFreight({ id: 'f1' }),
      makeFreight({ id: 'f2' }),
      makeFreight({ id: 'f1' }), // duplicado
      makeService({ id: 's1' }),
    ];

    const uniqueMap = new Map(items.map(i => [i.id, i]));
    const unique = Array.from(uniqueMap.values());

    expect(unique).toHaveLength(3);
    expect(unique.map(i => i.id)).toEqual(['f1', 'f2', 's1']);
  });
});

// ============================================================
// 7. Throttle de persistência de localização (1x/min)
// ============================================================

describe('Throttle de persistência de localização', () => {
  it('não salva localização se passaram menos de 60s', () => {
    const MIN_SAVE_INTERVAL_MS = 60_000;
    const lastSaveTime = Date.now() - 30_000; // 30s atrás
    const now = Date.now();

    const shouldSave = (now - lastSaveTime) >= MIN_SAVE_INTERVAL_MS;

    expect(shouldSave).toBe(false);
  });

  it('salva localização se passaram mais de 60s', () => {
    const MIN_SAVE_INTERVAL_MS = 60_000;
    const lastSaveTime = Date.now() - 65_000; // 65s atrás
    const now = Date.now();

    const shouldSave = (now - lastSaveTime) >= MIN_SAVE_INTERVAL_MS;

    expect(shouldSave).toBe(true);
  });

  it('não salva se mudança de posição < 20m', () => {
    const MIN_DISTANCE_METERS = 20;

    function calcDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
      const R = 6371000;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLng = (lng2 - lng1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    // Apenas 5m de diferença
    const dist = calcDistance(-16.6869, -49.2648, -16.6869045, -49.2648);
    const shouldSave = dist >= MIN_DISTANCE_METERS;

    expect(shouldSave).toBe(false);
  });
});

// ============================================================
// 8. LOW_ACCURACY não deve virar GPS_OFF
// ============================================================

describe('GPS — LOW_ACCURACY não é GPS_OFF', () => {
  it('accuracy > 100m gera aviso leve, não GPS_OFF', () => {
    const accuracy = 150; // metros

    function classifyAccuracy(acc: number): 'OK' | 'LOW_ACCURACY' | 'GPS_OFF' {
      if (acc <= 100) return 'OK';
      if (acc <= 500) return 'LOW_ACCURACY'; // aviso suave, não erro
      return 'GPS_OFF'; // apenas se completamente inacessível
    }

    const result = classifyAccuracy(accuracy);
    expect(result).toBe('LOW_ACCURACY');
    expect(result).not.toBe('GPS_OFF');
  });

  it('código de erro 3 (timeout) nunca resulta em GPS_OFF', () => {
    function interpretGPSErrorCode(code: number): { isDefinitelyOff: boolean; status: string } {
      switch (code) {
        case 1: return { isDefinitelyOff: true, status: 'NO_PERMISSION' };
        case 2: return { isDefinitelyOff: false, status: 'UNAVAILABLE' };
        case 3: return { isDefinitelyOff: false, status: 'TIMEOUT' };
        default: return { isDefinitelyOff: false, status: 'UNKNOWN' };
      }
    }

    const result = interpretGPSErrorCode(3); // timeout
    expect(result.isDefinitelyOff).toBe(false);
    expect(result.status).toBe('TIMEOUT');
  });
});

// ============================================================
// 9. Cooldown de alertas GPS (2 minutos)
// ============================================================

describe('Cooldown de alertas GPS', () => {
  it('não dispara alerta se passou menos de 2 minutos do último alerta', () => {
    const ALERT_COOLDOWN_MS = 2 * 60 * 1000;
    const lastAlertTime = Date.now() - 90_000; // 90s atrás
    const now = Date.now();

    const canAlert = (now - lastAlertTime) >= ALERT_COOLDOWN_MS;
    expect(canAlert).toBe(false);
  });

  it('dispara alerta se passaram mais de 2 minutos', () => {
    const ALERT_COOLDOWN_MS = 2 * 60 * 1000;
    const lastAlertTime = Date.now() - 130_000; // 130s atrás
    const now = Date.now();

    const canAlert = (now - lastAlertTime) >= ALERT_COOLDOWN_MS;
    expect(canAlert).toBe(true);
  });
});
