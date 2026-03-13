#!/usr/bin/env node
/**
 * ✅ Native Release Preflight Validator
 *
 * Usage:
 *   node scripts/validate-native-release.mjs
 *   node scripts/validate-native-release.mjs --require-android-assets
 *
 * Exit 0 = safe to release
 * Exit 1 = BLOCKED
 */

import { existsSync, readFileSync } from 'fs';
import { resolve } from 'path';

const args = new Set(process.argv.slice(2));
const requireAndroidAssets = args.has('--require-android-assets');

const CONFIG_PATH = resolve(process.cwd(), 'capacitor.config.ts');
const ANDROID_ASSET_CONFIG_PATH = resolve(
  process.cwd(),
  'android/app/src/main/assets/capacitor.config.json',
);
const ANDROID_PUBLIC_ASSETS_DIR = resolve(
  process.cwd(),
  'android/app/src/main/assets/public',
);

console.log('🔍 [Preflight] Validating native release configuration...\n');

const errors = [];
const warnings = [];

function pushError(message) {
  errors.push(message);
}

function validateServerUrl(url, sourceLabel) {
  try {
    const parsed = new URL(url);

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      pushError(`${sourceLabel} uses unsupported protocol: "${parsed.protocol}"`);
    }

    if (parsed.search || parsed.hash) {
      pushError(`${sourceLabel} contains query/hash params: "${url}"`);
    }

    if (parsed.pathname && parsed.pathname !== '/' && parsed.pathname !== '') {
      pushError(`${sourceLabel} contains path segment "${parsed.pathname}" — keep only origin`);
    }
  } catch {
    pushError(`${sourceLabel} is not a valid URL: "${url}"`);
  }
}

let configContent = '';
try {
  configContent = readFileSync(CONFIG_PATH, 'utf-8');
} catch (err) {
  console.error('❌ Could not read capacitor.config.ts:', err.message);
  process.exit(1);
}

const hasServerUrl = /server\s*:\s*\{[^}]*url\s*:/s.test(configContent);
const hasEnvGuard = /process\.env\.CAPACITOR_LIVE_RELOAD/s.test(configContent);
const hasConditionalSpread = /\.\.\.\(isLiveReload|isNativeDev/s.test(configContent);

if (hasServerUrl && !hasEnvGuard) {
  pushError('server.url is present WITHOUT CAPACITOR_LIVE_RELOAD env guard');
}

if (hasServerUrl && !hasConditionalSpread) {
  pushError('server block is not conditionally applied with spread + env guard');
}

const tsServerUrls = [...configContent.matchAll(/url\s*:\s*['"`]([^'"`]+)['"`]/g)].map(match => match[1]);
for (const url of tsServerUrls) {
  validateServerUrl(url, `capacitor.config.ts server.url`);
}

if (process.env.CAPACITOR_LIVE_RELOAD === 'true') {
  pushError('CAPACITOR_LIVE_RELOAD=true is active in current environment (invalid for release)');
}

const hasAndroidConfigJson = existsSync(ANDROID_ASSET_CONFIG_PATH);
const hasAndroidPublicAssets = existsSync(ANDROID_PUBLIC_ASSETS_DIR);

if (requireAndroidAssets && !hasAndroidConfigJson) {
  pushError('android/app/src/main/assets/capacitor.config.json not found — run `npx cap sync android` before release');
}

if (requireAndroidAssets && !hasAndroidPublicAssets) {
  pushError('android/app/src/main/assets/public not found — Android assets not synced from dist');
}

if (!requireAndroidAssets && !hasAndroidConfigJson) {
  warnings.push('Android asset config not found yet (expected before sync).');
}

if (hasAndroidConfigJson) {
  try {
    const raw = readFileSync(ANDROID_ASSET_CONFIG_PATH, 'utf-8');
    const androidConfig = JSON.parse(raw);

    const releaseServerUrl = androidConfig?.server?.url;
    if (releaseServerUrl) {
      pushError(
        `android/app/src/main/assets/capacitor.config.json contains server.url in release: "${releaseServerUrl}"`,
      );
      validateServerUrl(releaseServerUrl, 'Android asset server.url');
    }

    const webDir = androidConfig?.webDir;
    if (webDir && webDir !== 'dist') {
      warnings.push(`Android config webDir is "${webDir}" (expected "dist").`);
    }
  } catch (err) {
    pushError(`Failed to parse Android asset config JSON: ${err.message}`);
  }
}

if (warnings.length > 0) {
  console.warn('⚠️ Warnings:\n');
  warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
  console.warn('');
}

if (errors.length > 0) {
  console.error('❌ RELEASE BLOCKED — Found %d issue(s):\n', errors.length);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.error('\n📋 See FRT-062 in src/hooks/useRegressionShield.ts for context.');
  console.error('💡 Fix the issues above before generating/signing AAB.\n');
  process.exit(1);
}

console.log('✅ [Preflight] Configuration is SAFE for native release.');
console.log('   - server.url properly guarded');
console.log('   - no unsafe URL query/hash/path');
if (hasAndroidConfigJson) {
  console.log('   - Android capacitor.config.json verified');
}
if (hasAndroidPublicAssets) {
  console.log('   - Android public assets folder found');
}
console.log('');
process.exit(0);
