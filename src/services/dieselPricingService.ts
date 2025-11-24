import { supabase } from '@/integrations/supabase/client';

export type VehicleCategory = 
  | 'MOTORCYCLE'      // Moto (10L)
  | 'PICKUP'          // Pickup (40L)
  | 'SEMITRUCK'       // Carretas (70L)
  | 'TRANSPORT_COMPANY'; // Transportadora (100L)

export type PricingType = 'FIXED' | 'PER_KM' | 'PER_TON';

interface PricingResult {
  vehicleCategory: VehicleCategory;
  litersBase: number;
  dieselPrice: number;
  monthlyFee: number;
  calculatedAt: string;
}

export interface FreightPriceCalculation {
  pricingType: PricingType;
  baseValue: number;
  totalPrice: number;
  distance?: number;
  weight?: number;
  breakdown: string;
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

  /**
   * Calcula preço total baseado no tipo de pricing
   */
  static calculateFreightPrice(
    pricingType: PricingType,
    baseValue: number,
    distance?: number,
    weightKg?: number
  ): FreightPriceCalculation {
    let totalPrice: number;
    let breakdown: string;

    switch (pricingType) {
      case 'FIXED':
        totalPrice = baseValue;
        breakdown = `Valor fixo: R$ ${baseValue.toFixed(2)}`;
        break;

      case 'PER_KM':
        if (!distance || distance <= 0) {
          throw new Error('Distância é obrigatória para pricing por KM');
        }
        totalPrice = baseValue * distance;
        breakdown = `R$ ${baseValue.toFixed(2)}/km × ${distance.toFixed(0)} km = R$ ${totalPrice.toFixed(2)}`;
        break;

      case 'PER_TON':
        if (!weightKg || weightKg <= 0) {
          throw new Error('Peso é obrigatório para pricing por tonelada');
        }
        const weightTons = weightKg / 1000;
        totalPrice = baseValue * weightTons;
        breakdown = `R$ ${baseValue.toFixed(2)}/ton × ${weightTons.toFixed(2)} ton = R$ ${totalPrice.toFixed(2)}`;
        break;

      default:
        throw new Error(`Tipo de pricing inválido: ${pricingType}`);
    }

    return {
      pricingType,
      baseValue,
      totalPrice,
      distance,
      weight: weightKg,
      breakdown,
    };
  }

  /**
   * Formata label do tipo de pricing
   */
  static getPricingTypeLabel(pricingType: PricingType): string {
    const labels: Record<PricingType, string> = {
      FIXED: 'Valor Fixo',
      PER_KM: 'Por Quilômetro',
      PER_TON: 'Por Tonelada',
    };
    return labels[pricingType] || pricingType;
  }

  /**
   * Formata sufixo do tipo de pricing
   */
  static getPricingTypeSuffix(pricingType: PricingType): string {
    const suffixes: Record<PricingType, string> = {
      FIXED: '',
      PER_KM: '/km',
      PER_TON: '/ton',
    };
    return suffixes[pricingType] || '';
  }
}
