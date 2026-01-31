
Objetivo
- Deixar o app com APENAS 1 estilo de spinner em TODOS os lugares, usando o componente padrão `AppSpinner` (o “C” verde do print), eliminando o segundo spinner (Lucide `Loader2`) e quaisquer spinners “caseiros”.

Diagnóstico (por que hoje alterna “2 spins”)
- Existem dois sistemas de loading coexistindo:
  1) `src/components/ui/AppSpinner.tsx` (spinner estilo “C” verde) — é o que você quer como padrão.
  2) `src/components/AppLoader.tsx` (usa `Loader2` do lucide-react) — este é o “outro spin” que aparece em boot/auth/Suspense.
- Além disso, há spinners soltos em alguns componentes (ex.: upload) e vários botões/telas usam `Loader2` como spinner.

Estratégia (como garantir “1 spinner só” sem quebrar telas)
- Manter a API do `AppLoader` (para não ter que reescrever tudo agora), mas trocar a implementação interna para renderizar o `AppSpinner` (e não mais `Loader2`).
- Fazer uma varredura e substituir os spinners “soltos” e os `Loader2` usados com `animate-spin` por `AppSpinner`/`InlineSpinner`/`CenteredSpinner`.
- Resultado: mesmo que algum lugar ainda importe `AppLoader`, por dentro ele renderiza o mesmo spinner padrão.

Mudanças planejadas (frontend)

1) Unificar o loader global (principal causa do “alternar 2 spinners”)
Arquivo: `src/components/AppLoader.tsx`
- Remover `import { Loader2 } from 'lucide-react'`
- Importar `AppSpinner` do padrão:
  - `import { AppSpinner } from '@/components/ui/AppSpinner'`
- Trocar todas as ocorrências de `<Loader2 ... animate-spin ... />` por `<AppSpinner ... />`
- Mapear tamanhos do AppLoader para pixels, preservando o visual atual:
  - `sm` => 20px (equivalente ao antigo `h-5 w-5`)
  - `md` => 32px (equivalente ao antigo `h-8 w-8`)
  - `lg` => 48px (equivalente ao antigo `h-12 w-12`)
- Manter os “containers” por variante para não quebrar layout:
  - `fullscreen`: manter `fixed inset-0 ... bg-background/95 backdrop-blur-sm` e só trocar o spinner interno
  - `inline`: manter `min-h-[200px] p-8` e só trocar o spinner interno
  - `minimal`: manter `p-2` e só trocar o spinner interno
- Manter `debugId` e os logs em DEV (não afetam produção)

Impacto direto:
- Tudo que hoje usa `GlobalLoader`, `AuthLoader`, `DashboardLoader`, `SectionLoader`, `ComponentLoader` (Suspense fallbacks no `App.tsx` e `LazyComponents.tsx`) passará a exibir exatamente o mesmo spinner padrão do `AppSpinner`.

2) Remover spinners “caseiros” que ainda aparecem em fluxos comuns
Arquivos encontrados com spinner “manual” (por busca):
- `src/components/ProfilePhotoUpload.tsx` (já usa um div “C” parecido, mas fora do componente padrão)
- `src/components/vehicle/VehiclePhotoGallery.tsx` (usa um spinner branco customizado)

Ajuste:
- Substituir os `<div className="... animate-spin ...">` por:
  - `InlineSpinner` quando estiver dentro de botão/linha (mantém espaçamento “mr-2” consistente)
  - ou `AppSpinner size="sm"` quando precisar customizar cor (por exemplo, em botão escuro, se necessário)
- Assim, não fica nenhum spinner “inventado” fora do componente oficial.

3) Reduzir/eliminar `Loader2` apenas quando ele estiver sendo usado como spinner
(para realmente ficar “1 spinner só” em toda a UI)
- Fazer busca e substituição por padrão:
  - Alvo: usos de `Loader2` com `animate-spin`
  - Trocar por:
    - `InlineSpinner` em botões (ex.: “Entrar”, “Cadastrar”, “Salvando…”, etc.)
    - `CenteredSpinner`/`AppSpinner` em estados de tela/seção
- Prioridade de correção (mais visível para você no dia a dia):
  1) Tela de Auth (`src/pages/Auth.tsx`) — hoje mostra `Loader2` no botão enquanto loga/cadastra (pode ser percebido como “segundo spinner”)
  2) Fluxos de upload (foto)
  3) Painéis/Modais que usam `Loader2` em loading inicial de card/aba

Observação importante:
- Ícones que “giram” mas não são spinner (ex.: `RefreshCw` girando no botão “Atualizar”) não são necessariamente “spinner de carregamento”. Se você quiser padronizar até isso, eu também consigo, mas primeiro vou focar em eliminar os spinners de loading reais (os circulares).

Critérios de aceite (como vamos confirmar que ficou 1 só)
- Durante boot/auth e troca de rotas (Suspense): só aparece o “C” verde do `AppSpinner`.
- Em botões de submit/login/upload/salvar: ao carregar, só aparece o “C” verde do `InlineSpinner`/`AppSpinner` (não mais `Loader2`).
- Não existem mais spinners customizados em `<div className="...animate-spin...border...">` fora de `AppSpinner.tsx`.

Checklist de testes (end-to-end)
1) Abrir o app do zero (forçar reload) e observar o loader global: deve ser o mesmo “C” verde.
2) Ir em /auth e clicar “Entrar” (com credenciais): o spinner no botão deve ser o mesmo “C” verde.
3) Navegar para /dashboard/company e alternar abas/ações que carregam dados: loaders devem ser iguais.
4) Fazer um upload de foto (perfil/veículo): spinner do “Enviando…” deve ser o mesmo “C” verde.
5) Testar em modo escuro e no mobile.

Risco/impacto
- Baixo: vamos reaproveitar containers e só trocar o “miolo” do spinner, mantendo layout/estrutura.
- Médio (apenas se você exigir 100% de substituição de todos os `Loader2` do projeto): é um sweep grande, mas é direto e mecânico.

O que eu vou implementar assim que você aprovar este plano
- Refatoração do `AppLoader` para usar `AppSpinner` (principal).
- Remoção dos spinners customizados identificados.
- Substituição de `Loader2` usado como spinner nos fluxos mais visíveis (Auth + uploads + alguns painéis), e deixo um sweep final para “zerar Loader2 animate-spin” no app inteiro.
