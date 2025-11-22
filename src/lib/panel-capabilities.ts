/**
 * NÚCLEO ÚNICO DE CAPACIDADES POR PAINEL
 * Define permissões por painel (ADMIN, PRODUTOR, DRIVER, SERVICE_PROVIDER, COMPANY)
 */

import { PERMISSION_MESSAGES } from './permission-messages';
import type { UserProfile } from '@/hooks/useAuth';

export type PanelKey = 'ADMIN' | 'PRODUTOR' | 'DRIVER' | 'SERVICE_PROVIDER' | 'COMPANY';

export type ActionKey = 
  // Driver actions
  | 'view_platform_freights'
  | 'view_company_freights'
  | 'submit_freight_proposal'
  | 'submit_service_proposal'
  | 'manage_own_vehicles'
  | 'checkin'
  | 'withdraw'
  | 'chat'
  // Producer actions
  | 'create_freight'
  | 'edit_own_freight'
  | 'cancel_own_freight'
  | 'accept_driver_proposal'
  | 'rate_driver'
  // Company actions
  | 'manage_company_freights'
  | 'assign_driver'
  | 'see_company_drivers'
  | 'manage_company_vehicles'
  | 'approve_affiliation'
  | 'rate_company_driver'
  // Service Provider actions
  | 'view_service_requests'
  | 'submit_service_proposal_sp'
  | 'complete_service'
  | 'service_chat'
  // Common actions
  | 'view_antt_breakdown'
  | 'receive_notifications';

export interface CapabilityDecision {
  allowed: boolean;
  reason?: string;
}

export type PanelCapabilities = Record<ActionKey, CapabilityDecision>;

export interface CapabilityContext {
  hasActiveAssignment?: boolean;
  freightStatus?: string;
  hasANTTPrice?: boolean;
}

export interface ComputeCapabilitiesParams {
  panel: PanelKey;
  profile: UserProfile | null;
  companyDriver?: {
    isCompanyDriver: boolean;
    canAcceptFreights: boolean;
    canManageVehicles: boolean;
    isAffiliated: boolean;
  };
  driverPermissions?: {
    isAffiliated: boolean;
    canAcceptFreights: boolean;
    canManageVehicles: boolean;
    companyId: string | null;
    companyName: string | null;
    mustUseChat: boolean;
  };
  context?: CapabilityContext;
}

/**
 * Resolve painel baseado na rota atual e perfil do usuário
 */
export const resolvePanelFromRoute = (path: string, profile: UserProfile | null): PanelKey => {
  if (!profile) return 'DRIVER'; // fallback

  if (path.includes('/admin')) return 'ADMIN';
  if (path.includes('/dashboard/producer')) return 'PRODUTOR';
  if (path.includes('/dashboard/driver')) return 'DRIVER';
  if (path.includes('/dashboard/service-provider')) return 'SERVICE_PROVIDER';
  if (path.includes('/dashboard/company')) return 'COMPANY';

  // Fallback baseado em role
  switch (profile.role) {
    case 'ADMIN': return 'ADMIN';
    case 'PRODUTOR': return 'PRODUTOR';
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO': return 'DRIVER';
    case 'PRESTADOR_SERVICOS': return 'SERVICE_PROVIDER';
    case 'TRANSPORTADORA': return 'COMPANY';
    default: return 'DRIVER';
  }
};

/**
 * Retorna rota padrão para um role específico
 */
export const getDefaultDashboardForRole = (
  role: string | undefined, 
  active_mode?: string | null
): string => {
  // Verificar transportadora first
  if (active_mode === 'TRANSPORTADORA' || role === 'TRANSPORTADORA') {
    return '/dashboard/company';
  }

  switch (role) {
    case 'ADMIN':
      return '/admin';
    case 'MOTORISTA':
    case 'MOTORISTA_AFILIADO':
      return '/dashboard/driver';
    case 'PRODUTOR':
      return '/dashboard/producer';
    case 'PRESTADOR_SERVICOS':
      return '/dashboard/service-provider';
    default:
      return '/';
  }
};

/**
 * FUNÇÃO CENTRAL: Calcula todas as capacidades para um painel específico
 */
export const computePanelCapabilities = (params: ComputeCapabilitiesParams): PanelCapabilities => {
  const { panel, profile, companyDriver, driverPermissions, context } = params;

  // Inicializar todas as capabilities como negadas
  const capabilities: PanelCapabilities = {
    view_platform_freights: { allowed: false },
    view_company_freights: { allowed: false },
    submit_freight_proposal: { allowed: false },
    submit_service_proposal: { allowed: false },
    manage_own_vehicles: { allowed: false },
    checkin: { allowed: false },
    withdraw: { allowed: false },
    chat: { allowed: false },
    create_freight: { allowed: false },
    edit_own_freight: { allowed: false },
    cancel_own_freight: { allowed: false },
    accept_driver_proposal: { allowed: false },
    rate_driver: { allowed: false },
    manage_company_freights: { allowed: false },
    assign_driver: { allowed: false },
    see_company_drivers: { allowed: false },
    manage_company_vehicles: { allowed: false },
    approve_affiliation: { allowed: false },
    rate_company_driver: { allowed: false },
    view_service_requests: { allowed: false },
    submit_service_proposal_sp: { allowed: false },
    complete_service: { allowed: false },
    service_chat: { allowed: false },
    view_antt_breakdown: { allowed: false },
    receive_notifications: { allowed: false },
  };

  // ========== ADMIN: tudo permitido ==========
  if (panel === 'ADMIN') {
    Object.keys(capabilities).forEach(key => {
      capabilities[key as ActionKey] = { allowed: true };
    });
    return capabilities;
  }

  // ========== DRIVER: regras específicas ==========
  if (panel === 'DRIVER') {
    const isCompanyDriver = companyDriver?.isCompanyDriver || driverPermissions?.companyId !== null;
    const isAffiliated = companyDriver?.isAffiliated || driverPermissions?.isAffiliated || false;
    const canAcceptFreights = companyDriver?.canAcceptFreights || driverPermissions?.canAcceptFreights || false;
    const canManageVehicles = companyDriver?.canManageVehicles || driverPermissions?.canManageVehicles || false;

    // 🐛 DEBUG: Log driver capabilities context
    console.log('[panel-capabilities] DRIVER context:', {
      isCompanyDriver,
      isAffiliated,
      canAcceptFreights,
      profileRole: profile?.role
    });

    // view_platform_freights: autônomo sempre vê; empresa vê só se canAcceptFreights
    if (!isCompanyDriver) {
      capabilities.view_platform_freights = { allowed: true };
    } else if (canAcceptFreights) {
      capabilities.view_platform_freights = { allowed: true };
    } else {
      capabilities.view_platform_freights = { 
        allowed: false, 
        reason: PERMISSION_MESSAGES.DRIVER_COMPANY_DISABLED_PLATFORM 
      };
    }

    // view_company_freights: apenas se for motorista de empresa
    capabilities.view_company_freights = { 
      allowed: isCompanyDriver 
    };

    // submit_freight_proposal: autônomo sempre pode, afiliado depende de can_accept_freights
    if (!isCompanyDriver) {
      // ✅ Motorista independente: sempre permitido
      capabilities.submit_freight_proposal = { allowed: true };
    } else if (isAffiliated && !canAcceptFreights) {
      // ❌ Motorista AFILIADO sem can_accept_freights: bloqueado (deve usar chat)
      capabilities.submit_freight_proposal = { 
        allowed: false, 
        reason: PERMISSION_MESSAGES.DRIVER_AFFILIATED_NO_PROPOSAL 
      };
    } else {
      // ✅ Motorista de empresa COM can_accept_freights: permitido
      capabilities.submit_freight_proposal = { allowed: true };
    }

    // submit_service_proposal: mesma lógica que freight proposal
    capabilities.submit_service_proposal = capabilities.submit_freight_proposal;

    // manage_own_vehicles: depende de canManageVehicles
    if (!isAffiliated) {
      capabilities.manage_own_vehicles = { allowed: canManageVehicles };
    } else {
      capabilities.manage_own_vehicles = { 
        allowed: false, 
        reason: PERMISSION_MESSAGES.DRIVER_AFFILIATED_NO_VEHICLES 
      };
    }

    // checkin/withdraw: precisa de assignment ativo
    const hasActive = context?.hasActiveAssignment || false;
    capabilities.checkin = { 
      allowed: hasActive,
      reason: hasActive ? undefined : PERMISSION_MESSAGES.DRIVER_NO_ACTIVE_ASSIGNMENT
    };
    capabilities.withdraw = capabilities.checkin;

    // chat: sempre permitido
    capabilities.chat = { allowed: true };
  }

  // ========== PRODUTOR: regras específicas ==========
  if (panel === 'PRODUTOR') {
    capabilities.create_freight = { allowed: true };
    capabilities.edit_own_freight = { allowed: true };
    capabilities.cancel_own_freight = { allowed: true };
    capabilities.accept_driver_proposal = { allowed: true };
    capabilities.rate_driver = { allowed: true };
    capabilities.chat = { allowed: true };
  }

  // ========== COMPANY: regras específicas ==========
  if (panel === 'COMPANY') {
    capabilities.manage_company_freights = { allowed: true };
    capabilities.assign_driver = { allowed: true };
    capabilities.see_company_drivers = { allowed: true };
    capabilities.manage_company_vehicles = { allowed: true };
    capabilities.approve_affiliation = { allowed: true };
    capabilities.rate_company_driver = { allowed: true };
    capabilities.chat = { allowed: true };
    capabilities.submit_freight_proposal = { allowed: true };
    capabilities.submit_service_proposal = { allowed: true };
  }

  // ========== SERVICE_PROVIDER: regras específicas ==========
  if (panel === 'SERVICE_PROVIDER') {
    capabilities.view_service_requests = { allowed: true };
    capabilities.submit_service_proposal_sp = { allowed: true };
    capabilities.complete_service = { 
      allowed: context?.hasActiveAssignment || false 
    };
    capabilities.service_chat = { allowed: true };
  }

  // ========== COMMON: regras comuns ==========
  capabilities.view_antt_breakdown = { 
    allowed: context?.hasANTTPrice || false 
  };
  capabilities.receive_notifications = { allowed: true };

  return capabilities;
};

/**
 * Helper: verificar se possui capacidade
 */
export const hasCapability = (
  capabilities: PanelCapabilities, 
  action: ActionKey
): boolean => {
  return capabilities[action]?.allowed || false;
};

/**
 * Helper: obter razão de restrição
 */
export const getRestrictionReason = (
  capabilities: PanelCapabilities, 
  action: ActionKey
): string | undefined => {
  return capabilities[action]?.reason;
};
