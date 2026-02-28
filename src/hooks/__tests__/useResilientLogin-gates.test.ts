/**
 * Regression test: useResilientLogin must NEVER bypass security gates.
 *
 * This test scans the source code to ensure:
 * 1. getDashboardRoute is never used for actual navigation (only fallback to /complete-profile)
 * 2. resolvePostAuthRoute is always imported and used
 * 3. No direct dashboard route assignment without gates
 *
 * WHY: A previous bug allowed MOTORISTA users to skip admin approval
 * because getDashboardRoute was called directly, bypassing the 3 gates
 * enforced by resolvePostAuthRoute (docs, approval, role-based routing).
 */

import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';

const SOURCE_FILE = path.resolve(__dirname, '../useResilientLogin.ts');

describe('useResilientLogin security gates', () => {
  let source: string;

  beforeAll(() => {
    source = fs.readFileSync(SOURCE_FILE, 'utf-8');
  });

  it('must import resolvePostAuthRoute', () => {
    expect(source).toContain("import { resolvePostAuthRoute }");
  });

  it('must call resolvePostAuthRoute at least once', () => {
    const calls = source.match(/resolvePostAuthRoute\(/g);
    expect(calls).not.toBeNull();
    expect(calls!.length).toBeGreaterThanOrEqual(2); // login + selectProfile
  });

  it('must NOT use getDashboardRoute for actual navigation (only safe fallback)', () => {
    // Find all lines with getDashboardRoute
    const lines = source.split('\n');
    const dashboardRouteLines = lines.filter(
      (line) =>
        line.includes('getDashboardRoute(') &&
        !line.trim().startsWith('//') &&
        !line.trim().startsWith('*')
    );

    for (const line of dashboardRouteLines) {
      // The function definition itself is OK
      if (line.includes('function getDashboardRoute')) continue;

      // Any remaining usage must NOT be assigned to targetRoute/fallbackRoute
      // without being overridden by /complete-profile
      // We check that it's not directly used for navigation
      const isUnsafe =
        (line.includes('targetRoute =') || line.includes('fallbackRoute =')) &&
        !line.includes('/complete-profile');

      expect(isUnsafe).toBe(false);
    }
  });

  it('all fallback routes must point to /complete-profile, never dashboard', () => {
    // Match patterns like: targetRoute = getDashboardRoute(...)
    const unsafePattern = /(?:targetRoute|fallbackRoute)\s*=\s*getDashboardRoute\(/g;
    const matches = source.match(unsafePattern);
    
    // There should be ZERO direct assignments from getDashboardRoute
    expect(matches).toBeNull();
  });

  it('must contain NEVER comments as documentation guardrails', () => {
    const neverComments = source.match(/NEVER route to dashboard without security gates/g);
    expect(neverComments).not.toBeNull();
    expect(neverComments!.length).toBeGreaterThanOrEqual(2);
  });
});
