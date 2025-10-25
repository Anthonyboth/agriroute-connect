/**
 * Testes para sistema de painéis e capacidades
 */

import { describe, it, expect } from 'vitest';
import {
  resolvePanelFromRoute,
  getDefaultDashboardForRole,
  computePanelCapabilities,
  hasCapability,
  getRestrictionReason,
  type PanelKey,
} from '../src/lib/panel-capabilities';
import { PERMISSION_MESSAGES } from '../src/lib/permission-messages';

describe('Panel Capabilities System', () => {
  describe('resolvePanelFromRoute', () => {
    it('should resolve ADMIN panel from /admin route', () => {
      const panel = resolvePanelFromRoute('/admin', { role: 'ADMIN' } as any);
      expect(panel).toBe('ADMIN');
    });

    it('should resolve DRIVER panel from /dashboard/driver route', () => {
      const panel = resolvePanelFromRoute('/dashboard/driver', { role: 'MOTORISTA' } as any);
      expect(panel).toBe('DRIVER');
    });

    it('should resolve COMPANY panel from /dashboard/company route', () => {
      const panel = resolvePanelFromRoute('/dashboard/company', { role: 'TRANSPORTADORA' } as any);
      expect(panel).toBe('COMPANY');
    });

    it('should fallback to role-based resolution', () => {
      const panel = resolvePanelFromRoute('/other', { role: 'PRODUTOR' } as any);
      expect(panel).toBe('PRODUTOR');
    });
  });

  describe('getDefaultDashboardForRole', () => {
    it('should return /admin for ADMIN role', () => {
      const route = getDefaultDashboardForRole('ADMIN');
      expect(route).toBe('/admin');
    });

    it('should return /dashboard/driver for MOTORISTA role', () => {
      const route = getDefaultDashboardForRole('MOTORISTA');
      expect(route).toBe('/dashboard/driver');
    });

    it('should return /dashboard/company for TRANSPORTADORA mode', () => {
      const route = getDefaultDashboardForRole('MOTORISTA', 'TRANSPORTADORA');
      expect(route).toBe('/dashboard/company');
    });
  });

  describe('computePanelCapabilities - ADMIN', () => {
    it('should allow all actions for ADMIN panel', () => {
      const capabilities = computePanelCapabilities({
        panel: 'ADMIN',
        profile: { role: 'ADMIN' } as any,
      });

      expect(hasCapability(capabilities, 'view_platform_freights')).toBe(true);
      expect(hasCapability(capabilities, 'submit_freight_proposal')).toBe(true);
      expect(hasCapability(capabilities, 'manage_company_freights')).toBe(true);
    });
  });

  describe('computePanelCapabilities - DRIVER (Autônomo)', () => {
    it('should allow autonomous driver to submit proposals', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA' } as any,
        companyDriver: {
          isCompanyDriver: false,
          canAcceptFreights: false,
          canManageVehicles: true,
          isAffiliated: false,
        },
        driverPermissions: {
          isAffiliated: false,
          canAcceptFreights: true,
          canManageVehicles: true,
          companyId: null,
          companyName: null,
          mustUseChat: false,
        },
      });

      expect(hasCapability(capabilities, 'view_platform_freights')).toBe(true);
      expect(hasCapability(capabilities, 'submit_freight_proposal')).toBe(true);
      expect(hasCapability(capabilities, 'manage_own_vehicles')).toBe(true);
    });
  });

  describe('computePanelCapabilities - DRIVER (Afiliado)', () => {
    it('should block affiliated driver from submitting proposals', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA_AFILIADO' } as any,
        companyDriver: {
          isCompanyDriver: true,
          canAcceptFreights: false,
          canManageVehicles: false,
          isAffiliated: true,
        },
        driverPermissions: {
          isAffiliated: true,
          canAcceptFreights: false,
          canManageVehicles: false,
          companyId: 'company-123',
          companyName: 'Test Company',
          mustUseChat: true,
        },
      });

      expect(hasCapability(capabilities, 'submit_freight_proposal')).toBe(false);
      expect(getRestrictionReason(capabilities, 'submit_freight_proposal'))
        .toBe(PERMISSION_MESSAGES.DRIVER_AFFILIATED_NO_PROPOSAL);
      
      expect(hasCapability(capabilities, 'manage_own_vehicles')).toBe(false);
      expect(getRestrictionReason(capabilities, 'manage_own_vehicles'))
        .toBe(PERMISSION_MESSAGES.DRIVER_AFFILIATED_NO_VEHICLES);
    });

    it('should block affiliated driver from viewing platform freights if disabled', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA_AFILIADO' } as any,
        companyDriver: {
          isCompanyDriver: true,
          canAcceptFreights: false, // Empresa desabilitou
          canManageVehicles: false,
          isAffiliated: true,
        },
        driverPermissions: {
          isAffiliated: true,
          canAcceptFreights: false,
          canManageVehicles: false,
          companyId: 'company-123',
          companyName: 'Test Company',
          mustUseChat: true,
        },
      });

      expect(hasCapability(capabilities, 'view_platform_freights')).toBe(false);
      expect(getRestrictionReason(capabilities, 'view_platform_freights'))
        .toBe(PERMISSION_MESSAGES.DRIVER_COMPANY_DISABLED_PLATFORM);
    });

    it('should allow affiliated driver with canAcceptFreights to view platform', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA_AFILIADO' } as any,
        companyDriver: {
          isCompanyDriver: true,
          canAcceptFreights: true, // Empresa permitiu
          canManageVehicles: false,
          isAffiliated: true,
        },
        driverPermissions: {
          isAffiliated: true,
          canAcceptFreights: true,
          canManageVehicles: false,
          companyId: 'company-123',
          companyName: 'Test Company',
          mustUseChat: false,
        },
      });

      expect(hasCapability(capabilities, 'view_platform_freights')).toBe(true);
      // Mas ainda não pode enviar propostas
      expect(hasCapability(capabilities, 'submit_freight_proposal')).toBe(false);
    });
  });

  describe('computePanelCapabilities - DRIVER (Check-in/Withdraw)', () => {
    it('should block checkin without active assignment', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA' } as any,
        companyDriver: {
          isCompanyDriver: false,
          canAcceptFreights: true,
          canManageVehicles: true,
          isAffiliated: false,
        },
        context: {
          hasActiveAssignment: false,
        },
      });

      expect(hasCapability(capabilities, 'checkin')).toBe(false);
      expect(getRestrictionReason(capabilities, 'checkin'))
        .toBe(PERMISSION_MESSAGES.DRIVER_NO_ACTIVE_ASSIGNMENT);
    });

    it('should allow checkin with active assignment', () => {
      const capabilities = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA' } as any,
        companyDriver: {
          isCompanyDriver: false,
          canAcceptFreights: true,
          canManageVehicles: true,
          isAffiliated: false,
        },
        context: {
          hasActiveAssignment: true,
        },
      });

      expect(hasCapability(capabilities, 'checkin')).toBe(true);
      expect(hasCapability(capabilities, 'withdraw')).toBe(true);
    });
  });

  describe('computePanelCapabilities - PRODUCER', () => {
    it('should allow all producer actions', () => {
      const capabilities = computePanelCapabilities({
        panel: 'PRODUTOR',
        profile: { role: 'PRODUTOR' } as any,
      });

      expect(hasCapability(capabilities, 'create_freight')).toBe(true);
      expect(hasCapability(capabilities, 'edit_own_freight')).toBe(true);
      expect(hasCapability(capabilities, 'cancel_own_freight')).toBe(true);
      expect(hasCapability(capabilities, 'accept_driver_proposal')).toBe(true);
      expect(hasCapability(capabilities, 'rate_driver')).toBe(true);
      expect(hasCapability(capabilities, 'chat')).toBe(true);
    });
  });

  describe('computePanelCapabilities - COMPANY', () => {
    it('should allow all company actions', () => {
      const capabilities = computePanelCapabilities({
        panel: 'COMPANY',
        profile: { role: 'TRANSPORTADORA' } as any,
      });

      expect(hasCapability(capabilities, 'manage_company_freights')).toBe(true);
      expect(hasCapability(capabilities, 'assign_driver')).toBe(true);
      expect(hasCapability(capabilities, 'see_company_drivers')).toBe(true);
      expect(hasCapability(capabilities, 'manage_company_vehicles')).toBe(true);
      expect(hasCapability(capabilities, 'approve_affiliation')).toBe(true);
    });
  });

  describe('computePanelCapabilities - SERVICE_PROVIDER', () => {
    it('should allow service provider actions', () => {
      const capabilities = computePanelCapabilities({
        panel: 'SERVICE_PROVIDER',
        profile: { role: 'PRESTADOR_SERVICOS' } as any,
        context: {
          hasActiveAssignment: true,
        },
      });

      expect(hasCapability(capabilities, 'view_service_requests')).toBe(true);
      expect(hasCapability(capabilities, 'submit_service_proposal_sp')).toBe(true);
      expect(hasCapability(capabilities, 'complete_service')).toBe(true);
      expect(hasCapability(capabilities, 'service_chat')).toBe(true);
    });
  });

  describe('Common capabilities', () => {
    it('should allow notifications for all panels', () => {
      const panels: PanelKey[] = ['ADMIN', 'DRIVER', 'PRODUTOR', 'COMPANY', 'SERVICE_PROVIDER'];
      
      panels.forEach(panel => {
        const capabilities = computePanelCapabilities({
          panel,
          profile: { role: 'MOTORISTA' } as any,
        });
        
        expect(hasCapability(capabilities, 'receive_notifications')).toBe(true);
      });
    });

    it('should allow ANTT breakdown only with price', () => {
      const capabilitiesWithPrice = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA' } as any,
        context: {
          hasANTTPrice: true,
        },
      });

      const capabilitiesWithoutPrice = computePanelCapabilities({
        panel: 'DRIVER',
        profile: { role: 'MOTORISTA' } as any,
        context: {
          hasANTTPrice: false,
        },
      });

      expect(hasCapability(capabilitiesWithPrice, 'view_antt_breakdown')).toBe(true);
      expect(hasCapability(capabilitiesWithoutPrice, 'view_antt_breakdown')).toBe(false);
    });
  });
});
