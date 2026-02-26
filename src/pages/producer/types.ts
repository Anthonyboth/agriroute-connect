export interface ProducerFreight {
  id: string;
  cargo_type: string;
  origin_city?: string;
  origin_state?: string;
  origin_address?: string;
  origin_neighborhood?: string;
  origin_street?: string;
  origin_number?: string;
  origin_complement?: string;
  origin_zip_code?: string;
  destination_city?: string;
  destination_state?: string;
  destination_address?: string;
  destination_neighborhood?: string;
  destination_street?: string;
  destination_number?: string;
  destination_complement?: string;
  destination_zip_code?: string;
  pickup_date: string;
  delivery_date?: string;
  price: number;
  weight: number;
  weight_kg?: number;
  distance_km?: number;
  status: string;
  driver_id?: string;
  producer_id: string;
  urgency?: string;
  minimum_antt_price?: number;
  created_at: string;
  updated_at: string;
  origin_lat?: number;
  origin_lng?: number;
  destination_lat?: number;
  destination_lng?: number;
  accepted_trucks?: number;
  // Campos de tracking em tempo real
  current_lat?: number;
  current_lng?: number;
  last_location_update?: string;
  tracking_status?: string;
  profiles?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    email?: string;
    role?: string;
    user_id?: string;
    profile_photo_url?: string;
  };
  driver_profiles?: {
    full_name: string;
    profile_photo_url?: string;
  };
  drivers_assigned?: string[];
  required_trucks?: number;
  deliveryDeadline?: {
    hoursRemaining: number;
    isUrgent: boolean;
    isCritical: boolean;
    displayText: string;
  };
  metadata?: Record<string, any>;
}

export interface ProducerProposal {
  id: string;
  freight_id: string;
  driver_id: string;
  proposed_price: number;
  message?: string;
  status: string;
  created_at: string;
  freight?: ProducerFreight;
  driver?: {
    id: string;
    full_name: string;
    contact_phone?: string;
    email?: string;
  };
}

export interface ExternalPayment {
  id: string;
  freight_id: string;
  producer_id: string;
  driver_id: string;
  amount: number;
  status: string;
  notes?: string;
  created_at: string;
  updated_at?: string;
  freight?: ProducerFreight;
  driver?: {
    id: string;
    full_name: string;
  };
}

export interface FreightPayment {
  id: string;
  freight_id: string;
  payer_id: string;
  amount: number;
  status: string;
  created_at: string;
}

export interface ProducerStatistics {
  openFreights: number;  // ✅ P0: Fretes abertos (rural + urbano FRETE_*)
  openServices: number;  // ✅ P0: Serviços abertos (NÃO-transporte)
  openTotal: number;     // Soma total (uso interno apenas)
  activeFreights: number;
  pendingConfirmation: number;
  totalValue: number;
  pendingProposals: number;
  pendingPayments: number;
  totalPendingAmount: number;
}

export interface ProducerFilters {
  sortBy: 'date' | 'price' | 'distance' | 'status';
  sortOrder: 'asc' | 'desc';
  status?: string[];
  dateRange?: { start: Date; end: Date };
  priceRange?: { min: number; max: number };
  distanceRange?: { min: number; max: number };
  cargoType?: string[];
  urgency?: string[];
}
