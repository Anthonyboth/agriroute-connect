/**
 * Freight Status Service
 * 
 * Provides safe, enum-based freight status updates using RPC
 * Includes validation, transition rules, and error handling
 */

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  labelToEnum,
  isValidTransition,
  getTransitionErrorMessage,
  isFinalStatus,
  normalizeFreightStatus,
  getFreightStatusLabel,
} from '@/lib/freight-status';

export interface UpdateFreightStatusParams {
  freightId: string;
  newStatus: string; // Can be enum or PT-BR label
  userId: string;
  notes?: string;
  location?: { lat: number; lng: number };
  assignmentId?: string;
  skipValidation?: boolean; // For admin overrides
}

export interface UpdateFreightStatusResult {
  success: boolean;
  error?: string;
  currentStatus?: string;
  attemptedStatus?: string;
  message?: string;
}

/**
 * Update freight status using safe RPC with enum validation
 * 
 * Uses update_freight_status (typed enum RPC) with fallback to update_freight_status_text
 * This prevents enum/text type mismatch errors in production
 */
export async function updateFreightStatus(
  params: UpdateFreightStatusParams
): Promise<UpdateFreightStatusResult> {
  const {
    freightId,
    newStatus,
    userId,
    notes,
    location,
    assignmentId,
    skipValidation = false,
  } = params;

  try {
    // 1. Convert label to enum if needed
    let enumStatus = newStatus;
    if (newStatus && !newStatus.includes('_') && newStatus !== newStatus.toUpperCase()) {
      const converted = labelToEnum(newStatus);
      if (converted) {
        enumStatus = converted;
      }
    }

    // 2. Normalize the enum
    enumStatus = normalizeFreightStatus(enumStatus);

    // 3. Fetch current freight status for validation (client-side pre-check)
    if (!skipValidation) {
      const { data: freight, error: fetchError } = await supabase
        .from('freights')
        .select('status')
        .eq('id', freightId)
        .single();

      if (fetchError) {
        console.error('[FreightStatus] Error fetching current status:', fetchError);
        return {
          success: false,
          error: 'Erro ao verificar status atual do frete',
        };
      }

      const currentStatus = freight.status;

      // Check if current status is final
      if (isFinalStatus(currentStatus)) {
        const message = `Este frete está em status final (${getFreightStatusLabel(currentStatus)}) e não pode mais ser alterado.`;
        toast.error(message);
        return {
          success: false,
          error: message,
          currentStatus,
          attemptedStatus: enumStatus,
        };
      }

      // Check if transition is valid
      if (!isValidTransition(currentStatus, enumStatus)) {
        const message = getTransitionErrorMessage(currentStatus, enumStatus);
        toast.error(message);
        return {
          success: false,
          error: message,
          currentStatus,
          attemptedStatus: enumStatus,
        };
      }
    }

    // 4. Call new typed RPC to update status (prefers enum type)
    // This RPC uses SECURITY DEFINER and checks driver_id/producer_id permissions
    let { data, error } = await supabase.rpc('update_freight_status', {
      p_id: freightId,
      p_status: enumStatus, // Typed as freight_status enum
    });

    // Fallback: If typed RPC fails, try text-based RPC
    // This handles cases where the enum cast isn't available yet
    if (error) {
      console.warn('[FreightStatus] Typed RPC failed, falling back to text RPC:', error);
      
      const fallbackResult = await supabase.rpc('update_freight_status_text', {
        p_id: freightId,
        p_status_text: enumStatus, // Server-side text-to-enum conversion
      });
      
      data = fallbackResult.data;
      error = fallbackResult.error;
      
      if (error) {
        console.error('[FreightStatus] Both RPCs failed:', error);
      }
    }

    if (error) {
      console.error('[FreightStatus] RPC error:', error);
      
      // Handle specific error codes
      if (error.code === 'P0001') {
        const message = 'Este frete já foi entregue e está aguardando confirmação. Não é possível alterar o status.';
        toast.error(message);
        return {
          success: false,
          error: message,
        };
      }
      
      toast.error('Erro ao atualizar status do frete: ' + (error.message || 'Erro desconhecido'));
      return {
        success: false,
        error: error.message || 'Erro desconhecido',
      };
    }

    // 5. Check RPC response
    const result = data as any;
    if (!result || !result.success) {
      const errorMsg = result?.error || 'Erro ao atualizar status';
      toast.error(errorMsg);
      return {
        success: false,
        error: errorMsg,
        currentStatus: result?.current_status,
        attemptedStatus: result?.attempted_status,
        message: result?.message,
      };
    }

    // 6. Success
    const statusMessages: Record<string, string> = {
      'LOADING': 'Status atualizado: A caminho da coleta! 🚚',
      'LOADED': 'Status atualizado: Carga coletada! 📦',
      'IN_TRANSIT': 'Status atualizado: Em trânsito! 🛣️',
      'DELIVERED_PENDING_CONFIRMATION': 'Entrega reportada com sucesso! O produtor tem 72h para confirmar. ✅',
      'DELIVERED': 'Entrega confirmada! ✅',
      'COMPLETED': 'Frete concluído! 🎉',
    };

    const successMessage = statusMessages[enumStatus] || 'Status atualizado com sucesso!';
    toast.success(successMessage);

    return {
      success: true,
      message: successMessage,
    };
  } catch (error: any) {
    console.error('[FreightStatus] Unexpected error:', error);
    toast.error('Erro inesperado ao atualizar status');
    return {
      success: false,
      error: 'Erro inesperado',
    };
  }
}

/**
 * Update freight status using PT-BR label
 * Convenience wrapper that converts label to enum
 */
export async function updateFreightStatusByLabel(
  params: Omit<UpdateFreightStatusParams, 'newStatus'> & { label: string }
): Promise<UpdateFreightStatusResult> {
  const { label, ...rest } = params;
  
  const enumStatus = labelToEnum(label);
  if (!enumStatus) {
    toast.error(`Status inválido: "${label}"`);
    return {
      success: false,
      error: `Status inválido: "${label}"`,
    };
  }

  return updateFreightStatus({
    ...rest,
    newStatus: enumStatus,
  });
}
