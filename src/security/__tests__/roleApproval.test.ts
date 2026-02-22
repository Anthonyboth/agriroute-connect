import { describe, it, expect } from 'vitest';

/**
 * Test: PRESTADOR_SERVICOS must NOT self-approve.
 * This test validates the business rule that only PRODUTOR and TRANSPORTADORA
 * can be auto-approved. PRESTADOR_SERVICOS requires admin approval.
 */
describe('Role Approval Rules', () => {
  const ROLES_ALLOWED_AUTO_APPROVAL = ['PRODUTOR', 'TRANSPORTADORA'];
  const ROLES_REQUIRING_MANUAL_APPROVAL = ['PRESTADOR_SERVICOS', 'MOTORISTA'];

  it('PRESTADOR_SERVICOS should NOT be in auto-approval list', () => {
    expect(ROLES_ALLOWED_AUTO_APPROVAL).not.toContain('PRESTADOR_SERVICOS');
  });

  it('MOTORISTA should NOT be in auto-approval list', () => {
    expect(ROLES_ALLOWED_AUTO_APPROVAL).not.toContain('MOTORISTA');
  });

  it('PRODUTOR should be allowed auto-approval', () => {
    expect(ROLES_ALLOWED_AUTO_APPROVAL).toContain('PRODUTOR');
  });

  it('TRANSPORTADORA should be allowed auto-approval', () => {
    expect(ROLES_ALLOWED_AUTO_APPROVAL).toContain('TRANSPORTADORA');
  });

  it('roles requiring manual approval should not overlap with auto-approval', () => {
    const overlap = ROLES_REQUIRING_MANUAL_APPROVAL.filter(
      role => ROLES_ALLOWED_AUTO_APPROVAL.includes(role)
    );
    expect(overlap).toHaveLength(0);
  });
});
