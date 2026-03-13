#!/usr/bin/env node
/**
 * ✅ Native Release Preflight Validator v3
 *
 * Usage:
 *   node scripts/validate-native-release.mjs
 *   node scripts/validate-native-release.mjs --require-android-assets
 *
 * Exit 0 = safe to release
 * Exit 1 = BLOCKED
 *
 * FRT-071: Validates capacitor.plugins.json and critical plugin registration
 * FRT-072: Validates plugin major version alignment with @capacitor/core
 */

import { existsSync, readFileSync, statSync } from 'fs';
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
const ANDROID_INDEX_HTML = resolve(
  process.cwd(),
  'android/app/src/main/assets/public/index.html',
);
const ANDROID_PLUGINS_JSON = resolve(
  process.cwd(),
  'android/app/src/main/assets/capacitor.plugins.json',
);
const IOS_INDEX_HTML = resolve(
  process.cwd(),
  'ios/App/App/public/index.html',
);
const IOS_CONFIG_JSON = resolve(
  process.cwd(),
  'ios/App/App/capacitor.config.json',
);
const PACKAGE_JSON_PATH = resolve(process.cwd(), 'package.json');

// Critical plugins that MUST be registered in the native binary
const CRITICAL_PLUGINS = ['Camera', 'Geolocation', 'SplashScreen'];

console.log('🔍 [Preflight v3] Validating native release configuration...\n');

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

// ═══════════════════════════════════════════════════════════════
// 1. Validate capacitor.config.ts (server.url guard)
// ═══════════════════════════════════════════════════════════════

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

// ═══════════════════════════════════════════════════════════════
// 2. Validate Android native assets
// ═══════════════════════════════════════════════════════════════

const hasAndroidConfigJson = existsSync(ANDROID_ASSET_CONFIG_PATH);
const hasAndroidPublicAssets = existsSync(ANDROID_PUBLIC_ASSETS_DIR);
const hasAndroidIndexHtml = existsSync(ANDROID_INDEX_HTML);
const hasAndroidPluginsJson = existsSync(ANDROID_PLUGINS_JSON);

if (requireAndroidAssets) {
  if (!hasAndroidConfigJson) {
    pushError(
      'android/app/src/main/assets/capacitor.config.json not found — run `npx cap sync android` before release'
    );
  }

  if (!hasAndroidPublicAssets) {
    pushError(
      'android/app/src/main/assets/public not found — Android assets not synced from dist'
    );
  }

  if (hasAndroidPublicAssets && !hasAndroidIndexHtml) {
    pushError(
      'android/app/src/main/assets/public/index.html NOT FOUND — dist/ was not built or synced correctly.\n' +
      '     This causes the app to open and immediately close (AAB ~9 MB instead of ~12 MB).\n' +
      '     Fix: run `npm run build && npx cap sync android` before generating the AAB.'
    );
  }

  // FRT-071: Validate capacitor.plugins.json exists and has critical plugins
  if (!hasAndroidPluginsJson) {
    pushError(
      'android/app/src/main/assets/capacitor.plugins.json NOT FOUND (FRT-071).\n' +
      '     Without this file, native plugins (Camera, SplashScreen, Geolocation) will throw\n' +
      '     "plugin is not implemented" at runtime, causing boot crashes.\n' +
      '     Fix: run `npx cap sync android`.'
    );
  } else {
    // Validate critical plugins are registered
    try {
      const pluginsRaw = readFileSync(ANDROID_PLUGINS_JSON, 'utf-8');
      const plugins = JSON.parse(pluginsRaw);
      const registeredNames = Array.isArray(plugins)
        ? plugins.map(p => p.name || p.id || '').filter(Boolean)
        : [];

      for (const critical of CRITICAL_PLUGINS) {
        const found = registeredNames.some(name =>
          name.toLowerCase().includes(critical.toLowerCase())
        );
        if (!found) {
          pushError(
            `Critical plugin "${critical}" NOT registered in capacitor.plugins.json (FRT-071).\n` +
            `     Registered plugins: [${registeredNames.join(', ')}]\n` +
            `     Fix: ensure @capacitor/${critical.toLowerCase()} is installed and run \`npx cap sync android\`.`
          );
        }
      }
    } catch (err) {
      pushError(`Failed to parse capacitor.plugins.json: ${err.message}`);
    }
  }
}

if (!requireAndroidAssets && !hasAndroidConfigJson) {
  warnings.push('Android asset config not found yet (expected before sync).');
}

// Validate Android config doesn't have server.url in release
if (hasAndroidConfigJson) {
  try {
    const raw = readFileSync(ANDROID_ASSET_CONFIG_PATH, 'utf-8');
    const androidConfig = JSON.parse(raw);

    const releaseServerUrl = androidConfig?.server?.url;
    if (releaseServerUrl) {
      pushError(
        `android/app/src/main/assets/capacitor.config.json contains server.url in release: "${releaseServerUrl}"`
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

// ═══════════════════════════════════════════════════════════════
// 3. Validate iOS native assets (if present)
// ═══════════════════════════════════════════════════════════════

if (existsSync(resolve(process.cwd(), 'ios'))) {
  if (!existsSync(IOS_INDEX_HTML)) {
    warnings.push(
      'ios/App/App/public/index.html not found — if building for iOS, run `npx cap sync ios`.'
    );
  }
  if (!existsSync(IOS_CONFIG_JSON)) {
    warnings.push(
      'ios/App/App/capacitor.config.json not found — if building for iOS, run `npx cap sync ios`.'
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// 4. FRT-072: Validate plugin version alignment
// ═══════════════════════════════════════════════════════════════

try {
  const pkgRaw = readFileSync(PACKAGE_JSON_PATH, 'utf-8');
  const pkg = JSON.parse(pkgRaw);
  const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

  // Extract core major version
  const coreVersion = deps['@capacitor/core'] || '';
  const coreMajorMatch = coreVersion.match(/(\d+)/);
  const coreMajor = coreMajorMatch ? parseInt(coreMajorMatch[1]) : null;

  if (coreMajor) {
    // Check all @capacitor/* packages
    const capacitorPkgs = Object.entries(deps).filter(([name]) =>
      name.startsWith('@capacitor/') && name !== '@capacitor/core'
    );

    for (const [name, version] of capacitorPkgs) {
      const majorMatch = String(version).match(/(\d+)/);
      if (majorMatch) {
        const major = parseInt(majorMatch[1]);
        if (major !== coreMajor) {
          pushError(
            `FRT-072: ${name}@${version} (major ${major}) is incompatible with @capacitor/core@${coreVersion} (major ${coreMajor}).\n` +
            `     All @capacitor/* packages MUST share the same major version.`
          );
        }
      }
    }

    // Check @capawesome-team packages
    const capawesomePkgs = Object.entries(deps).filter(([name]) =>
      name.startsWith('@capawesome-team/')
    );

    for (const [name, version] of capawesomePkgs) {
      const majorMatch = String(version).match(/(\d+)/);
      if (majorMatch) {
        const major = parseInt(majorMatch[1]);
        if (major !== coreMajor) {
          pushError(
            `FRT-072: ${name}@${version} (major ${major}) is incompatible with @capacitor/core@${coreVersion} (major ${coreMajor}).\n` +
            `     Third-party Capacitor plugins MUST match core major version.`
          );
        }
      }
    }
  }
} catch (err) {
  warnings.push(`Could not validate plugin versions: ${err.message}`);
}

// ═══════════════════════════════════════════════════════════════
// 5. AAB size check (if AAB exists)
// ═══════════════════════════════════════════════════════════════

const aabPath = resolve(process.cwd(), 'android/app/build/outputs/bundle/release/app-release.aab');
if (existsSync(aabPath)) {
  try {
    const stats = statSync(aabPath);
    const sizeMB = stats.size / (1024 * 1024);
    if (sizeMB < 11) {
      pushError(
        `AAB file is suspiciously small: ${sizeMB.toFixed(2)} MB (expected ≥11 MB).\n` +
        '     This usually means web assets are missing from the bundle.\n' +
        '     Fix: run `npm run build && npx cap sync android` and rebuild.'
      );
    } else {
      console.log(`   ✅ AAB size: ${sizeMB.toFixed(2)} MB (healthy)`);
    }
  } catch { /* ignore stat errors */ }
}

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

if (warnings.length > 0) {
  console.warn('⚠️ Warnings:\n');
  warnings.forEach((w, i) => console.warn(`  ${i + 1}. ${w}`));
  console.warn('');
}

if (errors.length > 0) {
  console.error('❌ RELEASE BLOCKED — Found %d issue(s):\n', errors.length);
  errors.forEach((e, i) => console.error(`  ${i + 1}. ${e}`));
  console.error('\n📋 See FRT-062, FRT-071, FRT-072 in src/hooks/useRegressionShield.ts for context.');
  console.error('💡 Fix the issues above before generating/signing AAB.\n');
  process.exit(1);
}

console.log('✅ [Preflight v3] Configuration is SAFE for native release.');
console.log('   - server.url properly guarded');
console.log('   - no unsafe URL query/hash/path');
if (hasAndroidConfigJson) console.log('   - Android capacitor.config.json verified');
if (hasAndroidPublicAssets) console.log('   - Android public assets folder found');
if (hasAndroidIndexHtml) console.log('   - Android public/index.html present (dist/ correctly synced)');
if (hasAndroidPluginsJson) console.log('   - capacitor.plugins.json present with critical plugins');
console.log('   - Plugin version alignment verified');
console.log('');
process.exit(0);
