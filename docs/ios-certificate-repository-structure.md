# 📁 Estrutura do Repositório de Certificados iOS

## Visão Geral

O repositório `agriroute-connect-certificates-public` contém todos os certificados e provisioning profiles necessários para o build iOS via Fastlane Match.

**Repositório:** https://github.com/Anthonyboth/agriroute-connect-certificates-public

---

## Estrutura de Pastas Esperada

```
agriroute-connect-certificates-public/
│
├── certs/
│   ├── distribution/
│   │   ├── ABC123DEFG.cer              # Certificado de distribuição
│   │   └── ABC123DEFG.p12              # Chave privada do certificado
│   │
│   └── development/                     # (Opcional - para builds de desenvolvimento)
│       ├── XYZ987HIJK.cer
│       └── XYZ987HIJK.p12
│
├── profiles/
│   ├── appstore/
│   │   └── AppStore_app.lovable.f2dbc20153194f90a3cc8dd215bbebba.mobileprovision
│   │
│   └── development/                     # (Opcional - para builds de desenvolvimento)
│       └── Development_app.lovable.f2dbc20153194f90a3cc8dd215bbebba.mobileprovision
│
├── match_version.txt                    # Versão do Fastlane Match utilizada
│
└── README.md                            # (Opcional - documentação do repo)
```

---

## Detalhamento dos Arquivos

### 📄 certs/distribution/*.cer
**O que é:** Certificado de distribuição Apple  
**Formato:** X.509 certificate (base64 encoded)  
**Uso:** Assinar o app para distribuição na App Store  
**Como obter:** Gerado via Apple Developer Portal ou Fastlane Match

### 🔑 certs/distribution/*.p12
**O que é:** Chave privada do certificado de distribuição  
**Formato:** PKCS#12 archive  
**Uso:** Contém a chave privada necessária para assinar o app  
**Como obter:** Gerado junto com o certificado via Match  
**Segurança:** ⚠️ NUNCA compartilhar publicamente (mesmo em repo privado, use criptografia)

### 📱 profiles/appstore/*.mobileprovision
**O que é:** Provisioning Profile de App Store  
**Formato:** Plist (XML) assinado pela Apple  
**Uso:** Define permissões e entitlements do app  
**Nomear como:** `AppStore_{BUNDLE_ID}.mobileprovision`  
**Exemplo:** `AppStore_app.lovable.f2dbc20153194f90a3cc8dd215bbebba.mobileprovision`

### 📋 match_version.txt
**O que é:** Arquivo de controle de versão do Match  
**Conteúdo:** Versão do Fastlane Match usada (exemplo: `2.220.0`)  
**Uso:** Garantir compatibilidade entre versões do Match

---

## Como Verificar a Estrutura

### Opção 1: Via GitHub Web Interface
1. Acesse: https://github.com/Anthonyboth/agriroute-connect-certificates-public
2. Navegue pelas pastas `certs/` e `profiles/`
3. Confirme que os arquivos existem

### Opção 2: Via Git Clone Local
```bash
# Clone o repositório
git clone https://github.com/Anthonyboth/agriroute-connect-certificates-public.git
cd agriroute-connect-certificates-public

# Liste a estrutura
tree -L 3

# Verifique se os arquivos necessários existem
ls -la certs/distribution/
ls -la profiles/appstore/
```

### Opção 3: Via Fastlane Match
```bash
# No diretório ios/App do projeto
cd ios/App

# Execute Match em modo readonly para verificar
bundle exec fastlane match appstore --readonly
```

---

## Validação dos Certificados

### Verificar Certificado (.cer)
```bash
# Ver detalhes do certificado
openssl x509 -in certs/distribution/ABC123DEFG.cer -text -noout

# Verificar data de expiração
openssl x509 -in certs/distribution/ABC123DEFG.cer -noout -dates
```

**Campos importantes:**
- **Subject:** Deve conter o nome da equipe Apple Developer
- **Issuer:** Apple Worldwide Developer Relations
- **Validity:** Data de expiração (certificados Apple expiram em 1 ano)

### Verificar Chave Privada (.p12)
```bash
# Verificar se o arquivo p12 é válido
openssl pkcs12 -info -in certs/distribution/ABC123DEFG.p12 -nodes -passin pass:

# ATENÇÃO: Se o p12 tiver senha, substitua por: -passin pass:SUA_SENHA
```

### Verificar Provisioning Profile
```bash
# Ver conteúdo do provisioning profile
security cms -D -i profiles/appstore/AppStore_app.lovable.f2dbc20153194f90a3cc8dd215bbebba.mobileprovision

# Extrair data de expiração
security cms -D -i profiles/appstore/AppStore_app.lovable.f2dbc20153194f90a3cc8dd215bbebba.mobileprovision | grep -A 1 ExpirationDate
```

**Campos importantes:**
- **AppIDName:** Deve ser "AgriRoute Connect" ou similar
- **ApplicationIdentifierPrefix:** Team ID (exemplo: 4YULT95XAK)
- **ExpirationDate:** Data de expiração (profiles expiram em 1 ano)
- **ProvisionedDevices:** Deve estar vazio (app store profiles não têm devices)

---

## Troubleshooting

### ❌ Erro: "Certificate not found in repository"
**Causa:** Certificado não existe ou está em pasta errada  
**Solução:**
1. Verifique se o arquivo `.cer` está em `certs/distribution/`
2. Verifique se o arquivo `.p12` está em `certs/distribution/`
3. Execute `git status` no repo para ver se há arquivos não commitados

### ❌ Erro: "Provisioning profile doesn't match bundle identifier"
**Causa:** Provisioning profile é para outro app  
**Solução:**
1. Extraia o conteúdo do profile: `security cms -D -i <profile>`
2. Verifique se o bundle ID é `app.lovable.f2dbc20153194f90a3cc8dd215bbebba`
3. Gere novo profile no Apple Developer Portal se necessário

### ❌ Erro: "Certificate has expired"
**Causa:** Certificado expirou (validade de 1 ano)  
**Solução:**
1. Verifique data de expiração: `openssl x509 -in <cert> -noout -dates`
2. Revogue certificado antigo no Apple Developer Portal
3. Gere novo certificado via Match: `fastlane match appstore --force`

### ❌ Erro: "Repository is empty"
**Causa:** Nenhum certificado foi gerado ainda  
**Solução:**
1. Execute Match pela primeira vez para gerar certificados:
```bash
cd ios/App
bundle exec fastlane match appstore
```
2. Match irá criar os certificados e commitá-los no repositório

---

## Segurança do Repositório

### ⚠️ Repositório Público vs Privado

**Atual:** Repositório é PÚBLICO (`agriroute-connect-certificates-public`)

**Riscos:**
- Certificados e chaves privadas expostos publicamente
- Qualquer pessoa pode baixar e potencialmente assinar apps maliciosos com seu certificado
- Viola diretrizes de segurança da Apple

**Recomendação:**
1. **Tornar o repositório PRIVADO imediatamente**
2. Ou usar criptografia no Match (password-protected)

### 🔒 Como Proteger com Senha

Editar `ios/App/fastlane/Matchfile`:
```ruby
git_url("https://github.com/Anthonyboth/agriroute-connect-certificates-public.git")
storage_mode("git")
type("appstore")

# Adicionar:
git_basic_authorization(Base64.strict_encode64("USERNAME:PERSONAL_ACCESS_TOKEN"))
```

E no GitHub Actions, adicionar secret:
```yaml
env:
  MATCH_PASSWORD: ${{ secrets.MATCH_PASSWORD }}
```

---

## Manutenção

### Renovar Certificados (Anualmente)
```bash
# Revogar certificados antigos
fastlane match nuke distribution

# Gerar novos certificados
fastlane match appstore --force

# Commit e push
cd agriroute-connect-certificates-public
git add .
git commit -m "Renew distribution certificates"
git push
```

### Adicionar Novo Device (Development)
```bash
# Atualizar provisioning profile com novos devices
fastlane match development --force_for_new_devices
```

---

## Checklist de Configuração Inicial

Ao configurar o repositório pela primeira vez:

- [ ] Criar repositório GitHub (preferencialmente privado)
- [ ] Executar `fastlane match appstore` para gerar certificados
- [ ] Verificar que `certs/distribution/` contém `.cer` e `.p12`
- [ ] Verificar que `profiles/appstore/` contém `.mobileprovision`
- [ ] Verificar que `match_version.txt` existe
- [ ] Adicionar README.md com instruções de uso
- [ ] Configurar branch protection (main branch)
- [ ] Testar clone e uso via CI/CD

---

## Referências

- [Fastlane Match Documentation](https://docs.fastlane.tools/actions/match/)
- [Apple Code Signing Guide](https://developer.apple.com/support/code-signing/)
- [Managing Certificates via API](https://developer.apple.com/documentation/appstoreconnectapi/certificates)
