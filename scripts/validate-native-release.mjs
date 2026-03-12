#!/usr/bin/env node
/**
 * ✅ Native Release Preflight Validator
 * 
 * Validates that capacitor.config.ts does NOT contain a hardcoded server.url
 * for production builds. Prevents FRT-062 regressions (Android flash/crash).
 * 
 * Usage: node scripts/validate-native-release.mjs
 * Exit 0 = safe to release, Exit 1 = BLOCKED
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

const CONFIG_PATH = resolve(process.cwd(), 'capacitor.config.ts');

console.log('🔍 [Preflight] Validating native release configuration...\n');

let configContent;
try {
  configContent = readFileSync(CONFIG_PATH, 'utf-8');
} catch (err) {
  console.error('❌ Could not read capacitor.config.ts:', err.message);
  process.exit(1);
}

const errors = [];

// Check 1: No hardcoded server.url without env guard
const hasServerUrl = /server\s*:\s*\{[^}]*url\s*:/s.test(configContent);
const hasEnvGuard = /process\.env\.CAPACITOR_LIVE_RELOAD/s.test(configContent);
const hasConditionalSpread = /\.\.\.\(isLiveReload|isNativeDev/s.test(configContent);

if (hasServerUrl && !hasEnvGuard) {
  errors.push('server.url is present WITHOUT environment variable guard (CAPACITOR_LIVE_RELOAD)');
}

if (hasServerUrl && !hasConditionalSpread) {
  errors.push('server block is NOT conditionally applied — must use spread operator with env check');
}

// Check 2: No query parameters in server URL (causes Android WebView crashes)
const urlMatch = configContent.match(/url\s*:\s*['"`]([^'"`]+)['"`]/);
if (urlMatch) {
  const url = urlMatch[1];
  if (url.includes('?') || url.includes('#')) {
    errors.push(`server.url contains query/hash parameters: "${url}" — this crashes Android WebView`);
  }
}

// Check 3: Ensure CAPACITOR_LIVE_RELOAD is not set in current env
if (process.env.CAPACITOR_LIVE_RELOAD === 'true') {
  errors.push('CAPACITOR_LIVE_RELOAD=true is set in current environment — UNSET it for release builds');
}

// Report
if (errors.length > 0) {
  console.error('❌ RELEASE BLOCKED — Found %d issue(s):\n', errors.length);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.error('\n📋 See FRT-062 in useRegressionShield.ts for context.');
  console.error('💡 For release: ensure CAPACITOR_LIVE_RELOAD is NOT set and server.url is conditional.\n');
  process.exit(1);
} else {
  console.log('✅ [Preflight] Configuration is SAFE for production release.');
  console.log('   - server.url: conditional (env-guarded)');
  console.log('   - CAPACITOR_LIVE_RELOAD: not active');
  console.log('   - No dangerous URL parameters detected\n');
  process.exit(0);
}
