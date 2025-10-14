# Guia de Atendimento - Recuperação de Senha

## 📱 Processo de Atendimento via WhatsApp

### Tempo Médio Esperado
⏱️ **5-10 minutos** por solicitação

---

## 🔄 Fluxo de Atendimento

### 1️⃣ Recebimento da Solicitação

Quando o usuário entrar em contato pelo WhatsApp solicitando reset de senha:

**Template de Resposta Inicial:**
```
Olá! 👋

Entendi que você precisa redefinir sua senha. Vou ajudá-lo!

Para sua segurança, preciso confirmar algumas informações:

1. Qual é o seu nome completo cadastrado?
2. Qual é o e-mail cadastrado na plataforma?
3. Qual foi a última vez que você acessou a plataforma (aproximadamente)?

Aguardo suas informações para prosseguir. 😊
```

---

### 2️⃣ Validação de Identidade

**Checklist de Segurança:**
- [ ] Nome completo confere com o cadastro
- [ ] E-mail está correto
- [ ] Informações adicionais conferem (data de último acesso, tipo de conta, etc.)

**Se algo não conferir:**
```
Desculpe, mas as informações fornecidas não conferem com nosso cadastro. 

Por favor, verifique:
- O e-mail está correto?
- Você pode ter usado outro e-mail para se cadastrar?

Caso não consiga lembrar, podemos tentar localizar pelo seu CPF/CNPJ.
```

---

### 3️⃣ Execução do Reset

1. **Acesse o Supabase SQL Editor:**
   - Link: https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl/sql/new

2. **Execute o script conforme documentação:**
   - Consulte: `docs/ADMIN_PASSWORD_RESET.md`
   - Siga todos os passos na ordem

3. **Gere uma senha temporária forte:**
   - Mínimo 8 caracteres
   - Combine letras maiúsculas, minúsculas e números
   - Exemplo: `Agro2025@`

**Template durante o processo:**
```
Perfeito! Estou processando sua solicitação...

Aguarde alguns instantes. ⏳
```

---

### 4️⃣ Envio da Nova Senha

**Template de Resposta com Sucesso:**
```
✅ Senha redefinida com sucesso!

📧 E-mail: [email_do_usuario]
🔑 Nova senha: [senha_temporaria]

⚠️ IMPORTANTE:
1. Acesse: https://agriroute.lovable.app
2. Faça login com seu e-mail e a senha acima
3. Após o login, vá em "Configurações" e altere sua senha

Por segurança, recomendamos que você mude sua senha imediatamente após o primeiro acesso.

Tudo certo? Consegue acessar? 😊
```

---

### 5️⃣ Acompanhamento

Aguarde a confirmação do usuário de que conseguiu acessar.

**Se o usuário confirmar sucesso:**
```
Ótimo! Fico feliz que tenha dado certo! 🎉

Lembre-se de trocar sua senha nas configurações.

Se precisar de mais alguma coisa, estou à disposição!
```

**Se o usuário reportar problema:**
- Verifique se executou todos os passos do script
- Confirme se o campo `updated_at` foi atualizado
- Verifique se o e-mail foi confirmado (PASSO 4)
- Em último caso, tente gerar outra senha

---

## ⚠️ Situações Especiais

### Usuário não lembra o e-mail cadastrado

```
Sem problemas! Podemos tentar localizar pelo seu CPF/CNPJ.

Por favor, me informe seu CPF/CNPJ cadastrado.
```

Então, execute no SQL:
```sql
SELECT 
  p.full_name,
  p.email,
  u.email as auth_email
FROM profiles p
LEFT JOIN auth.users u ON u.id = p.user_id
WHERE p.cpf_cnpj = 'CPF_INFORMADO';
```

---

### Conta bloqueada ou suspensa

```
Identifiquei que sua conta está [bloqueada/suspensa].

Vou encaminhar sua solicitação para nossa equipe de suporte avançado analisar.

Você receberá uma resposta em até 24 horas.
```

Encaminhar para supervisão com:
- ID do usuário
- Motivo do bloqueio/suspensão
- Contexto da solicitação

---

### Múltiplas contas com mesmo nome

```
Identifiquei que existe mais de uma conta com seu nome.

Para garantir que vou resetar a conta correta, me informe:
- Você é motorista, produtor ou prestador de serviços?
- Qual cidade você cadastrou?
```

---

## 📊 Registro de Atendimento

Após cada atendimento, registre em planilha/sistema:

| Data | Hora | Nome | E-mail | Tipo | Status | Observações |
|------|------|------|--------|------|--------|-------------|
| DD/MM | HH:MM | - | - | Reset Senha | Concluído | - |

**Status possíveis:**
- ✅ Concluído
- ⏳ Em andamento
- ❌ Negado (identidade não confirmada)
- 🔄 Encaminhado (casos especiais)

---

## 💡 Dicas para Atendimento Eficiente

1. **Seja cordial e empático** - O usuário pode estar frustrado
2. **Confirme sempre a identidade** - Segurança em primeiro lugar
3. **Seja claro nas instruções** - Use linguagem simples
4. **Acompanhe até o fim** - Certifique-se que o usuário conseguiu acessar
5. **Registre tudo** - Mantenha histórico para referência futura

---

## 📞 Escalação

Se não conseguir resolver, escale para:
- **Supervisor de Suporte**: [contato]
- **Desenvolvedor**: [contato]
- **Casos urgentes**: [contato]

---

## 🔗 Links Úteis

- Script SQL: `docs/ADMIN_PASSWORD_RESET.md`
- Supabase Dashboard: https://supabase.com/dashboard/project/shnvtxejjecbnztdbbbl
- App de Produção: https://agriroute.lovable.app
