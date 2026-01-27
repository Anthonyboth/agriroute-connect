/**
 * Fonte única de verdade para os tipos de usuário/roles do sistema
 * 
 * Este arquivo centraliza a definição de todos os roles disponíveis
 * para cadastro e deve ser utilizado em TODOS os lugares do app
 * que exibem seleção de tipo de conta.
 * 
 * @module user-roles
 */

import { Users, Truck, Building2, Wrench } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// Tipos de role para cadastro (signup) - inclui MOTORISTA_AFILIADO para URLs de redirecionamento
export type SignupRole = 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS' | 'MOTORISTA_AFILIADO';

// Subtipo para motorista (fluxo de driver-type)
export type DriverSubType = 'MOTORISTA' | 'MOTORISTA_AFILIADO' | 'TRANSPORTADORA';

// Roles que aparecem nos CARDS de seleção (não inclui MOTORISTA_AFILIADO pois tem fluxo próprio)
export type CardSelectableRole = 'PRODUTOR' | 'MOTORISTA' | 'TRANSPORTADORA' | 'PRESTADOR_SERVICOS';

// Interface para cada opção de role
export interface RoleOption {
  value: SignupRole;
  label: string;
  icon: LucideIcon;
  description: string;
  /**
   * Se true, este role redireciona para uma página especial em vez de continuar no fluxo normal
   */
  specialRedirect?: string;
}

/**
 * Lista de roles disponíveis para cadastro
 * 
 * ESTA É A FONTE ÚNICA DE VERDADE - use em AuthModal, Auth.tsx, etc.
 */
export const USER_ROLES: RoleOption[] = [
  {
    value: 'PRODUTOR',
    label: 'Produtor/Contratante',
    icon: Users,
    description: 'Contrate fretes para suas cargas',
  },
  {
    value: 'MOTORISTA',
    label: 'Motorista',
    icon: Truck,
    description: 'Encontre e aceite fretes',
  },
  {
    value: 'TRANSPORTADORA',
    label: 'Transportadora',
    icon: Building2,
    description: 'Gerencie sua frota e motoristas',
  },
  {
    value: 'PRESTADOR_SERVICOS',
    label: 'Prestador de Serviços',
    icon: Wrench,
    description: 'Ofereça serviços auxiliares',
  },
];

/**
 * Roles que requerem etapa adicional (driver-type selection)
 * Atualmente: MOTORISTA pode virar MOTORISTA, MOTORISTA_AFILIADO ou TRANSPORTADORA
 */
export const ROLES_WITH_SUB_SELECTION: SignupRole[] = [];

/**
 * Verifica se um role é válido para signup
 */
export function isValidSignupRole(role: string | null | undefined): role is SignupRole {
  if (!role) return false;
  return USER_ROLES.some(r => r.value === role);
}

/**
 * Obtém os dados de um role pelo valor
 */
export function getRoleData(role: SignupRole): RoleOption | undefined {
  return USER_ROLES.find(r => r.value === role);
}

/**
 * Roles válidos como array de strings (para validação)
 * Inclui MOTORISTA_AFILIADO para validação de URL
 */
export const VALID_SIGNUP_ROLES: readonly SignupRole[] = [
  ...USER_ROLES.map(r => r.value),
  'MOTORISTA_AFILIADO', // Role especial com fluxo próprio
] as const;
