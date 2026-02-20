
# Role Gate — Blindagem 100% de Acesso por Painel

## Diagnóstico do Estado Atual

### O que já existe (e funciona)
- `ProtectedRoute` em `App.tsx` já tem checagem de `allowedRoles` para todas as rotas de dashboard
- `useResilientLogin` redireciona pelo `role` correto após login
- `AuthedLanding` e `RedirectIfAuthed` redirecionam para o painel correto
- `user_roles` table já existe no banco com trigger de sincronização

### Lacunas reais identificadas (causa raiz dos "painéis errados")

**Lacuna 1 — `active_mode` sobrepõe `role` no redirecionamento**
Em `AuthedLanding` (linha 623): `const effectiveRole = profile?.active_mode || profile?.role;`
Se um motorista tiver `active_mode = 'TRANSPORTADORA'` por dado antigo/inconsistente, ele é enviado para `/dashboard/company`, mesmo que seu `role` seja `MOTORISTA`.

**Lacuna 2 — `ProtectedRoute` não tem resolver canônico central**
A lógica de "qual painel para qual role" está duplicada em 5 lugares:
- `AuthedLanding` (switch case)
- `RedirectIfAuthed` (switch case)
- `useResilientLogin` (`getDashboardRoute`)
- `ProtectedRoute` (redirects inline)
- `lib/auth-utils.ts` (`ROLE_DASHBOARD_MAP`)

Quando um lugar diverge dos outros, o usuário fica em loop ou painel errado.

**Lacuna 3 — `MOTORISTA_AFILIADO` com `active_mode = 'TRANSPORTADORA'` não está coberto no `ProtectedRoute`**
Linha 397-398: `profile.role !== 'MOTORISTA' && profile.role !== 'MOTORISTA_AFILIADO'` mas não considera o `active_mode` inconsistente.

**Lacuna 4 — Sem "route guard" ativo ao trocar de rota**
`ProtectedRoute` só age no mount inicial. Se o usuário navegar por JS (link interno, back button) para `/dashboard/producer` sendo motorista, o guard precisa reagir — e hoje faz isso, mas com lógica espalhada e inconsistente.

**Lacuna 5 — `localStorage.getItem('redirect_after_login')` não valida o painel permitido**
Linha 744-747: Se houver uma URL salva de uma sessão anterior de outro role, o usuário é redirecionado para ela sem checar se pertence ao seu painel.

---

## Solução: Arquitetura do Role Gate

### Estrutura dos arquivos novos/alterados

```text
src/security/panelAccessGuard.ts   ← NOVO: resolver canônico central
src/hooks/useRoleGate.ts           ← NOVO: hook de proteção de rota
src/components/security/RequirePanel.tsx  ← NOVO: wrapper de página
src/lib/auth-utils.ts              ← ALTERADO: consolidar ROLE_DASHBOARD_MAP
src/App.tsx                        ← ALTERADO: usar RequirePanel + limpar redirect_after_login
src/hooks/useResilientLogin.ts     ← ALTERADO: usar getDashboardByRole do panelAccessGuard
```

---

## Arquivo 1 — `src/security/panelAccessGuard.ts` (novo)

Fonte única de verdade para: qual role → qual painel → quais rotas são permitidas.

```typescript
export type CanonicalPanel = 'PRODUCER' | 'DRIVER' | 'CARRIER' | 'SERVICE_PROVIDER' | 'ADMIN';

interface PanelAccess {
  panel: CanonicalPanel;
  allowedPaths: string[];       // prefixos permitidos (ex: ['/dashboard/driver'])
  defaultRoute: string;         // rota de entrada padrão
}

// Mapa role -> acesso de painel (ÚNICA fonte de verdade)
const ROLE_PANEL_MAP: Record<string, PanelAccess> = {
  PRODUTOR:           { panel: 'PRODUCER',          allowedPaths: ['/dashboard/producer'], defaultRoute: '/dashboard/producer' },
  MOTORISTA:          { panel: 'DRIVER',             allowedPaths: ['/dashboard/driver'],   defaultRoute: '/dashboard/driver'   },
  MOTORISTA_AFILIADO: { panel: 'DRIVER',             allowedPaths: ['/dashboard/driver'],   defaultRoute: '/dashboard/driver'   },
  TRANSPORTADORA:     { panel: 'CARRIER',            allowedPaths: ['/dashboard/company'],  defaultRoute: '/dashboard/company'  },
  PRESTADOR_SERVICOS: { panel: 'SERVICE_PROVIDER',   allowedPaths: ['/dashboard/service-provider'], defaultRoute: '/dashboard/service-provider' },
  ADMIN:              { panel: 'ADMIN',              allowedPaths: ['/admin', '/dashboard'], defaultRoute: '/admin'             },
};

// Rotas compartilhadas (acessíveis por qualquer autenticado)
const SHARED_AUTHENTICATED_PATHS = ['/complete-profile', '/plans', '/nfe-dashboard', '/cadastro-transportadora'];

export function resolveCanonicalAccess(profile: UserProfile | null): PanelAccess | null {
  if (!profile) return null;
  // ✅ SEMPRE usar profile.role (campo real do banco), NUNCA active_mode como critério de painel
  // active_mode é usado APENAS para funcionalidades internas (ex: modo duplo motorista/transportadora)
  return ROLE_PANEL_MAP[profile.role] ?? null;
}

export function isRouteAllowedForProfile(pathname: string, profile: UserProfile | null): boolean {
  if (!profile) return false;
  if (SHARED_AUTHENTICATED_PATHS.some(p => pathname.startsWith(p))) return true;
  const access = resolveCanonicalAccess(profile);
  if (!access) return false;
  return access.allowedPaths.some(p => pathname.startsWith(p));
}

export function getDefaultRouteForProfile(profile: UserProfile | null): string {
  const access = resolveCanonicalAccess(profile);
  return access?.defaultRoute ?? '/';
}
```

**Regra central:** `active_mode` NÃO determina o painel de entrada. Apenas `profile.role` faz isso. O `active_mode` só é consultado para funcionalidades internas específicas (ex.: motorista com empresa).

---

## Arquivo 2 — `src/hooks/useRoleGate.ts` (novo)

Hook leve que qualquer componente pode chamar para verificar se está na rota certa.

```typescript
export function useRoleGate() {
  const { profile, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    if (loading || !profile) return;
    
    const isDashboardPath = location.pathname.startsWith('/dashboard') || location.pathname.startsWith('/admin');
    if (!isDashboardPath) return;
    
    if (!isRouteAllowedForProfile(location.pathname, profile)) {
      const correctRoute = getDefaultRouteForProfile(profile);
      console.warn(`[RoleGate] Rota bloqueada: ${location.pathname} → redirecionando para ${correctRoute}`);
      navigate(correctRoute, { replace: true });
    }
  }, [location.pathname, profile, loading]);
  
  return {
    isAllowed: isRouteAllowedForProfile(location.pathname, profile),
    defaultRoute: getDefaultRouteForProfile(profile),
  };
}
```

---

## Arquivo 3 — `src/components/security/RequirePanel.tsx` (novo)

Wrapper declarativo para cada página de dashboard. Garante render bloqueado até profile estar resolvido.

```typescript
interface RequirePanelProps {
  panel: CanonicalPanel;
  children: React.ReactNode;
}

export function RequirePanel({ panel, children }: RequirePanelProps) {
  const { profile, loading } = useAuth();
  const navigate = useNavigate();
  
  const access = profile ? resolveCanonicalAccess(profile) : null;
  
  if (loading) return <DashboardLoader message="Verificando acesso..." />;
  
  if (!profile) {
    return <Navigate to="/auth" replace />;
  }
  
  if (access?.panel !== panel) {
    const correctRoute = getDefaultRouteForProfile(profile);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive" />
          <h2 className="text-xl font-bold">Acesso não permitido</h2>
          <p className="text-muted-foreground">Você não tem permissão para acessar este painel.</p>
          <Button onClick={() => navigate(correctRoute, { replace: true })}>
            Ir para meu painel
          </Button>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
```

---

## Alterações nos arquivos existentes

### `src/App.tsx` — 4 pontos de mudança

**1. `AuthedLanding`:** Substituir `profile?.active_mode || profile?.role` por `getDefaultRouteForProfile(profile)` — remove a lacuna do active_mode.

**2. `RedirectIfAuthed`:** Substituir o switch de roles manual por `getDefaultRouteForProfile(profile)`. Adicionar validação do `redirect_after_login`: só usar se `isRouteAllowedForProfile(after, profile)`.

**3. `ProtectedRoute`:** Simplificar os redirects inline (linhas 394-408) usando `getDefaultRouteForProfile(profile)` em vez de ternários aninhados manuais.

**4. Rotas de dashboard:** Adicionar `<RequirePanel panel="DRIVER">` etc. dentro dos Suspense, como segunda camada de proteção.

### `src/hooks/useResilientLogin.ts`

Substituir a função local `getDashboardRoute` por `getDefaultRouteForProfile` do `panelAccessGuard.ts` para eliminar a duplicação da tabela de mapeamento.

### `src/lib/auth-utils.ts`

Redirecionar `getDashboardByRole` para usar `resolveCanonicalAccess` internamente, evitando manutenção duplicada.

---

## Fluxo completo após a implementação

```text
USUÁRIO FAZ LOGIN
       ↓
useResilientLogin.login()
       ↓
Busca profile.role do banco (fresco, sem cache)
       ↓
getDefaultRouteForProfile(profile) → rota correta
       ↓
navigate(rota) [SPA] ou window.location.href [fallback]
       ↓
ROTA DE DASHBOARD CARREGA
       ↓
ProtectedRoute verifica allowedRoles  ← camada 1
       ↓
RequirePanel verifica panel           ← camada 2 (nova)
       ↓
useRoleGate reage a troca de rota     ← camada 3 (nova)
       ↓
PAINEL RENDERIZA ✅
```

---

## Cenários de teste cobertos

| Cenário | Comportamento esperado |
|---|---|
| Motorista afiliado acessa `/dashboard/service-provider` por URL | Redirecionado imediatamente para `/dashboard/driver` |
| Produtor acessa `/dashboard/driver` por link antigo | Redirecionado para `/dashboard/producer` |
| Motorista com `active_mode = TRANSPORTADORA` faz login | Vai para `/dashboard/driver` (role=MOTORISTA, não active_mode) |
| `redirect_after_login` salvo de sessão de outro role | Ignorado; usa `getDefaultRouteForProfile` |
| Usuário navega via back button para painel errado | `useRoleGate` detecta e redireciona |
| Login com credenciais corretas, perfil único | Sempre vai para o painel do `profile.role` |

---

## Detalhes técnicos

- **Zero loops de redirect:** todos os redirects são `replace: true` e só disparam quando `!loading && !!profile`.
- **Sem breaking changes:** `ProtectedRoute` continua existindo e funcionando como camada 1; `RequirePanel` é camada 2 adicional.
- **TypeScript strict:** todos os tipos exportados do `panelAccessGuard` para reuso nos componentes.
- **Mensagens em PT-BR:** "Você não tem permissão para acessar este painel" + botão "Ir para meu painel".
- **Logs de segurança em DEV:** `console.warn('[RoleGate] Rota bloqueada: ...')` visível apenas em desenvolvimento.

---

## Arquivos a criar/alterar

| Arquivo | Operação | Motivo |
|---|---|---|
| `src/security/panelAccessGuard.ts` | CRIAR | Fonte única de verdade para role → painel |
| `src/hooks/useRoleGate.ts` | CRIAR | Guard ativo em cada troca de rota |
| `src/components/security/RequirePanel.tsx` | CRIAR | Wrapper declarativo por página |
| `src/App.tsx` | ALTERAR | Usar resolver canônico, corrigir active_mode, validar redirect_after_login |
| `src/hooks/useResilientLogin.ts` | ALTERAR | Usar getDefaultRouteForProfile (remover duplicação) |
| `src/lib/auth-utils.ts` | ALTERAR | getDashboardByRole delegando para panelAccessGuard |
