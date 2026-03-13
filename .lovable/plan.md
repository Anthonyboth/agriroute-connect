

## Analysis: AAB Local Crash ("abre e fecha")

### What I found

After reviewing the entire codebase, here is the status:

**Already hardened (working correctly):**
- `validate-native-release.mjs` validates index.html, plugins.json, plugin version alignment, AAB size
- Gradle gates block release if assets are missing
- `signing.properties` shield prevents misconfigured builds
- `BrowserRouter` works fine with Capacitor 7.x (uses internal localhost server, not `file://`)
- SplashScreen fallback has try/catch, plugin availability check
- Native platform detection skips PWA recovery correctly

**The logs you shared are from `com.dp.logcatapp` (Logcat reader app), not from AgriRoute.** They show the Logcat app starting up, not the crash itself.

### Proposed improvements

Two small hardening additions to `validate-native-release.mjs`:

1. **Validate index.html content** (not just existence) — detect empty/corrupt files where the file exists but has no React root
2. **Validate compiled assets directory** — ensure `assets/public/assets/` contains actual JS/CSS files

### Technical details

**File: `scripts/validate-native-release.mjs`**

Add after the existing `hasAndroidIndexHtml` check:
- Read `index.html` content and verify it contains `<div id="root">` 
- Check `android/app/src/main/assets/public/assets/` directory exists and has `.js` files

These are ~15 lines of code, zero risk to the app.

### What you need to do to debug the actual crash

To capture the **real** AgriRoute crash logs, run:
```
adb logcat --pid=$(adb shell pidof -s com.agriroute.connect) 
```
Or filter by your package:
```
adb logcat | grep -i "agriroute\|capacitor\|WebView\|chromium"
```

The logs you shared show `com.dp.logcatapp` (a log viewer app), not your app's crash output.

