

## Plano de Correção: Notificações Pré-Login e Tela Piscando

### Problema 1: Pop-up de notificações aparecendo antes do login

**Causa raiz**: O componente `PermissionPrompts` (linha 1089 do App.tsx) é renderizado **incondicionalmente** para todos os usuários. O hook `useContextualPermissions` retorna `shouldRequestNotifications = true` no caso `default` (quando não há perfil/role), ou seja, para visitantes não logados.

**Correção**: 
- No `PermissionPrompts.tsx`, adicionar verificação de autenticação. Se o usuário não estiver logado (`!profile`), retornar `null` imediatamente, sem renderizar nada.

### Problema 2: Tela piscando ao abrir o site no celular

**Causa raiz**: O componente `AuthedLanding` (rota `/`) mostra um **spinner fullscreen** (`AuthLoader`) enquanto o estado de autenticação está carregando, e depois troca para a página `Landing`. Essa transição rápida (spinner -> landing) causa o efeito de "piscar". O fluxo é:

1. App abre -> Boot phase `INITIALIZING` -> `CHECKING_AUTH`
2. `AuthedLanding` detecta `loading=true` -> mostra spinner fullscreen
3. Auth resolve (usuário não logado) -> `loading=false` -> troca para `Landing`
4. Essa troca brusca = flash visual

**Correção**:
- No `AuthedLanding`, em vez de mostrar o spinner fullscreen enquanto verifica autenticação, renderizar a página `Landing` diretamente. Se depois descobrir que o usuário está logado, redireciona silenciosamente para o dashboard. Isso elimina o flash porque a Landing já está visível desde o primeiro frame.

---

### Detalhes Técnicos

**Arquivo 1: `src/components/PermissionPrompts.tsx`**
- Importar `useAuth` 
- No início do componente, verificar se há `profile` (usuário logado)
- Se `!profile`, retornar `null` antes de qualquer outra lógica

**Arquivo 2: `src/App.tsx` (componente `AuthedLanding`)**
- Remover o estado de loading que mostra `AuthLoader` para usuários não autenticados
- Enquanto `loading` é `true` e não há `profile`, renderizar `<Landing />` diretamente (em vez do spinner)
- Manter o redirect para dashboard apenas quando confirmar que o usuário está logado e tem perfil

Resultado: ao abrir o site, a Landing aparece instantaneamente, sem spinner, sem pop-ups, limpa.

