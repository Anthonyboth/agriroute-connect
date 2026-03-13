

## Diagnosis: "Abre e Fecha" — Root Cause Analysis

### Critical Findings

**1. The logs you shared are STILL from `com.dp.logcatapp` (Logcat reader app), NOT from AgriRoute.**
Every line contains `com.dp.logcatapp/com.dp.logcatapp.activities.MainActivity`. These show the Logcat app switching between foreground/background as you alternate between it and AgriRoute. We have ZERO crash logs from AgriRoute itself.

**2. The app IS running briefly.** The `error_logs` table in Supabase shows entries from today at 18:44, 18:43, 13:17, and 05:39 — all reporting `[SplashScreen] plugin is not implemented on android`. This means JavaScript DID execute, React DID mount, and the error monitoring DID reach Supabase. The app opens, runs for a moment, then closes.

**3. There is a REAL bug in `validate-native-release.mjs`** — line 172 has a duplicate `const assetFiles = readdirSync(...)` declaration that would crash the script at runtime (SyntaxError: redeclaration of `const assetFiles`). This means the Gradle release gate (`validateNativeRelease`) crashes and blocks ALL release builds. If you're generating debug APKs to bypass this, the debug build skips ALL validation.

**4. The appId mismatch** between `capacitor.config.ts` (`app.lovable.f2dbc20153194f90a3cc8dd215bbebba`) and your production `signing.properties` (`com.agriroute.connect`) does NOT cause crashes. The appId is metadata — Android uses the manifest's fully-qualified class names (FRT-065 fix). But it should be aligned for consistency.

### What's likely causing "abre e fecha"

Based on the evidence (app loads briefly, JS runs, SplashScreen error fires, then closes), the most likely causes:

- **Missing/corrupt web assets in the APK** — the debug build doesn't validate this
- **SplashScreen plugin not synced** — the app tries to hide splash, plugin throws, and something in the error chain closes the app
- **React error boundary catching an unhandled error** and calling `window.location.reload()` — which in native creates a flash/close loop

### Plan (both stability fix + monitoring in parallel)

**Step 1: Fix duplicate const in validate-native-release.mjs**
Remove the duplicated line 172 so the release preflight actually runs.

**Step 2: Add pre-React diagnostic in index.html**
Inject a tiny inline `<script>` that runs BEFORE React and reports to Telegram if the WebView loaded but React never painted. This will tell us definitively whether the crash is in WebView, in React boot, or in a specific component.

```text
WebView loads index.html
  └─ inline <script> fires → sets __webviewLoaded = true
  └─ setTimeout(8s) → if React hasn't painted → POST to telegram-error-notifier
  └─ React mounts → clears timeout
```

**Step 3: Suppress SplashScreen error propagation on native**
The error `"SplashScreen" plugin is not implemented on android` is being caught by `useSplashScreen` (console.warn) but is ALSO being intercepted by the global window error handler and `usePanelErrorTelegramReporter`, which calls `ErrorMonitoringService.captureError`. This creates noise and may trigger error boundary recovery. Ensure this error is fully suppressed in ALL error interceptors.

**Step 4: Register FRT-077 in regression shield**
Document: pre-React diagnostic for native WebView, duplicate const fix, and SplashScreen error suppression.

### Files to modify
- `scripts/validate-native-release.mjs` — remove duplicate `const assetFiles`
- `index.html` — add inline pre-React diagnostic script
- `src/hooks/useNativeCrashMonitor.ts` — add pre-React boot telemetry hook
- `src/hooks/useRegressionShield.ts` — add FRT-077

### What you MUST do after this fix
1. `git pull` the changes
2. Run `npm run mobile:sync:android:release` — confirm it passes with 0 errors
3. Generate APK: `cd android && ./gradlew assembleDebug`
4. Install and test. If it still flashes, the diagnostic will send a Telegram message showing EXACTLY where it crashes (WebView, React boot, or component)
5. Share that Telegram message here

