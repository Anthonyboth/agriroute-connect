import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface InsuranceProduct {
  id: string;
  name: string;
  category: string;
  description: string;
  coverage_details: string;
  exclusions: string;
  min_price: number;
  max_price: number;
  max_coverage: number | null;
  pricing_model: string;
  active: boolean;
  created_at: string;
}

export interface UserInsurance {
  id: string;
  user_id: string;
  insurance_product_id: string;
  coverage_value: number;
  price: number;
  status: string;
  start_date: string;
  end_date: string | null;
  payment_method: string | null;
  created_at: string;
  insurance_products?: InsuranceProduct;
}

export interface InsuranceClaim {
  id: string;
  user_insurance_id: string | null;
  freight_insurance_id: string | null;
  user_id: string;
  description: string;
  evidence_urls: string[];
  status: string;
  resolution_notes: string | null;
  amount_claimed: number;
  amount_paid: number;
  created_at: string;
  resolved_at: string | null;
}

export function useInsurance() {
  const [products, setProducts] = useState<InsuranceProduct[]>([]);
  const [userInsurances, setUserInsurances] = useState<UserInsurance[]>([]);
  const [claims, setClaims] = useState<InsuranceClaim[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProducts = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('insurance_products')
      .select('*')
      .eq('active', true)
      .order('category');
    if (error) {
      console.error('Error fetching insurance products:', error);
      return;
    }
    setProducts(data || []);
  }, []);

  const fetchUserInsurances = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('user_insurances')
      .select('*, insurance_products(*)')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching user insurances:', error);
      return;
    }
    setUserInsurances(data || []);
  }, []);

  const fetchClaims = useCallback(async () => {
    const { data, error } = await (supabase as any)
      .from('insurance_claims')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Error fetching insurance claims:', error);
      return;
    }
    setClaims(data || []);
  }, []);

  const refetch = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchProducts(), fetchUserInsurances(), fetchClaims()]);
    setLoading(false);
  }, [fetchProducts, fetchUserInsurances, fetchClaims]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  const createInsurance = async (params: {
    insuranceProductId: string;
    coverageValue: number;
    price: number;
    paymentMethod: string;
    endDate?: string;
  }) => {
    // Resolve profile id
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .maybeSingle();

    if (!profile) {
      toast.error('Perfil não encontrado');
      return false;
    }

    const { error } = await (supabase as any)
      .from('user_insurances')
      .insert({
        user_id: profile.id,
        insurance_product_id: params.insuranceProductId,
        coverage_value: params.coverageValue,
        price: params.price,
        payment_method: params.paymentMethod,
        end_date: params.endDate || null,
      });

    if (error) {
      console.error('Error creating insurance:', error);
      toast.error('Erro ao contratar seguro');
      return false;
    }

    toast.success('Seguro contratado com sucesso!');
    await refetch();
    return true;
  };

  const createClaim = async (params: {
    userInsuranceId?: string;
    freightInsuranceId?: string;
    description: string;
    evidenceUrls: string[];
    amountClaimed: number;
  }) => {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id || '')
      .maybeSingle();

    if (!profile) {
      toast.error('Perfil não encontrado');
      return false;
    }

    const { error } = await (supabase as any)
      .from('insurance_claims')
      .insert({
        user_id: profile.id,
        user_insurance_id: params.userInsuranceId || null,
        freight_insurance_id: params.freightInsuranceId || null,
        description: params.description,
        evidence_urls: params.evidenceUrls,
        amount_claimed: params.amountClaimed,
      });

    if (error) {
      console.error('Error creating claim:', error);
      toast.error('Erro ao abrir sinistro');
      return false;
    }

    toast.success('Sinistro aberto com sucesso!');
    await refetch();
    return true;
  };

  const cancelInsurance = async (insuranceId: string) => {
    const { error } = await (supabase as any)
      .from('user_insurances')
      .update({ status: 'cancelled' })
      .eq('id', insuranceId);

    if (error) {
      console.error('Error cancelling insurance:', error);
      toast.error('Erro ao cancelar seguro');
      return false;
    }

    toast.success('Seguro cancelado');
    await refetch();
    return true;
  };

  return {
    products,
    userInsurances,
    claims,
    loading,
    refetch,
    createInsurance,
    createClaim,
    cancelInsurance,
  };
}
