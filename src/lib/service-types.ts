// Tipos de serviços unificados para toda a plataforma
// Este arquivo centraliza todos os tipos para evitar inconsistências

import { 
  Truck, 
  Home, 
  Wrench, 
  Settings, 
  Stethoscope,
  Leaf,
  Users,
  TestTube,
  Droplets,
  Wheat,
  Package,
  MapPin,
  Zap,
  Key,
  Fuel,
  Plane,
  Shield,
  MoreHorizontal
} from 'lucide-react';

export interface ServiceType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'freight' | 'technical' | 'agricultural' | 'logistics';
  clientVisible: boolean; // Se aparece para clientes solicitarem
  providerVisible: boolean; // Se aparece para prestadores oferecerem
}

export const ALL_SERVICE_TYPES: ServiceType[] = [
  // SERVIÇOS DE FRETE (visíveis para clientes e prestadores)
  {
    id: 'CARGA',
    label: 'Transporte de Carga',
    description: 'Soja, milho, fertilizantes e outros produtos agrícolas',
    icon: Truck,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'freight',
    clientVisible: true,
    providerVisible: false
  },
  {
    id: 'GUINCHO',
    label: 'Guincho',
    description: 'Reboque e socorro de veículos',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'freight',
    clientVisible: true,
    providerVisible: false
  },
  {
    id: 'MUDANCA',
    label: 'Mudanças e Frete Urbano',
    description: 'Mudanças residenciais, comerciais e fretes urbanos',
    icon: Home,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'freight',
    clientVisible: true,
    providerVisible: false
  },

  // SERVIÇOS TÉCNICOS (só prestadores por enquanto, mas podem ser solicitados via ServiceRequestModal)
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'technical',
    clientVisible: false, // Será implementado futuramente
    providerVisible: true
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos em geral de veículos e equipamentos',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'ELETRICISTA_AUTOMOTIVO',
    label: 'Eletricista Automotivo',
    description: 'Sistema elétrico completo de veículos',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracheiro',
    description: 'Troca e reparo de pneus',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Assistência Técnica Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'MANUTENCAO_EQUIPAMENTOS',
    label: 'Manutenção de Equipamentos',
    description: 'Manutenção e reparo de tratores e implementos agrícolas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'MANUTENCAO_BALANCAS',
    label: 'Manutenção de Balanças',
    description: 'Manutenção, calibração e reparo de balanças rodoviárias e de grãos',
    icon: Settings,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'CONSULTORIA_RURAL',
    label: 'Consultoria Rural',
    description: 'Consultoria especializada em gestão rural e produtividade',
    icon: Users,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  },

  // SERVIÇOS AGRÍCOLAS
  {
    id: 'ANALISE_SOLO',
    label: 'Análise de Solo',
    description: 'Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'PULVERIZACAO',
    label: 'Pulverização',
    description: 'Aplicação de defensivos e fertilizantes foliares',
    icon: Droplets,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'PULVERIZACAO_DRONE',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'COLHEITA_PLANTIO',
    label: 'Colheita e Plantio',
    description: 'Serviços de colheita mecanizada e plantio especializado',
    icon: Wheat,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'ADUBACAO_CALCARIO',
    label: 'Adubação e Calagem',
    description: 'Aplicação de fertilizantes e correção do pH do solo',
    icon: Leaf,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'OPERADOR_MAQUINAS',
    label: 'Operador de Máquinas',
    description: 'Operação de tratores, colheitadeiras e implementos',
    icon: Wrench,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'SECAGEM_GRAOS',
    label: 'Secador / Secagem de Grãos',
    description: 'Operação de secadores e controle de umidade dos grãos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'agricultural',
    clientVisible: false,
    providerVisible: true
  },

  // SERVIÇOS DE LOGÍSTICA
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'logistics',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'COMBUSTIVEL',
    label: 'Combustível',
    description: 'Entrega de combustível',
    icon: Fuel,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'logistics',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'logistics',
    clientVisible: false,
    providerVisible: true
  },
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros tipos de serviços especializados',
    icon: MoreHorizontal,
    color: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    category: 'technical',
    clientVisible: false,
    providerVisible: true
  }
];

// Helpers para filtrar tipos por categoria ou visibilidade
export const getClientVisibleServices = () => ALL_SERVICE_TYPES.filter(s => s.clientVisible);
export const getProviderVisibleServices = () => ALL_SERVICE_TYPES.filter(s => s.providerVisible);
export const getServicesByCategory = (category: ServiceType['category']) => ALL_SERVICE_TYPES.filter(s => s.category === category);
export const getServiceById = (id: string) => ALL_SERVICE_TYPES.find(s => s.id === id);

// Mapeamento para compatibilidade com código existente
export const FREIGHT_SERVICE_TYPES = ALL_SERVICE_TYPES.filter(s => s.category === 'freight');
export const TECHNICAL_SERVICE_TYPES = ALL_SERVICE_TYPES.filter(s => s.category === 'technical');
export const AGRICULTURAL_SERVICE_TYPES = ALL_SERVICE_TYPES.filter(s => s.category === 'agricultural');
export const LOGISTICS_SERVICE_TYPES = ALL_SERVICE_TYPES.filter(s => s.category === 'logistics');

export const CATEGORY_LABELS = {
  freight: 'Fretes e Transporte',
  technical: 'Serviços Técnicos',
  agricultural: 'Serviços Agrícolas',
  logistics: 'Logística e Armazenagem'
};