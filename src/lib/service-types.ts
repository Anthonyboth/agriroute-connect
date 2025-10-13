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
  MoreHorizontal,
  GraduationCap,
  Scale,
  Tractor,
  Box,
  Fence,
  Mountain,
  Waves,
  Hammer,
  Users2,
  Satellite,
  Sun,
  Car,
  Bike
} from 'lucide-react';

export interface ServiceType {
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  category: 'freight' | 'technical' | 'agricultural' | 'logistics' | 'urban';
  clientVisible: boolean; // Se aparece para clientes solicitarem
  providerVisible: boolean; // Se aparece para prestadores oferecerem
  showOnlyInAllTab?: boolean; // Se aparece apenas na aba "Todos os Serviços"
}

export const ALL_SERVICE_TYPES: ServiceType[] = [
  // TODOS OS SERVIÇOS AGORA SÃO VISÍVEIS PARA TODOS OS TIPOS DE USUÁRIOS
  // Prestadores podem marcar serviços oferecidos, clientes/motoristas podem solicitar
  
  // ==================== SERVIÇOS DE FRETE (Ordem Alfabética) ====================
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
    id: 'FRETE_MOTO',
    label: 'Frete por Moto',
    description: 'Entregas rápidas e pequenos fretes urbanos',
    icon: Bike,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'freight',
    clientVisible: true,
    providerVisible: false
  },
  {
    id: 'GUINCHO',
    label: 'Guincho e Socorro 24h',
    description: 'Reboque, socorro e assistência emergencial para veículos 24 horas',
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

  // ==================== SERVIÇOS TÉCNICOS (Ordem Alfabética) ====================
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Assistência Técnica Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'technical',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'AUTO_ELETRICA',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracharia',
    description: 'Troca e reparo de pneus (veículos, tratores e implementos)',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CONSULTORIA_RURAL',
    label: 'Consultoria Rural',
    description: 'Consultoria especializada em gestão rural e produtividade',
    icon: Users,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'AUTOMACAO_INDUSTRIAL',
    label: 'Automação Industrial',
    description: 'Automação de processos industriais e sistemas de controle',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  // Aliases para compatibilidade com dados antigos
  {
    id: 'ELETRICISTA_AUTOMOTIVO',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'ELETRICA',
    label: 'Elétrica',
    description: 'Serviços elétricos em geral urbanos e rurais',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'MANUTENCAO_BALANCAS',
    label: 'Manutenção de Balanças',
    description: 'Manutenção, calibração e reparo de balanças rodoviárias e de grãos',
    icon: Scale,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MANUTENCAO_REVISAO_GPS',
    label: 'Manutenção e Revisão GPS',
    description: 'Manutenção, atualização e calibração de sistemas GPS agrícolas',
    icon: Satellite,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MECANICO_INDUSTRIAL',
    label: 'Mecânico Industrial',
    description: 'Manutenção e reparo de equipamentos industriais e sistemas mecânicos',
    icon: Settings,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  // Alias para compatibilidade
  {
    id: 'MECANICO_AUTOMOTIVO',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros serviços especializados não listados acima',
    icon: MoreHorizontal,
    color: 'bg-neutral-100 text-neutral-800 border-neutral-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },

  // ==================== SERVIÇOS AGRÍCOLAS (Ordem Alfabética) ====================
  {
    id: 'ADUBACAO_CALCARIO',
    label: 'Adubação e Calagem',
    description: 'Aplicação de fertilizantes e correção do pH do solo',
    icon: Leaf,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'AGRONOMO',
    label: 'Agrônomo',
    description: 'Consultoria agronômica e acompanhamento técnico de lavoura',
    icon: GraduationCap,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'ANALISE_SOLO',
    label: 'Análise de Solo',
    description: 'Serviço laboratorial feito por laboratórios - Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CARREGAMENTO_DESCARREGAMENTO',
    label: 'Carregamento e Descarregamento',
    description: 'Pessoas para carregamento e descarregamento de caminhões',
    icon: Users2,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CLASSIFICACAO_GRAOS',
    label: 'Classificação de Grãos',
    description: 'Classificação e análise de qualidade de grãos',
    icon: Scale,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'COLHEITA_PLANTIO_TERCEIRIZADA',
    label: 'Colheita e Plantio Terceirizada',
    description: 'Serviços terceirizados de colheita e plantio mecanizado com equipamentos modernos',
    icon: Wheat,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  // Aliases para compatibilidade
  {
    id: 'COLHEITA_MECANIZADA',
    label: 'Colheita e Plantio Terceirizada',
    description: 'Serviços terceirizados de colheita e plantio mecanizado com equipamentos modernos',
    icon: Wheat,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'COMPRA_ENTREGA_PECAS',
    label: 'Compra e Entrega de Peças Agrícolas',
    description: 'Serviço para lojas agrícolas - Busca e entrega de peças e componentes para máquinas agrícolas',
    icon: Box,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CONSTRUCAO_MANUTENCAO_CERCAS',
    label: 'Construção e Manutenção de Cercas',
    description: 'Instalação e manutenção de cercas rurais',
    icon: Fence,
    color: 'bg-stone-100 text-stone-800 border-stone-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'ENERGIA_SOLAR',
    label: 'Energia Solar',
    description: 'Instalação e manutenção de sistemas de energia solar fotovoltaica',
    icon: Sun,
    color: 'bg-sky-100 text-sky-800 border-sky-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'LIMPEZA_DESASSOREAMENTO_REPRESAS',
    label: 'Limpeza e Desassoreamento de Represas',
    description: 'Limpeza e manutenção de represas e reservatórios',
    icon: Waves,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MECANICO_AGRICOLA',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'OPERADOR_MAQUINAS',
    label: 'Operador de Máquinas',
    description: 'Operação de tratores, colheitadeiras e implementos',
    icon: Wrench,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'PIVO_IRRIGACAO',
    label: 'Pivô Irrigação (Instalação e Manutenção)',
    description: 'Instalação, manutenção e reparo de sistemas de irrigação por pivô',
    icon: Droplets,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'PLANTIO_MECANIZADO',
    label: 'Colheita e Plantio Terceirizada',
    description: 'Serviços terceirizados de colheita e plantio mecanizado com equipamentos modernos',
    icon: Wheat,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'PULVERIZACAO_DRONE',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'SECAGEM_GRAOS',
    label: 'Secador / Secagem de Grãos',
    description: 'Operação de secadores e controle de umidade dos grãos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'SOCORRO_MECANICO_24H',
    label: 'Guincho e Socorro 24h',
    description: 'Reboque, socorro e assistência emergencial para veículos 24 horas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true,
    showOnlyInAllTab: true
  },
  {
    id: 'TERRAPLENAGEM',
    label: 'Terraplenagem',
    description: 'Serviços de terraplanagem e movimentação de terra',
    icon: Mountain,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'TOPOGRAFIA_RURAL',
    label: 'Topografia Rural',
    description: 'Serviços de topografia e levantamento topográfico',
    icon: MapPin,
    color: 'bg-violet-100 text-violet-800 border-violet-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'TORNEARIA_SOLDA_REPAROS',
    label: 'Tornearia, Solda e Reparos',
    description: 'Serviços de tornearia, solda e reparos mecânicos',
    icon: Hammer,
    color: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },

  // ==================== SERVIÇOS DE LOGÍSTICA (Ordem Alfabética) ====================
  {
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'logistics',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'COMBUSTIVEL',
    label: 'Combustível',
    description: 'Entrega de combustível TRR (Transporte Rodoviário de Reabastecimento)',
    icon: Fuel,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'urban',
    clientVisible: true,
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
export const URBAN_SERVICE_TYPES = ALL_SERVICE_TYPES.filter(s => s.category === 'urban');

export const CATEGORY_LABELS = {
  freight: 'Fretes e Transporte',
  technical: 'Serviços Técnicos',
  agricultural: 'Serviços Agrícolas',
  logistics: 'Logística',
  urban: 'Serviços Urbanos'
};