# Documentação: Cálculo ANTT

## Visão Geral

O sistema calcula automaticamente o preço mínimo de frete conforme as tabelas oficiais da ANTT (Agência Nacional de Transportes Terrestres), seguindo a **Lei 13.703/2018** que estabelece o piso mínimo do frete rodoviário.

## Fórmula Oficial ANTT

```
Preço Mínimo = (Taxa por KM × Distância) + Taxa Fixa
```

**Valores por carreta** são sempre calculados primeiro, e então multiplicados pelo número de carretas quando necessário.

## Mapeamento de Tipos de Carga → Categorias ANTT

| Tipo de Carga (Sistema) | Categoria ANTT Oficial |
|-------------------------|------------------------|
| Grãos (Soja, Milho, Trigo, Arroz) | Granel sólido |
| Fertilizante, Calcário, Farelo | Granel sólido |
| Açúcar, Café | Granel sólido |
| Sementes em Bags | Neogranel |
| Combustível (Diesel, Gasolina) | Granel líquido |
| Defensivos Agrícolas | Perigosa (carga geral) |
| Ração, Algodão, Madeira | Carga Geral |
| Gado, Suínos | Carga Geral |
| Frutas, Hortaliças | Carga Geral |
| Carnes, Laticínios | Carga Geral |
| Máquinas, Equipamentos | Carga Geral |

### Fallback

Se o tipo de carga não for encontrado no mapeamento, o sistema usa **"Carga Geral"** como fallback.

## Tipos de Tabela (A/B/C/D)

| Tabela | Performance | Propriedade |
|--------|-------------|-------------|
| A | Normal | Próprio |
| B | Normal | Terceiros |
| C | Alta | Próprio |
| D | Alta | Terceiros |

**Critérios:**
- **Performance**: Selecionado pelo usuário (checkbox "Alta Performance")
- **Propriedade**: Selecionado pelo usuário (radio "Próprio" vs "Terceiros")

## Número de Eixos

Valores válidos: **2, 3, 4, 5, 6, 7, 9**

- Se não especificado, o sistema usa **5 eixos** como padrão
- Cada combinação (Categoria + Tabela + Eixos) tem uma taxa específica na tabela ANTT

## Processo de Cálculo

### 1. Na Criação do Frete (`CreateFreightModal`)

1. Usuário preenche tipo de carga, origem, destino
2. Sistema calcula distância via Google Maps API
3. Usuário seleciona número de eixos, performance, propriedade
4. Sistema chama `antt-calculator` edge function
5. **Validação obrigatória**: Se ANTT retornar NULL/0, frete NÃO é criado
6. Frete é salvo com `minimum_antt_price` (valor TOTAL)

**Retry Logic:** 3 tentativas com delay de 1s entre elas

### 2. Na Edição do Frete (`EditFreightModal`)

1. Se campos relevantes mudarem (cargo_type, distance_km, axles, high_performance), recalcula automaticamente
2. Mostra preview do novo valor ANTT antes de salvar
3. **Validação**: Não permite salvar se recálculo falhar

### 3. Recálculo em Massa (`recalculate-all-antt-freights`)

**Uso:** Ferramenta administrativa para corrigir fretes antigos sem ANTT

**Acesso:** Apenas usuários ADMIN

**Rate Limit:** 1 execução por hora por admin

**Funcionamento:**
1. Busca até 500 fretes com `minimum_antt_price` NULL ou 0
2. Para cada frete, calcula ANTT baseado nos dados existentes
3. Atualiza o banco de dados
4. Retorna relatório detalhado (sucessos, falhas, pulados)

## Edge Functions

### `antt-calculator`

**Endpoint:** `supabase.functions.invoke('antt-calculator')`

**Parâmetros:**
```typescript
{
  cargo_type: string;
  distance_km: number;
  axles: number; // 2-9
  table_type: 'A' | 'B' | 'C' | 'D';
  required_trucks: number; // default 1
}
```

**Resposta:**
```typescript
{
  minimum_freight_value: number; // Por carreta
  minimum_freight_value_total: number; // Total
  suggested_freight_value: number; // +10% do mínimo
  suggested_freight_value_total: number;
  calculation_details: {
    antt_category: string;
    table_type: string;
    axles: number;
    distance_km: number;
    rate_per_km: number;
    fixed_charge: number;
    formula: string;
  }
}
```

### `recalculate-all-antt-freights`

**Endpoint:** `supabase.functions.invoke('recalculate-all-antt-freights')`

**Parâmetros:** Nenhum

**Resposta:**
```typescript
{
  success: boolean;
  message: string;
  results: {
    total: number;
    updated: number;
    failed: number;
    skipped: number;
    details: Array<{
      freight_id: string;
      status: 'success' | 'failed' | 'skipped';
      reason?: string;
      minimum_antt_price?: number;
    }>
  }
}
```

## Painel de Debug Admin

**Localização:** Admin Panel → Sistema → Debug ANTT

**Funcionalidades:**
1. **Estatísticas em tempo real:**
   - Total de fretes CARGA
   - Quantos têm ANTT calculado
   - Quantos estão sem ANTT (NULL/0)
   - Percentual de cobertura

2. **Recálculo em Massa:**
   - Botão para recalcular todos os fretes sem ANTT
   - Progress bar e relatório detalhado
   - Rate limit de 1x por hora

3. **Simulador de Cálculo:**
   - Teste manual de cálculos ANTT
   - Inputs: cargo_type, distance, axles, table_type, trucks
   - Exibe breakdown completo (fórmula, taxa/km, taxa fixa)

## Validações

### ✅ Validações Implementadas

1. **Criação obrigatória:** Frete CARGA não pode ser criado sem ANTT válido
2. **Retry automático:** 3 tentativas em caso de falha temporária
3. **Recálculo em edição:** Automático quando campos relevantes mudam
4. **Fallback:** Usa "Carga Geral" se categoria não encontrada
5. **Rate limit:** Protege contra abuso no recálculo em massa
6. **Auditoria:** Todas as operações são logadas

### ❌ Erros Comuns

| Erro | Causa | Solução |
|------|-------|---------|
| "Taxa ANTT não encontrada" | Combinação (categoria + tabela + eixos) não existe na base | Verificar se `antt_rates` está populada |
| "Valor total abaixo do mínimo ANTT" | Preço proposto < mínimo calculado | Aumentar preço do frete |
| "Rate limit excedido" | Tentou recalcular em massa 2x na mesma hora | Aguardar 1 hora |
| "Acesso negado" | Usuário não é ADMIN | Apenas admins podem usar ferramentas de manutenção |

## Tabela `antt_rates`

**Estrutura:**
```sql
CREATE TABLE antt_rates (
  id UUID PRIMARY KEY,
  cargo_category TEXT NOT NULL, -- 'Granel sólido', 'Carga Geral', etc.
  table_type TEXT NOT NULL,     -- 'A', 'B', 'C', 'D'
  axles INTEGER NOT NULL,        -- 2-9
  rate_per_km NUMERIC NOT NULL,  -- Taxa por km (R$)
  fixed_charge NUMERIC NOT NULL, -- Taxa fixa (R$)
  effective_date TIMESTAMP,      -- Data de vigência
  created_at TIMESTAMP
);
```

**Índices:**
```sql
CREATE INDEX idx_antt_rates_lookup 
ON antt_rates(cargo_category, table_type, axles);
```

## Atualizando Tabelas ANTT

Quando a ANTT publicar novas resoluções/tabelas:

1. **Backup da tabela atual:**
   ```sql
   CREATE TABLE antt_rates_backup_YYYYMMDD AS 
   SELECT * FROM antt_rates;
   ```

2. **Inserir novos valores:**
   ```sql
   INSERT INTO antt_rates (cargo_category, table_type, axles, rate_per_km, fixed_charge, effective_date)
   VALUES 
   ('Granel sólido', 'A', 5, 2.50, 150.00, '2024-01-01'),
   -- ... outros valores
   ```

3. **Rodar recálculo em massa** via painel admin

4. **Validar resultados** comparando alguns fretes manualmente

## Troubleshooting

### Fretes antigos sem ANTT

**Solução:** Use o painel de Debug ANTT → Recálculo em Massa

### ANTT calculando incorretamente

1. Verificar mapeamento de cargo_type no `antt-calculator/index.ts`
2. Conferir valores na tabela `antt_rates`
3. Validar fórmula: `(rate_per_km × distance) + fixed_charge`
4. Usar Simulador de Cálculo no painel admin

### Performance lenta

- Cache de cálculos ANTT pode ser implementado se necessário
- Otimizar índices na tabela `antt_rates`
- Considerar pre-calcular ANTT para distâncias comuns

## Referências Legais

- **Lei 13.703/2018** - Política Nacional de Pisos Mínimos do Transporte Rodoviário de Cargas
- **Resolução ANTT nº 5.867/2021** - Tabelas de pisos mínimos vigentes
- Site oficial: https://www.gov.br/antt

## Contato

Para dúvidas sobre o cálculo ANTT ou atualização de tabelas, contate o time de desenvolvimento.
