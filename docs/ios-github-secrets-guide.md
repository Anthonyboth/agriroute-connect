# 🔐 Configurando GitHub Secrets para iOS Build

## Visão Geral

Para o pipeline iOS funcionar, você precisa configurar **3 secrets** no GitHub com credenciais do App Store Connect.

---

## Passo 1: Criar API Key no App Store Connect

### 1.1 Acessar App Store Connect
1. Acesse https://appstoreconnect.apple.com/
2. Faça login com sua conta Apple ID (dev@agrirouteconnect.com ou similar)

### 1.2 Navegar para Chaves de API
1. Clique em **"Usuários e Acesso"** (Users and Access)
2. Selecione a aba **"Chaves de API"** (API Keys)
3. Clique no botão **"+"** para gerar nova chave

### 1.3 Configurar a Chave
- **Nome:** `GitHub Actions CI/CD`
- **Acesso:** Selecione **"Administrador"** ou **"Desenvolvedor"** (Developer)
- Clique em **"Gerar"**

⚠️ **IMPORTANTE:** Após criar, você verá a chave **APENAS UMA VEZ**. Baixe o arquivo `.p8` imediatamente!

### 1.4 Informações Geradas
Após criar, você verá 3 informações essenciais:

| Campo | Exemplo | Onde Usar |
|-------|---------|-----------|
| **Key ID** | `ABC123DEFG` | `APPSTORE_CONNECT_KEY_ID` |
| **Issuer ID** | `12345678-abcd-1234-efgh-123456789012` | `APPSTORE_CONNECT_ISSUER_ID` |
| **Arquivo .p8** | `AuthKey_ABC123DEFG.p8` | `APPSTORE_CONNECT_PRIVATE_KEY` |

📸 **Screenshot:** [App Store Connect API Keys Page]

---

## Passo 2: Converter Arquivo .p8 para String

O arquivo `.p8` precisa ser convertido para uma string de uma linha.

### Opção A: Via Terminal (macOS/Linux)
```bash
# Navegue até a pasta onde o arquivo .p8 foi baixado
cd ~/Downloads

# Visualize o conteúdo do arquivo
cat AuthKey_ABC123DEFG.p8

# Copie todo o conteúdo incluindo as linhas:
# -----BEGIN PRIVATE KEY-----
# (conteúdo base64)
# -----END PRIVATE KEY-----
```

### Opção B: Via Editor de Texto
1. Abra o arquivo `.p8` com TextEdit/Notepad/VS Code
2. Copie **TODO** o conteúdo (incluindo as linhas BEGIN/END)
3. O formato deve ser:
```
-----BEGIN PRIVATE KEY-----
MIGTAgEAMBMGByqGSM49AgEGCCqGSM49AwEHBHkwdwIBAQQg...
(várias linhas de texto base64)
...ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefg=
-----END PRIVATE KEY-----
```

⚠️ **IMPORTANTE:** NÃO remova as quebras de linha! Copie exatamente como está.

---

## Passo 3: Adicionar Secrets no GitHub

### 3.1 Navegar para Secrets
1. Acesse o repositório: https://github.com/Anthonyboth/agriroute-connect
2. Clique em **"Settings"** → **"Secrets and variables"** → **"Actions"**
3. Clique em **"New repository secret"**

📸 **Screenshot:** [GitHub Repository Settings > Secrets]

### 3.2 Adicionar APPSTORE_CONNECT_KEY_ID
- **Name:** `APPSTORE_CONNECT_KEY_ID`
- **Value:** Cole o Key ID (exemplo: `ABC123DEFG`)
- Clique em **"Add secret"**

### 3.3 Adicionar APPSTORE_CONNECT_ISSUER_ID
- **Name:** `APPSTORE_CONNECT_ISSUER_ID`
- **Value:** Cole o Issuer ID (exemplo: `12345678-abcd-1234-efgh-123456789012`)
- Clique em **"Add secret"**

### 3.4 Adicionar APPSTORE_CONNECT_PRIVATE_KEY
- **Name:** `APPSTORE_CONNECT_PRIVATE_KEY`
- **Value:** Cole **TODO** o conteúdo do arquivo .p8 incluindo:
  ```
  -----BEGIN PRIVATE KEY-----
  (todo o conteúdo base64 em múltiplas linhas)
  -----END PRIVATE KEY-----
  ```
- Clique em **"Add secret"**

---

## Passo 4: Verificar Configuração

### 4.1 Lista de Secrets Configurados
Após adicionar os 3 secrets, você deve ver:

```
✅ APPSTORE_CONNECT_KEY_ID
✅ APPSTORE_CONNECT_ISSUER_ID  
✅ APPSTORE_CONNECT_PRIVATE_KEY
```

### 4.2 Testar o Pipeline
1. Vá em **"Actions"** → **"iOS TestFlight Build"**
2. Clique em **"Run workflow"** → **"Run workflow"**
3. Aguarde o build (~10-15 minutos na primeira vez)

Se tudo estiver correto, você verá:
```
✅ Setup Ruby + Fastlane
✅ Install Fastlane dependencies
✅ Run Fastlane TestFlight
✅ Upload IPA artifact
```

---

## Troubleshooting

### ❌ Erro: "Unauthorized - Invalid API Key"
**Causa:** Key ID ou Issuer ID incorretos  
**Solução:**
1. Volte ao App Store Connect → Usuários e Acesso → Chaves de API
2. Verifique o Key ID e Issuer ID exatos
3. Atualize os secrets no GitHub

### ❌ Erro: "Could not parse API key"
**Causa:** Conteúdo do arquivo .p8 foi colado incorretamente  
**Solução:**
1. Baixe o arquivo .p8 novamente (se ainda tiver acesso)
2. Copie o conteúdo **EXATAMENTE** como está (incluindo quebras de linha)
3. Certifique-se de incluir as linhas BEGIN e END

### ❌ Erro: "Insufficient privileges"
**Causa:** API Key sem permissões suficientes  
**Solução:**
1. Volte ao App Store Connect → Chaves de API
2. Clique na chave criada
3. Altere o acesso para **"Desenvolvedor"** ou **"Administrador"**

---

## Segurança

### ✅ Boas Práticas
- **NUNCA** commitar o arquivo `.p8` no repositório
- **NUNCA** compartilhar o arquivo `.p8` publicamente
- Usar secrets do GitHub (valores criptografados)
- Revogar chave antiga ao criar nova

### 🔒 Rotação de Chaves
Se precisar trocar a API Key:
1. Criar nova chave no App Store Connect
2. Atualizar os 3 secrets no GitHub
3. Revogar chave antiga no App Store Connect

### 🚨 Em Caso de Vazamento
1. **Revogue imediatamente** a chave no App Store Connect
2. Crie nova chave
3. Atualize os secrets no GitHub
4. Monitore atividades suspeitas no App Store Connect

---

## Checklist Final

Antes de executar o primeiro build, confirme:

- [ ] Arquivo `.p8` baixado e salvo em local seguro
- [ ] Key ID copiado corretamente
- [ ] Issuer ID copiado corretamente
- [ ] Conteúdo completo do `.p8` colado no secret (incluindo BEGIN/END)
- [ ] Os 3 secrets aparecem na lista do GitHub
- [ ] Permissões da API Key são "Desenvolvedor" ou "Administrador"
- [ ] Certificados já estão no repositório Match (agriroute-connect-certificates-public)

---

## Referências

- [Creating API Keys for App Store Connect API](https://developer.apple.com/documentation/appstoreconnectapi/creating_api_keys_for_app_store_connect_api)
- [Fastlane App Store Connect API](https://docs.fastlane.tools/app-store-connect-api/)
- [GitHub Encrypted Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## Suporte

Se ainda tiver problemas:
1. Verifique logs do GitHub Actions na aba "Actions"
2. Procure por mensagens específicas de erro
3. Consulte a [documentação completa do pipeline](./ios-github-actions-setup.md)
