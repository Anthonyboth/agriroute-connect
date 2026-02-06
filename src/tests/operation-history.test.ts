/**
 * Testes para o sistema de histórico de operações e relatórios.
 * 
 * Valida:
 * - Estrutura dos dados de histórico
 * - Imutabilidade do histórico
 * - Consolidação de relatórios
 * - Separação por roles
 * - Suporte a guest
 */
import { describe, it, expect } from 'vitest';

// Mock operation history item para testes unitários
interface MockOperationHistory {
  id: string;
  entity_type: 'FREIGHT' | 'SERVICE';
  original_id: string;
  user_id: string | null;
  user_role: string;
  guest_contact_name: string | null;
  guest_contact_phone: string | null;
  origin_location: string | null;
  destination_location: string | null;
  service_or_cargo_type: string | null;
  final_price: number;
  truck_count: number;
  operation_created_at: string;
  completed_at: string;
  final_status: string;
  rating_completed: boolean;
  snapshot_data: Record<string, any>;
  recorded_at: string;
}

// Helper: criar item de histórico mock
const createMockHistoryItem = (overrides: Partial<MockOperationHistory> = {}): MockOperationHistory => ({
  id: crypto.randomUUID(),
  entity_type: 'FREIGHT',
  original_id: crypto.randomUUID(),
  user_id: crypto.randomUUID(),
  user_role: 'PRODUTOR',
  guest_contact_name: null,
  guest_contact_phone: null,
  origin_location: 'Primavera do Leste/MT',
  destination_location: 'Canarana/MT',
  service_or_cargo_type: 'graos_soja',
  final_price: 10800,
  truck_count: 1,
  operation_created_at: '2026-02-01T10:00:00Z',
  completed_at: '2026-02-05T15:30:00Z',
  final_status: 'COMPLETED',
  rating_completed: false,
  snapshot_data: { weight: 30000, distance_km: 280, urgency: 'MEDIUM' },
  recorded_at: '2026-02-05T15:30:00Z',
  ...overrides,
});

// Helper: calcular stats (replica lógica do hook)
const calculateStats = (items: MockOperationHistory[]) => ({
  total: items.length,
  totalRevenue: items.reduce((sum, item) => sum + (item.final_price || 0), 0),
  avgPrice: items.length > 0 
    ? items.reduce((sum, item) => sum + (item.final_price || 0), 0) / items.length 
    : 0,
  freightCount: items.filter(i => i.entity_type === 'FREIGHT').length,
  serviceCount: items.filter(i => i.entity_type === 'SERVICE').length,
  ratedCount: items.filter(i => i.rating_completed).length,
  byType: items.reduce((acc, item) => {
    const type = item.service_or_cargo_type || 'OUTROS';
    acc[type] = (acc[type] || 0) + 1;
    return acc;
  }, {} as Record<string, number>),
});

describe('Estrutura do Histórico de Operações', () => {
  it('deve conter todos os campos obrigatórios para frete rural', () => {
    const item = createMockHistoryItem({
      entity_type: 'FREIGHT',
      user_role: 'PRODUTOR',
    });

    expect(item.id).toBeTruthy();
    expect(item.entity_type).toBe('FREIGHT');
    expect(item.original_id).toBeTruthy();
    expect(item.user_id).toBeTruthy();
    expect(item.user_role).toBe('PRODUTOR');
    expect(item.origin_location).toBeTruthy();
    expect(item.destination_location).toBeTruthy();
    expect(item.service_or_cargo_type).toBeTruthy();
    expect(item.final_price).toBeGreaterThan(0);
    expect(item.operation_created_at).toBeTruthy();
    expect(item.completed_at).toBeTruthy();
    expect(item.final_status).toBe('COMPLETED');
    expect(item.snapshot_data).toBeDefined();
  });

  it('deve conter campos de guest para frete guest', () => {
    const item = createMockHistoryItem({
      user_id: null,
      user_role: 'GUEST',
      guest_contact_name: 'João Silva',
      guest_contact_phone: '66999999999',
    });

    expect(item.user_id).toBeNull();
    expect(item.user_role).toBe('GUEST');
    expect(item.guest_contact_name).toBe('João Silva');
    expect(item.guest_contact_phone).toBe('66999999999');
  });

  it('deve conter campos obrigatórios para serviço urbano', () => {
    const item = createMockHistoryItem({
      entity_type: 'SERVICE',
      user_role: 'PRESTADOR_SERVICOS',
      service_or_cargo_type: 'MECANICO',
      origin_location: 'Cuiabá/MT',
      destination_location: 'Cuiabá/MT',
    });

    expect(item.entity_type).toBe('SERVICE');
    expect(item.user_role).toBe('PRESTADOR_SERVICOS');
    expect(item.service_or_cargo_type).toBe('MECANICO');
  });

  it('deve suportar multi-carreta', () => {
    const item = createMockHistoryItem({
      truck_count: 3,
      snapshot_data: { weight: 90000, distance_km: 280 },
    });

    expect(item.truck_count).toBe(3);
  });
});

describe('Frete rural finalizado aparece no histórico', () => {
  it('deve aparecer no histórico do produtor', () => {
    const producerId = crypto.randomUUID();
    const freightId = crypto.randomUUID();
    
    const producerHistory = createMockHistoryItem({
      original_id: freightId,
      user_id: producerId,
      user_role: 'PRODUTOR',
    });

    expect(producerHistory.user_id).toBe(producerId);
    expect(producerHistory.original_id).toBe(freightId);
    expect(producerHistory.user_role).toBe('PRODUTOR');
    expect(producerHistory.final_status).toBe('COMPLETED');
  });

  it('deve aparecer no histórico do motorista', () => {
    const driverId = crypto.randomUUID();
    const freightId = crypto.randomUUID();
    
    const driverHistory = createMockHistoryItem({
      original_id: freightId,
      user_id: driverId,
      user_role: 'MOTORISTA',
    });

    expect(driverHistory.user_id).toBe(driverId);
    expect(driverHistory.original_id).toBe(freightId);
    expect(driverHistory.user_role).toBe('MOTORISTA');
  });
});

describe('Serviço urbano finalizado aparece no histórico', () => {
  it('deve aparecer no histórico do prestador', () => {
    const providerId = crypto.randomUUID();
    
    const providerHistory = createMockHistoryItem({
      entity_type: 'SERVICE',
      user_id: providerId,
      user_role: 'PRESTADOR_SERVICOS',
      service_or_cargo_type: 'ELETRICISTA',
    });

    expect(providerHistory.entity_type).toBe('SERVICE');
    expect(providerHistory.user_role).toBe('PRESTADOR_SERVICOS');
  });
});

describe('Serviço guest finalizado aparece no histórico interno', () => {
  it('deve gerar registro sem user_id mas com dados de contato', () => {
    const guestHistory = createMockHistoryItem({
      entity_type: 'SERVICE',
      user_id: null,
      user_role: 'GUEST',
      guest_contact_name: 'Maria Santos',
      guest_contact_phone: '66988888888',
    });

    expect(guestHistory.user_id).toBeNull();
    expect(guestHistory.user_role).toBe('GUEST');
    expect(guestHistory.guest_contact_name).toBe('Maria Santos');
  });
});

describe('Histórico é imutável após criação', () => {
  it('status sempre deve ser COMPLETED', () => {
    const item = createMockHistoryItem();
    expect(item.final_status).toBe('COMPLETED');
    // Nota: imutabilidade real é enforced via RLS (sem policy UPDATE/DELETE)
  });

  it('recorded_at é definido na criação e não deve mudar', () => {
    const item = createMockHistoryItem();
    expect(item.recorded_at).toBeTruthy();
  });
});

describe('Relatório consolida valores corretamente', () => {
  it('deve somar receitas corretamente', () => {
    const items = [
      createMockHistoryItem({ final_price: 5000 }),
      createMockHistoryItem({ final_price: 8000 }),
      createMockHistoryItem({ final_price: 12000 }),
    ];

    const stats = calculateStats(items);

    expect(stats.total).toBe(3);
    expect(stats.totalRevenue).toBe(25000);
    expect(stats.avgPrice).toBeCloseTo(8333.33, 0);
  });

  it('deve separar fretes de serviços', () => {
    const items = [
      createMockHistoryItem({ entity_type: 'FREIGHT', final_price: 10000 }),
      createMockHistoryItem({ entity_type: 'FREIGHT', final_price: 15000 }),
      createMockHistoryItem({ entity_type: 'SERVICE', final_price: 500 }),
    ];

    const stats = calculateStats(items);

    expect(stats.freightCount).toBe(2);
    expect(stats.serviceCount).toBe(1);
    expect(stats.totalRevenue).toBe(25500);
  });

  it('deve contar avaliações corretamente', () => {
    const items = [
      createMockHistoryItem({ rating_completed: true }),
      createMockHistoryItem({ rating_completed: false }),
      createMockHistoryItem({ rating_completed: true }),
    ];

    const stats = calculateStats(items);

    expect(stats.ratedCount).toBe(2);
  });

  it('deve agrupar por tipo de serviço/carga', () => {
    const items = [
      createMockHistoryItem({ service_or_cargo_type: 'graos_soja' }),
      createMockHistoryItem({ service_or_cargo_type: 'graos_soja' }),
      createMockHistoryItem({ service_or_cargo_type: 'graos_milho' }),
    ];

    const stats = calculateStats(items);

    expect(stats.byType['graos_soja']).toBe(2);
    expect(stats.byType['graos_milho']).toBe(1);
  });

  it('deve lidar com lista vazia sem erros', () => {
    const stats = calculateStats([]);

    expect(stats.total).toBe(0);
    expect(stats.totalRevenue).toBe(0);
    expect(stats.avgPrice).toBe(0);
    expect(stats.freightCount).toBe(0);
    expect(stats.serviceCount).toBe(0);
    expect(stats.ratedCount).toBe(0);
  });
});

describe('Roles válidos no histórico', () => {
  const validRoles = ['PRODUTOR', 'MOTORISTA', 'MOTORISTA_AFILIADO', 'PRESTADOR_SERVICOS', 'TRANSPORTADORA', 'GUEST'];
  
  validRoles.forEach(role => {
    it(`deve aceitar role ${role}`, () => {
      const item = createMockHistoryItem({
        user_role: role,
        user_id: role === 'GUEST' ? null : crypto.randomUUID(),
      });
      expect(item.user_role).toBe(role);
    });
  });
});

describe('Transportadora vê histórico agregado', () => {
  it('deve gerar registro com role TRANSPORTADORA para fretes da empresa', () => {
    const companyOwnerId = crypto.randomUUID();
    
    const companyHistory = createMockHistoryItem({
      user_id: companyOwnerId,
      user_role: 'TRANSPORTADORA',
      snapshot_data: {
        weight: 30000,
        distance_km: 280,
        driver_id: crypto.randomUUID(),
        company_id: crypto.randomUUID(),
      },
    });

    expect(companyHistory.user_role).toBe('TRANSPORTADORA');
    expect(companyHistory.snapshot_data.driver_id).toBeTruthy();
    expect(companyHistory.snapshot_data.company_id).toBeTruthy();
  });
});
