import { describe, it, expect } from 'vitest';
import {
  resolveCanonicalAccess,
  isRouteAllowedForProfile,
  getDefaultRouteForProfile,
  getPanelForProfile,
  SHARED_AUTHENTICATED_PATHS,
} from '@/security/panelAccessGuard';

/**
 * Etapa 1 — Pentest Defensivo: Role Route Guard
 * 
 * Valida que cada role:
 * 1. É mapeado ao painel correto
 * 2. Só acessa suas rotas permitidas
 * 3. É bloqueado em rotas de outros painéis
 * 4. Redireciona para rota padrão correta
 * 5. Pode acessar rotas compartilhadas (complete-profile, plans, etc.)
 */

const ROLES_AND_PANELS = [
  { role: 'PRODUTOR', panel: 'PRODUCER', defaultRoute: '/dashboard/producer', blockedRoutes: ['/dashboard/driver', '/dashboard/company', '/dashboard/service-provider', '/admin'] },
  { role: 'MOTORISTA', panel: 'DRIVER', defaultRoute: '/dashboard/driver', blockedRoutes: ['/dashboard/producer', '/dashboard/company', '/dashboard/service-provider', '/admin'] },
  { role: 'MOTORISTA_AFILIADO', panel: 'DRIVER', defaultRoute: '/dashboard/driver', blockedRoutes: ['/dashboard/producer', '/dashboard/company', '/dashboard/service-provider', '/admin'] },
  { role: 'TRANSPORTADORA', panel: 'CARRIER', defaultRoute: '/dashboard/company', blockedRoutes: ['/dashboard/producer', '/dashboard/driver', '/dashboard/service-provider'] },
  { role: 'PRESTADOR_SERVICOS', panel: 'SERVICE_PROVIDER', defaultRoute: '/dashboard/service-provider', blockedRoutes: ['/dashboard/producer', '/dashboard/driver', '/dashboard/company', '/admin'] },
  { role: 'ADMIN', panel: 'ADMIN', defaultRoute: '/admin', blockedRoutes: [] },
];

describe('panelAccessGuard — Role Route Guard (P0)', () => {
  describe('resolveCanonicalAccess', () => {
    it.each(ROLES_AND_PANELS)(
      'maps $role → panel $panel',
      ({ role, panel }) => {
        const access = resolveCanonicalAccess({ role });
        expect(access).not.toBeNull();
        expect(access!.panel).toBe(panel);
      }
    );

    it('returns null for unknown role', () => {
      expect(resolveCanonicalAccess({ role: 'UNKNOWN' })).toBeNull();
    });

    it('returns null for null/undefined profile', () => {
      expect(resolveCanonicalAccess(null)).toBeNull();
      expect(resolveCanonicalAccess(undefined)).toBeNull();
    });

    it('returns null for profile without role', () => {
      expect(resolveCanonicalAccess({ role: '' })).toBeNull();
    });
  });

  describe('getDefaultRouteForProfile', () => {
    it.each(ROLES_AND_PANELS)(
      '$role → $defaultRoute',
      ({ role, defaultRoute }) => {
        expect(getDefaultRouteForProfile({ role })).toBe(defaultRoute);
      }
    );

    it('returns / for unknown role', () => {
      expect(getDefaultRouteForProfile({ role: 'UNKNOWN' })).toBe('/');
    });

    it('returns / for null profile', () => {
      expect(getDefaultRouteForProfile(null)).toBe('/');
    });
  });

  describe('isRouteAllowedForProfile — allowed routes', () => {
    it.each(ROLES_AND_PANELS)(
      '$role can access $defaultRoute',
      ({ role, defaultRoute }) => {
        expect(isRouteAllowedForProfile(defaultRoute, { role })).toBe(true);
      }
    );

    it('ADMIN can access /admin and /dashboard/*', () => {
      const admin = { role: 'ADMIN' };
      expect(isRouteAllowedForProfile('/admin', admin)).toBe(true);
      expect(isRouteAllowedForProfile('/admin/users', admin)).toBe(true);
      expect(isRouteAllowedForProfile('/dashboard/anything', admin)).toBe(true);
    });
  });

  describe('isRouteAllowedForProfile — blocked routes (cross-panel)', () => {
    ROLES_AND_PANELS.forEach(({ role, blockedRoutes }) => {
      blockedRoutes.forEach((blockedRoute) => {
        it(`${role} CANNOT access ${blockedRoute}`, () => {
          expect(isRouteAllowedForProfile(blockedRoute, { role })).toBe(false);
        });
      });
    });
  });

  describe('isRouteAllowedForProfile — shared authenticated paths', () => {
    const anyRole = { role: 'MOTORISTA' };

    it.each(SHARED_AUTHENTICATED_PATHS)(
      'any authenticated user can access %s',
      (path) => {
        expect(isRouteAllowedForProfile(path, anyRole)).toBe(true);
      }
    );

    it('shared paths work for all roles', () => {
      ROLES_AND_PANELS.forEach(({ role }) => {
        SHARED_AUTHENTICATED_PATHS.forEach((path) => {
          expect(isRouteAllowedForProfile(path, { role })).toBe(true);
        });
      });
    });
  });

  describe('isRouteAllowedForProfile — edge cases', () => {
    it('returns false for null profile', () => {
      expect(isRouteAllowedForProfile('/dashboard/producer', null)).toBe(false);
    });

    it('returns false for undefined profile', () => {
      expect(isRouteAllowedForProfile('/dashboard/driver', undefined)).toBe(false);
    });

    it('returns false for unknown role on panel routes', () => {
      expect(isRouteAllowedForProfile('/dashboard/producer', { role: 'UNKNOWN' })).toBe(false);
    });
  });

  describe('getPanelForProfile', () => {
    it.each(ROLES_AND_PANELS)(
      '$role → panel $panel',
      ({ role, panel }) => {
        expect(getPanelForProfile({ role })).toBe(panel);
      }
    );

    it('returns null for null profile', () => {
      expect(getPanelForProfile(null)).toBeNull();
    });
  });

  describe('MOTORISTA_AFILIADO uses same panel as MOTORISTA', () => {
    it('both map to DRIVER panel', () => {
      expect(getPanelForProfile({ role: 'MOTORISTA' })).toBe('DRIVER');
      expect(getPanelForProfile({ role: 'MOTORISTA_AFILIADO' })).toBe('DRIVER');
    });

    it('both redirect to /dashboard/driver', () => {
      expect(getDefaultRouteForProfile({ role: 'MOTORISTA' })).toBe('/dashboard/driver');
      expect(getDefaultRouteForProfile({ role: 'MOTORISTA_AFILIADO' })).toBe('/dashboard/driver');
    });
  });

  describe('Deep link protection — URL manipulation blocked', () => {
    it('MOTORISTA cannot deep-link to /dashboard/producer/freights', () => {
      expect(isRouteAllowedForProfile('/dashboard/producer/freights', { role: 'MOTORISTA' })).toBe(false);
    });

    it('PRODUTOR cannot deep-link to /dashboard/driver/tracking', () => {
      expect(isRouteAllowedForProfile('/dashboard/driver/tracking', { role: 'PRODUTOR' })).toBe(false);
    });

    it('PRESTADOR_SERVICOS cannot deep-link to /admin/users', () => {
      expect(isRouteAllowedForProfile('/admin/users', { role: 'PRESTADOR_SERVICOS' })).toBe(false);
    });

    it('MOTORISTA cannot deep-link to /dashboard/company/fleet', () => {
      expect(isRouteAllowedForProfile('/dashboard/company/fleet', { role: 'MOTORISTA' })).toBe(false);
    });
  });
});
