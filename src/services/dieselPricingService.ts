import { supabase } from '@/integrations/supabase/client';

export type VehicleCategory = 
  | 'MOTORCYCLE'      // Moto (10L)
  | 'PICKUP'          // Pickup (40L)
  | 'SEMITRUCK'       // Carretas (70L)
  | 'TRANSPORT_COMPANY'; // Transportadora (100L)

interface PricingResult {
  vehicleCategory: VehicleCategory;
  litersBase: number;
  dieselPrice: number;
  monthlyFee: number;
  calculatedAt: string;
}

export class DieselPricingService {
  private static VEHICLE_LITERS: Record<VehicleCategory, number> = {
    MOTORCYCLE: 10,
    PICKUP: 40,
    SEMITRUCK: 70,
    TRANSPORT_COMPANY: 100,
  };

  private static VEHICLE_NAMES: Record<VehicleCategory, string> = {
    MOTORCYCLE: 'Moto',
    PICKUP: 'Pickup',
    SEMITRUCK: 'Carretas',
    TRANSPORT_COMPANY: 'Transportadora',
  };

  /**
   * Busca preço atual do diesel
   */
  static async getCurrentDieselPrice(): Promise<number> {
    const { data, error } = await supabase
      .from('diesel_prices')
      .select('price')
      .order('effective_date', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      console.error('[DieselPricing] Erro ao buscar preço:', error);
      return 6.00; // Fallback
    }

    return data?.price || 6.00;
  }

  /**
   * Calcula mensalidade: litros × preço (SEM markup)
   */
  static async calculateMonthlyFee(
    category: VehicleCategory,
    dieselPrice?: number
  ): Promise<PricingResult> {
    const price = dieselPrice ?? await this.getCurrentDieselPrice();
    const liters = this.VEHICLE_LITERS[category];
    const monthlyFee = liters * price;

    return {
      vehicleCategory: category,
      litersBase: liters,
      dieselPrice: price,
      monthlyFee,
      calculatedAt: new Date().toISOString(),
    };
  }

  /**
   * Calcula todas as categorias
   */
  static async calculateAllCategories(): Promise<Record<VehicleCategory, PricingResult>> {
    const dieselPrice = await this.getCurrentDieselPrice();
    const results: Partial<Record<VehicleCategory, PricingResult>> = {};

    for (const category of Object.keys(this.VEHICLE_LITERS) as VehicleCategory[]) {
      results[category] = await this.calculateMonthlyFee(category, dieselPrice);
    }

    return results as Record<VehicleCategory, PricingResult>;
  }

  /**
   * Mapeia categoria de usuário para categoria de veículo
   */
  static mapUserCategoryToVehicle(userCategory: string): VehicleCategory {
    const mapping: Record<string, VehicleCategory> = {
      'prestador': 'PICKUP',
      'motorista': 'PICKUP',
      'motorista_rural': 'SEMITRUCK',
      'motorista_urbano': 'PICKUP',
      'transportadora': 'TRANSPORT_COMPANY',
      'guincho_urbano': 'PICKUP',
      'guincho_rural': 'SEMITRUCK',
    };

    return mapping[userCategory] || 'PICKUP';
  }

  static getVehicleName(category: VehicleCategory): string {
    return this.VEHICLE_NAMES[category];
  }
}
