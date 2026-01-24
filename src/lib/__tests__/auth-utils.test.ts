import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  getDashboardByRole,
  isValidRole,
  getValidRoles,
  parseRoleFromUrl,
  parseModeFromUrl,
  setPendingSignupRole,
  getPendingSignupRole,
  clearPendingSignupRole,
  buildAuthUrl,
} from '../auth-utils';

describe('auth-utils', () => {
  describe('getDashboardByRole', () => {
    it('returns correct dashboard for PRODUTOR', () => {
      expect(getDashboardByRole('PRODUTOR')).toBe('/dashboard/producer');
    });

    it('returns correct dashboard for MOTORISTA', () => {
      expect(getDashboardByRole('MOTORISTA')).toBe('/dashboard/driver');
    });

    it('returns correct dashboard for MOTORISTA_AFILIADO', () => {
      expect(getDashboardByRole('MOTORISTA_AFILIADO')).toBe('/dashboard/driver');
    });

    it('returns correct dashboard for TRANSPORTADORA', () => {
      expect(getDashboardByRole('TRANSPORTADORA')).toBe('/dashboard/company');
    });

    it('returns correct dashboard for PRESTADOR_SERVICOS', () => {
      expect(getDashboardByRole('PRESTADOR_SERVICOS')).toBe('/dashboard/service-provider');
    });

    it('returns correct dashboard for ADMIN', () => {
      expect(getDashboardByRole('ADMIN')).toBe('/admin');
    });

    it('returns root for unknown role', () => {
      expect(getDashboardByRole('UNKNOWN')).toBe('/');
    });
  });

  describe('isValidRole', () => {
    it('returns true for valid roles', () => {
      expect(isValidRole('PRODUTOR')).toBe(true);
      expect(isValidRole('MOTORISTA')).toBe(true);
      expect(isValidRole('MOTORISTA_AFILIADO')).toBe(true);
      expect(isValidRole('TRANSPORTADORA')).toBe(true);
      expect(isValidRole('PRESTADOR_SERVICOS')).toBe(true);
      expect(isValidRole('ADMIN')).toBe(true);
    });

    it('returns false for invalid roles', () => {
      expect(isValidRole('UNKNOWN')).toBe(false);
      expect(isValidRole('')).toBe(false);
      expect(isValidRole('produtor')).toBe(false); // case sensitive
    });
  });

  describe('parseRoleFromUrl', () => {
    it('returns null for null input', () => {
      expect(parseRoleFromUrl(null)).toBe(null);
    });

    it('normalizes lowercase to uppercase', () => {
      expect(parseRoleFromUrl('produtor')).toBe('PRODUTOR');
      expect(parseRoleFromUrl('motorista')).toBe('MOTORISTA');
    });

    it('returns null for invalid role', () => {
      expect(parseRoleFromUrl('invalid')).toBe(null);
    });

    it('returns role for valid role string', () => {
      expect(parseRoleFromUrl('PRODUTOR')).toBe('PRODUTOR');
      expect(parseRoleFromUrl('TRANSPORTADORA')).toBe('TRANSPORTADORA');
    });
  });

  describe('parseModeFromUrl', () => {
    it('returns login by default', () => {
      const params = new URLSearchParams();
      expect(parseModeFromUrl(params)).toBe('login');
    });

    it('returns signup when mode=signup', () => {
      const params = new URLSearchParams('mode=signup');
      expect(parseModeFromUrl(params)).toBe('signup');
    });

    it('returns signup when tab=signup (legacy)', () => {
      const params = new URLSearchParams('tab=signup');
      expect(parseModeFromUrl(params)).toBe('signup');
    });

    it('returns signup when tab=register (legacy)', () => {
      const params = new URLSearchParams('tab=register');
      expect(parseModeFromUrl(params)).toBe('signup');
    });

    it('mode takes priority over tab', () => {
      const params = new URLSearchParams('mode=login&tab=signup');
      expect(parseModeFromUrl(params)).toBe('login');
    });
  });

  describe('sessionStorage functions', () => {
    beforeEach(() => {
      sessionStorage.clear();
    });

    afterEach(() => {
      sessionStorage.clear();
    });

    it('setPendingSignupRole stores role in sessionStorage', () => {
      setPendingSignupRole('PRODUTOR');
      expect(sessionStorage.getItem('pending_signup_role')).toBe('PRODUTOR');
    });

    it('getPendingSignupRole retrieves role from sessionStorage', () => {
      sessionStorage.setItem('pending_signup_role', 'MOTORISTA');
      expect(getPendingSignupRole()).toBe('MOTORISTA');
    });

    it('getPendingSignupRole returns null for invalid role', () => {
      sessionStorage.setItem('pending_signup_role', 'INVALID');
      expect(getPendingSignupRole()).toBe(null);
    });

    it('clearPendingSignupRole removes role from sessionStorage', () => {
      sessionStorage.setItem('pending_signup_role', 'PRODUTOR');
      clearPendingSignupRole();
      expect(sessionStorage.getItem('pending_signup_role')).toBe(null);
    });
  });

  describe('buildAuthUrl', () => {
    it('builds login URL without role', () => {
      expect(buildAuthUrl('login')).toBe('/auth?mode=login');
    });

    it('builds signup URL without role', () => {
      expect(buildAuthUrl('signup')).toBe('/auth?mode=signup');
    });

    it('builds signup URL with role', () => {
      expect(buildAuthUrl('signup', 'PRODUTOR')).toBe('/auth?mode=signup&role=PRODUTOR');
    });

    it('ignores role for login mode', () => {
      expect(buildAuthUrl('login', 'PRODUTOR')).toBe('/auth?mode=login');
    });
  });
});

describe('URL navigation scenarios', () => {
  it('/auth?mode=signup opens signup', () => {
    const params = new URLSearchParams('mode=signup');
    expect(parseModeFromUrl(params)).toBe('signup');
  });

  it('/auth?mode=login opens login', () => {
    const params = new URLSearchParams('mode=login');
    expect(parseModeFromUrl(params)).toBe('login');
  });

  it('/auth?mode=signup&role=PRODUTOR preserves role', () => {
    const params = new URLSearchParams('mode=signup&role=PRODUTOR');
    expect(parseModeFromUrl(params)).toBe('signup');
    expect(parseRoleFromUrl(params.get('role'))).toBe('PRODUTOR');
  });

  it('role is applied correctly to dashboard routing', () => {
    const role = parseRoleFromUrl('PRODUTOR');
    expect(role).toBe('PRODUTOR');
    expect(getDashboardByRole(role!)).toBe('/dashboard/producer');
  });
});
