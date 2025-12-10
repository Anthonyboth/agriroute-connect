import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface DriverExpense {
  id: string;
  driver_id: string;
  expense_type: 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'TIRE' | 'OTHER';
  amount: number;
  description?: string;
  expense_date: string;
  liters?: number;
  price_per_liter?: number;
  km_reading?: number;
  vehicle_id?: string;
  freight_id?: string;
  receipt_url?: string;
  created_at: string;
  updated_at: string;
  vehicles?: { plate: string; model: string } | null;
}

export interface ExpenseInput {
  expense_type: 'FUEL' | 'MAINTENANCE' | 'TOLL' | 'TIRE' | 'OTHER';
  amount: number;
  description?: string;
  expense_date: string;
  liters?: number;
  price_per_liter?: number;
  km_reading?: number;
  vehicle_id?: string;
  freight_id?: string;
}

export interface FinancialSummary {
  totalEarnings: number;
  totalExpenses: number;
  netProfit: number;
  totalKm: number;
  totalLiters: number;
  avgKmPerLiter: number;
  costPerKm: number;
  expensesByType: Record<string, number>;
  monthlyData: { month: string; earnings: number; expenses: number; profit: number }[];
  fuelHistory: { date: string; liters: number; kmPerLiter: number; pricePerLiter: number }[];
}

export const useDriverExpenses = (driverId: string | undefined) => {
  const queryClient = useQueryClient();

  // Buscar despesas
  const { data: expenses, isLoading: expensesLoading } = useQuery({
    queryKey: ['driver-expenses', driverId],
    queryFn: async () => {
      if (!driverId) return [];
      
      const { data, error } = await supabase
        .from('driver_expenses')
        .select('*')
        .eq('driver_id', driverId)
        .order('expense_date', { ascending: false });
      
      if (error) throw error;
      return data as DriverExpense[];
    },
    enabled: !!driverId,
  });

  // Buscar ganhos (fretes concluídos)
  const { data: earnings, isLoading: earningsLoading } = useQuery({
    queryKey: ['driver-earnings', driverId],
    queryFn: async () => {
      if (!driverId) return [];
      
      const { data, error } = await supabase
        .from('freight_assignments')
        .select(`
          id,
          agreed_price,
          delivered_at,
          created_at,
          freights:freight_id (
            distance_km,
            origin_city,
            destination_city
          )
        `)
        .eq('driver_id', driverId)
        .eq('status', 'COMPLETED')
        .order('delivered_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    },
    enabled: !!driverId,
  });

  // Calcular resumo financeiro
  const financialSummary: FinancialSummary = (() => {
    const totalEarnings = earnings?.reduce((sum, e) => sum + (e.agreed_price || 0), 0) || 0;
    const totalExpenses = expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
    const netProfit = totalEarnings - totalExpenses;

    // Calcular km total (dos fretes)
    const totalKm = earnings?.reduce((sum, e) => sum + ((e.freights as any)?.distance_km || 0), 0) || 0;

    // Calcular consumo de combustível
    const fuelExpenses = expenses?.filter(e => e.expense_type === 'FUEL' && e.liters) || [];
    const totalLiters = fuelExpenses.reduce((sum, e) => sum + (e.liters || 0), 0);
    
    // Calcular km/litro usando leituras de odômetro
    let avgKmPerLiter = 0;
    if (fuelExpenses.length >= 2) {
      const sortedFuel = [...fuelExpenses].sort((a, b) => 
        new Date(a.expense_date).getTime() - new Date(b.expense_date).getTime()
      );
      
      let totalKmFromOdometer = 0;
      let totalLitersCalc = 0;
      
      for (let i = 1; i < sortedFuel.length; i++) {
        const current = sortedFuel[i];
        const previous = sortedFuel[i - 1];
        
        if (current.km_reading && previous.km_reading && current.liters) {
          totalKmFromOdometer += current.km_reading - previous.km_reading;
          totalLitersCalc += current.liters;
        }
      }
      
      avgKmPerLiter = totalLitersCalc > 0 ? totalKmFromOdometer / totalLitersCalc : 0;
    }

    const costPerKm = totalKm > 0 ? totalExpenses / totalKm : 0;

    // Despesas por tipo
    const expensesByType: Record<string, number> = {};
    expenses?.forEach(e => {
      expensesByType[e.expense_type] = (expensesByType[e.expense_type] || 0) + e.amount;
    });

    // Dados mensais (últimos 12 meses)
    const monthlyData: { month: string; earnings: number; expenses: number; profit: number }[] = [];
    const now = new Date();
    
    for (let i = 11; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStr = monthDate.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' });
      const monthStart = monthDate.toISOString().split('T')[0];
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).toISOString().split('T')[0];

      const monthEarnings = earnings?.filter(e => {
        const date = e.delivered_at || e.created_at;
        return date >= monthStart && date <= monthEnd;
      }).reduce((sum, e) => sum + (e.agreed_price || 0), 0) || 0;

      const monthExpenses = expenses?.filter(e => {
        return e.expense_date >= monthStart && e.expense_date <= monthEnd;
      }).reduce((sum, e) => sum + e.amount, 0) || 0;

      monthlyData.push({
        month: monthStr,
        earnings: monthEarnings,
        expenses: monthExpenses,
        profit: monthEarnings - monthExpenses,
      });
    }

    // Histórico de abastecimentos com km/litro
    const fuelHistory = fuelExpenses
      .filter(e => e.liters && e.price_per_liter)
      .slice(0, 20)
      .map((e, i, arr) => {
        let kmPerLiter = 0;
        if (i < arr.length - 1 && e.km_reading && arr[i + 1].km_reading) {
          const kmDiff = e.km_reading - (arr[i + 1].km_reading || 0);
          kmPerLiter = e.liters ? kmDiff / e.liters : 0;
        }
        return {
          date: e.expense_date,
          liters: e.liters || 0,
          kmPerLiter: Math.max(0, kmPerLiter),
          pricePerLiter: e.price_per_liter || 0,
        };
      });

    return {
      totalEarnings,
      totalExpenses,
      netProfit,
      totalKm,
      totalLiters,
      avgKmPerLiter,
      costPerKm,
      expensesByType,
      monthlyData,
      fuelHistory,
    };
  })();

  // Adicionar despesa
  const addExpense = useMutation({
    mutationFn: async (input: ExpenseInput) => {
      if (!driverId) throw new Error('Driver ID não encontrado');
      
      const { data, error } = await supabase
        .from('driver_expenses')
        .insert({
          driver_id: driverId,
          ...input,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-expenses', driverId] });
      toast.success('Despesa registrada com sucesso!');
    },
    onError: (error) => {
      console.error('[useDriverExpenses] Erro ao adicionar despesa:', error);
      toast.error('Erro ao registrar despesa');
    },
  });

  // Atualizar despesa
  const updateExpense = useMutation({
    mutationFn: async ({ id, ...input }: ExpenseInput & { id: string }) => {
      const { data, error } = await supabase
        .from('driver_expenses')
        .update(input)
        .eq('id', id)
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-expenses', driverId] });
      toast.success('Despesa atualizada!');
    },
    onError: (error) => {
      console.error('[useDriverExpenses] Erro ao atualizar despesa:', error);
      toast.error('Erro ao atualizar despesa');
    },
  });

  // Deletar despesa
  const deleteExpense = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('driver_expenses')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['driver-expenses', driverId] });
      toast.success('Despesa removida!');
    },
    onError: (error) => {
      console.error('[useDriverExpenses] Erro ao deletar despesa:', error);
      toast.error('Erro ao remover despesa');
    },
  });

  return {
    expenses: expenses || [],
    earnings: earnings || [],
    financialSummary,
    isLoading: expensesLoading || earningsLoading,
    addExpense,
    updateExpense,
    deleteExpense,
  };
};
