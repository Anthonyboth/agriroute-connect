import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export type RiskLevel = 'low' | 'medium' | 'high' | 'blocked';
export type OperationType = 'withdrawal' | 'advance' | 'credit_use' | 'pix_key_change' | 'high_payout' | 'admin_financial_action' | 'transfer';

export interface RiskAssessment {
  score: number;
  level: RiskLevel;
  factors: Array<{ factor: string; impact: number; detail: string }>;
  confirmation_required: 'simple' | 'pin' | 'pin_plus_review' | 'blocked';
}

export interface RiskCheckResult {
  assessment: RiskAssessment;
  hasPin: boolean;
  activeCooldowns: Array<{ event_type: string; cooldown_until: string }>;
}

export const useFinancialRisk = () => {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [lastAssessment, setLastAssessment] = useState<RiskCheckResult | null>(null);

  const assessRisk = useCallback(async (
    operationType: OperationType,
    amount: number = 0
  ): Promise<RiskCheckResult | null> => {
    if (!profile?.id) return null;

    try {
      setLoading(true);

      // Call server-side risk assessment
      const { data: riskData, error: riskError } = await supabase.rpc('assess_operation_risk', {
        p_profile_id: profile.id,
        p_operation_type: operationType,
        p_amount: amount,
      });

      if (riskError) throw riskError;

      // Check if user has a financial PIN
      const { data: pinData } = await supabase
        .from('financial_pins')
        .select('id')
        .eq('profile_id', profile.id)
        .maybeSingle();

      // Get active cooldowns
      const { data: cooldowns } = await supabase
        .rpc('get_active_cooldowns', { p_profile_id: profile.id });

      const assessment = riskData as unknown as RiskAssessment;
      const result: RiskCheckResult = {
        assessment,
        hasPin: !!pinData,
        activeCooldowns: (cooldowns as any[]) || [],
      };

      setLastAssessment(result);
      return result;
    } catch (err) {
      console.error('Risk assessment error:', err);
      // Default to medium risk on error (fail-safe)
      const fallback: RiskCheckResult = {
        assessment: { score: 25, level: 'medium', factors: [{ factor: 'assessment_error', impact: 25, detail: 'Não foi possível avaliar risco' }], confirmation_required: 'pin' },
        hasPin: false,
        activeCooldowns: [],
      };
      setLastAssessment(fallback);
      return fallback;
    } finally {
      setLoading(false);
    }
  }, [profile?.id]);

  const logRiskResult = useCallback(async (
    operationType: OperationType,
    amount: number,
    assessment: RiskAssessment,
    result: 'approved' | 'denied' | 'pending_review'
  ) => {
    if (!profile?.id) return;

    try {
      await supabase.from('operation_risk_logs').insert({
        profile_id: profile.id,
        operation_type: operationType,
        amount,
        risk_level: assessment.level,
        risk_score: assessment.score,
        risk_factors: assessment.factors as any,
        confirmation_method: assessment.confirmation_required,
        user_agent: navigator.userAgent,
        result,
      });
    } catch (err) {
      console.error('Failed to log risk result:', err);
    }
  }, [profile?.id]);

  const createBlockedOperation = useCallback(async (
    operationType: OperationType,
    amount: number,
    payload: Record<string, any>,
    assessment: RiskAssessment
  ) => {
    if (!profile?.id) return;

    try {
      await supabase.from('blocked_operations').insert({
        profile_id: profile.id,
        operation_type: operationType,
        operation_payload: payload as any,
        amount,
        reason: assessment.factors.map(f => f.detail).join('; '),
        risk_factors: assessment.factors as any,
        status: 'pending_review',
      });
    } catch (err) {
      console.error('Failed to create blocked operation:', err);
    }
  }, [profile?.id]);

  const verifyPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!profile?.id) return false;

    try {
      // For now, verify against stored hash using a simple comparison
      // In production, this should be an edge function with bcrypt
      const { data, error } = await supabase
        .from('financial_pins')
        .select('pin_hash, failed_attempts, locked_until')
        .eq('profile_id', profile.id)
        .maybeSingle();

      if (error || !data) return false;

      // Check lock
      if (data.locked_until && new Date(data.locked_until) > new Date()) {
        return false;
      }

      // Simple hash comparison (in production use bcrypt via edge function)
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pin + profile.id));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      if (hashHex === data.pin_hash) {
        // Reset failed attempts
        await supabase.from('financial_pins')
          .update({ failed_attempts: 0, locked_until: null, updated_at: new Date().toISOString() })
          .eq('profile_id', profile.id);
        return true;
      } else {
        const newAttempts = (data.failed_attempts || 0) + 1;
        const lockUntil = newAttempts >= 5 
          ? new Date(Date.now() + 30 * 60 * 1000).toISOString() 
          : null;
        await supabase.from('financial_pins')
          .update({ failed_attempts: newAttempts, locked_until: lockUntil, updated_at: new Date().toISOString() })
          .eq('profile_id', profile.id);
        return false;
      }
    } catch {
      return false;
    }
  }, [profile?.id]);

  const createPin = useCallback(async (pin: string): Promise<boolean> => {
    if (!profile?.id || pin.length !== 4) return false;

    try {
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest('SHA-256', encoder.encode(pin + profile.id));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

      const { error } = await supabase.from('financial_pins').upsert({
        profile_id: profile.id,
        pin_hash: hashHex,
        failed_attempts: 0,
        locked_until: null,
      }, { onConflict: 'profile_id' });

      return !error;
    } catch {
      return false;
    }
  }, [profile?.id]);

  return {
    assessRisk,
    logRiskResult,
    createBlockedOperation,
    verifyPin,
    createPin,
    loading,
    lastAssessment,
  };
};
