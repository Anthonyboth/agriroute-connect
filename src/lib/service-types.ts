// ============================================================
// CATÁLOGO UNIFICADO DE SERVIÇOS — AgriRoute
// ============================================================
// Cada serviço é definido UMA ÚNICA VEZ.
// O campo `categories` (array) indica em quais abas ele aparece.
// Isso elimina duplicatas _TECH/_URB/_LOG e garante manutenção fácil.
// Para adicionar/remover: basta editar esta lista.
// ============================================================

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
  Bike,
  Camera,
  Wifi,
  ShoppingCart,
  Laptop,
  Navigation,
  Factory,
  PawPrint,
  Map
} from 'lucide-react';

// ============================================================
// TIPOS
// ============================================================

export type ServiceCategory = 'freight' | 'technical' | 'agricultural' | 'logistics' | 'urban';

export interface ServiceType {
  /** ID canônico único — é o que vai salvo no banco */
  id: string;
  label: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  /** Categorias em que o serviço aparece nas abas de filtro */
  categories: ServiceCategory[];
  /** Se aparece para clientes solicitarem */
  clientVisible: boolean;
  /** Se aparece para prestadores oferecerem */
  providerVisible: boolean;

  // Mantido por retrocompatibilidade — NÃO usar em código novo
  /** @deprecated Use `categories[0]` */
  category?: ServiceCategory;
}

// ============================================================
// LABELS DAS CATEGORIAS
// ============================================================

export const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  freight: 'Fretes e Transporte',
  technical: 'Serviços Técnicos',
  agricultural: 'Serviços Agrícolas',
  logistics: 'Logística',
  urban: 'Serviços Urbanos',
};

// ============================================================
// CATÁLOGO COMPLETO (33 serviços únicos + 1 genérico)
// ============================================================
// Ordem: alfabética por label (OUTROS vai ao final).
// Para adicionar um serviço: basta incluir um novo objeto aqui.
// Para removê-lo: basta deletar o objeto. Nada mais precisa mudar.
// ============================================================

const SERVICE_DEFINITIONS: Omit<ServiceType, 'category'>[] = [
  {
    id: 'AGRONOMO',
    label: 'Agrônomo',
    description: 'Consultoria agronômica e acompanhamento técnico de lavoura',
    icon: GraduationCap,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'ANALISE_SOLO',
    label: 'Análise de Solo',
    description: 'Serviço laboratorial — Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    categories: ['agricultural', 'logistics'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Técnico Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'AUTO_ELETRICA',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'AUTOMACAO_INDUSTRIAL',
    label: 'Automação Industrial',
    description: 'Automação de processos industriais e sistemas de controle',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracharia',
    description: 'Troca e reparo de pneus (veículos, tratores e implementos)',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CARREGAMENTO_DESCARREGAMENTO',
    label: 'Saqueiros / Ajudantes de Carga',
    description: 'Contratação de ajudantes (saqueiros) para carregar e descarregar caminhões — NÃO é transporte',
    icon: Users2,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    categories: ['agricultural', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CFTV_SEGURANCA',
    label: 'CFTV e Segurança Eletrônica',
    description: 'Instalação de câmeras de segurança, sistemas de monitoramento e equipamentos de proteção eletrônica',
    icon: Camera,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CLASSIFICACAO_GRAOS',
    label: 'Classificação de Grãos',
    description: 'Classificação e análise de qualidade de grãos',
    icon: Scale,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'COLHEITA_PLANTIO_TERCEIRIZADA',
    label: 'Colheita e Plantio Terceirizada',
    description: 'Serviços terceirizados de colheita e plantio mecanizado com equipamentos modernos',
    icon: Wheat,
    color: 'bg-green-100 text-green-800 border-green-200',
    categories: ['agricultural'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CONSTRUCAO_MANUTENCAO_CERCAS',
    label: 'Construção e Manutenção de Cercas',
    description: 'Instalação e manutenção de cercas rurais',
    icon: Fence,
    color: 'bg-stone-100 text-stone-800 border-stone-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'CONSULTORIA_TI',
    label: 'Consultoria em T.I',
    description: 'Passagem de cabos, instalação e configuração de equipamentos de internet e redes',
    icon: Wifi,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'ENERGIA_SOLAR',
    label: 'Energia Solar',
    description: 'Instalação e manutenção de sistemas de energia solar fotovoltaica',
    icon: Sun,
    color: 'bg-sky-100 text-sky-800 border-sky-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    categories: ['agricultural', 'logistics'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'LIMPEZA_DESASSOREAMENTO_REPRESAS',
    label: 'Limpeza e Desassoreamento de Represas',
    description: 'Limpeza e manutenção de represas e reservatórios',
    icon: Waves,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'MANUTENCAO_BALANCAS',
    label: 'Manutenção de Balanças',
    description: 'Manutenção, calibração e reparo de balanças rodoviárias e de grãos',
    icon: Scale,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'MANUTENCAO_REVISAO_GPS',
    label: 'Manutenção e Revisão GPS',
    description: 'Manutenção, atualização e calibração de sistemas GPS agrícolas',
    icon: Satellite,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'MECANICO_INDUSTRIAL',
    label: 'Mecânico Industrial',
    description: 'Manutenção e reparo de equipamentos industriais e sistemas mecânicos',
    icon: Settings,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'OPERADOR_MAQUINAS',
    label: 'Operador de Máquinas',
    description: 'Operação de tratores, colheitadeiras e implementos',
    icon: Wrench,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'PIVO_IRRIGACAO',
    label: 'Pivô Irrigação (Instalação e Manutenção)',
    description: 'Instalação, manutenção e reparo de sistemas de irrigação por pivô',
    icon: Droplets,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'PULVERIZACAO_DRONE',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    categories: ['agricultural', 'technical'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'SECAGEM_GRAOS',
    label: 'Secador / Secagem de Grãos',
    description: 'Operação de secadores e controle de umidade dos grãos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    categories: ['agricultural'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'TERRAPLENAGEM',
    label: 'Terraplenagem',
    description: 'Serviços de terraplanagem e movimentação de terra',
    icon: Mountain,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    categories: ['agricultural', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'TOPOGRAFIA_RURAL',
    label: 'Topografia',
    description: 'Serviços de topografia e levantamento topográfico',
    icon: MapPin,
    color: 'bg-violet-100 text-violet-800 border-violet-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },
  {
    id: 'TORNEARIA_SOLDA_REPAROS',
    label: 'Tornearia, Solda e Reparos',
    description: 'Serviços de tornearia, solda e reparos mecânicos',
    icon: Hammer,
    color: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    categories: ['agricultural', 'technical', 'urban'],
    clientVisible: true,
    providerVisible: true,
  },

  // ========== SERVIÇOS EXCLUSIVAMENTE AGRÍCOLAS ==========
  {
    id: 'GUINCHO',
    label: 'Guincho e Socorro 24h',
    description: 'Reboque, socorro e assistência emergencial para veículos 24 horas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    categories: ['agricultural'],
    clientVisible: true,
    providerVisible: false, // Apenas motoristas oferecem guincho
  },

  // ========== FRETES (não aparecem para prestadores) ==========
  {
    id: 'CARGA',
    label: 'Transporte de Carga',
    description: 'Soja, milho, fertilizantes e outros produtos agrícolas',
    icon: Truck,
    color: 'bg-primary/10 text-primary border-primary/20',
    categories: ['freight'],
    clientVisible: true,
    providerVisible: false,
  },
  {
    id: 'MUDANCA',
    label: 'Mudanças e Frete Urbano',
    description: 'Mudanças residenciais, comerciais e fretes urbanos',
    icon: Home,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    categories: ['freight'],
    clientVisible: true,
    providerVisible: false,
  },
  {
    id: 'FRETE_MOTO',
    label: 'Frete por Moto',
    description: 'Moto com carretinha — Capacidade até 500kg para entregas rápidas',
    icon: Bike,
    color: 'bg-green-100 text-green-800 border-green-200',
    categories: ['freight'],
    clientVisible: true,
    providerVisible: false,
  },
  {
    id: 'ENTREGA_PACOTES',
    label: 'Entrega de Pacotes',
    description: 'Entrega rápida de encomendas, documentos e pequenas cargas',
    icon: Box,
    color: 'bg-violet-100 text-violet-800 border-violet-200',
    categories: ['freight'],
    clientVisible: true,
    providerVisible: false,
  },
  {
    id: 'TRANSPORTE_PET',
    label: 'Transporte de Pet',
    description: 'Viagem segura e confortável para seu pet 🐾',
    icon: PawPrint,
    color: 'bg-gray-100 text-gray-800 border-gray-300',
    categories: ['freight'],
    clientVisible: true,
    providerVisible: false,
  },

  // ========== GENÉRICO ==========
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros serviços não listados',
    icon: MoreHorizontal,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    categories: ['urban'],
    clientVisible: true,
    providerVisible: true,
  },
];

// ============================================================
// CONSTRUÇÃO DO ARRAY EXPORTADO
// ============================================================
// Adiciona `category` (primeira categoria) por retrocompatibilidade.

export const ALL_SERVICE_TYPES: ServiceType[] = SERVICE_DEFINITIONS.map((s) => ({
  ...s,
  category: s.categories[0],
}));

// ============================================================
// HELPERS
// ============================================================

/** Retorna serviços visíveis para clientes */
export const getClientVisibleServices = () => ALL_SERVICE_TYPES.filter((s) => s.clientVisible);

/** Retorna serviços visíveis para prestadores */
export const getProviderVisibleServices = () => ALL_SERVICE_TYPES.filter((s) => s.providerVisible);

/** Retorna serviços que pertencem a uma categoria */
export const getServicesByCategory = (category: ServiceCategory) =>
  ALL_SERVICE_TYPES.filter((s) => s.categories.includes(category));

/** Busca serviço por ID (canônico) */
export const getServiceById = (id: string): ServiceType | undefined => {
  // Primeiro tenta match exato
  const exact = ALL_SERVICE_TYPES.find((s) => s.id === id);
  if (exact) return exact;

  // Retrocompatibilidade: IDs legados com sufixos _TECH/_URB/_LOG/_FREIGHT
  const canonical = id.replace(/_(TECH|URB|LOG|FREIGHT)$/, '');
  return ALL_SERVICE_TYPES.find((s) => s.id === canonical);
};

// Filtros por categoria (retrocompatibilidade)
export const FREIGHT_SERVICE_TYPES = getServicesByCategory('freight');
export const TECHNICAL_SERVICE_TYPES = getServicesByCategory('technical');
export const AGRICULTURAL_SERVICE_TYPES = getServicesByCategory('agricultural');
export const LOGISTICS_SERVICE_TYPES = getServicesByCategory('logistics');
export const URBAN_SERVICE_TYPES = getServicesByCategory('urban');

// ============================================================
// NORMALIZAÇÃO DE IDs LEGADOS
// ============================================================
// Remove sufixos _TECH/_URB/_LOG/_FREIGHT que eram usados no sistema antigo.
// Garante que IDs do banco sempre resolvem para o ID canônico.

export const canonicalizeServiceId = (id: string): string => {
  if (!id) return id;
  const upper = id.toUpperCase().trim();

  // Mapas legados explícitos
  if (upper === 'CARGA_FREIGHT') return 'CARGA';
  if (upper === 'GUINCHO_FREIGHT') return 'GUINCHO';

  // Sufixos genéricos
  return upper.replace(/_(TECH|URB|LOG)$/, '');
};

// ============================================================
// MATCHING (prestador ↔ serviço)
// ============================================================

/**
 * Verifica se um prestador pode atender um serviço.
 *
 * Regra: match exato por ID canônico (sem fallback por categoria).
 * Exceção: tipos genéricos legados SERVICO_AGRICOLA / SERVICO_TECNICO
 * fazem match por categoria para não sumir do painel.
 */
export const canProviderHandleService = (
  providerServiceTypes: string[],
  requestServiceType: string
): boolean => {
  if (!providerServiceTypes?.length || !requestServiceType) return false;

  const rawRequest = requestServiceType.toUpperCase().trim();
  const normalizedRequest = canonicalizeServiceId(rawRequest);
  const normalizedProvider = providerServiceTypes.map(canonicalizeServiceId);

  // Legado: tipos genéricos
  if (rawRequest === 'SERVICO_AGRICOLA' || rawRequest === 'SERVICO_TECNICO') {
    if (normalizedProvider.includes(rawRequest)) return true;
    const requiredCategory: ServiceCategory = rawRequest === 'SERVICO_AGRICOLA' ? 'agricultural' : 'technical';
    return normalizedProvider.some((t) => {
      const meta = getServiceById(t);
      return meta?.categories.includes(requiredCategory);
    });
  }

  // Match exato (canônico)
  if (normalizedProvider.includes(normalizedRequest)) return true;

  // Fallback defensivo (raw)
  const rawProvider = providerServiceTypes.map((t) => t.toUpperCase().trim());
  return rawProvider.includes(rawRequest);
};
