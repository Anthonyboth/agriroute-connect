#!/usr/bin/env bash
# audit-deps.sh — Validates all @capacitor/* packages are pinned to 7.4.4
set -euo pipefail

EXPECTED="7.4.4"
ERRORS=0

echo "=== AgriRoute Capacitor Dependency Audit ==="
echo ""

# --- 1. Check package.json dependencies & devDependencies ---
echo ">> Checking package.json for @capacitor/* entries..."

for field in dependencies devDependencies; do
  entries=$(node -e "
    const pkg = require('./package.json');
    const deps = pkg['$field'] || {};
    Object.entries(deps)
      .filter(([k]) => k.startsWith('@capacitor/'))
      .forEach(([k,v]) => console.log(k + ' ' + v));
  " 2>/dev/null || true)

  while IFS= read -r line; do
    [ -z "$line" ] && continue
    name=$(echo "$line" | awk '{print $1}')
    version=$(echo "$line" | awk '{print $2}')

    if [ "$version" != "$EXPECTED" ]; then
      echo "  ❌ $field: $name is $version (expected exact $EXPECTED)"
      ERRORS=$((ERRORS + 1))
    else
      echo "  ✅ $field: $name = $version"
    fi

    # Check for ^ or ~
    if echo "$version" | grep -qE '^\^|^~'; then
      echo "  ❌ $field: $name uses range operator ($version) — must be exact"
      ERRORS=$((ERRORS + 1))
    fi
  done <<< "$entries"
done

# --- 2. Check overrides ---
echo ""
echo ">> Checking overrides for @capacitor/core..."
override_val=$(node -e "
  const pkg = require('./package.json');
  console.log((pkg.overrides || {})['@capacitor/core'] || 'MISSING');
" 2>/dev/null || echo "MISSING")

if [ "$override_val" = "$EXPECTED" ]; then
  echo "  ✅ overrides @capacitor/core = $override_val"
else
  echo "  ❌ overrides @capacitor/core is '$override_val' (expected $EXPECTED)"
  ERRORS=$((ERRORS + 1))
fi

# --- 3. Check installed node_modules (if present) ---
echo ""
echo ">> Checking installed node_modules for Capacitor 8..."

if [ -d "node_modules" ]; then
  cap8_found=$(find node_modules/@capacitor -name 'package.json' -maxdepth 3 2>/dev/null | while read pj; do
    ver=$(node -e "console.log(require('./$pj').version)" 2>/dev/null || true)
    if echo "$ver" | grep -qE '^8\.'; then
      pkg_name=$(node -e "console.log(require('./$pj').name)" 2>/dev/null || true)
      echo "$pkg_name@$ver"
    fi
  done)

  if [ -n "$cap8_found" ]; then
    echo "  ❌ Capacitor 8 packages found in node_modules:"
    echo "$cap8_found" | sed 's/^/    /'
    ERRORS=$((ERRORS + 1))
  else
    echo "  ✅ No Capacitor 8 packages in node_modules"
  fi
else
  echo "  ⚠️  node_modules not found — skipping installed check"
fi

# --- Result ---
echo ""
if [ "$ERRORS" -gt 0 ]; then
  echo "❌ AUDIT FAILED — $ERRORS issue(s) found"
  exit 1
else
  echo "✅ AUDIT PASSED — all @capacitor/* packages are pinned to $EXPECTED"
  exit 0
fi
