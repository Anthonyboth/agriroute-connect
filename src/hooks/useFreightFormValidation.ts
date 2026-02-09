/**
 * useFreightFormValidation
 * 
 * Hook centralizado de validação para o formulário de frete (wizard).
 * Valida TODOS os campos obrigatórios antes do submit e retorna
 * exatamente qual campo está faltando, com mensagem clara e etapa correta.
 * 
 * Funciona para fretes normais e guest (sem cadastro).
 */

import { useCallback } from 'react';
import { useFormNotification } from '@/hooks/useFormNotification';

interface FreightFormData {
  origin_city: string;
  origin_state: string;
  destination_city: string;
  destination_state: string;
  origin_neighborhood: string;
  destination_neighborhood: string;
  cargo_type: string;
  weight: string;
  vehicle_type_required: string;
  pricing_type: 'FIXED' | 'PER_KM' | 'PER_TON';
  price: string;
  price_per_km: string;
  pickup_date: string;
  delivery_date: string;
  required_trucks: string;
  guest_name?: string;
  guest_phone?: string;
  guest_document?: string;
  [key: string]: any;
}

interface ValidationResult {
  valid: boolean;
  /** Step number to navigate to (1-5) */
  step?: number;
}

interface FieldRule {
  /** Field key in formData */
  key: string;
  /** Human-readable label in PT-BR */
  label: string;
  /** Wizard step number (1-5) */
  step: number;
  /** Validation function — return true if valid */
  check: (value: any, formData: FreightFormData) => boolean;
  /** Problem description */
  problem?: string;
  /** How to fix */
  solution?: string;
}

export function useFreightFormValidation() {
  const { showFormError } = useFormNotification();

  /**
   * Validates all required fields for freight creation.
   * Shows a toast with the FIRST missing field and navigates to the correct step.
   * Returns { valid, step } so the caller can setCurrentStep if needed.
   */
  const validateFreightForm = useCallback((
    formData: FreightFormData,
    guestMode: boolean = false
  ): ValidationResult => {
    
    const rules: FieldRule[] = [
      // ── Step 1: Route ──
      {
        key: 'origin_city',
        label: 'Cidade de Origem',
        step: 1,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione a cidade de onde sai a carga na etapa "Rota".',
      },
      {
        key: 'origin_state',
        label: 'Estado de Origem',
        step: 1,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione o estado de origem na etapa "Rota".',
      },
      {
        key: 'destination_city',
        label: 'Cidade de Destino',
        step: 1,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione a cidade de destino na etapa "Rota".',
      },
      {
        key: 'destination_state',
        label: 'Estado de Destino',
        step: 1,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione o estado de destino na etapa "Rota".',
      },

      // ── Step 1 (Guest only): Contact info ──
      ...(guestMode ? [
        {
          key: 'guest_name',
          label: 'Seu Nome',
          step: 1,
          check: (v: any) => !!v && v.trim().length >= 3,
          solution: 'Informe seu nome completo (mínimo 3 caracteres).',
        },
        {
          key: 'guest_phone',
          label: 'Seu Telefone',
          step: 1,
          check: (v: any) => !!v && v.replace(/\D/g, '').length >= 10,
          solution: 'Informe um telefone brasileiro válido com DDD (ex: 66 99999-0000).',
        },
        {
          key: 'guest_document',
          label: 'CPF ou CNPJ',
          step: 1,
          check: (v: any) => {
            if (!v) return false;
            const digits = v.replace(/\D/g, '');
            return digits.length === 11 || digits.length === 14;
          },
          solution: 'Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.',
        },
      ] as FieldRule[] : []),

      // ── Step 2: Address ──
      {
        key: 'origin_neighborhood',
        label: 'Bairro/Fazenda de Origem',
        step: 2,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Informe o bairro, fazenda ou ponto de referência de onde sai a carga.',
      },
      {
        key: 'destination_neighborhood',
        label: 'Bairro/Fazenda de Destino',
        step: 2,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Informe o bairro, fazenda ou ponto de referência de entrega.',
      },

      // ── Step 3: Cargo ──
      {
        key: 'cargo_type',
        label: 'Tipo de Carga',
        step: 3,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione o tipo de carga (ex: Grãos, Soja, Gado, etc.).',
      },
      {
        key: 'weight',
        label: 'Peso da Carga',
        step: 3,
        check: (v) => {
          if (!v) return false;
          const num = parseFloat(v);
          if (isNaN(num) || num <= 0) return false;
          const weightKg = num * 1000;
          // Weight is TOTAL cargo weight (distributed across multiple trucks)
          // Min: 100kg (0.1 ton), Max: 10,000,000kg (10,000 tons)
          return weightKg >= 100 && weightKg <= 10000000;
        },
        problem: 'Peso inválido. Permitido: 0.1 a 10.000 toneladas.',
        solution: 'Informe o peso TOTAL aproximado em toneladas que deseja transportar (ex: 300). Mínimo 0.1 ton, máximo 10.000 ton.',
      },
      {
        key: 'vehicle_type_required',
        label: 'Tipo de Veículo',
        step: 3,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione o tipo de veículo necessário (ex: Carreta, Truck, Bitrem).',
      },

      // ── Step 4: Price & Dates ──
      {
        key: '_price_value',
        label: 'Valor do Frete',
        step: 4,
        check: (_v, fd) => {
          if (fd.pricing_type === 'FIXED') {
            const p = parseFloat(fd.price);
            return !isNaN(p) && p > 0;
          }
          if (fd.pricing_type === 'PER_KM') {
            const p = parseFloat(fd.price_per_km);
            return !isNaN(p) && p > 0;
          }
          if (fd.pricing_type === 'PER_TON') {
            const p = parseFloat(fd.price_per_km); // price_per_km is reused for PER_TON
            return !isNaN(p) && p > 0;
          }
          return false;
        },
        problem: 'Valor do frete não definido ou inválido.',
        solution: 'Informe o valor por km, por tonelada, ou valor fixo na etapa "Valor".',
      },
      {
        key: 'pickup_date',
        label: 'Data de Coleta',
        step: 4,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione a data prevista para retirada da carga.',
      },
      {
        key: 'delivery_date',
        label: 'Data de Entrega',
        step: 4,
        check: (v) => !!v && v.trim().length > 0,
        solution: 'Selecione a data prevista para entrega da carga.',
      },
      {
        key: 'required_trucks',
        label: 'Quantidade de Veículos',
        step: 4,
        check: (v) => {
          const num = parseInt(v, 10);
          return !isNaN(num) && num >= 1;
        },
        problem: 'Quantidade de veículos inválida.',
        solution: 'Informe quantos veículos são necessários (mínimo 1).',
      },
    ];

    // Check each rule in order — stop at first failure
    for (const rule of rules) {
      const value = rule.key.startsWith('_') ? undefined : formData[rule.key];
      const isValid = rule.check(value, formData);

      if (!isValid) {
        showFormError({
          field: rule.label,
          problem: rule.problem || 'Campo obrigatório não preenchido.',
          solution: rule.solution || `Preencha o campo "${rule.label}" para continuar.`,
          type: 'error',
        });

        return { valid: false, step: rule.step };
      }
    }

    return { valid: true };
  }, [showFormError]);

  return { validateFreightForm };
}
