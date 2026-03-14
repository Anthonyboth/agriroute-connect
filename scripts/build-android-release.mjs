#!/usr/bin/env node
/**
 * ✅ FRT-078: Bulletproof Android Release Build Pipeline
 * 
 * PROBLEMA: AAB gerado sem `npx cap sync android` resulta em bundle
 * incompleto (~9MB) que crasha na Play Store (classes.dex missing em split APKs).
 * Funciona via ADB (APK único) mas falha na Play Store (split APK delivery).
 * 
 * SOLUÇÃO: Este script executa build+sync+validação+bundle em sequência atômica,
 * garantindo que NENHUMA etapa seja pulada.
 * 
 * Uso:
 *   node scripts/build-android-release.mjs
 *   npm run mobile:build:android
 * 
 * Flags:
 *   --skip-bundle    Apenas build+sync+validação (não roda gradlew)
 *   --apk            Gera APK ao invés de AAB
 */

import { execSync } from 'child_process';
import { existsSync, readFileSync, readdirSync, statSync, rmSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();
const args = new Set(process.argv.slice(2));
const skipBundle = args.has('--skip-bundle');
const buildApk = args.has('--apk');

// ═══════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════

function log(emoji, msg) {
  console.log(`${emoji} ${msg}`);
}

function fail(msg) {
  console.error(`\n❌ BUILD BLOCKED: ${msg}\n`);
  process.exit(1);
}

function run(cmd, label) {
  log('🔧', `${label}...`);
  try {
    execSync(cmd, { stdio: 'inherit', cwd: ROOT });
  } catch (err) {
    fail(`"${label}" failed with exit code ${err.status}.\nCommand: ${cmd}`);
  }
}

function fileExists(path) {
  return existsSync(resolve(ROOT, path));
}

function fileSize(path) {
  try {
    return statSync(resolve(ROOT, path)).size;
  } catch {
    return 0;
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 0: Environment safety checks
// ═══════════════════════════════════════════════════════════════

log('🚀', 'FRT-078: Android Release Build Pipeline v1.0\n');

if (process.env.CAPACITOR_LIVE_RELOAD === 'true') {
  fail('CAPACITOR_LIVE_RELOAD=true is set! Cannot build release with live reload.');
}

if (!fileExists('package.json')) {
  fail('Not in project root (package.json not found).');
}

if (!fileExists('android')) {
  fail('android/ directory not found. Run: npx cap add android');
}

// ═══════════════════════════════════════════════════════════════
// STEP 1: Clean old build artifacts
// ═══════════════════════════════════════════════════════════════

log('🧹', 'Step 1/6: Cleaning old build artifacts...');

const cleanPaths = [
  'dist',
  'android/app/build',
];

for (const p of cleanPaths) {
  const fullPath = resolve(ROOT, p);
  if (existsSync(fullPath)) {
    rmSync(fullPath, { recursive: true, force: true });
    log('   ', `Removed ${p}/`);
  }
}

// ═══════════════════════════════════════════════════════════════
// STEP 2: Build web frontend
// ═══════════════════════════════════════════════════════════════

log('📦', 'Step 2/6: Building web frontend (npm run build)...');
run('npm run build', 'Web build');

// Validate dist output
if (!fileExists('dist/index.html')) {
  fail('dist/index.html not found after build. Web build failed.');
}

const distFiles = readdirSync(resolve(ROOT, 'dist/assets')).filter(f => f.endsWith('.js'));
if (distFiles.length === 0) {
  fail('No .js files in dist/assets/. Web build produced empty output.');
}

log('   ', `dist/ contains index.html + ${distFiles.length} JS files ✓`);

// ═══════════════════════════════════════════════════════════════
// STEP 3: Capacitor sync
// ═══════════════════════════════════════════════════════════════

log('🔄', 'Step 3/6: Syncing Capacitor (npx cap sync android)...');
run('npx cap sync android', 'Capacitor sync');

// ═══════════════════════════════════════════════════════════════
// STEP 4: Validate synced assets (CRITICAL)
// ═══════════════════════════════════════════════════════════════

log('🔍', 'Step 4/6: Validating Android assets...');

const ASSETS_BASE = 'android/app/src/main/assets';
const requiredFiles = [
  { path: `${ASSETS_BASE}/public/index.html`, name: 'index.html (web app entry)' },
  { path: `${ASSETS_BASE}/capacitor.config.json`, name: 'capacitor.config.json' },
  { path: `${ASSETS_BASE}/capacitor.plugins.json`, name: 'capacitor.plugins.json' },
];

let assetErrors = 0;
for (const { path, name } of requiredFiles) {
  if (!fileExists(path)) {
    console.error(`   ❌ MISSING: ${name} → ${path}`);
    assetErrors++;
  } else {
    const size = fileSize(path);
    if (size < 10) {
      console.error(`   ❌ EMPTY: ${name} (${size} bytes) → ${path}`);
      assetErrors++;
    } else {
      log('   ', `✓ ${name} (${(size / 1024).toFixed(1)} KB)`);
    }
  }
}

// Check for JS assets
const androidAssetsDir = resolve(ROOT, `${ASSETS_BASE}/public/assets`);
if (existsSync(androidAssetsDir)) {
  const jsFiles = readdirSync(androidAssetsDir).filter(f => f.endsWith('.js'));
  if (jsFiles.length === 0) {
    console.error('   ❌ No .js files in Android assets/public/assets/');
    assetErrors++;
  } else {
    log('   ', `✓ ${jsFiles.length} compiled JS files in assets`);
  }
} else {
  console.error('   ❌ MISSING: assets/public/assets/ directory');
  assetErrors++;
}

// Check index.html has <div id="root">
if (fileExists(`${ASSETS_BASE}/public/index.html`)) {
  const html = readFileSync(resolve(ROOT, `${ASSETS_BASE}/public/index.html`), 'utf-8');
  if (!html.includes('id="root"')) {
    console.error('   ❌ index.html missing <div id="root"> — corrupt file');
    assetErrors++;
  }
}

// Check capacitor.config.json doesn't have server.url (FRT-062)
// AND validate appId matches canonical ID (FRT-079)
const CANONICAL_APP_ID = 'com.agriroute.connect';

if (fileExists(`${ASSETS_BASE}/capacitor.config.json`)) {
  try {
    const config = JSON.parse(readFileSync(resolve(ROOT, `${ASSETS_BASE}/capacitor.config.json`), 'utf-8'));
    if (config?.server?.url) {
      console.error(`   ❌ FRT-062: capacitor.config.json contains server.url: "${config.server.url}"`);
      console.error('     Release builds MUST NOT have server.url (causes flash-crash on Play Store)');
      assetErrors++;
    } else {
      log('   ', '✓ No server.url in release config (FRT-062 safe)');
    }

    // FRT-079: Validate canonical appId
    if (config?.appId && config.appId !== CANONICAL_APP_ID) {
      console.error(`   ❌ FRT-079: appId mismatch! Found "${config.appId}", expected "${CANONICAL_APP_ID}"`);
      console.error('     Dual identifiers cause Play Store crash (split APK mismatch).');
      assetErrors++;
    } else if (config?.appId === CANONICAL_APP_ID) {
      log('   ', `✓ appId = ${CANONICAL_APP_ID} (FRT-079 safe)`);
    }
  } catch (err) {
    console.error(`   ❌ Failed to parse capacitor.config.json: ${err.message}`);
    assetErrors++;
  }
}

// Check critical plugins registered (FRT-071)
if (fileExists(`${ASSETS_BASE}/capacitor.plugins.json`)) {
  try {
    const plugins = JSON.parse(readFileSync(resolve(ROOT, `${ASSETS_BASE}/capacitor.plugins.json`), 'utf-8'));
    const registered = (Array.isArray(plugins) ? plugins : []).map(p => p.classpath || p.name || '');
    const critical = ['Camera', 'Geolocation', 'SplashScreen'];
    for (const c of critical) {
      if (!registered.some(r => r.toLowerCase().includes(c.toLowerCase()))) {
        console.warn(`   ⚠️ Plugin "${c}" not found in capacitor.plugins.json`);
      }
    }
  } catch { /* ignore parse errors, already caught above */ }
}

if (assetErrors > 0) {
  fail(`${assetErrors} critical asset(s) missing or invalid.\nRun: npm run build && npx cap sync android`);
}

log('✅', 'All Android assets validated!\n');

// ═══════════════════════════════════════════════════════════════
// STEP 5: Run preflight validator
// ═══════════════════════════════════════════════════════════════

log('🛡️', 'Step 5/6: Running preflight validator...');
run('node scripts/validate-native-release.mjs --require-android-assets', 'Preflight validation');

// ═══════════════════════════════════════════════════════════════
// STEP 6: Generate AAB/APK
// ═══════════════════════════════════════════════════════════════

if (skipBundle) {
  log('⏭️', 'Step 6/6: Skipped (--skip-bundle flag)');
  log('✅', '\nBuild + sync + validation complete! Run gradlew manually:\n');
  log('   ', 'cd android');
  log('   ', buildApk 
    ? './gradlew assembleRelease' 
    : './gradlew bundleRelease');
} else {
  const isWindows = process.platform === 'win32';
  const gradlew = isWindows ? '.\\gradlew.bat' : './gradlew';
  const task = buildApk ? 'assembleRelease' : 'bundleRelease';
  
  log('🏗️', `Step 6/6: Generating ${buildApk ? 'APK' : 'AAB'} (${task})...`);
  
  try {
    execSync(`${gradlew} clean ${task}`, { 
      stdio: 'inherit', 
      cwd: resolve(ROOT, 'android') 
    });
  } catch (err) {
    fail(`Gradle ${task} failed. Check Android Studio for details.`);
  }

  // Validate output
  const outputPath = buildApk
    ? 'android/app/build/outputs/apk/release/app-release.apk'
    : 'android/app/build/outputs/bundle/release/app-release.aab';

  if (fileExists(outputPath)) {
    const sizeMB = fileSize(outputPath) / (1024 * 1024);
    
    if (sizeMB < 11) {
      console.error(`\n⚠️ WARNING: ${buildApk ? 'APK' : 'AAB'} is only ${sizeMB.toFixed(2)} MB`);
      console.error('   Expected ≥ 11 MB for a complete build.');
      console.error('   The bundle may be missing web assets.');
      console.error('   Verify before uploading to Play Store!\n');
    } else {
      log('📊', `Output size: ${sizeMB.toFixed(2)} MB ✓`);
    }

    log('📁', `Output: ${outputPath}`);
  } else {
    console.warn(`\n⚠️ Expected output not found at ${outputPath}`);
    console.warn('   Check android/app/build/outputs/ for the generated file.');
  }
}

// ═══════════════════════════════════════════════════════════════
// DONE
// ═══════════════════════════════════════════════════════════════

console.log('\n' + '═'.repeat(60));
log('✅', 'FRT-078: Android release build pipeline complete!');
console.log('═'.repeat(60));
console.log(`
📋 Next steps:
   1. Verify the AAB/APK size is ≥ 11 MB
   2. Test on device: adb install <path-to-apk>
   3. Upload to Google Play Console
   
🔍 To inspect AAB contents:
   Open the .aab as ZIP and verify these exist:
   - base/dex/classes.dex
   - base/assets/public/index.html
   - base/assets/capacitor.config.json
   - base/assets/capacitor.plugins.json
`);
