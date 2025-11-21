# 🔧 iOS Build Troubleshooting Guide - Codemagic

## 📋 Índice de Erros Comuns

1. [Erros de Assinatura (Code Signing)](#1-erros-de-assinatura-code-signing)
2. [Erros de Provisioning Profile](#2-erros-de-provisioning-profile)
3. [Erros de Bundle Identifier](#3-erros-de-bundle-identifier)
4. [Erros de Build](#4-erros-de-build)
5. [Erros de Upload para TestFlight](#5-erros-de-upload-para-testflight)
6. [Erros de Dependências](#6-erros-de-dependências)

---

## 1. Erros de Assinatura (Code Signing)

### ❌ Erro: "No signing certificate found"

**Mensagem típica:**
```
error: No signing certificate "iOS Distribution" found
```

**Causa:** Certificado não foi baixado ou não está no keychain

**Solução:**
1. Verifique se a integração App Store Connect está ativa
2. No Codemagic, vá em Teams → Integrations → App Store Connect
3. Reconecte se necessário
4. No script, adicione logs para debug:
```yaml
- name: Debug certificates
  script: |
    security find-identity -v -p codesigning
```

---

### ❌ Erro: "Signing for requires a development team"

**Mensagem típica:**
```
Signing for "App" requires a development team. Select a development team in the Signing & Capabilities editor.
```

**Causa:** Team ID não está configurado corretamente

**Solução:**
1. Verifique o `exportOptions.plist`:
```xml
<key>teamID</key>
<string>4YULT95XAK</string>
```
2. Confirme que o Team ID está correto em https://developer.apple.com/account
3. Se necessário, atualize o Team ID no arquivo

---

### ❌ Erro: "No non-expired App Store profile found"

**Mensagem típica:**
```
error: No non-expired App Store provisioning profiles matching "com.example.app" found
```

**Causa:** Provisioning profile expirado ou não encontrado

**Solução:**
1. No Apple Developer Portal, vá em Certificates, Identifiers & Profiles
2. Clique em Profiles → App Store
3. Verifique se há profile válido para o Bundle ID
4. Se expirado, delete e deixe o Codemagic recriar:
```yaml
app-store-connect fetch-signing-files \
  $BUNDLE_ID \
  --type IOS_APP_STORE \
  --create  # ← Este flag recria se necessário
```

---

## 2. Erros de Provisioning Profile

### ❌ Erro: "Profile doesn't include signing certificate"

**Mensagem típica:**
```
error: Provisioning profile "match AppStore" doesn't include signing certificate
```

**Causa:** Descompasso entre certificado e provisioning profile

**Solução:**
1. Delete o profile no Apple Developer Portal
2. No Codemagic, force recriação:
```yaml
- name: Force recreate profiles
  script: |
    app-store-connect fetch-signing-files \
      $BUNDLE_ID \
      --type IOS_APP_STORE \
      --create
```

---

### ❌ Erro: "Provisioning profile expired"

**Solução rápida:**
1. Acesse Apple Developer Portal
2. Vá em Profiles
3. Delete profiles expirados
4. Deixe o Codemagic recriar automaticamente

---

## 3. Erros de Bundle Identifier

### ❌ Erro: "An App ID with Identifier already exists"

**Causa:** Bundle ID já registrado mas não acessível

**Solução:**
1. Verifique se você tem acesso ao Bundle ID no Apple Developer Portal
2. Confirme que o Team ID está correto
3. Se for outro Team, use um Bundle ID diferente

---

### ❌ Erro: "Bundle identifier mismatch"

**Mensagem típica:**
```
The bundle identifier in the embedded.mobileprovision doesn't match the bundle identifier in the app
```

**Solução:**
1. Verifique `ios/App/App/Info.plist`:
```xml
<key>CFBundleIdentifier</key>
<string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
```
2. Verifique `ios/App/App.xcodeproj/project.pbxproj`:
```
PRODUCT_BUNDLE_IDENTIFIER = app.lovable.f2dbc20153194f90a3cc8dd215bbebba;
```
3. Garanta que todos os lugares usam o mesmo Bundle ID

---

## 4. Erros de Build

### ❌ Erro: "Command PhaseScriptExecution failed"

**Causa comum:** Script de Capacitor falhando

**Solução:**
```yaml
- name: Debug Capacitor sync
  script: |
    npm run build
    ls -la dist/  # Verifica se build gerou arquivos
    npx cap sync ios --verbose
```

---

### ❌ Erro: "Library not found"

**Mensagem típica:**
```
ld: library not found for -lPods-App
```

**Causa:** CocoaPods não instalado corretamente

**Solução:**
```yaml
- name: Install CocoaPods dependencies
  script: |
    cd ios/App
    pod install --repo-update
```

---

### ❌ Erro: "The archive does not contain an iOS App"

**Causa:** IPA foi gerado incorretamente

**Solução:**
1. Verifique se o `exportOptions.plist` está correto
2. Confirme que o caminho do arquivo está certo:
```yaml
--export-options-plist ios/App/exportOptions.plist
```
3. Verifique se o arquivo existe:
```yaml
- name: Verify export options
  script: |
    cat ios/App/exportOptions.plist
```

---

## 5. Erros de Upload para TestFlight

### ❌ Erro: "Invalid Swift Support"

**Mensagem típica:**
```
ERROR ITMS-90426: "Invalid Swift Support. The bundle contains an invalid implementation of Swift."
```

**Solução:**
Adicione no `exportOptions.plist`:
```xml
<key>stripSwiftSymbols</key>
<true/>
```

---

### ❌ Erro: "Missing compliance"

**Mensagem típica:**
```
Missing Compliance. This app is missing export compliance information.
```

**Solução:**
Adicione no `ios/App/App/Info.plist`:
```xml
<key>ITSAppUsesNonExemptEncryption</key>
<false/>
```

---

### ❌ Erro: "Invalid version number"

**Causa:** Version/Build number inválido

**Solução:**
1. Verifique `ios/App/App.xcodeproj/project.pbxproj`:
```
MARKETING_VERSION = 1.0.0;
CURRENT_PROJECT_VERSION = 1;
```
2. Use o script de incremento:
```yaml
- name: Increment build number
  script: |
    cd ios/App
    agvtool new-version -all $(($BUILD_NUMBER + 1))
```

---

## 6. Erros de Dependências

### ❌ Erro: "npm ERR! missing script: build"

**Solução:**
Verifique se `package.json` tem:
```json
{
  "scripts": {
    "build": "vite build"
  }
}
```

---

### ❌ Erro: "Module not found: @capacitor/ios"

**Solução:**
```yaml
- name: Install Capacitor dependencies
  script: |
    npm install @capacitor/ios @capacitor/core @capacitor/cli
```

---

## 🔍 Como Debuggar Builds

### 1. Adicionar logs detalhados

```yaml
- name: Debug environment
  script: |
    echo "=== Node version ==="
    node --version
    echo "=== NPM version ==="
    npm --version
    echo "=== Xcode version ==="
    xcodebuild -version
    echo "=== Available certificates ==="
    security find-identity -v -p codesigning
    echo "=== Installed profiles ==="
    ls -la ~/Library/MobileDevice/Provisioning\ Profiles/
```

### 2. Verificar arquivos gerados

```yaml
- name: Verify build artifacts
  script: |
    echo "=== Web build output ==="
    ls -la dist/
    echo "=== iOS project ==="
    ls -la ios/App/
    echo "=== Generated IPA ==="
    find . -name "*.ipa" -type f
```

### 3. Exportar logs completos

No `codemagic.yaml`, adicione:
```yaml
artifacts:
  - build/ios/ipa/*.ipa
  - /tmp/xcodebuild_logs/*.log
  - $HOME/Library/Logs/gym/*.log
```

---

## 📞 Quando Escalar para Suporte

Se nenhuma solução acima funcionar:

1. **Codemagic Support:**
   - Email: support@codemagic.io
   - Docs: https://docs.codemagic.io/

2. **Apple Developer Support:**
   - https://developer.apple.com/support/

3. **Informações para incluir no ticket:**
   - Build logs completos
   - Screenshot do erro
   - Versão do Xcode usada
   - Bundle ID e Team ID
   - Configuração do `codemagic.yaml`

---

## ✅ Checklist Final Antes de Build

- [ ] App Store Connect integração ativa
- [ ] Bundle ID registrado e acessível
- [ ] Team ID correto no exportOptions.plist
- [ ] Certificados e profiles válidos (não expirados)
- [ ] Dependencies instaladas localmente (teste com `npm run build`)
- [ ] Capacitor sincronizado (teste com `npx cap sync ios`)
- [ ] Versão e build number incrementados
- [ ] Info.plist com configurações corretas

---

## 🚀 Comando para Build Local (Debug)

Para testar antes de fazer push:

```bash
# 1. Build web
npm run build

# 2. Sync Capacitor
npx cap sync ios

# 3. Open no Xcode
npx cap open ios

# 4. No Xcode: Product → Archive
# 5. Validate App
# 6. Distribute App → App Store Connect
```

Se funcionar localmente mas falhar no Codemagic, o problema é de configuração do CI, não do código.
