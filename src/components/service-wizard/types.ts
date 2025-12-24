// Tipos para o wizard de serviços

export type ServiceType = 
  | 'GUINCHO'
  | 'FRETE_MOTO'
  | 'FRETE_URBANO'
  | 'MUDANCA_RESIDENCIAL'
  | 'MUDANCA_COMERCIAL'
  | 'SERVICO_AGRICOLA'
  | 'SERVICO_TECNICO';

export type ServiceCategory = 'freight' | 'technical' | 'agricultural' | 'logistics' | 'urban';

export interface ServiceWizardStep {
  id: number;
  title: string;
  description: string;
  icon: React.ReactNode;
}

export interface PersonalData {
  name: string;
  phone: string;
  email: string;
  document: string;
  profession?: string;
}

export interface AddressData {
  cep: string;
  city: string;
  city_id?: string;
  state: string;
  street: string;
  neighborhood: string;
  number: string;
  complement: string;
  reference?: string;
  lat?: number;
  lng?: number;
  floor?: string;
  hasElevator?: boolean;
}

export interface CargoDetails {
  type: string;
  weight: string;
  weightUnit: 'kg' | 'ton';
  dimensions?: {
    length: string;
    width: string;
    height: string;
  };
  needsPackaging: boolean;
  needsHelper?: boolean;
}

export interface VehicleDetails {
  type: string;
  plate?: string;
  photo?: string;
  situation?: string;
}

export interface MudancaDetails {
  type: 'RESIDENCIAL' | 'COMERCIAL';
  rooms: string;
  volume?: string;
  additionalServices: string[];
  specialItems?: string;
  pickupDate: string;
  deliveryDate: string;
  preferredTime?: string;
}

export interface AgriculturalDetails {
  farmName?: string;
  area?: string;
  culture?: string;
  accessInstructions?: string;
  serviceSpecific?: Record<string, any>;
}

export interface TechnicalDetails {
  equipmentType?: string;
  brand?: string;
  model?: string;
  year?: string;
  lastMaintenance?: string;
  photos?: string[];
}

export interface ServiceFormData {
  // Step 1: Tipo de serviço
  serviceType: ServiceType;
  subServiceType?: string;
  problemDescription: string;
  
  // Step 2: Dados pessoais
  personal: PersonalData;
  
  // Step 3: Localização
  origin: AddressData;
  destination?: AddressData;
  
  // Step 4: Detalhes específicos
  urgency: 'LOW' | 'MEDIUM' | 'HIGH';
  preferredTime?: string;
  
  // Detalhes específicos por tipo
  cargo?: CargoDetails;
  vehicle?: VehicleDetails;
  mudanca?: MudancaDetails;
  agricultural?: AgriculturalDetails;
  technical?: TechnicalDetails;
  
  // Informações adicionais
  additionalInfo?: string;
}

export interface ServiceWizardConfig {
  serviceType: ServiceType;
  title: string;
  description: string;
  icon: string;
  requiresDestination: boolean;
  steps: ServiceWizardStep[];
  category: ServiceCategory;
}

export const URGENCY_LABELS = {
  LOW: { label: 'Baixa', description: 'Pode aguardar alguns dias', color: 'bg-green-100 text-green-800' },
  MEDIUM: { label: 'Média', description: 'Prefiro em 24-48h', color: 'bg-yellow-100 text-yellow-800' },
  HIGH: { label: 'Alta', description: 'Preciso hoje/urgente', color: 'bg-red-100 text-red-800' }
} as const;

export const CARGO_TYPES = {
  DOCUMENTOS: 'Documentos',
  ELETRONICOS: 'Eletrônicos',
  ROUPAS: 'Roupas',
  ALIMENTOS: 'Alimentos',
  MOVEIS: 'Móveis',
  ELETRODOMESTICOS: 'Eletrodomésticos',
  MATERIAIS: 'Materiais de construção',
  OUTROS: 'Outros'
} as const;

export const ADDITIONAL_SERVICES = [
  { id: 'MONTAGEM_MOVEIS', label: 'Montagem/Desmontagem de Móveis', price: 150 },
  { id: 'EMBALAGEM', label: 'Serviço de Embalagem', price: 100 },
  { id: 'ELEVADOR', label: 'Uso de Elevador', price: 80 },
  { id: 'ESCADA', label: 'Subida/Descida de Escadas', price: 60 },
  { id: 'SEGURO_EXTRA', label: 'Seguro Adicional', price: 120 }
] as const;
