

## Redesign dos Cards de Fretes Rurais — Regra 60-30-10

### Diagnóstico Atual (problemas identificados)

O `FreightCard.tsx` (914 linhas) tem:
- **Excesso de badges** no topo (urgência, status, coleta, veículo, vagas) — poluição visual, sem hierarquia
- **Cores competindo**: verde, laranja, azul, roxo, amarelo — viola a 60-30-10
- **Informações úteis ausentes**: R$/km (decisivo para motoristas), tempo estimado de viagem, nome do solicitante
- **Seção de preço separada do contexto** — o motorista precisa calcular mentalmente se vale a pena
- **Origem/Destino verbose** — cidade+estado+CEP+endereço ocupa espaço demais

### Paleta 60-30-10 (mantendo as cores do app)

```text
60% — bg-card / bg-background (superfície limpa, neutro)
30% — text-foreground + border-border + bg-muted (texto, separadores, áreas secundárias)
10% — primary (verde) APENAS em: preço, CTA "Aceitar", badge urgência alta
       accent/destructive pontual: alertas ANTT, coleta urgente
```

### Informações a adicionar

| Info | Por quê | Fonte |
|------|---------|-------|
| **R$/km** | Métrica #1 do motorista para decidir | `price / distance_km` |
| **Tempo estimado** | Planejamento de rota | `distance_km / 60` (média 60km/h) |
| **Prazo restante para coleta** | Urgência real, não badge abstrata | `pickup_date - now` |
| **Indicador visual de rentabilidade** | Comparar com meta RPM do mercado (~R$6/km) | Cálculo local |

### Informações a remover/simplificar

- Badge "Carga" redundante (já tem ícone+título)
- CEP (raramente útil no card, pode ir no detalhe)
- Badge veículo duplicado (aparece 2x: badges + linha de peso)
- Emoji 📍/📌 de distância (confuso)

### Nova estrutura do card

```text
┌─────────────────────────────────────────────┐
│  🌾 Milho                        Média ●    │  ← Título + dot de urgência (não badge)
│  Coleta em 2 dias                           │  ← Texto simples, não badge
├─────────────────────────────────────────────┤
│  ○ Rondonópolis/MT                          │  ← Origem compacta
│  ↓                                          │
│  ● Juara/MT                                 │  ← Destino compacta
│                                             │
│  190 km  •  ~3h  •  0.1 t  •  Truck        │  ← Linha de specs compacta
├─────────────────────────────────────────────┤
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ 26/02    │  │ 01/03    │  │ R$14,21  │  │  ← Grid 3 cols: coleta, entrega, R$/km
│  │ Coleta   │  │ Entrega  │  │ por km   │  │
│  └──────────┘  └──────────┘  └──────────┘  │
├─────────────────────────────────────────────┤
│  R$ 2.700,00 fixo          ⚠ ANTT s/ calc  │  ← Preço principal
│                                             │
│  [████ Aceitar ████]  [Contraproposta]      │  ← CTAs
└─────────────────────────────────────────────┘
```

### Plano de implementação

1. **Refatorar o CardHeader** — substituir cascata de badges por: título + dot colorido de urgência + texto "Coleta em X dias" inline. Remover badge "Carga", badge veículo duplicado, emojis de distância.

2. **Compactar Origem/Destino** — layout vertical com dot-line (○ → ●), exibir apenas `cidade/UF`, mover endereço completo para tooltip. Remover CEP do card.

3. **Criar linha de specs** — uma única linha horizontal: `{km} • {~tempo} • {peso} • {veículo}` em `text-xs text-muted-foreground`.

4. **Grid 3 colunas** — substituir o grid 2 colunas (coleta/entrega) por 3 colunas incluindo R$/km calculado com cor semântica (verde se ≥ R$6/km, amarelo se entre R$4-6, vermelho se < R$4).

5. **Simplificar footer de preço** — preço grande à esquerda, badge ANTT menor e inline, remover ícone DollarSign solto.

6. **Aplicar 60-30-10 nas classes CSS** — remover `gradient-to-br`, `bg-gradient-to-r` excessivos. Card usa `bg-card` limpo. Bordas sutis `border-border/40`. Verde primário SOMENTE no preço e CTA.

7. **Manter compatibilidade total** — mesma interface `FreightCardProps`, mesmos handlers, mesmos modais. Apenas reestruturação visual.

