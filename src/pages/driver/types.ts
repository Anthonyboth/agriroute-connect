import { CanonicalServiceType } from '@/lib/service-type-normalization';

export interface Freight {
  id: string;
  cargo_type: string;
  weight: number;
  origin_address: string;
  destination_address: string;
  pickup_date: string;
  delivery_date: string;
  price: number;
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  status: string;
  distance_km: number;
  minimum_antt_price: number;
  required_trucks?: number;
  pricing_type: 'FIXED' | 'PER_KM' | 'PER_TON';
  price_per_km?: number;
  producer_id?: string | null;
  service_type?: CanonicalServiceType;
  is_service_request?: boolean;
  problem_description?: string;
  contact_phone?: string;
  contact_name?: string;
  additional_info?: string;
  producer?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    role: string;
  };
}

export interface Proposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  proposal_unit_price?: number | null;
  proposal_pricing_type?: string | null;
  status: string;
  created_at: string;
  message?: string;
  freight?: Freight;
  producer?: {
    id: string;
    full_name: string;
    phone: string;
  };
}

export interface DriverDashboardFilters {
  cargo_type: string;
  service_type: string;
  min_weight: string;
  max_weight: string;
  max_distance: string;
  min_price: string;
  max_price: string;
  origin_city: string;
  destination_city: string;
  vehicle_type: string;
}

export const defaultFilters: DriverDashboardFilters = {
  cargo_type: 'all',
  service_type: 'all',
  min_weight: '',
  max_weight: '',
  max_distance: '',
  min_price: '',
  max_price: '',
  origin_city: '',
  destination_city: '',
  vehicle_type: 'all',
};
