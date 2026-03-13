# 🚀 AgriRoute Release Checklist

**Version:** 1.0.0  
**Last Updated:** 2026-01-25

## Pre-Release Validation

Before ANY release, validate ALL items below in ALL environments:
- [ ] **Web Preview** (Lovable sandbox)
- [ ] **Web Production** (agriroute-connect.com.br)
- [ ] **Android** (Capacitor build)
- [ ] **iOS** (Capacitor build)

---

## 1️⃣ Build Verification

### Web Production
- [ ] Open View Source (`Ctrl+U`) and verify:
  - [ ] Script tags reference `/assets/*.js` (NOT `/src/main.tsx`)
  - [ ] CSS links reference `/assets/*.css`
  - [ ] No raw TypeScript/JSX in HTML
  
- [ ] Open Network tab (`F12` → Network) and verify:
  - [ ] All `/assets/*.js` return `Content-Type: application/javascript`
  - [ ] All `/assets/*.css` return `Content-Type: text/css`
  - [ ] NO chunks return 404 or 403
  - [ ] NO HTML being served for JS/CSS files

### Console Check
- [ ] Open Console (`F12` → Console) and verify:
  - [ ] `window.__APP_BUILD_ID` returns a value
  - [ ] No "ChunkLoadError" or "Unexpected token <" errors
  - [ ] `[ENV] Environment validated` message present

---

## 2️⃣ Core Flows

### Authentication
- [ ] **Login Flow**
  - [ ] Email/password login works
  - [ ] Google OAuth works (web only)
  - [ ] Redirect to correct dashboard after login
  - [ ] No stuck loading states

- [ ] **Signup Flow**
  - [ ] "Cadastrar" button opens modal (not stuck)
  - [ ] Role selection works
  - [ ] Form validation works
  - [ ] Account creation succeeds
  - [ ] Email confirmation (if enabled)

- [ ] **Logout Flow**
  - [ ] "Sair" button works
  - [ ] No toast on logout
  - [ ] Redirects to /auth
  - [ ] Session cleared

### Producer Dashboard
- [ ] **Counters**
  - [ ] "Abertos" shows ONLY open freights (not services)
  - [ ] "Serviços" shows ONLY open services
  - [ ] Counters match tab contents exactly

- [ ] **Create Freight (Rural)**
  - [ ] Modal opens without overlay stuck
  - [ ] City search works (no duplicates like "Primavera do Leste")
  - [ ] All steps complete successfully
  - [ ] Freight appears in "Abertos" tab

- [ ] **Create Freight (Urban: Moto/Guincho/Mudança)**
  - [ ] Service type selection works
  - [ ] Form submits successfully
  - [ ] Appears in correct tab

- [ ] **Cancel Freight**
  - [ ] Cancel button works
  - [ ] Counter updates correctly
  - [ ] Item removed from list

- [ ] **Cancel Service**
  - [ ] Cancel button works
  - [ ] "Serviços" counter updates (not "Abertos")
  - [ ] Item removed from list

### Driver Dashboard
- [ ] Dashboard loads without errors
- [ ] Freight search works
- [ ] Proposal submission works

### Fiscal Module
- [ ] **Certificate Upload**
  - [ ] Upload A1 certificate works
  - [ ] UI updates to show "Configured" status
  - [ ] No need to refresh page

---

## 3️⃣ City/Location Search

- [ ] **No Duplicates**
  - [ ] Search "Primavera do Leste" → shows ONLY ONE result
  - [ ] Search "Cuiabá" → shows ONLY ONE result
  - [ ] All cities show format: "Cidade — UF" (not full state name)

- [ ] **CEP Search**
  - [ ] Enter CEP → auto-fills city/state
  - [ ] City displays correctly

---

## 4️⃣ Error Handling

- [ ] **No Generic Errors**
  - [ ] No "Error: undefined" toasts
  - [ ] All error messages in Portuguese
  - [ ] All error messages have context

- [ ] **No Stuck States**
  - [ ] No permanent loading spinners
  - [ ] No stuck modal backdrops
  - [ ] No frozen screens (8s timeout fallback works)

---

## 5️⃣ Platform-Specific

### Android (Capacitor)
```bash
npm run mobile:sync:android:release
```
- [ ] Comando acima executado sem erro (build + sync + preflight)
- [ ] `android/app/src/main/assets/capacitor.config.json` existe
- [ ] `android/app/src/main/assets/capacitor.config.json` **não** contém `server.url`
- [ ] App abre 3x seguidas sem white screen/flicker/close
- [ ] Splash screen transitions smoothly
- [ ] Landing/login/cadastro abrem após cold start
- [ ] Deep links work
- [ ] Camera/GPS permissions work (if used)

### Android Smoke (obrigatório antes da Play Store)
- [ ] Abrir app, fechar totalmente, reabrir (3 ciclos)
- [ ] Testar rota inicial + login/cadastro
- [ ] Confirmar que não houve reload loop no boot

### iOS (Capacitor)
```bash
npx cap sync ios
npx cap run ios
```
- [ ] App launches without white screen
- [ ] Splash screen matches Android
- [ ] Safe area insets work
- [ ] All navigation works
- [ ] Touch targets are accessible

---

## 6️⃣ Performance

- [ ] Landing page loads < 3s on 4G
- [ ] Dashboard loads < 2s after login
- [ ] No visible layout shifts (CLS)
- [ ] Images lazy load correctly

---

## Sign-Off

| Platform | Tester | Date | Status |
|----------|--------|------|--------|
| Web Preview | | | ⬜ |
| Web Production | | | ⬜ |
| Android | | | ⬜ |
| iOS | | | ⬜ |

### Release Approved By:
- [ ] Development Lead
- [ ] QA Lead
- [ ] Product Owner

---

## Emergency Rollback

If ANY critical issue is found post-release:

1. **Web:** Revert to previous Lovable version via History
2. **Mobile:** Pause rollout / rollback in Play Console immediately if crash rate spikes
3. **Mobile:** Block new AAB uploads until `mobile:preflight:release` passes again
4. **Database:** Migrations are non-destructive, no rollback needed

---

## Notes

_Add any release-specific notes here:_

```
- 
```
