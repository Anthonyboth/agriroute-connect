

## Plano: Desbloquear cadastro quando permissão de localização falha no Android (APK desatualizado)

### Diagnóstico

O erro "Missing the following permissions in AndroidManifest.xml" ocorre porque o APK instalado localmente **não foi reconstruído após o último `npx cap sync`**. As permissões existem no `AndroidManifest.xml` do repositório, mas o APK local está desatualizado. Isso é um problema de build, não de código.

**Fluxo do bug:**
1. Usuário clica "Ativar" no `LocationPermission`
2. `requestPermissionSafe()` chama `Geolocation.requestPermissions()`
3. Capacitor nativo loga `console.error` com "Missing the following permissions" (bridge nativa)
4. O catch faz fallback para WebView geolocation, que também falha
5. `showGPSToast('NO_PERMISSION')` dispara `toast.error`
6. O `toast.error` é interceptado pelo `usePanelErrorTelegramReporter` e enviado ao Telegram
7. Cadastro fica bloqueado esperando localização

**O que já funciona corretamente:**
- O fallback WebView já existe em `requestPermissionSafe()` (linha 152-168)
- O `useLocationSecurityMonitor` já detecta manifest issues e usa WebView fallback (linha 249)
- As permissões estão corretas no `AndroidManifest.xml`
- iOS está configurado corretamente (Info.plist com todas as usage descriptions)

### Mudanças

| Arquivo | Mudança |
|---|---|
| `src/components/LocationPermission.tsx` | Quando `requestPermissionSafe()` falhar, permitir prosseguir sem localização com aviso. Não bloquear cadastro. |
| `src/lib/registration-policy.ts` | Tornar `localizacao` um requisito "soft" — aviso, não bloqueio |
| `src/hooks/usePanelErrorTelegramReporter.ts` | Adicionar "Missing the following permissions" e "AndroidManifest" ao `IGNORED_PATTERNS` |
| `src/integrations/supabase/client.ts` | Adicionar "Missing the following permissions" ao filtro de `console.error` nativo |
| `src/utils/capacitorPermissions.ts` | Suprimir `console.error` para erros de permissão (usar `console.warn`) |
| `src/hooks/useRegressionShield.ts` | Adicionar FRT-066 (localização não deve bloquear cadastro quando APK desatualizado) |

### Detalhamento

**1. LocationPermission.tsx — Não bloquear cadastro**

Quando `requestPermissionSafe()` retorna `false`, marcar `locationEnabled = false` mas NÃO impedir que o botão "Finalizar Cadastro" funcione. O componente mostrará badge "Indisponível" em vez de bloquear. A localização será solicitada novamente na primeira vez que o usuário acessar o dashboard.

**2. registration-policy.ts — Localização como requisito soft**

Remover `'localizacao'` dos requisitos obrigatórios do step 3. A localização será solicitada após o cadastro, não durante. Isso desbloqueia o cadastro para motoristas cujo APK não tem as permissões sincronizadas.

**3. Supressão de alertas falsos**

Adicionar aos filtros de ambos os interceptores:
- `"Missing the following permissions"`
- `"AndroidManifest"`

Isso evita que erros de APK desatualizado disparem alertas no Telegram.

**4. capacitorPermissions.ts — Downgrade para warn**

Trocar `console.error` por `console.warn` nos catches de permissão, já que são situações esperadas em APKs não sincronizados.

**5. Regression Shield — FRT-066**

Documentar que localização NÃO deve bloquear cadastro quando a falha é de APK desatualizado, e que erros de "Missing permissions in AndroidManifest" devem ser suprimidos nos reporters.

### iOS — Verificação

O `Info.plist` já contém todas as chaves necessárias:
- `NSLocationWhenInUseUsageDescription`
- `NSLocationAlwaysUsageDescription`
- `NSLocationAlwaysAndWhenInUseUsageDescription`
- `NSCameraUsageDescription`
- `NSPhotoLibraryUsageDescription`
- `ITSAppUsesNonExemptEncryption` = false

Não há mudança necessária para iOS. O `AppDelegate.swift` com pinch-to-zoom também está correto.

### Resultado

- Cadastro NUNCA é bloqueado por falha de permissão de localização
- Localização é solicitada após cadastro, no primeiro acesso ao dashboard
- Erros de APK desatualizado não disparam alertas no Telegram
- iOS permanece inalterado (já funciona)

