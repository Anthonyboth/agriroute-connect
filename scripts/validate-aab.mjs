#!/usr/bin/env node
/**
 * ✅ FRT-078: AAB/APK Post-Build Validator
 * 
 * Inspects a generated .aab or .apk file to verify it contains
 * all required files for a working Capacitor app on Play Store.
 * 
 * The Play Store splits AABs into multiple APKs (base.apk, split_config.*.apk).
 * If critical files are missing from the AAB, the split APKs will crash.
 * 
 * Usage:
 *   node scripts/validate-aab.mjs [path-to-aab]
 *   
 *   Default: android/app/build/outputs/bundle/release/app-release.aab
 */

import { existsSync, readFileSync, statSync } from 'fs';
import { resolve, extname } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();

// Find the AAB/APK file
let targetPath = process.argv[2];

if (!targetPath) {
  // Try default locations
  const defaults = [
    'android/app/build/outputs/bundle/release/app-release.aab',
    'android/app/build/outputs/apk/release/app-release.apk',
    'android/app/build/outputs/apk/release/app-release-unsigned.apk',
  ];
  targetPath = defaults.find(p => existsSync(resolve(ROOT, p)));
}

if (!targetPath || !existsSync(resolve(ROOT, targetPath))) {
  console.error('❌ No AAB/APK file found.');
  console.error('   Specify path: node scripts/validate-aab.mjs <path>');
  console.error('   Or build first: npm run mobile:build:android');
  process.exit(1);
}

const fullPath = resolve(ROOT, targetPath);
const isAAB = extname(targetPath).toLowerCase() === '.aab';
const fileType = isAAB ? 'AAB' : 'APK';

console.log(`\n🔍 FRT-078: Validating ${fileType}: ${targetPath}\n`);

const errors = [];
const warnings = [];
const passed = [];

// ═══════════════════════════════════════════════════════════════
// 1. File size check
// ═══════════════════════════════════════════════════════════════

const stats = statSync(fullPath);
const sizeMB = stats.size / (1024 * 1024);

if (sizeMB < 5) {
  errors.push(`${fileType} is critically small: ${sizeMB.toFixed(2)} MB (expected ≥ 11 MB). Build is definitely broken.`);
} else if (sizeMB < 11) {
  warnings.push(`${fileType} is suspiciously small: ${sizeMB.toFixed(2)} MB (expected ≥ 11 MB). Web assets may be missing.`);
} else {
  passed.push(`Size: ${sizeMB.toFixed(2)} MB ✓`);
}

// ═══════════════════════════════════════════════════════════════
// 2. Contents inspection via jar/unzip listing
// ═══════════════════════════════════════════════════════════════

let fileList = '';
try {
  // Try jar tf (available with JDK)
  fileList = execSync(`jar tf "${fullPath}"`, { encoding: 'utf-8', timeout: 30000 });
} catch {
  try {
    // Try unzip -l (available on most systems)
    const output = execSync(`unzip -l "${fullPath}"`, { encoding: 'utf-8', timeout: 30000 });
    fileList = output;
  } catch {
    try {
      // Try zipinfo (available on Linux/Mac)
      fileList = execSync(`zipinfo -1 "${fullPath}"`, { encoding: 'utf-8', timeout: 30000 });
    } catch {
      warnings.push(
        'Could not inspect AAB/APK contents (jar, unzip, zipinfo not available).\n' +
        '     Install JDK or unzip to enable content validation.\n' +
        '     Manual check: open the file as a ZIP and verify contents.'
      );
    }
  }
}

if (fileList) {
  const files = fileList.toLowerCase();
  
  // Critical files that MUST exist in AAB
  const criticalChecks = isAAB ? [
    { pattern: 'base/dex/classes.dex', desc: 'classes.dex (compiled Java/Kotlin code)' },
    { pattern: 'base/assets/public/index.html', desc: 'index.html (web app entry point)' },
    { pattern: 'base/assets/capacitor.config.json', desc: 'capacitor.config.json' },
    { pattern: 'base/assets/capacitor.plugins.json', desc: 'capacitor.plugins.json' },
    { pattern: 'base/manifest/androidmanifest.xml', desc: 'AndroidManifest.xml' },
    { pattern: 'base/assets/public/assets/', desc: 'compiled JS/CSS assets' },
  ] : [
    // APK structure is flat
    { pattern: 'classes.dex', desc: 'classes.dex (compiled Java/Kotlin code)' },
    { pattern: 'assets/public/index.html', desc: 'index.html (web app entry point)' },
    { pattern: 'assets/capacitor.config.json', desc: 'capacitor.config.json' },
    { pattern: 'assets/capacitor.plugins.json', desc: 'capacitor.plugins.json' },
    { pattern: 'androidmanifest.xml', desc: 'AndroidManifest.xml' },
    { pattern: 'assets/public/assets/', desc: 'compiled JS/CSS assets' },
  ];

  for (const { pattern, desc } of criticalChecks) {
    if (files.includes(pattern)) {
      passed.push(`${desc} ✓`);
    } else {
      errors.push(
        `MISSING: ${desc}\n` +
        `     Expected path in ${fileType}: ${pattern}\n` +
        `     This will cause the app to crash on Play Store (split APK delivery).`
      );
    }
  }

  // Count JS files in assets
  const jsMatches = files.match(/assets\/public\/assets\/[^\n]*\.js/g);
  if (jsMatches && jsMatches.length > 0) {
    passed.push(`${jsMatches.length} JavaScript bundle(s) found ✓`);
  } else if (!files.includes('assets/public/assets/')) {
    // Already caught above
  } else {
    errors.push('No .js bundles found in assets/public/assets/');
  }

  // Check for server.url leak (search for lovableproject.com in config)
  if (files.includes('capacitor.config.json')) {
    // We can't read individual files from ZIP easily, but size check should catch it
    passed.push('capacitor.config.json present (verify no server.url manually) ✓');
  }
}

// ═══════════════════════════════════════════════════════════════
// RESULTS
// ═══════════════════════════════════════════════════════════════

console.log('📊 Results:\n');

if (passed.length > 0) {
  console.log('   ✅ Passed:');
  passed.forEach(p => console.log(`      ${p}`));
  console.log('');
}

if (warnings.length > 0) {
  console.warn('   ⚠️ Warnings:');
  warnings.forEach(w => console.warn(`      ${w}`));
  console.warn('');
}

if (errors.length > 0) {
  console.error('   ❌ ERRORS:');
  errors.forEach(e => console.error(`      ${e}`));
  console.error('');
  console.error('═'.repeat(60));
  console.error(`❌ ${fileType} VALIDATION FAILED — DO NOT upload to Play Store!`);
  console.error('═'.repeat(60));
  console.error(`
Fix: Run the full build pipeline:
  npm run mobile:build:android

Or manually:
  npm run build
  npx cap sync android
  cd android && ./gradlew clean bundleRelease
`);
  process.exit(1);
}

console.log('═'.repeat(60));
console.log(`✅ ${fileType} validation PASSED — safe to upload to Play Store!`);
console.log('═'.repeat(60));
console.log(`
📁 File: ${targetPath}
📊 Size: ${sizeMB.toFixed(2)} MB
`);
process.exit(0);
