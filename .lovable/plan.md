

# Corrigir Acesso ao Painel Admin

## Problema Identificado

A politica RLS (Row Level Security) da tabela `admin_users` causa **recursao infinita**. A politica de SELECT faz um subquery na propria tabela `admin_users` para verificar se o usuario e admin — mas para executar esse subquery, o Postgres precisa avaliar a mesma politica de SELECT novamente, criando um loop infinito.

**Erro no console:**
```
infinite recursion detected in policy for relation "admin_users"
```

## Solucao

Substituir as politicas RLS que fazem subquery recursiva por politicas simples que comparam diretamente o `user_id` da linha com `auth.uid()`.

### Politica de SELECT (atual - com problema):
```
EXISTS (SELECT 1 FROM admin_users au WHERE au.user_id = auth.uid() AND au.is_active = true)
```

### Politica de SELECT (corrigida):
```
user_id = auth.uid() AND is_active = true
```

Isso permite que cada admin veja apenas seu proprio registro, o que e suficiente para o hook `useAdminAuth` funcionar (ele so busca o registro do usuario logado).

### Politica de UPDATE (mesma correcao):
De subquery recursiva para comparacao direta:
```
user_id = auth.uid() AND is_active = true AND role = 'superadmin'
```

## Detalhes Tecnicos

Uma unica migration SQL sera criada para:

1. Remover a politica `admin_users_select_by_admin` (recursiva)
2. Remover a politica `admin_users_update_by_superadmin` (recursiva)
3. Criar nova politica SELECT: cada admin le apenas seu proprio registro
4. Criar nova politica UPDATE: apenas superadmins podem atualizar seus registros

Nenhuma alteracao de codigo frontend e necessaria — o hook `useAdminAuth` ja busca apenas `WHERE user_id = user.id`, entao a nova politica e compativel.

