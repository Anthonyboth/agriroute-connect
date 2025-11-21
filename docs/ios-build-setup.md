# Configuração de Build iOS - Codemagic + TestFlight

## ✅ Configuração Atual (RECOMENDADA)

O projeto usa **App Store Connect Integration** automática via Codemagic.

### Vantagens
- ✅ Certificados e provisioning profiles gerenciados automaticamente
- ✅ Não precisa expor API Keys no repositório
- ✅ Rotação automática de credenciais
- ✅ Setup mais simples e seguro

### Como Verificar a Integração

#### 1. No Codemagic Dashboard

1. Acesse: https://codemagic.io/
2. Vá em **Teams & integrations** (canto superior direito)
3. Clique na aba **Integrations**
4. Procure por **App Store Connect**

✅ **Status esperado:** Deve aparecer como "Connected" com o email da conta Apple

❌ **Se não estiver conectado:**
- Clique em "Enable" ou "Connect"
- Faça login com Apple ID que tem acesso ao Apple Developer Program
- Autorize o Codemagic a acessar App Store Connect

#### 2. Verificar Environment Group

1. No projeto, vá em **Settings → Environment variables**
2. Procure pelo grupo **app_store_credentials**
3. Deve conter:
   - `APP_STORE_CONNECT_KEY_IDENTIFIER`
   - `APP_STORE_CONNECT_ISSUER_ID`
   - `APP_STORE_CONNECT_PRIVATE_KEY`

✅ Estes valores são gerenciados automaticamente pela integração

#### 3. Verificar Bundle ID

1. No Apple Developer Portal: https://developer.apple.com/
2. Vá em **Certificates, Identifiers & Profiles**
3. Clique em **Identifiers**
4. Procure por: `app.lovable.f2dbc20153194f90a3cc8dd215bbebba`

✅ O Bundle ID deve estar registrado
✅ Push Notifications capability deve estar habilitada (se necessário)

#### 4. Verificar Team ID

No arquivo `ios/App/exportOptions.plist`:
```xml
<key>teamID</key>
<string>4YULT95XAK</string>
```

✅ Confirme que `4YULT95XAK` é o Team ID correto da sua conta Apple Developer

**Como encontrar seu Team ID:**
1. Acesse: https://developer.apple.com/account
2. Clique no seu nome no topo
3. O Team ID aparece ao lado do nome da equipe

## 🔄 Fluxo de Build Atual

```yaml
1. Install dependencies (npm install)
2. Build web app (npm run build)
3. Sync Capacitor (npx cap sync ios)
4. Fetch signing files (automatic via App Store Connect)
5. Add certificates to keychain
6. Configure code signing
7. Increment build number
8. Build IPA
9. Publish to TestFlight
```

## 📋 Checklist Pré-Build

Antes de fazer push e triggerar o build:

- [ ] App Store Connect integração ativa no Codemagic
- [ ] Bundle ID registrado no Apple Developer Portal
- [ ] Team ID correto no `exportOptions.plist`
- [ ] Grupo `app_store_credentials` configurado
- [ ] Arquivo `ios/App/exportOptions.plist` existe
- [ ] `codemagic-testflight.yaml` aponta para o arquivo correto

## 🚀 Como Triggerar um Build

### Opção 1: Via Git Push
```bash
git add .
git commit -m "Update iOS config"
git push origin main
```

### Opção 2: Via Codemagic Dashboard
1. Acesse o projeto no Codemagic
2. Clique em "Start new build"
3. Selecione o workflow `ios-release-testflight`
4. Clique em "Start build"

## 📊 Monitoramento do Build

Durante o build, você pode acompanhar:

1. **Logs em tempo real** no Codemagic Dashboard
2. **Email de notificação** configurado para `dev@agriroute.com`
3. **Artifacts gerados**: `.ipa` file disponível para download
4. **TestFlight**: App aparece automaticamente no TestFlight após build bem-sucedido

## ⚠️ Erros Comuns

Consulte o arquivo `docs/ios-troubleshooting.md` para resolução de problemas.
