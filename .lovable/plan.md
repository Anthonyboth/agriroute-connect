
# Correção do Crash no Android (Tela Pisca e Fecha)

## Problema

O app Android crasha imediatamente ao abrir, exibindo "AgriRoute fechou porque este app tem um bug". A correção anterior (CSS async) resolveu apenas parte do problema. Existem MAIS causas raiz que precisam ser corrigidas.

## Causas Raiz Identificadas

### 1. Web Manifest conflitando com Capacitor WebView (PRINCIPAL)
O `index.html` inclui `<link rel="manifest" href="/site.webmanifest?v=2">`. Quando o Android WebView carrega HTML com manifest PWA, o Chrome WebView pode tentar entrar em modo PWA, conflitando com o ambiente Capacitor e causando crash.

### 2. Preloads de imagens que podem não existir no bundle
O `<link rel="preload" as="image" ...>` para hero images pode falhar no WebView local, gerando erros fatais de preload em alguns dispositivos.

### 3. Preconnect/DNS-prefetch desnecessários no Android
Tags como `<link rel="preconnect" href="https://...supabase.co">` e `<link rel="dns-prefetch" ...>` para Stripe, WhatsApp etc. são inúteis no WebView nativo e podem causar erros silenciosos.

### 4. Console removido em produção (drop_console: true)
O terser está removendo TODOS os `console.*` calls em produção, incluindo `console.error` e `console.warn`. Isso impede qualquer diagnóstico e pode causar comportamentos inesperados em handlers de erro.

### 5. SW gerado pelo VitePWA presente no dist/
Mesmo sem registro automático, o arquivo `sw.js` no `dist/` pode ser auto-detectado por alguns WebViews Android.

## Plano de Correção

### Etapa 1: index.html - Desativar tags problemáticas no Capacitor

Adicionar script de detecção nativa no HEAD que remove dinamicamente tags desnecessárias:
- Remover `<link rel="manifest">` no Capacitor
- Remover `<link rel="preload">` de hero images no Capacitor
- Remover `<link rel="preconnect">` e `<link rel="dns-prefetch">` no Capacitor

Isso sera feito adicionando um script inline no HEAD ANTES dessas tags, que detecta o ambiente nativo e remove/desabilita os links.

### Etapa 2: vite.config.ts - Parar de remover console.error/warn

Mudar a configuracao do terser para manter `console.error` e `console.warn` em producao:
- Remover `drop_console: true`
- Usar apenas `pure_funcs` para remover `console.log`, `console.info`, `console.debug`
- Isso preserva `console.error` e `console.warn` para diagnostico

### Etapa 3: main.tsx - Adicionar try/catch global para boot nativo

Envolver o `createRoot(...).render()` em try/catch para capturar erros fatais durante a inicializacao no Android, exibindo uma mensagem de erro util em vez de crash silencioso.

### Etapa 4: capacitor.config.ts - Habilitar debug temporariamente

Habilitar `webContentsDebuggingEnabled: true` no Android para permitir depuracao via Chrome DevTools caso o problema persista.

## Detalhes Tecnicos

### index.html - Script de limpeza nativa (no HEAD, antes das tags)
```text
<script>
  // Detectar Capacitor/nativo e remover tags que causam crash no WebView
  (function(){
    var isNative = window.Capacitor || location.protocol === 'capacitor:' || 
      (location.hostname === 'localhost' && !location.port);
    if (!isNative) return;
    
    // Adiar para quando o DOM do head estiver pronto
    var observer = new MutationObserver(function(){
      // Remover manifest (causa conflito PWA/WebView)
      document.querySelectorAll('link[rel="manifest"]').forEach(function(el){ el.remove(); });
      // Remover preloads de imagens hero (arquivos podem não existir)
      document.querySelectorAll('link[rel="preload"][as="image"]').forEach(function(el){ el.remove(); });
      // Remover preconnect/dns-prefetch (inutil em WebView local)
      document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]').forEach(function(el){ el.remove(); });
    });
    observer.observe(document.head, { childList: true });
    // Executar tambem imediatamente para tags ja presentes
    document.querySelectorAll('link[rel="manifest"]').forEach(function(el){ el.remove(); });
    document.querySelectorAll('link[rel="preload"][as="image"]').forEach(function(el){ el.remove(); });
    document.querySelectorAll('link[rel="preconnect"], link[rel="dns-prefetch"]').forEach(function(el){ el.remove(); });
  })();
</script>
```

### vite.config.ts - Preservar console.error/warn
```text
terserOptions: {
  compress: {
    drop_console: false,  // NAO remover todos os console
    drop_debugger: mode === 'production',
    pure_funcs: mode === 'production' 
      ? ['console.log', 'console.info', 'console.debug'] 
      : []
  },
```

### main.tsx - Try/catch no boot
```text
try {
  createRoot(document.getElementById('root')!).render(<App />);
} catch (error) {
  // Exibir erro no DOM se o React falhar ao montar
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML = '<div style="padding:2rem;text-align:center">' +
      '<h2>Erro ao iniciar o app</h2>' +
      '<p>' + (error instanceof Error ? error.message : String(error)) + '</p>' +
      '<button onclick="location.reload()">Recarregar</button></div>';
  }
}
```

### capacitor.config.ts - Debug temporario
```text
android: {
  allowMixedContent: true,
  webContentsDebuggingEnabled: true,  // TEMPORARIO: habilitar para diagnostico
},
```

## Apos aplicar

O usuario deve:
1. `git pull`
2. `npm run build`
3. `npx cap sync`
4. `npx cap run android`

Se ainda houver crash, o `webContentsDebuggingEnabled: true` permitira conectar Chrome DevTools (`chrome://inspect`) para ver o erro exato.
