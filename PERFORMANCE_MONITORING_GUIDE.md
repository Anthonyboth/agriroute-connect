# 🔍 Guia de Monitoramento e Troubleshooting - Performance

## 📊 Como Monitorar as Otimizações

### 1. **Google Lighthouse (Local)**

```bash
# Produção local
npm run build
npm run preview

# Em outra aba, abrir Chrome DevTools > Lighthouse
# Executar audit em modo "Navigation" + "Mobile"
```

**Métricas críticas:**
- **FCP** (First Contentful Paint): Meta < 2.5s
- **LCP** (Largest Contentful Paint): Meta < 4.0s
- **TBT** (Total Blocking Time): Meta < 300ms
- **CLS** (Cumulative Layout Shift): Meta < 0.1

---

### 2. **Bundle Analyzer**

```bash
# Analisar tamanho dos chunks
npx vite-bundle-visualizer

# Ou adicionar ao package.json:
"scripts": {
  "analyze": "vite-bundle-visualizer"
}
```

**O que procurar:**
- ✅ Chunks balanceados (nenhum > 200KB)
- ✅ Tree-shaking funcionando (sem duplicatas)
- ❌ Bibliotecas grandes não usadas
- ❌ CSS duplicado em múltiplos chunks

---

### 3. **Chrome DevTools - Coverage**

```bash
# 1. Build de produção
npm run build && npm run preview

# 2. Chrome DevTools > More Tools > Coverage
# 3. Recarregar página
# 4. Navegar pelas rotas principais
```

**Interpretação:**
- **Vermelho:** Código não executado (pode ser tree-shakeable)
- **Verde:** Código executado
- **Meta:** < 30% de código não utilizado

---

### 4. **Network Waterfall**

**Chrome DevTools > Network Tab**

**Verificar:**
- **DNS Lookup:** < 50ms
- **Initial Connection:** < 100ms
- **SSL/TLS:** < 200ms
- **TTFB:** < 500ms
- **Content Download:** < 1s para CSS/JS

**Flags de atenção:**
- 🔴 Requests sequenciais (devem ser paralelos)
- 🔴 Recursos bloqueando renderização
- 🔴 Redirects múltiplos

---

## 🐛 Troubleshooting de Problemas Comuns

### Problema 1: **Build Falha com Erro de PurgeCSS**

**Erro típico:**
```
Error: PurgeCSS: Unable to extract selectors from file
```

**Solução:**
```typescript
// vite.config.ts - Adicionar arquivo problemático à whitelist
purgecss({
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
    '!./src/problema.tsx' // Excluir arquivo específico
  ]
})
```

---

### Problema 2: **Classes CSS Faltando em Produção**

**Sintomas:**
- Componentes sem estilo
- Console: "class not found"

**Diagnóstico:**
```bash
# 1. Build local
npm run build

# 2. Inspecionar CSS gerado
cat dist/assets/index-*.css | grep "nome-da-classe"

# Se não encontrar, PurgeCSS removeu
```

**Solução:**
```typescript
// vite.config.ts - Adicionar à safelist
safelist: {
  standard: [
    'classe-faltante',
    /^prefixo-dinamico-/, // Para classes dinâmicas
  ]
}
```

---

### Problema 3: **Prefetch Causando Lentidão**

**Sintomas:**
- Página inicial lenta
- Network tab mostra downloads paralelos excessivos

**Diagnóstico:**
```javascript
// Console do navegador
console.log(navigator.connection);
// Verificar effectiveType, saveData, downlink
```

**Solução:**
```typescript
// src/App.tsx - Adicionar verificação mais restritiva
const conn = (navigator as any).connection;
const shouldPrefetch = 
  conn?.effectiveType === '4g' && 
  conn?.downlink > 10 && // Exigir > 10 Mbps
  !conn?.saveData;

if (shouldPrefetch) {
  // ... código de prefetch
}
```

---

### Problema 4: **Tree-Shaking Removeu Código Necessário**

**Sintomas:**
- Erro "Module not found" em produção
- Funcionalidade específica quebrada

**Diagnóstico:**
```bash
# Verificar imports side-effect
grep -r "import.*from.*\.css" src/
grep -r "import.*'.*\.css'" src/
```

**Solução:**
```typescript
// vite.config.ts - Preservar side-effects específicos
treeshake: {
  moduleSideEffects: (id) => {
    // Preservar imports de CSS
    if (id.includes('.css')) return true;
    
    // Preservar polyfills
    if (id.includes('polyfill')) return true;
    
    // Remover side-effects de node_modules
    return !id.includes('node_modules');
  }
}
```

---

### Problema 5: **LCP Pior Após Otimizações**

**Sintomas:**
- LCP aumentou de 4.4s para 5s+
- Imagem hero não aparece

**Diagnóstico:**
```html
<!-- index.html - Verificar preload -->
<link rel="preload" href="/hero-truck-night-moon.webp" as="image" fetchpriority="high">
```

**Solução:**
```html
<!-- Garantir que preload está ANTES de qualquer CSS -->
<head>
  <meta charset="UTF-8" />
  <link rel="preload" href="/hero-truck-night-moon.webp" as="image" fetchpriority="high">
  <!-- ... outros links -->
</head>
```

---

## 🔬 Testes A/B Recomendados

### Setup de Teste A/B:

```typescript
// src/utils/abTest.ts
export const isOptimizationEnabled = () => {
  // 50% dos usuários recebem otimizações
  const userId = localStorage.getItem('userId') || Math.random().toString();
  const hash = userId.split('').reduce((a, b) => ((a << 5) - a) + b.charCodeAt(0), 0);
  return Math.abs(hash % 100) < 50;
};

// Usar em vite.config.ts
const useOptimizations = process.env.AB_TEST === 'true' 
  ? isOptimizationEnabled() 
  : true;

export default defineConfig({
  css: {
    postcss: {
      plugins: useOptimizations ? [purgecss(...)] : []
    }
  }
});
```

---

## 📈 Métricas para Coletar

### Antes da Implementação (Baseline):
```json
{
  "timestamp": "2025-01-21",
  "lighthouse": {
    "fcp": 3.5,
    "lcp": 4.4,
    "tbt": 150,
    "cls": 0.05,
    "si": 3.6
  },
  "bundles": {
    "total": 574.37,
    "css": 20.88,
    "js": 553.49,
    "unusedJs": 305.0
  }
}
```

### Após Implementação (Comparar):
```bash
# Executar e salvar
npm run build
npx lighthouse https://agriroute-connect.com.br --output json --output-path ./lighthouse-after.json
```

**Calcular delta:**
```javascript
const improvement = ((before - after) / before) * 100;
console.log(`FCP melhorou ${improvement.toFixed(1)}%`);
```

---

## 🎯 Critérios de Sucesso/Falha

### ✅ **Implementação BEM-SUCEDIDA se:**
- FCP reduzir pelo menos 10% (< 3.15s)
- CSS final < 18KB
- Zero erros de CSS faltante
- Zero feedback negativo de usuários (24h)

### ❌ **Rollback NECESSÁRIO se:**
- FCP **aumentar** (> 3.5s)
- Qualquer funcionalidade crítica quebrada
- > 5 relatórios de problemas visuais
- Build time > 2x mais lento

---

## 📊 Dashboard de Monitoramento

### Template de Planilha:

| Data | FCP | LCP | CSS (KB) | JS Não Usado (KB) | Erros | Notas |
|------|-----|-----|----------|-------------------|-------|-------|
| 21/01 (baseline) | 3.5s | 4.4s | 20.9 | 305 | 0 | Pré-otimização |
| 21/01 (pós-fase1) | ? | ? | ? | ? | ? | Monitorar 48h |

---

## 🚨 Red Flags - Sinais de Problema

### 🔴 **Crítico - Rollback Imediato:**
- Build não completa
- Aplicação não carrega
- Dashboard principal quebrado
- Formulários não submetem

### 🟡 **Alto - Investigar em 2h:**
- FCP/LCP piores que baseline
- > 3 classes CSS faltantes
- Animações travando
- Componentes com layout quebrado

### 🟢 **Baixo - Monitorar:**
- Componente secundário sem estilo
- Hover state inconsistente
- Pequeno flash de conteúdo

---

## 🔄 Processo de Iteração

### Ciclo de Melhoria Contínua:

```
1. MEDIR (Baseline) ──> 2. IMPLEMENTAR (Fase 1)
        ↑                           │
        │                           ↓
4. AJUSTAR (Refinement) <── 3. MONITORAR (48h)
```

**Iteração 1 (Semana 1):**
- Implementar Fase 1
- Monitorar 48h
- Coletar feedback
- Ajustar safelist se necessário

**Iteração 2 (Semana 2):**
- Analisar resultados Fase 1
- Decidir se avançar para Fase 2
- Implementar code splitting (se seguro)

**Iteração 3 (Semana 3):**
- Otimizações de infraestrutura
- CDN + HTTP/2 Push

---

## 📝 Log de Mudanças

### Template de Changelog:

```markdown
## [1.0.0] - 2025-01-21

### Adicionado
- PurgeCSS com safelist extensiva
- Prefetch estratégico de rotas
- Tree-shaking agressivo

### Performance
- FCP: 3.5s → 3.0s (-14%)
- CSS: 20.9KB → 17.5KB (-16%)
- JS não usado: 305KB → 270KB (-11%)

### Conhecido Issues
- Nenhum no momento

### Rollback Instructions
- Ver PERFORMANCE_OPTIMIZATION_REPORT.md seção "Plano de Emergência"
```

---

## 🎓 Recursos Adicionais

### Documentação Oficial:
- [Web.dev - Performance](https://web.dev/performance/)
- [Vite - Build Optimizations](https://vitejs.dev/guide/build.html)
- [PurgeCSS - Configuration](https://purgecss.com/configuration.html)

### Ferramentas Recomendadas:
- [WebPageTest](https://www.webpagetest.org/)
- [GTmetrix](https://gtmetrix.com/)
- [PageSpeed Insights](https://pagespeed.web.dev/)

---

**Última atualização:** 2025-01-21  
**Mantenedor:** Equipe AgriRoute  
**Versão:** 1.0
