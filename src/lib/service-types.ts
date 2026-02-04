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
  hideFromAllTab?: boolean; // Se true, não aparece na aba "Todos os Serviços"
}

export const ALL_SERVICE_TYPES: ServiceType[] = [
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
    id: 'ARMAZENAGEM',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'ASSISTENCIA_TECNICA',
    label: 'Técnico Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'AUTO_ELETRICA',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'AUTOMACAO_INDUSTRIAL',
    label: 'Automação Industrial',
    description: 'Automação de processos industriais e sistemas de controle',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'BORRACHEIRO',
    label: 'Borracharia',
    description: 'Troca e reparo de pneus (veículos, tratores e implementos)',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CARREGAMENTO_DESCARREGAMENTO',
    label: 'Saqueiros / Ajudantes de Carga',
    description: 'Contratação de ajudantes (saqueiros) para carregar e descarregar caminhões - NÃO é transporte',
    icon: Users2,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CHAVEIRO',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
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
  {
    id: 'CONSULTORIA_TI',
    label: 'Consultoria em T.I',
    description: 'Passagem de cabos, instalação e configuração de equipamentos de internet e redes',
    icon: Wifi,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'agricultural',
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
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'FRETE_MOTO',
    label: 'Frete por Moto',
    description: 'Moto com carretinha - Capacidade até 500kg para entregas rápidas',
    icon: Bike,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'freight',
    clientVisible: true,
    providerVisible: false
  },
  {
    id: 'GUINDASTE',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'GUINCHO',
    label: 'Guincho e Socorro 24h',
    description: 'Reboque, socorro e assistência emergencial para veículos 24 horas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: false
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
    id: 'MANUTENCAO_BALANCAS',
    label: 'Manutenção de Balanças',
    description: 'Manutenção, calibração e reparo de balanças rodoviárias e de grãos',
    icon: Scale,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MANUTENCAO_REVISAO_GPS',
    label: 'Manutenção e Revisão GPS',
    description: 'Manutenção, atualização e calibração de sistemas GPS agrícolas',
    icon: Satellite,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MECANICO',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'MECANICO_INDUSTRIAL',
    label: 'Mecânico Industrial',
    description: 'Manutenção e reparo de equipamentos industriais e sistemas mecânicos',
    icon: Settings,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
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
    id: 'SERVICOS_VETERINARIOS',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CFTV_SEGURANCA',
    label: 'CFTV e Segurança Eletrônica',
    description: 'Instalação de câmeras de segurança, sistemas de monitoramento e equipamentos de proteção eletrônica',
    icon: Camera,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'TERRAPLENAGEM',
    label: 'Terraplenagem',
    description: 'Serviços de terraplanagem e movimentação de terra',
    icon: Mountain,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'TOPOGRAFIA_RURAL',
    label: 'Topografia',
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
    category: 'agricultural',
    clientVisible: true,
    providerVisible: true
  },
  {
    id: 'CARGA',
    label: 'Transporte de Carga',
    description: 'Soja, milho, fertilizantes e outros produtos agrícolas',
    icon: Truck,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'agricultural',
    clientVisible: true,
    providerVisible: false
  },
  {
    id: 'OUTROS',
    label: 'Outros',
    description: 'Outros serviços não listados',
    icon: MoreHorizontal,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true
  },
  // ========== DUPLICATAS PARA LOGÍSTICA ==========
  {
    id: 'ARMAZENAGEM_LOG',
    label: 'Armazenagem',
    description: 'Serviços de armazenamento de grãos e insumos',
    icon: Package,
    color: 'bg-rose-100 text-rose-800 border-rose-200',
    category: 'logistics',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'GUINDASTE_LOG',
    label: 'Guindaste',
    description: 'Elevação e movimentação de cargas pesadas',
    icon: Package,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'logistics',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  // ========== DUPLICATAS PARA SERVIÇOS TÉCNICOS ==========
  {
    id: 'ASSISTENCIA_TECNICA_TECH',
    label: 'Técnico Agrícola',
    description: 'Suporte técnico especializado para produção agrícola',
    icon: Settings,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'AUTO_ELETRICA_TECH',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'ANALISE_SOLO_TECH',
    label: 'Análise de Solo',
    description: 'Serviço laboratorial feito por laboratórios - Coleta e análise de amostras de solo para correção',
    icon: TestTube,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'AUTOMACAO_INDUSTRIAL_TECH',
    label: 'Automação Industrial',
    description: 'Automação de processos industriais e sistemas de controle',
    icon: Zap,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'BORRACHEIRO_TECH',
    label: 'Borracharia',
    description: 'Troca e reparo de pneus (veículos, tratores e implementos)',
    icon: Shield,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CHAVEIRO_TECH',
    label: 'Chaveiro',
    description: 'Abertura de veículos travados',
    icon: Key,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CLASSIFICACAO_GRAOS_TECH',
    label: 'Classificação de Grãos',
    description: 'Classificação e análise de qualidade de grãos',
    icon: Scale,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CONSTRUCAO_MANUTENCAO_CERCAS_TECH',
    label: 'Construção e Manutenção de Cercas',
    description: 'Instalação e manutenção de cercas rurais',
    icon: Fence,
    color: 'bg-stone-100 text-stone-800 border-stone-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CONSULTORIA_TI_TECH',
    label: 'Consultoria em T.I',
    description: 'Passagem de cabos, instalação e configuração de equipamentos de internet e redes',
    icon: Wifi,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'ENERGIA_SOLAR_TECH',
    label: 'Energia Solar',
    description: 'Instalação e manutenção de sistemas de energia solar fotovoltaica',
    icon: Sun,
    color: 'bg-sky-100 text-sky-800 border-sky-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'LIMPEZA_DESASSOREAMENTO_REPRESAS_TECH',
    label: 'Limpeza e Desassoreamento de Represas',
    description: 'Limpeza e manutenção de represas e reservatórios',
    icon: Waves,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MANUTENCAO_BALANCAS_TECH',
    label: 'Manutenção de Balanças',
    description: 'Manutenção, calibração e reparo de balanças rodoviárias e de grãos',
    icon: Scale,
    color: 'bg-purple-100 text-purple-800 border-purple-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MANUTENCAO_REVISAO_GPS_TECH',
    label: 'Manutenção e Revisão GPS',
    description: 'Manutenção, atualização e calibração de sistemas GPS agrícolas',
    icon: Satellite,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MECANICO_TECH',
    label: 'Mecânico',
    description: 'Reparos mecânicos para todos os tipos de veículos, desde carros até máquinas agrícolas',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MECANICO_INDUSTRIAL_TECH',
    label: 'Mecânico Industrial',
    description: 'Manutenção e reparo de equipamentos industriais e sistemas mecânicos',
    icon: Settings,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'OPERADOR_MAQUINAS_TECH',
    label: 'Operador de Máquinas',
    description: 'Operação de tratores, colheitadeiras e implementos',
    icon: Wrench,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'PIVO_IRRIGACAO_TECH',
    label: 'Pivô Irrigação (Instalação e Manutenção)',
    description: 'Instalação, manutenção e reparo de sistemas de irrigação por pivô',
    icon: Droplets,
    color: 'bg-blue-100 text-blue-800 border-blue-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'PULVERIZACAO_DRONE_TECH',
    label: 'Pulverização por Drone',
    description: 'Aplicação de defensivos e fertilizantes via drone',
    icon: Plane,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'SERVICOS_VETERINARIOS_TECH',
    label: 'Serviços Veterinários',
    description: 'Atendimento veterinário e cuidados com o rebanho',
    icon: Stethoscope,
    color: 'bg-green-100 text-green-800 border-green-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CFTV_SEGURANCA_TECH',
    label: 'CFTV e Segurança Eletrônica',
    description: 'Instalação de câmeras de segurança, sistemas de monitoramento e equipamentos de proteção eletrônica',
    icon: Camera,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'TOPOGRAFIA_RURAL_TECH',
    label: 'Topografia',
    description: 'Serviços de topografia e levantamento topográfico',
    icon: MapPin,
    color: 'bg-violet-100 text-violet-800 border-violet-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'TORNEARIA_SOLDA_REPAROS_TECH',
    label: 'Tornearia, Solda e Reparos',
    description: 'Serviços de tornearia, solda e reparos mecânicos',
    icon: Hammer,
    color: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    category: 'technical',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  // ========== DUPLICATAS PARA SERVIÇOS URBANOS ==========
  {
    id: 'AUTO_ELETRICA_URB',
    label: 'Auto Elétrica',
    description: 'Sistemas elétricos para todos os tipos de autos, desde carros até máquinas agrícolas',
    icon: Car,
    color: 'bg-cyan-100 text-cyan-800 border-cyan-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'BORRACHEIRO_URB',
    label: 'Borracharia',
    description: 'Serviços de borracharia, troca de pneus e reparos',
    icon: Wrench,
    color: 'bg-slate-100 text-slate-800 border-slate-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CARREGAMENTO_DESCARREGAMENTO_URB',
    label: 'Saqueiros / Ajudantes de Carga',
    description: 'Contratação de ajudantes (saqueiros) para carregar e descarregar caminhões - NÃO é transporte',
    icon: Users2,
    color: 'bg-amber-100 text-amber-800 border-amber-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CHAVEIRO_URB',
    label: 'Chaveiro',
    description: 'Serviços de chaveiro e reparos de fechaduras',
    icon: Key,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CONSULTORIA_TI_URB',
    label: 'Consultoria em T.I',
    description: 'Consultoria em tecnologia da informação e sistemas',
    icon: Laptop,
    color: 'bg-indigo-100 text-indigo-800 border-indigo-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'ENERGIA_SOLAR_URB',
    label: 'Energia Solar',
    description: 'Instalação e manutenção de sistemas de energia solar',
    icon: Sun,
    color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MANUTENCAO_BALANCAS_URB',
    label: 'Manutenção de Balanças',
    description: 'Manutenção e calibração de balanças',
    icon: Scale,
    color: 'bg-teal-100 text-teal-800 border-teal-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MANUTENCAO_REVISAO_GPS_URB',
    label: 'Manutenção e Revisão GPS',
    description: 'Manutenção e revisão de sistemas GPS',
    icon: Navigation,
    color: 'bg-sky-100 text-sky-800 border-sky-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MECANICO_URB',
    label: 'Mecânico',
    description: 'Serviços de mecânica geral',
    icon: Wrench,
    color: 'bg-gray-100 text-gray-800 border-gray-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'MECANICO_INDUSTRIAL_URB',
    label: 'Mecânico Industrial',
    description: 'Manutenção e reparos de equipamentos industriais',
    icon: Factory,
    color: 'bg-stone-100 text-stone-800 border-stone-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'SERVICOS_VETERINARIOS_URB',
    label: 'Serviços Veterinários',
    description: 'Serviços veterinários e cuidados com animais',
    icon: PawPrint,
    color: 'bg-pink-100 text-pink-800 border-pink-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'CFTV_SEGURANCA_URB',
    label: 'CFTV e Segurança Eletrônica',
    description: 'Instalação e manutenção de sistemas CFTV e segurança',
    icon: Camera,
    color: 'bg-red-100 text-red-800 border-red-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'TERRAPLENAGEM_URB',
    label: 'Terraplenagem',
    description: 'Serviços de terraplenagem e movimentação de terra',
    icon: Mountain,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'TOPOGRAFIA_RURAL_URB',
    label: 'Topografia',
    description: 'Serviços de topografia e levantamento topográfico',
    icon: Map,
    color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  {
    id: 'TORNEARIA_SOLDA_REPAROS_URB',
    label: 'Tornearia, Solda e Reparos',
    description: 'Serviços de tornearia, solda e reparos mecânicos',
    icon: Hammer,
    color: 'bg-zinc-100 text-zinc-800 border-zinc-200',
    category: 'urban',
    clientVisible: true,
    providerVisible: true,
    hideFromAllTab: true
  },
  // Freight duplicates
  {
    id: 'GUINCHO_FREIGHT',
    label: 'Guincho e Socorro 24h',
    description: 'Reboque, socorro e assistência emergencial para veículos 24 horas',
    icon: Wrench,
    color: 'bg-orange-100 text-orange-800 border-orange-200',
    category: 'freight',
    clientVisible: true,
    providerVisible: false,
    hideFromAllTab: true
  },
  {
    id: 'CARGA_FREIGHT',
    label: 'Transporte de Carga',
    description: 'Soja, milho, fertilizantes e outros produtos agrícolas',
    icon: Truck,
    color: 'bg-primary/10 text-primary border-primary/20',
    category: 'freight',
    clientVisible: true,
    providerVisible: false,
    hideFromAllTab: true
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

/**
 * ✅ FUNÇÃO DE MATCHING (estrita): Verifica se um prestador pode atender um serviço
 *
 * Regra do produto: cada tipo de serviço é único.
 * - Se o prestador oferece AGRONOMO, ele só deve ver/atender AGRONOMO.
 * - Não existe fallback por “categoria” (ex: SERVICO_AGRICOLA) nem por “mesma categoria”.
 * 
 * @param providerServiceTypes - Tipos que o prestador oferece (ex: ['AGRONOMO', 'BORRACHEIRO'])
 * @param requestServiceType - Tipo do serviço solicitado (ex: 'SERVICO_AGRICOLA')
 * @returns true se o prestador pode atender
 */
export const canProviderHandleService = (
  providerServiceTypes: string[],
  requestServiceType: string
): boolean => {
  if (!providerServiceTypes || providerServiceTypes.length === 0) {
    // Prestador sem tipos configurados → não pode atender nada
    return false;
  }

  if (!requestServiceType) {
    return false;
  }

  const normalizedRequest = requestServiceType.toUpperCase().trim();
  const normalizedProvider = providerServiceTypes.map(t => t.toUpperCase().trim());

  // ✅ Compatibilidade (LEGADO): alguns registros antigos ainda chegam como tipo genérico.
  // Para não “sumir” do painel, permitimos que prestadores com qualquer tipo da categoria
  // correspondente enxerguem o pedido genérico.
  // Importante: isso só roda para os dois tipos genéricos legados — o matching continua 1:1
  // para todos os demais tipos.
  if (normalizedRequest === 'SERVICO_AGRICOLA' || normalizedRequest === 'SERVICO_TECNICO') {
    // Se o prestador explicitamente tiver o tipo genérico configurado (caso exista no DB), ok.
    if (normalizedProvider.includes(normalizedRequest)) return true;

    const requiredCategory = normalizedRequest === 'SERVICO_AGRICOLA' ? 'agricultural' : 'technical';
    const providerHasCategory = normalizedProvider.some((t) => {
      const meta = getServiceById(t);
      return meta?.category === requiredCategory;
    });

    return providerHasCategory;
  }

  // 1. Match exato
  if (normalizedProvider.includes(normalizedRequest)) {
    return true;
  }

  return false;
};