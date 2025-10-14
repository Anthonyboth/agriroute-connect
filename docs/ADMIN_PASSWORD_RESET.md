# Script de Redefinição de Senha - Administradores

## ⚠️ ATENÇÃO
Este script deve ser executado **SOMENTE por administradores** no Supabase SQL Editor.

**Link de acesso:** https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/sql/new

---

## 📋 Instruções de Uso

### PASSO 1: Buscar o usuário pelo e-mail

Execute esta query para confirmar que o usuário existe e obter seu ID:

```sql
SELECT 
  id,
  email,
  created_at,
  last_sign_in_at,
  email_confirmed_at
FROM auth.users 
WHERE email = '<EMAIL_DO_USUARIO>'; -- Exemplo: 'joao@email.com'
```

**Importante:** Anote o `id` retornado para usar no próximo passo.

---

### PASSO 2: Redefinir a senha do usuário

⚠️ **Substitua os valores:**
- `<USER_ID>`: Cole o ID obtido no PASSO 1
- `<NOVA_SENHA>`: Defina uma senha temporária (mínimo 6 caracteres)

```sql
UPDATE auth.users 
SET 
  encrypted_password = crypt('<NOVA_SENHA>', gen_salt('bf')),
  updated_at = now()
WHERE id = '<USER_ID>';
```

**Exemplo:**
```sql
UPDATE auth.users 
SET 
  encrypted_password = crypt('senha123', gen_salt('bf')),
  updated_at = now()
WHERE id = '811c36c6-7f39-4aa3-afd8-b2ba79e0b215';
```

---

### PASSO 3: Verificar se a alteração foi aplicada

```sql
SELECT 
  id,
  email,
  updated_at,
  last_sign_in_at
FROM auth.users 
WHERE id = '<USER_ID>';
```

Confirme que o campo `updated_at` foi atualizado para a data/hora atual.

---

### PASSO 4: (Opcional) Confirmar e-mail se necessário

Se o usuário nunca confirmou o e-mail, execute:

```sql
UPDATE auth.users 
SET 
  email_confirmed_at = now(),
  updated_at = now()
WHERE id = '<USER_ID>' AND email_confirmed_at IS NULL;
```

---

## 📝 Registrar Auditoria

Para manter um histórico das ações administrativas:

```sql
INSERT INTO audit_logs (
  user_id,
  table_name,
  operation,
  new_data,
  timestamp
) VALUES (
  (SELECT id FROM profiles WHERE user_id = auth.uid() LIMIT 1),
  'auth.users',
  'PASSWORD_RESET_BY_ADMIN',
  jsonb_build_object(
    'target_user_email', '<EMAIL_DO_USUARIO>',
    'target_user_id', '<USER_ID>',
    'reset_reason', 'Solicitação via WhatsApp',
    'admin_action', true
  ),
  now()
);
```

---

## 💬 Mensagem para Enviar ao Usuário (WhatsApp)

Após executar o script com sucesso, copie e envie esta mensagem ao usuário:

```
Olá! Sua senha foi redefinida com sucesso. ✅

Nova senha: <NOVA_SENHA>

Por segurança, recomendamos que você altere esta senha assim que fizer login.

Para fazer login:
1. Acesse: https://agriroute.lovable.app
2. Use seu e-mail: <EMAIL_DO_USUARIO>
3. Use a nova senha fornecida acima

Caso tenha dúvidas, estamos à disposição!
```

---

## 🔐 Checklist de Segurança

Antes de executar o script, confirme:

- [ ] Confirmei a identidade do usuário via WhatsApp
- [ ] Verifiquei que o e-mail fornecido está correto
- [ ] Criei uma senha temporária forte
- [ ] Executei todas as queries na ordem correta
- [ ] Registrei a ação no audit_logs
- [ ] Enviei a nova senha ao usuário via WhatsApp
- [ ] Orientei o usuário a trocar a senha após login

---

## 🆘 Troubleshooting

### Erro: "não há nenhum usuário com este email"
- Verifique se o e-mail está digitado corretamente
- Confirme com o usuário se ele usou outro e-mail para cadastro

### Erro: "violação de constraint"
- Verifique se a senha tem pelo menos 6 caracteres
- Tente usar outra senha temporária

### Usuário não consegue fazer login após reset
- Confirme que o `updated_at` foi atualizado
- Execute o PASSO 4 para confirmar o e-mail
- Verifique se não há bloqueios na conta (campo `banned_until`)

---

## 📞 Suporte

Em caso de dúvidas, contacte o desenvolvedor responsável pelo sistema.
