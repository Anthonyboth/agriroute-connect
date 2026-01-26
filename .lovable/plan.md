
Objetivo
- Eliminar o erro do browser “Failed to send a request to the Edge Function” ao emitir NF-e.
- Garantir que a requisição chegue na Edge Function e que a resposta seja sempre JSON (inclusive em erro).
- Mudanças mínimas e objetivas, apenas em Edge Functions e front-end, sem mexer em banco/migrações.

Diagnóstico (com base no código atual)
1) Front-end está chamando a function errada
- Em `src/components/fiscal/nfe/NfeEmissionWizard.tsx`, o submit chama `supabase.functions.invoke("nfe-emissao", ...)`.
- Porém a Edge Function existente e confirmada é `nfe-emitir`.
- Isso sozinho pode gerar falha no browser dependendo de como o SDK trata 404/Network/CORS.

2) CORS das Edge Functions está incompleto para browser
- `supabase/functions/nfe-emitir/index.ts` atualmente tem apenas:
  - Access-Control-Allow-Origin
  - Access-Control-Allow-Headers
  - OPTIONS respondendo sem status 204 e sem Allow-Methods/Max-Age.
- `supabase/functions/nfe-update-status/index.ts` está igual.
- Preflight (OPTIONS) do browser pode falhar por falta de:
  - `Access-Control-Allow-Methods: 'POST, OPTIONS'`
  - `Access-Control-Max-Age: '86400'`
  - status 204 no OPTIONS
- Resultado típico: request é bloqueada antes de “chegar” no handler, e o SDK mostra “Failed to send a request…”

3) Front-end não garante Authorization válido antes de chamar emissão
- No `NfeEmissionWizard.tsx` hoje não existe `getSession()` antes do invoke principal.
- E não envia `Authorization: Bearer ...` explicitamente (requisito que você pediu).

Escopo e garantias
- Não alterarei banco, não criarei migrações, não renomearei tabelas/colunas.
- Mudanças serão somente nestes arquivos:
  1) `supabase/functions/nfe-emitir/index.ts`
  2) `supabase/functions/nfe-update-status/index.ts`
  3) `src/components/fiscal/nfe/NfeEmissionWizard.tsx`

Implementação (patch planejado)

A) Edge Function: CORS correto em `supabase/functions/nfe-emitir/index.ts`
1) Substituir o `corsHeaders` pelo modelo EXATO solicitado:
```ts
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
};
```

2) Ajustar o preflight OPTIONS para status 204 + headers:
```ts
if (req.method === 'OPTIONS') {
  return new Response(null, { status: 204, headers: corsHeaders });
}
```

3) Garantir que TODAS as respostas retornem JSON com:
- `...corsHeaders`
- `'Content-Type': 'application/json'`

Hoje já existe `jsonResponse()` que faz isso:
```ts
function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
```
- Vou manter o helper e apenas garantir que ele use o novo `corsHeaders` (com Methods/Max-Age).

4) Logs mínimos e úteis (sem token)
Logo no início do handler (após OPTIONS) adicionar:
```ts
const origin = req.headers.get("Origin");
const authHeader = req.headers.get("Authorization");
console.log("[nfe-emitir] Request", {
  method: req.method,
  origin,
  hasAuthorization: !!authHeader,
});
```
- Não logar token.
- Em caso de erro inesperado, logar stack:
```ts
} catch (error) {
  console.error("[nfe-emitir] Erro inesperado:", error);
  if (error instanceof Error) console.error("[nfe-emitir] Stack:", error.stack);
  return jsonResponse(500, { ... });
}
```

B) Edge Function: mesmo CORS em `supabase/functions/nfe-update-status/index.ts`
Repetir exatamente o mesmo padrão:
1) Atualizar `corsHeaders` para incluir Methods/Max-Age.
2) OPTIONS retorna 204.
3) Todas as respostas usam `json()` (já existe) com `...corsHeaders` + JSON content-type.
4) Logs mínimos no início:
```ts
const origin = req.headers.get("Origin");
const authHeader = req.headers.get("Authorization");
console.log("[nfe-update-status] Request", {
  method: req.method,
  origin,
  hasAuthorization: !!authHeader,
});
```
E no catch:
```ts
console.error("[nfe-update-status] Unexpected error:", error);
if (error instanceof Error) console.error("[nfe-update-status] Stack:", error.stack);
```

C) Front-end: Authorization correto + function name correto em `src/components/fiscal/nfe/NfeEmissionWizard.tsx`
Mudanças mínimas no `handleSubmit()`:

1) Antes de invocar, buscar session:
```ts
const { data: { session } } = await supabase.auth.getSession();
if (!session?.access_token) {
  toast.error("Sessão inválida", { description: "Faça login novamente." });
  return;
}
```

2) Garantir que o nome chamado é exatamente “nfe-emitir”:
- Trocar:
```ts
await supabase.functions.invoke("nfe-emissao", { ... })
```
- Para:
```ts
await supabase.functions.invoke("nfe-emitir", { ... })
```

3) Enviar Authorization explicitamente (sem Bearer undefined):
```ts
const { data, error } = await supabase.functions.invoke("nfe-emitir", {
  body: payload,
  headers: {
    Authorization: `Bearer ${session.access_token}`,
  },
});
```

Observação importante (mínimo para não quebrar):
- Não vou alterar UI/etapas do wizard.
- Apenas impedir “chamar com token vazio” e padronizar o nome correto da function.

(Extra opcional, mas ainda mínimo e dentro do mesmo arquivo)
- Para o polling (`pollStatus`) que chama `nfe-update-status`, hoje ele não envia Authorization explicitamente.
- Isso pode causar 401 e polling “nunca” concluir.
- Eu recomendo (e vou incluir, por ser mínimo e no mesmo arquivo) pegar `session.access_token` uma vez e passar nos invokes do polling também:
  - ou buscar session dentro do `pollStatus`
  - ou passar o token como parâmetro para `pollStatus`
- Isso melhora a robustez sem mexer em outras abas.

Validação / Como vamos confirmar que ficou pronto (sem “falso concluído”)
Após aplicar o patch (no modo de implementação), vou validar com evidência:
1) No browser (route atual `/dashboard/producer`):
- Clicar “Emitir NF-e”
- Confirmar que NÃO aparece mais “Failed to send a request to the Edge Function”.

2) Checar se a request chega na function:
- Usar logs da Edge Function (Supabase) e procurar:
  - `[nfe-emitir] Request { method: 'POST', origin: ..., hasAuthorization: true }`
  - e para preflight:
  - `[nfe-emitir]` não loga OPTIONS porque retornamos antes (OK), mas o browser deve receber 204 com headers.

3) Garantir resposta JSON sempre:
- Mesmo em erro (401/400/422/500), o client deve receber JSON e exibir toast com mensagem.

Entrega (o que você vai receber no final da implementação)
- Lista de arquivos alterados (somente os 3 acima).
- Trechos exatos alterados (corsHeaders + OPTIONS 204 + invoke “nfe-emitir” + getSession + Authorization).
- Confirmação explícita: não alterei banco / não criei migrações.
