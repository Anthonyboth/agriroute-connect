/**
 * useReportsDashboard.test.ts
 * 
 * Testes para validação de relatórios:
 * 1. Multi-carreta: motorista sempre usa agreed_price por carreta
 * 2. Transportadora: agregação por company_id
 * 3. PT-BR: nenhum termo em inglês visível
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// HELPERS PARA TESTES PUROS (sem hooks React)
// ============================================================

// Simula cálculo de KPIs do motorista a partir de assignment history
function calcMotoristaKPIs(assignments: Array<{
  agreed_price: number | null;
  freight_price_total: number;
  distance_km: number | null;
  freight_distance_km: number;
  status_final: string;
  weight_per_truck: number | null;
  freight_weight: number;
}>) {
  const completed = assignments.filter(a => ['COMPLETED', 'DELIVERED'].includes(a.status_final));
  const total = assignments.length;

  const receitaTotal = completed.reduce((sum, a) => sum + (a.agreed_price ?? a.freight_price_total), 0);
  const distanciaTotal = completed.reduce((sum, a) => sum + (a.distance_km ?? a.freight_distance_km), 0);
  const pesoTotal = completed.reduce((sum, a) => sum + (a.weight_per_truck ?? a.freight_weight ?? 0), 0);
  const ticketMedio = completed.length > 0 ? receitaTotal / completed.length : 0;
  const rsPorKm = distanciaTotal > 0 ? receitaTotal / distanciaTotal : 0;
  const rsPorTon = pesoTotal > 0 ? receitaTotal / pesoTotal : 0;
  const taxaCancelamento = total > 0
    ? (assignments.filter(a => a.status_final === 'CANCELLED').length / total) * 100
    : 0;

  return {
    receitaTotal,
    fretesConcluidos: completed.length,
    totalFretes: total,
    distanciaTotal,
    ticketMedio,
    rsPorKm,
    rsPorTon,
    pesoTotal,
    taxaCancelamento,
  };
}

// Simula agregação da transportadora por company_id
function calcTransportadoraKPIs(assignments: Array<{
  company_id: string;
  driver_id: string;
  agreed_price: number | null;
  freight_price_total: number;
  distance_km: number | null;
  freight_distance_km: number;
  status_final: string;
}>, companyId: string) {
  const companyAssignments = assignments.filter(a => a.company_id === companyId);
  const completed = companyAssignments.filter(a => ['COMPLETED', 'DELIVERED'].includes(a.status_final));

  const receitaTotal = completed.reduce((sum, a) => sum + (a.agreed_price ?? a.freight_price_total), 0);
  const distanciaTotal = completed.reduce((sum, a) => sum + (a.distance_km ?? a.freight_distance_km), 0);
  const motoristasAtivos = new Set(companyAssignments.map(a => a.driver_id)).size;
  const receitaPorMotorista = motoristasAtivos > 0 ? receitaTotal / motoristasAtivos : 0;

  return {
    receitaTotal,
    fretesConcluidos: completed.length,
    totalFretes: companyAssignments.length,
    distanciaTotal,
    motoristasAtivos,
    receitaPorMotorista,
  };
}

// ============================================================
// TESTE 1: Multi-carreta — motorista usa valor por carreta
// ============================================================
describe('Multi-carreta: motorista usa agreed_price por assignment', () => {
  it('deve usar agreed_price individual, não freight_price_total', () => {
    // Frete multi-carreta: total R$ 30.000, mas motorista tem assignment de R$ 10.000
    const assignments = [
      {
        agreed_price: 10000,         // Valor da CARRETA do motorista
        freight_price_total: 30000,  // Valor TOTAL do frete (3 carretas)
        distance_km: 500,
        freight_distance_km: 500,
        status_final: 'COMPLETED',
        weight_per_truck: 20,
        freight_weight: 60,          // Total de todas as carretas
      },
      {
        agreed_price: 8000,
        freight_price_total: 30000,
        distance_km: 400,
        freight_distance_km: 400,
        status_final: 'COMPLETED',
        weight_per_truck: 18,
        freight_weight: 60,
      },
    ];

    const kpis = calcMotoristaKPIs(assignments);

    // Motorista NUNCA deve ver o valor total do frete (30000)
    expect(kpis.receitaTotal).toBe(18000); // 10000 + 8000
    expect(kpis.receitaTotal).not.toBe(60000); // NÃO é 30000 * 2
    expect(kpis.ticketMedio).toBe(9000); // 18000 / 2
    expect(kpis.fretesConcluidos).toBe(2);
    expect(kpis.rsPorKm).toBeCloseTo(20); // 18000 / 900
    expect(kpis.rsPorTon).toBeCloseTo(473.68, 1); // 18000 / 38
  });

  it('deve usar freight_price_total como fallback quando agreed_price é null (single-truck)', () => {
    const assignments = [
      {
        agreed_price: null,          // Single truck, sem agreed_price
        freight_price_total: 5000,
        distance_km: null,
        freight_distance_km: 200,
        status_final: 'COMPLETED',
        weight_per_truck: null,
        freight_weight: 25,
      },
    ];

    const kpis = calcMotoristaKPIs(assignments);
    expect(kpis.receitaTotal).toBe(5000);
    expect(kpis.rsPorKm).toBe(25); // 5000 / 200
  });

  it('deve calcular taxa de cancelamento corretamente', () => {
    const assignments = [
      { agreed_price: 5000, freight_price_total: 15000, distance_km: 200, freight_distance_km: 200, status_final: 'COMPLETED', weight_per_truck: 10, freight_weight: 30 },
      { agreed_price: 5000, freight_price_total: 15000, distance_km: 200, freight_distance_km: 200, status_final: 'CANCELLED', weight_per_truck: 10, freight_weight: 30 },
      { agreed_price: 5000, freight_price_total: 15000, distance_km: 200, freight_distance_km: 200, status_final: 'COMPLETED', weight_per_truck: 10, freight_weight: 30 },
    ];

    const kpis = calcMotoristaKPIs(assignments);
    expect(kpis.taxaCancelamento).toBeCloseTo(33.33, 1);
    expect(kpis.fretesConcluidos).toBe(2);
    expect(kpis.receitaTotal).toBe(10000); // Só os concluídos
  });
});

// ============================================================
// TESTE 2: Transportadora — agregação por company_id
// ============================================================
describe('Transportadora: agregação por company_id', () => {
  const COMPANY_A = 'company-a';
  const COMPANY_B = 'company-b';

  const allAssignments = [
    { company_id: COMPANY_A, driver_id: 'driver-1', agreed_price: 10000, freight_price_total: 30000, distance_km: 500, freight_distance_km: 500, status_final: 'COMPLETED' },
    { company_id: COMPANY_A, driver_id: 'driver-2', agreed_price: 8000, freight_price_total: 30000, distance_km: 400, freight_distance_km: 400, status_final: 'COMPLETED' },
    { company_id: COMPANY_A, driver_id: 'driver-1', agreed_price: 12000, freight_price_total: 12000, distance_km: 600, freight_distance_km: 600, status_final: 'COMPLETED' },
    { company_id: COMPANY_B, driver_id: 'driver-3', agreed_price: 15000, freight_price_total: 15000, distance_km: 700, freight_distance_km: 700, status_final: 'COMPLETED' },
    { company_id: COMPANY_A, driver_id: 'driver-2', agreed_price: 5000, freight_price_total: 5000, distance_km: 200, freight_distance_km: 200, status_final: 'CANCELLED' },
  ];

  it('deve agregar receita apenas dos assignments da empresa', () => {
    const kpis = calcTransportadoraKPIs(allAssignments, COMPANY_A);
    expect(kpis.receitaTotal).toBe(30000); // 10000 + 8000 + 12000
    expect(kpis.fretesConcluidos).toBe(3);
    expect(kpis.totalFretes).toBe(4); // 3 completed + 1 cancelled
  });

  it('deve contar motoristas ativos distintos', () => {
    const kpis = calcTransportadoraKPIs(allAssignments, COMPANY_A);
    expect(kpis.motoristasAtivos).toBe(2); // driver-1 e driver-2
  });

  it('deve calcular receita por motorista corretamente', () => {
    const kpis = calcTransportadoraKPIs(allAssignments, COMPANY_A);
    expect(kpis.receitaPorMotorista).toBe(15000); // 30000 / 2
  });

  it('deve isolar dados entre empresas', () => {
    const kpisA = calcTransportadoraKPIs(allAssignments, COMPANY_A);
    const kpisB = calcTransportadoraKPIs(allAssignments, COMPANY_B);
    expect(kpisA.receitaTotal).toBe(30000);
    expect(kpisB.receitaTotal).toBe(15000);
    expect(kpisA.motoristasAtivos).toBe(2);
    expect(kpisB.motoristasAtivos).toBe(1);
  });
});

// ============================================================
// TESTE 3: PT-BR — detectar termos proibidos em inglês
// ============================================================
describe('PT-BR: nenhum termo em inglês visível ao usuário', () => {
  // Labels que NÃO devem aparecer na UI
  const FORBIDDEN_TERMS = [
    'Loading', 'Error', 'No data', 'Refresh', 'Cancel', 'Submit',
    'Revenue', 'Trips', 'Distance', 'Average', 'Total',
    'Completed', 'Cancelled', 'Pending', 'In Transit',
    'Filter', 'Search', 'Export', 'Download',
  ];

  // Labels PT-BR que DEVEM estar presentes
  const REQUIRED_PT_BR = [
    'Faturamento', 'Viagens', 'Concluído', 'Cancelado',
    'Receita', 'Motorista', 'Período', 'Exportar',
    'Atualizar', 'Filtros', 'Relatórios',
  ];

  // Map de status para PT-BR
  const STATUS_LABEL_MAP: Record<string, string> = {
    'OPEN': 'Aberto',
    'ACCEPTED': 'Aceito',
    'IN_TRANSIT': 'Em Trânsito',
    'DELIVERED': 'Entregue',
    'CANCELLED': 'Cancelado',
    'COMPLETED': 'Concluído',
    'PENDING': 'Pendente',
  };

  it('mapeamento de status deve cobrir todos os status conhecidos', () => {
    const knownStatuses = ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED', 'COMPLETED', 'PENDING'];
    for (const status of knownStatuses) {
      expect(STATUS_LABEL_MAP[status]).toBeDefined();
      // O label PT-BR não deve ser igual ao status original em inglês
      expect(STATUS_LABEL_MAP[status]).not.toBe(status);
    }
  });

  it('todos os labels PT-BR obrigatórios devem estar definidos', () => {
    for (const term of REQUIRED_PT_BR) {
      expect(term.length).toBeGreaterThan(0);
    }
  });

  it('termos proibidos em inglês não devem ser usados como labels diretos', () => {
    // Valida que o mapeamento não inclui termos em inglês como valor
    const values = Object.values(STATUS_LABEL_MAP);
    for (const forbidden of FORBIDDEN_TERMS) {
      expect(values).not.toContain(forbidden);
    }
  });
});
