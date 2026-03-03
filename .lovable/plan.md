

## Plano: Replicar efeito de brilho (glow) dos StatsCards do Prestador para todos os painéis

### O que está acontecendo

No painel do **Prestador de Serviços** (`ServiceProviderDashboard.tsx`), cada StatsCard recebe manualmente uma className com efeito de hover glow:

```
hover:shadow-lg hover:shadow-primary/30 hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80
```

Cada card usa uma cor de shadow diferente baseada no `iconColor` (primary, orange, green, blue). Nos outros painéis (Motorista, Produtor, Hero do Prestador), os StatsCards **não têm** esse efeito.

### Abordagem

Incorporar o efeito de glow diretamente no componente `StatsCard` (`src/components/ui/stats-card.tsx`), tornando-o padrão para todos os painéis sem alterar nenhum outro arquivo.

### Alteração — 1 arquivo

**`src/components/ui/stats-card.tsx`**

Adicionar ao styles de ambos os tamanhos (`sm` e `md`) as classes de glow, scale e backdrop-blur. A cor do shadow será derivada do `iconColor` prop usando um mapeamento simples:

- `text-primary` → `hover:shadow-primary/30`
- `text-orange-500/600` → `hover:shadow-orange-300`  
- `text-green-500/600` → `hover:shadow-green-300`
- `text-blue-500/600` → `hover:shadow-blue-300`
- `text-purple-500` → `hover:shadow-purple-300`
- `text-amber-500` → `hover:shadow-amber-300`
- `text-teal-500` → `hover:shadow-teal-300`
- default → `hover:shadow-primary/30`

Classes base adicionadas ao Card:
```
hover:shadow-lg hover:scale-105 transition-all duration-300 bg-white/80 backdrop-blur-sm dark:bg-gray-900/80
```

Mais a classe de shadow-color mapeada do iconColor.

### Painéis afetados automaticamente (sem editar)

- Motorista (`DriverDashboardStats.tsx`) — 5 cards
- Produtor (`ProducerDashboardStats.tsx`) — 6 cards  
- Hero do Prestador (`ServiceProviderHeroDashboard.tsx`) — 4 cards
- Analytics (`FreightAnalyticsDashboard.tsx`)

### Painel Admin

O Admin usa um `StatsCard` local (definido no próprio `AdminDashboard.tsx`), não o componente compartilhado. Posso replicar o mesmo efeito lá também. Confirme se deseja incluir o admin.

### O que NÃO muda

- Nenhuma funcionalidade, texto, ícone ou cor existente
- Apenas adiciona o efeito visual de glow/scale ao hover

