# Guia de Configuração VAPID Keys - AGRIROUTE

## 🔑 O que são VAPID Keys?

VAPID (Voluntary Application Server Identification) são chaves criptográficas que permitem que o servidor envie notificações push de forma autenticada para os navegadores dos usuários.

## ⚡ Passo 1: Gerar as Chaves

### Opção 1: Usando vapidkeys.com (Recomendado - Mais Fácil)

1. Acesse https://vapidkeys.com/
2. Clique em "Generate new keys"
3. Você verá 3 valores:
   - **Public Key** (chave pública)
   - **Private Key** (chave privada)
   - **Contact Email** (seu email de contato)

### Opção 2: Usando CLI (Terminal)

```bash
# Instalar web-push globalmente
npm install -g web-push

# Gerar chaves
web-push generate-vapid-keys
```

Isso irá gerar:
```
=======================================
Public Key:
BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U

Private Key:
UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls
=======================================
```

## 🔐 Passo 2: Adicionar Secrets no Supabase Edge Functions

1. Acesse o Supabase Dashboard: https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl
2. Navegue para: **Settings** → **Edge Functions** → **Secrets**
3. Adicione os seguintes secrets:

### Secret 1: VAPID_PUBLIC_KEY
- **Nome:** `VAPID_PUBLIC_KEY`
- **Valor:** Cole a Public Key gerada (ex: `BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U`)

### Secret 2: VAPID_PRIVATE_KEY
- **Nome:** `VAPID_PRIVATE_KEY`
- **Valor:** Cole a Private Key gerada (ex: `UUxI4O8-FbRouAevSmBQ6o18hgE4nSG3qwvJTfKc-ls`)

### Secret 3: VAPID_EMAIL (Opcional)
- **Nome:** `VAPID_EMAIL`
- **Valor:** Seu email de contato (ex: `contato@agriroute.com`)

## 📱 Passo 3: Adicionar Public Key no Frontend

1. Abra o arquivo `.env` na raiz do projeto
2. Localize a linha `VITE_VAPID_PUBLIC_KEY=""`
3. Cole a **Public Key** entre as aspas:

```env
VITE_VAPID_PUBLIC_KEY="BEl62iUYgUivxIkv69yViEuiBIa-Ib9-SkvMeAtA3LFgDzkrxZJjSgSnfckjBJuBkr3qBUYIHBQFLXYp5Nksh8U"
```

⚠️ **IMPORTANTE:** Adicione APENAS a **Public Key** no `.env`. NUNCA adicione a Private Key no frontend!

## ✅ Passo 4: Testar a Configuração

### 4.1 Verificar no Frontend

1. Faça login no AGRIROUTE
2. Clique no ícone de sino (🔔) no topo
3. Clique em "Preferências de Notificação"
4. Clique no botão "Ativar Push"
5. Permita notificações quando o navegador solicitar

Se tudo estiver correto, você verá a mensagem: **"Notificações push ativadas com sucesso! 🔔"**

### 4.2 Testar Envio de Push via SQL

Execute no Supabase SQL Editor:

```sql
-- Substitua 'SEU_USER_ID' pelo ID do seu usuário
SELECT extensions.http_post(
  'https://shnvtxejjecbnztdbbbl.supabase.co/functions/v1/send-push-notification',
  jsonb_build_object(
    'user_ids', ARRAY['SEU_USER_ID'],
    'title', '🔔 Teste de Push Notification',
    'message', 'Se você recebeu esta notificação, VAPID está configurado corretamente!',
    'type', 'info',
    'data', jsonb_build_object(),
    'url', '/',
    'requireInteraction', false
  ),
  jsonb_build_object(
    'apikey', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNobnZ0eGVqamVjYm56dGRiYmJsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTczNjAzMzAsImV4cCI6MjA3MjkzNjMzMH0.qcYO3vsj8KOmGDGM12ftFpr0mTQP5DB_0jAiRkPYyFg',
    'Content-Type', 'application/json'
  )
);
```

Você deverá receber uma notificação push no seu navegador!

## 🔍 Troubleshooting

### Problema: "VAPID key não configurada"

**Solução:**
1. Verifique se a `VITE_VAPID_PUBLIC_KEY` está no arquivo `.env`
2. Reinicie o servidor de desenvolvimento: `npm run dev`
3. Limpe o cache do navegador e tente novamente

### Problema: "Notificações push não chegam"

**Solução:**
1. Verifique se as 3 secrets estão configuradas no Supabase:
   - `VAPID_PUBLIC_KEY`
   - `VAPID_PRIVATE_KEY`
   - `VAPID_EMAIL` (opcional)
2. Verifique se as chaves pública no frontend e no Supabase são **exatamente iguais**
3. Verifique os logs da Edge Function `send-push-notification`:
   - Supabase Dashboard → Functions → send-push-notification → Logs

### Problema: "Permissão negada pelo navegador"

**Solução:**
1. Abra as configurações do navegador
2. Procure por "Notificações" ou "Permissions"
3. Encontre o site AGRIROUTE
4. Altere para "Permitir notificações"
5. Recarregue a página e tente ativar novamente

## 📊 Monitoramento

### Ver Logs de Push Notifications

```sql
-- Ver últimas 50 notificações push enviadas
SELECT 
  ps.user_id,
  p.full_name,
  ps.endpoint,
  ps.is_active,
  ps.last_used_at,
  ps.created_at
FROM push_subscriptions ps
LEFT JOIN profiles p ON p.id = ps.user_id
ORDER BY ps.created_at DESC
LIMIT 50;
```

### Ver Usuários com Push Ativo

```sql
SELECT 
  COUNT(*) as total_usuarios_push_ativo
FROM push_subscriptions
WHERE is_active = true;
```

## 🎯 Próximos Passos

Após configurar VAPID:

1. ✅ Push notifications para chat de propostas (já implementado)
2. ✅ Push notifications para transportadora (já implementado)
3. 🔄 Adicionar som customizado de notificação (FASE 2)
4. 🔄 Indicador visual de mensagens não lidas (FASE 2)
5. 🔄 Sistema de digitação em tempo real (FASE 3)

## 🆘 Suporte

Se encontrar problemas:
1. Verifique os logs no Supabase Dashboard
2. Verifique o console do navegador (F12)
3. Consulte a documentação: https://web.dev/push-notifications-overview/

---

**✨ Configuração completa! Agora o AGRIROUTE pode enviar notificações push reais para os usuários.**
