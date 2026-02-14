
# Remover textos dos Heroes e reduzir botoes em todos os paineis

## Objetivo
Remover os titulos ("Painel de Gerenciamento", "Ola, X") e subtitulos de TODAS as secoes hero dos dashboards, mantendo apenas os botoes de acao. Tambem reduzir o tamanho dos botoes para que a imagem de fundo fique mais visivel.

## Arquivos afetados

### 1. `src/components/ui/hero-action-button.tsx` (botao menor)
- Reduzir altura de `h-11` para `h-9`
- Reduzir padding de `px-5` para `px-4`
- Reduzir texto de `text-sm` para `text-xs`
- Resultado: botoes mais compactos, imagem de fundo mais visivel

### 2. `src/pages/ProducerDashboard.tsx` (Produtor)
- Remover o `<h1>Painel de Gerenciamento</h1>` (linha ~1400)
- Remover o `<p>Gerencie seus fretes...</p>` (linhas ~1401-1403)
- Manter apenas o `<div>` dos botoes

### 3. `src/pages/producer/ProducerDashboardHero.tsx` (Produtor - componente separado)
- Remover o `<h1>Painel de Gerenciamento</h1>` (linha 41-43)
- Remover o `<p>Gerencie seus fretes...</p>` (linha 44-46)
- Manter apenas os botoes

### 4. `src/pages/driver/DriverDashboardHero.tsx` (Motorista)
- Remover o `<h1>Ola, {displayName}</h1>` (linhas 47-49)
- Remover o `<p>Sistema I.A encontra fretes...</p>` (linhas 50-52)
- Remover o Badge de "Motorista - companyName" (linhas 53-58)
- Manter apenas os botoes

### 5. `src/pages/CompanyDashboard.tsx` (Transportadora)
- Remover o Badge "Transportadora" (linhas 737-740)
- Remover o `<h1>Painel de Gerenciamento</h1>` (linhas 742-744)
- Manter o card de info da empresa (CNPJ) pois e funcional, nao decorativo
- Manter apenas os botoes

### 6. `src/components/ServiceProviderHeroDashboard.tsx` (Prestador)
- Remover o `<h1>Ola, {firstName}</h1>` (linhas 168-170)
- Remover o `<p>Sistema I.A encontra solicitacoes...</p>` (linhas 171-173)
- Manter apenas os botoes

## Reducao da altura do hero
- Reduzir `min-h-[250px]` para `min-h-[160px]` em todos os heroes (sem texto, precisa de menos espaco)
- No ServiceProviderHeroDashboard, reduzir `py-12 md:py-16` para `py-6 md:py-8`

## O que NAO sera alterado
- Imagens de fundo (hero backgrounds)
- Logica dos botoes (onClick, modais, etc.)
- Nenhum outro componente fora dos heroes
- Nenhuma funcionalidade existente
