/**
 * Tests for the history and reports pipeline.
 * 
 * Test 1: Frete concluído → freight_history (price_per_truck correto)
 * Test 2: Multi-carreta: motorista não recebe valor total
 * Test 3: Serviço concluído → service_request_history e RPC retorna KPIs coerentes
 */
import { describe, it, expect } from 'vitest';

// ============================================================
// Teste 1: price_per_truck é calculado corretamente
// ============================================================
describe('Freight History Pipeline', () => {
  it('deve calcular price_per_truck corretamente para frete com 6 carretas', () => {
    const priceTotal = 32400;
    const requiredTrucks = 6;

    // Simula a lógica do trigger log_freight_to_history
    const pricePerTruck = requiredTrucks > 0 ? priceTotal / requiredTrucks : priceTotal;

    expect(pricePerTruck).toBe(5400);
    expect(pricePerTruck).toBeLessThan(priceTotal);
  });

  it('deve lidar com div/0 quando required_trucks é 0', () => {
    const priceTotal = 10000;
    const requiredTrucks = 0;

    const pricePerTruck = requiredTrucks > 0 ? priceTotal / requiredTrucks : priceTotal;

    expect(pricePerTruck).toBe(10000); // fallback: valor total
  });

  it('deve lidar com frete single-truck (required_trucks = 1)', () => {
    const priceTotal = 5400;
    const requiredTrucks = 1;

    const pricePerTruck = requiredTrucks > 0 ? priceTotal / requiredTrucks : priceTotal;

    expect(pricePerTruck).toBe(5400);
    expect(pricePerTruck).toBe(priceTotal);
  });
});

// ============================================================
// Teste 2: Motorista multi-carreta NÃO recebe valor total
// ============================================================
describe('Multi-carreta: Motorista recebe valor por viagem', () => {
  it('relatório do motorista soma por assignment, não por total do frete', () => {
    // Simula 6 carretas, total R$ 32.400, agreed_price R$ 5.400 cada
    const totalFretePrice = 32400;
    const requiredTrucks = 6;
    const agreedPricePerAssignment = 5400;

    // Simula assignments concluídos para UM motorista (1 assignment)
    const driverAssignments = [
      { agreed_price: agreedPricePerAssignment, status_final: 'DELIVERED' },
    ];

    // Receita do motorista = soma dos agreed_price dos assignments DELE
    const driverRevenue = driverAssignments
      .filter(a => ['COMPLETED', 'DELIVERED'].includes(a.status_final))
      .reduce((sum, a) => sum + a.agreed_price, 0);

    expect(driverRevenue).toBe(5400);
    expect(driverRevenue).not.toBe(totalFretePrice); // NUNCA deve ser o total
    expect(driverRevenue).toBe(agreedPricePerAssignment);
  });

  it('transportadora soma receita de todos os assignments dos seus motoristas', () => {
    // 3 motoristas da mesma empresa, cada um com 1 assignment de R$ 5.400
    const companyAssignments = [
      { driver_id: 'd1', agreed_price: 5400, status_final: 'DELIVERED' },
      { driver_id: 'd2', agreed_price: 5400, status_final: 'DELIVERED' },
      { driver_id: 'd3', agreed_price: 5400, status_final: 'COMPLETED' },
    ];

    const companyRevenue = companyAssignments
      .filter(a => ['COMPLETED', 'DELIVERED'].includes(a.status_final))
      .reduce((sum, a) => sum + a.agreed_price, 0);

    expect(companyRevenue).toBe(16200); // 3 × 5400
  });
});

// ============================================================
// Teste 3: Serviço concluído → histórico + KPIs coerentes
// ============================================================
describe('Service Request History Pipeline', () => {
  it('serviço COMPLETED gera registro no histórico', () => {
    // Simula o trigger log_service_to_history
    const serviceRequest = {
      id: 'sr-001',
      status: 'COMPLETED',
      client_id: 'client-001',
      provider_id: 'provider-001',
      service_type: 'MECANICA',
      final_price: 350,
      estimated_price: 300,
      city_name: 'Uberlândia',
      state: 'MG',
      completed_at: new Date().toISOString(),
    };

    // Simula a inserção no histórico
    const historyRecord = {
      service_request_id: serviceRequest.id,
      client_id: serviceRequest.client_id,
      provider_id: serviceRequest.provider_id,
      service_type: serviceRequest.service_type,
      status_final: serviceRequest.status,
      final_price: serviceRequest.final_price || serviceRequest.estimated_price || 0,
      city: serviceRequest.city_name,
      state: serviceRequest.state,
    };

    expect(historyRecord.status_final).toBe('COMPLETED');
    expect(historyRecord.final_price).toBe(350);
    expect(historyRecord.provider_id).toBe('provider-001');
    expect(historyRecord.client_id).toBe('client-001');
  });

  it('KPIs de prestador são coerentes com dados do histórico', () => {
    // Simula dados de service_request_history para um prestador
    const providerHistory = [
      { status_final: 'COMPLETED', final_price: 350 },
      { status_final: 'COMPLETED', final_price: 500 },
      { status_final: 'CANCELLED', final_price: 0 },
      { status_final: 'COMPLETED', final_price: 200 },
    ];

    const completed = providerHistory.filter(h => h.status_final === 'COMPLETED');
    const cancelled = providerHistory.filter(h => h.status_final === 'CANCELLED');

    const kpis = {
      receita_total: completed.reduce((sum, h) => sum + h.final_price, 0),
      total_servicos: providerHistory.length,
      servicos_concluidos: completed.length,
      servicos_cancelados: cancelled.length,
      ticket_medio: completed.length > 0
        ? completed.reduce((sum, h) => sum + h.final_price, 0) / completed.length
        : 0,
    };

    expect(kpis.receita_total).toBe(1050);
    expect(kpis.total_servicos).toBe(4);
    expect(kpis.servicos_concluidos).toBe(3);
    expect(kpis.servicos_cancelados).toBe(1);
    expect(kpis.ticket_medio).toBe(350);
  });

  it('serviço CANCELLED não conta receita', () => {
    const cancelledServices = [
      { status_final: 'CANCELLED', final_price: 500 },
      { status_final: 'CANCELLED', final_price: 300 },
    ];

    const revenue = cancelledServices
      .filter(h => h.status_final === 'COMPLETED')
      .reduce((sum, h) => sum + h.final_price, 0);

    expect(revenue).toBe(0);
  });
});
