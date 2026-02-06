/**
 * src/security/__tests__/paymentClosureGuard.test.ts
 *
 * Testes abrangentes para o módulo de segurança de pagamento, confirmação,
 * avaliação e encerramento.
 *
 * Cobertura mínima: 35 testes
 * - Transições de pagamento válidas/inválidas
 * - Restrições por papel
 * - Multi-carreta
 * - Labels PT-BR
 * - Fluxo completo rural single-truck
 * - Fluxo completo rural multi-truck
 * - Fluxo urbano
 * - Avaliação
 */

import { describe, it, expect } from 'vitest';
import {
  canCreateExternalPayment,
  canMarkPaidByProducer,
  canConfirmReceivedByDriver,
  assertValidPaymentTransition,
  canCloseFreightAsCompleted,
  canCloseMultiTruckFreight,
  canRateFreight,
  canRateServiceRequest,
  getPaymentUILabelPtBR,
  getPaymentActionLabelPtBR,
  getPaymentStatusExplanation,
} from '../paymentClosureGuard';

// =============================================================================
// 1. canCreateExternalPayment
// =============================================================================

describe('canCreateExternalPayment', () => {
  it('permite produtor criar pagamento quando frete está DELIVERED', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(true);
    expect(result.error).toBeNull();
  });

  it('permite produtor criar pagamento quando frete está DELIVERED_PENDING_CONFIRMATION', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED_PENDING_CONFIRMATION',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia motorista de criar pagamento', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('produtor');
  });

  it('bloqueia se frete está IN_TRANSIT', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'IN_TRANSIT',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('entrega');
  });

  it('bloqueia se já existe pagamento ativo (proposed)', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
      existingPaymentStatus: 'proposed',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Proposto');
  });

  it('bloqueia se já existe pagamento confirmado', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
      existingPaymentStatus: 'confirmed',
    });
    expect(result.valid).toBe(false);
  });

  it('permite ADMIN criar pagamento', () => {
    const result = canCreateExternalPayment({
      freightStatus: 'DELIVERED',
      actorRole: 'ADMIN',
    });
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// 2. canMarkPaidByProducer
// =============================================================================

describe('canMarkPaidByProducer', () => {
  it('permite produtor marcar como pago quando status é proposed', () => {
    const result = canMarkPaidByProducer({
      paymentStatus: 'proposed',
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia motorista de marcar como pago', () => {
    const result = canMarkPaidByProducer({
      paymentStatus: 'proposed',
      freightStatus: 'DELIVERED',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('produtor');
  });

  it('bloqueia se já pago pelo produtor', () => {
    const result = canMarkPaidByProducer({
      paymentStatus: 'paid_by_producer',
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('já foi marcado');
  });

  it('bloqueia se já confirmado', () => {
    const result = canMarkPaidByProducer({
      paymentStatus: 'confirmed',
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('confirmado');
  });

  it('bloqueia se frete está em status anterior à entrega', () => {
    const result = canMarkPaidByProducer({
      paymentStatus: 'proposed',
      freightStatus: 'IN_TRANSIT',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('entrega');
  });
});

// =============================================================================
// 3. canConfirmReceivedByDriver
// =============================================================================

describe('canConfirmReceivedByDriver', () => {
  it('permite motorista confirmar quando status é paid_by_producer', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'paid_by_producer',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(true);
  });

  it('permite motorista afiliado confirmar', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'paid_by_producer',
      actorRole: 'MOTORISTA_AFILIADO',
    });
    expect(result.valid).toBe(true);
  });

  it('permite transportadora confirmar em nome do motorista', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'paid_by_producer',
      actorRole: 'TRANSPORTADORA',
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia produtor de confirmar recebimento', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'paid_by_producer',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('motorista');
  });

  it('bloqueia se pagamento ainda está proposed', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'proposed',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('produtor marcar como pago');
  });

  it('bloqueia se pagamento já confirmado', () => {
    const result = canConfirmReceivedByDriver({
      paymentStatus: 'confirmed',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('já foi confirmado');
  });
});

// =============================================================================
// 4. assertValidPaymentTransition
// =============================================================================

describe('assertValidPaymentTransition', () => {
  it('aceita proposed → paid_by_producer', () => {
    const result = assertValidPaymentTransition('proposed', 'paid_by_producer');
    expect(result.valid).toBe(true);
  });

  it('aceita paid_by_producer → confirmed', () => {
    const result = assertValidPaymentTransition('paid_by_producer', 'confirmed');
    expect(result.valid).toBe(true);
  });

  it('aceita proposed → cancelled', () => {
    const result = assertValidPaymentTransition('proposed', 'cancelled');
    expect(result.valid).toBe(true);
  });

  it('aceita proposed → rejected', () => {
    const result = assertValidPaymentTransition('proposed', 'rejected');
    expect(result.valid).toBe(true);
  });

  it('aceita paid_by_producer → disputed', () => {
    const result = assertValidPaymentTransition('paid_by_producer', 'disputed');
    expect(result.valid).toBe(true);
  });

  it('bloqueia regressão confirmed → paid_by_producer', () => {
    const result = assertValidPaymentTransition('confirmed', 'paid_by_producer');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('Não é permitid');
  });

  it('bloqueia regressão paid_by_producer → proposed', () => {
    const result = assertValidPaymentTransition('paid_by_producer', 'proposed');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('voltar');
  });

  it('bloqueia salto proposed → confirmed', () => {
    const result = assertValidPaymentTransition('proposed', 'confirmed');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não é permitida');
  });

  it('verifica permissão de papel na transição', () => {
    // Motorista não pode marcar como pago
    const result = assertValidPaymentTransition('proposed', 'paid_by_producer', 'MOTORISTA');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('permissão');
  });

  it('aceita papel correto na transição', () => {
    const result = assertValidPaymentTransition('proposed', 'paid_by_producer', 'PRODUTOR');
    expect(result.valid).toBe(true);
  });

  it('bloqueia status desconhecido', () => {
    const result = assertValidPaymentTransition('invalid_status', 'confirmed');
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não é reconhecido');
  });
});

// =============================================================================
// 5. canCloseFreightAsCompleted
// =============================================================================

describe('canCloseFreightAsCompleted', () => {
  it('permite encerrar frete DELIVERED com pagamento confirmed pelo produtor', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia motorista de encerrar diretamente', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'confirmed',
      actorRole: 'MOTORISTA',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('automático');
  });

  it('bloqueia se pagamento não foi confirmado', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'paid_by_producer',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('motorista confirmar');
  });

  it('bloqueia se pagamento está em disputa', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'disputed',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('disputa');
  });

  it('bloqueia se pagamento não foi iniciado', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: null,
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('efetuado e confirmado');
  });

  it('bloqueia se frete já está COMPLETED', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('já foi concluído');
  });

  it('bloqueia se frete está IN_TRANSIT', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'IN_TRANSIT',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('entrega confirmada');
  });

  it('bloqueia multi-carreta quando nem todas concluídas', () => {
    const result = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
      requiredTrucks: 3,
      completedAssignments: 2,
      allAssignmentsCompleted: false,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2/3');
  });
});

// =============================================================================
// 6. canCloseMultiTruckFreight
// =============================================================================

describe('canCloseMultiTruckFreight', () => {
  it('permite encerrar quando todas as carretas estão DELIVERED', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'DELIVERED', paymentStatus: 'confirmed' },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia quando carreta faltando', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 3,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'DELIVERED', paymentStatus: 'confirmed' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('2/3');
  });

  it('bloqueia quando carreta não entregue', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'IN_TRANSIT', paymentStatus: undefined },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('não finalizou');
  });

  it('bloqueia quando pagamento não confirmado', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'DELIVERED', paymentStatus: 'paid_by_producer' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pagamento');
  });

  it('ignora validação para single-truck', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 1,
      assignments: [{ id: '1', status: 'IN_TRANSIT' }],
    });
    expect(result.valid).toBe(true);
  });
});

// =============================================================================
// 7. canRateFreight (Avaliação Rural)
// =============================================================================

describe('canRateFreight', () => {
  it('permite avaliar quando COMPLETED com pagamento confirmado', () => {
    const result = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(result.canRate).toBe(true);
    expect(result.message).toContain('disponível');
  });

  it('bloqueia avaliação duplicada', () => {
    const result = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
      hasAlreadyRated: true,
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('já enviada');
  });

  it('bloqueia se frete não está COMPLETED', () => {
    const result = canRateFreight({
      freightStatus: 'DELIVERED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('encerramento');
  });

  it('bloqueia se pagamento não confirmado', () => {
    const result = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'paid_by_producer',
      actorRole: 'MOTORISTA',
    });
    expect(result.canRate).toBe(false);
    expect(result.message).toContain('confirmação do pagamento');
  });

  it('permite motorista avaliar', () => {
    const result = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'MOTORISTA',
    });
    expect(result.canRate).toBe(true);
  });

  it('permite motorista afiliado avaliar', () => {
    const result = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'MOTORISTA_AFILIADO',
    });
    expect(result.canRate).toBe(true);
  });
});

// =============================================================================
// 8. canRateServiceRequest (Avaliação Urbana)
// =============================================================================

describe('canRateServiceRequest', () => {
  it('permite avaliar quando serviço COMPLETED', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'PRODUTOR',
    });
    expect(result.canRate).toBe(true);
  });

  it('bloqueia se serviço não concluído', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'IN_PROGRESS',
      actorRole: 'PRODUTOR',
    });
    expect(result.canRate).toBe(false);
  });

  it('bloqueia avaliação duplicada', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
      hasAlreadyRated: true,
    });
    expect(result.canRate).toBe(false);
  });

  it('permite GUEST avaliar após conclusão', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'GUEST',
    });
    expect(result.canRate).toBe(true);
  });
});

// =============================================================================
// 9. Labels PT-BR
// =============================================================================

describe('Labels PT-BR', () => {
  it('getPaymentUILabelPtBR traduz todos os status', () => {
    expect(getPaymentUILabelPtBR('proposed')).toBe('Proposto');
    expect(getPaymentUILabelPtBR('paid_by_producer')).toBe('Pago pelo Produtor');
    expect(getPaymentUILabelPtBR('confirmed')).toBe('Confirmado');
    expect(getPaymentUILabelPtBR('disputed')).toBe('Em Disputa');
    expect(getPaymentUILabelPtBR('cancelled')).toBe('Cancelado');
    expect(getPaymentUILabelPtBR('rejected')).toBe('Rejeitado');
  });

  it('nunca retorna status em inglês', () => {
    const statuses = ['proposed', 'paid_by_producer', 'confirmed', 'disputed', 'cancelled', 'rejected'];
    for (const status of statuses) {
      const label = getPaymentUILabelPtBR(status);
      expect(label).not.toBe(status);
      expect(label).not.toContain('_');
    }
  });

  it('retorna "Desconhecido" para status vazio', () => {
    expect(getPaymentUILabelPtBR('')).toBe('Desconhecido');
  });

  it('getPaymentActionLabelPtBR traduz ações', () => {
    expect(getPaymentActionLabelPtBR('mark_paid')).toBe('Marcar como Pago');
    expect(getPaymentActionLabelPtBR('confirm_receipt')).toBe('Confirmar Recebimento');
    expect(getPaymentActionLabelPtBR('dispute')).toBe('Contestar');
    expect(getPaymentActionLabelPtBR('cancel')).toBe('Cancelar Pagamento');
  });

  it('getPaymentStatusExplanation retorna explicação por papel', () => {
    const produtor = getPaymentStatusExplanation('proposed', 'PRODUTOR');
    expect(produtor).toContain('Marque como pago');

    const motorista = getPaymentStatusExplanation('paid_by_producer', 'MOTORISTA');
    expect(motorista).toContain('Confirme o recebimento');
  });

  it('todas as mensagens de erro estão em PT-BR', () => {
    // canMarkPaidByProducer errors
    const r1 = canMarkPaidByProducer({ paymentStatus: 'proposed', freightStatus: 'DELIVERED', actorRole: 'MOTORISTA' });
    expect(r1.error).toContain('produtor');
    expect(r1.error).not.toMatch(/\b(only|cannot|not allowed)\b/i);

    // canConfirmReceivedByDriver errors
    const r2 = canConfirmReceivedByDriver({ paymentStatus: 'proposed', actorRole: 'MOTORISTA' });
    expect(r2.error).toContain('produtor');
    expect(r2.error).not.toMatch(/\b(only|cannot|must)\b/i);

    // canCloseFreightAsCompleted errors
    const r3 = canCloseFreightAsCompleted({
      freightStatus: 'IN_TRANSIT',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(r3.error).toContain('entrega');
    expect(r3.error).not.toMatch(/\b(freight|delivery|must)\b/i);
  });
});

// =============================================================================
// 10. Fluxo completo rural single-truck
// =============================================================================

describe('Fluxo completo: rural single-truck', () => {
  it('segue sequência correta sem erros', () => {
    // 1. Frete entregue → criar pagamento
    const step1 = canCreateExternalPayment({
      freightStatus: 'DELIVERED_PENDING_CONFIRMATION',
      actorRole: 'PRODUTOR',
    });
    expect(step1.valid).toBe(true);

    // 2. Produtor marca como pago
    const step2 = canMarkPaidByProducer({
      paymentStatus: 'proposed',
      freightStatus: 'DELIVERED',
      actorRole: 'PRODUTOR',
    });
    expect(step2.valid).toBe(true);

    // 3. Motorista confirma recebimento
    const step3 = canConfirmReceivedByDriver({
      paymentStatus: 'paid_by_producer',
      actorRole: 'MOTORISTA',
    });
    expect(step3.valid).toBe(true);

    // 4. Frete pode ser encerrado
    const step4 = canCloseFreightAsCompleted({
      freightStatus: 'DELIVERED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(step4.valid).toBe(true);

    // 5. Avaliação desbloqueada
    const step5 = canRateFreight({
      freightStatus: 'COMPLETED',
      paymentStatus: 'confirmed',
      actorRole: 'PRODUTOR',
    });
    expect(step5.canRate).toBe(true);
  });
});

// =============================================================================
// 11. Fluxo completo rural multi-truck
// =============================================================================

describe('Fluxo completo: rural multi-truck', () => {
  it('bloqueia encerramento quando apenas 1 de 2 carretas finalizou', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'IN_TRANSIT' },
      ],
    });
    expect(result.valid).toBe(false);
  });

  it('permite encerramento quando todas as carretas finalizaram', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'COMPLETED', paymentStatus: 'confirmed' },
        { id: '2', status: 'DELIVERED', paymentStatus: 'confirmed' },
      ],
    });
    expect(result.valid).toBe(true);
  });

  it('bloqueia quando pagamento de uma carreta não confirmado', () => {
    const result = canCloseMultiTruckFreight({
      requiredTrucks: 2,
      assignments: [
        { id: '1', status: 'DELIVERED', paymentStatus: 'confirmed' },
        { id: '2', status: 'DELIVERED', paymentStatus: 'proposed' },
      ],
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain('pagamento');
  });
});

// =============================================================================
// 12. Fluxo urbano
// =============================================================================

describe('Fluxo urbano (service_request)', () => {
  it('permite avaliar após COMPLETED', () => {
    const result = canRateServiceRequest({
      serviceStatus: 'COMPLETED',
      actorRole: 'MOTORISTA',
    });
    expect(result.canRate).toBe(true);
  });

  it('bloqueia avaliação durante serviço em andamento', () => {
    for (const status of ['OPEN', 'ACCEPTED', 'ON_THE_WAY', 'IN_PROGRESS']) {
      const result = canRateServiceRequest({
        serviceStatus: status,
        actorRole: 'PRODUTOR',
      });
      expect(result.canRate).toBe(false);
    }
  });
});
