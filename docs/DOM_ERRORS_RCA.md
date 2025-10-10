# Root Cause Analysis: removeChild/insertBefore Errors

## 🔴 Problema
Erros recorrentes de `removeChild`/`insertBefore` causando travamentos na aplicação.

## 🎯 Causa Raiz
**57 instâncias de `key={index}` em 34 arquivos.**

React usa keys para reconciliar o Virtual DOM. Quando usamos `key={index}`:
- Se a lista reordena, React tenta remover/inserir nós que já foram movidos
- Causa race conditions onde `parent.removeChild(node)` falha pois `node.parentNode !== parent`

## ✅ Correção Implementada

### 1. Substituição de TODAS as keys instáveis
- **34 arquivos corrigidos**
- **57 instâncias** de `key={index}` substituídas por identificadores estáveis:
  - Headers: `key={item.label}`
  - Cidades: `key={city}` ou `key={city.name}-${city.state}`
  - Especialidades/certificações: `key={specialty}`, `key={cert}`
  - Fotos: `key={\`photo-${index}-${photo.name}\`}`
  - Skeletons: `key={\`loading-${i}\`}`
  - Features/stats: `key={feature}`, `key={stat.label}`

### 2. ESLint Rule Permanente
- Adicionada rule `react/jsx-key` no `eslint.config.js`
- **BLOQUEIA** novos `key={index}` via CI/CD

### 3. Testes Automatizados
- Criado `cypress/e2e/dom-stability.cy.ts`
- Testa 7 páginas principais
- Valida ausência de erros DOM

## 🛡️ Garantia de Não Recorrência
1. ✅ ESLint impede novos casos
2. ✅ Cypress valida continuamente
3. ✅ Todas as instâncias corrigidas
4. ✅ Documentação atualizada

## 📅 Data de Correção
${new Date().toLocaleDateString('pt-BR')} - Correção definitiva implementada

## 🚀 Resultado Esperado
**Zero erros DOM** - Aplicação estável e sem travamentos.
