# 📱 iOS Build Pipeline - GitHub Actions + Fastlane

## Arquitetura do Pipeline

O pipeline de build iOS do AgriRoute Connect utiliza uma stack moderna e automatizada:

```
GitHub Push → GitHub Actions → Fastlane → Match → Xcode Build → TestFlight Upload
```

### Componentes Principais

1. **GitHub Actions** - Orquestrador de CI/CD
2. **Fastlane** - Automação de build e deploy iOS
3. **Fastlane Match** - Gerenciamento centralizado de certificados
4. **App Store Connect API** - Autenticação sem senha

---

## Fluxo Detalhado de Build

### 1️⃣ Trigger (Gatilho)
```yaml
on:
  workflow_dispatch:  # Manual trigger
  push:
    branches: [main]  # Auto-trigger em push para main
```

### 2️⃣ Preparação do Ambiente
```yaml
- Setup Node.js 20
- Install npm dependencies
- Build web assets (Vite)
- Sync Capacitor iOS project
```

### 3️⃣ Setup Ruby + Fastlane
```yaml
- Install Ruby 3.2
- Bundle install (Gemfile dependencies)
- Cache Bundler gems
```

### 4️⃣ Gerenciamento de Certificados (Match)
```bash
bundle exec fastlane match_certificates
```

**O que acontece:**
- Clona repositório de certificados (readonly)
- Baixa certificados de distribuição (.cer, .p12)
- Baixa provisioning profiles (.mobileprovision)
- Instala no keychain temporário do CI

**Repositório usado:**
```
https://github.com/Anthonyboth/agriroute-connect-certificates-public.git
```

### 5️⃣ Build do App (gym)
```bash
bundle exec fastlane build_ios
```

**Configuração:**
- Workspace: `App.xcworkspace`
- Scheme: `App`
- Configuration: `Release`
- Export method: `app-store`
- Output: `App.ipa`

### 6️⃣ Upload para TestFlight
```bash
bundle exec fastlane upload_testflight
```

**Parâmetros:**
- `skip_waiting_for_build_processing: true` - Não aguarda processamento
- `skip_submission: true` - Não submete para review automático

---

## Estrutura do Fastfile

### Lane: `match_certificates`
```ruby
lane :match_certificates do
  create_keychain(
    name: "ci_keychain",
    password: "ci_keychain_password",
    default_keychain: true,
    unlock: true,
    timeout: 3600
  )

  match(
    type: "appstore",
    git_url: "https://github.com/Anthonyboth/agriroute-connect-certificates-public.git",
    git_branch: "main",
    app_identifier: "app.lovable.f2dbc20153194f90a3cc8dd215bbebba",
    team_id: "4YULT95XAK",
    readonly: true,
    shallow_clone: true,
    skip_certificate_matching: true,
    keychain_name: "ci_keychain",
    keychain_password: "ci_keychain_password",
    api_key: create_api_key
  )
end
```

**Parâmetros importantes:**
- `readonly: true` - Não cria novos certificados
- `shallow_clone: true` - Clone rápido do repo
- `skip_certificate_matching: true` - Não valida matching de certificados
- `skip_set_partition_list: true` - Fix para keychain no CI

### Lane: `build_ios`
```ruby
lane :build_ios do
  match_certificates
  
  gym(
    workspace: "App.xcworkspace",
    scheme: "App",
    configuration: "Release",
    export_method: "app-store",
    api_key: create_api_key,
    export_options: {
      provisioningProfiles: {
        "app.lovable.f2dbc20153194f90a3cc8dd215bbebba" => "match AppStore app.lovable.f2dbc20153194f90a3cc8dd215bbebba"
      }
    }
  )
end
```

### Lane: `testflight`
```ruby
lane :testflight do
  build_ios
  upload_testflight
end
```

---

## Autenticação via App Store Connect API

### Helper Function: `create_api_key`
```ruby
def create_api_key
  app_store_connect_api_key(
    key_id: ENV["APPSTORE_CONNECT_KEY_ID"],
    issuer_id: ENV["APPSTORE_CONNECT_ISSUER_ID"],
    key_content: ENV["APPSTORE_CONNECT_PRIVATE_KEY"],
    in_house: false
  )
end
```

**Benefícios:**
✅ Sem senha Apple ID  
✅ Sem 2FA  
✅ Mais seguro (revogável via App Store Connect)  
✅ Ideal para CI/CD

---

## Otimizações de Performance

### Caching Estratégico
```yaml
# Cache CocoaPods
- uses: actions/cache@v4
  with:
    path: ios/App/Pods
    key: ${{ runner.os }}-pods-${{ hashFiles('ios/App/Podfile.lock') }}

# Cache Xcode Derived Data
- uses: actions/cache@v4
  with:
    path: ~/Library/Developer/Xcode/DerivedData
    key: ${{ runner.os }}-derived-data-${{ hashFiles('ios/App/Podfile.lock') }}
```

### Melhorias Aplicadas
1. **Xcode 16.2 explícito** - Versão fixa para builds consistentes
2. **Cache agressivo** - Node modules, Pods, DerivedData
3. **Paralelização** - Steps independentes executam em paralelo quando possível
4. **Skip pod repo-update** - Usa cache de specs do CocoaPods

---

## Tempo Estimado de Build

| Fase | Tempo (Cold) | Tempo (Cached) |
|------|--------------|----------------|
| Setup + Deps | 2-3 min | 30-45 seg |
| Vite Build | 30-60 seg | 30-60 seg |
| CocoaPods | 2-3 min | 15-30 seg |
| Xcode Build | 5-8 min | 3-5 min |
| TestFlight Upload | 1-2 min | 1-2 min |
| **TOTAL** | **10-17 min** | **6-9 min** |

---

## Troubleshooting

### ❌ Erro: "No code signing identity found"
**Solução:** Verificar se certificados foram baixados corretamente pelo Match.
```bash
# Debug no CI
security find-identity -v -p codesigning
```

### ❌ Erro: "Provisioning profile doesn't match"
**Solução:** Verificar `export_options` no gym() - deve apontar para profile correto.

### ❌ Erro: "API Key authentication failed"
**Solução:** Verificar se secrets do GitHub estão corretos (KEY_ID, ISSUER_ID, PRIVATE_KEY).

### ❌ Erro: "Keychain access denied"
**Solução:** Adicionar `skip_set_partition_list: true` no match().

---

## Monitoramento

### Logs Importantes
```bash
# Ver logs do Fastlane no GitHub Actions
Actions → Workflow run → "Run Fastlane TestFlight" step

# Verificar status no App Store Connect
https://appstoreconnect.apple.com/apps/{app-id}/testflight
```

### Notificações
- ✅ Build sucesso → IPA disponível em Artifacts
- ❌ Build falha → Email + GitHub notification
- 📱 TestFlight upload → Email do App Store Connect

---

## Próximos Passos

1. **Monitorar primeira build** - Verificar se todos os caches funcionam
2. **Testar workflow_dispatch** - Trigger manual para validar
3. **Configurar branch protection** - Exigir build success antes de merge
4. **Adicionar testes automatizados** - XCTest + UI Tests (futuro)

---

## Referências

- [Fastlane Match Documentation](https://docs.fastlane.tools/actions/match/)
- [App Store Connect API Keys](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)
- [GitHub Actions for iOS](https://docs.github.com/en/actions/deployment/deploying-xcode-applications)
