# Sistema Hierárquico de Cidades - Documentação

## Visão Geral

Este documento descreve o sistema hierárquico de cidades implementado no AgroRoute para gerenciar áreas de atendimento de motoristas, prestadores de serviços e produtores.

## Arquitetura

### Tabela Central: `user_cities`

A tabela `user_cities` é a estrutura central que relaciona usuários com as cidades onde eles atuam:

```sql
CREATE TABLE user_cities (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  city_id UUID REFERENCES cities(id),
  type user_city_type, -- MOTORISTA_ORIGEM | MOTORISTA_DESTINO | PRESTADOR_SERVICO | PRODUTOR_LOCALIZACAO
  radius_km NUMERIC,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

### Tipos de Uso

- **MOTORISTA_ORIGEM**: Motorista busca fretes com origem nesta cidade
- **MOTORISTA_DESTINO**: Motorista busca fretes com destino nesta cidade
- **PRESTADOR_SERVICO**: Prestador oferece serviços nesta cidade
- **PRODUTOR_LOCALIZACAO**: Localização base do produtor

## Funcionamento

### 1. Adição de Cidade

Quando um usuário adiciona uma cidade:

```typescript
// O usuário seleciona uma cidade e tipo
await supabase.from('user_cities').insert({
  user_id: user.id,
  city_id: cityId,
  type: 'MOTORISTA_ORIGEM',
  radius_km: 50,
  is_active: true
});
```

**Resultado:**
- O usuário passa a fazer parte da hierarquia daquela cidade
- Automaticamente começa a ver fretes/serviços daquela região

### 2. Remoção de Cidade

Quando um usuário remove uma cidade:

```typescript
await supabase.from('user_cities').delete().eq('id', cityId);
```

**Resultado:**
- O usuário é removido da hierarquia daquela cidade
- Automaticamente para de ver fretes/serviços daquela região
- Os números na aba "Disponíveis" diminuem

### 3. Ativação/Desativação

Usuários podem desativar temporariamente uma cidade sem removê-la:

```typescript
await supabase
  .from('user_cities')
  .update({ is_active: false })
  .eq('id', cityId);
```

**Resultado:**
- Fretes/serviços daquela região somem temporariamente
- Pode ser reativada a qualquer momento

## Matching de Fretes/Serviços

### Para Motoristas

A função RPC `get_compatible_freights_for_driver` usa a estrutura hierárquica:

```sql
-- Match por city_id (hierárquico) - PRIORIDADE
WHERE EXISTS (
  SELECT 1
  FROM user_cities uc
  WHERE uc.user_id = driver_user_id
    AND uc.is_active = true
    AND uc.type IN ('MOTORISTA_ORIGEM', 'MOTORISTA_DESTINO')
    AND (
      (uc.type = 'MOTORISTA_ORIGEM' AND f.origin_city_id = uc.city_id) OR
      (uc.type = 'MOTORISTA_DESTINO' AND f.destination_city_id = uc.city_id)
    )
)

-- Fallback para dados antigos sem city_id
OR EXISTS (...)
```

### Para Prestadores de Serviços

A função RPC `execute_service_matching_with_user_cities` funciona de forma similar:

```sql
WHERE EXISTS (
  SELECT 1
  FROM user_cities uc
  WHERE uc.user_id = provider_user_id
    AND uc.is_active = true
    AND uc.type = 'PRESTADOR_SERVICO'
    AND sr.city_id = uc.city_id
)
```

## Atualizações em Tempo Real

O sistema implementa atualização em tempo real usando Supabase Realtime:

```typescript
useEffect(() => {
  const channel = supabase
    .channel('user-cities-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_cities',
        filter: `user_id=eq.${user.id}`
      },
      (payload) => {
        // Recarregar fretes/serviços automaticamente
        fetchCompatibleItems();
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}, [user?.id]);
```

**Resultado:**
- Mudanças em `user_cities` disparam atualização automática
- Lista de fretes/serviços é recarregada instantaneamente
- Números da aba "Disponíveis" atualizam em tempo real

## Componentes

### `UserCityManager`

Componente unificado para gerenciar cidades de qualquer tipo de usuário:

```tsx
<UserCityManager 
  userRole="MOTORISTA" // ou "PRESTADOR_SERVICOS" ou "PRODUTOR"
  onCitiesUpdate={() => {
    // Callback quando cidades são atualizadas
  }}
/>
```

### Componentes Depreciados

Os seguintes componentes estão **depreciados** e não devem mais ser usados:

- ❌ `DriverServiceAreasManager` - Use `UserCityManager` com `userRole="MOTORISTA"`
- ❌ `DriverCityManager` - Use `UserCityManager` com `userRole="MOTORISTA"`
- ❌ `ServiceProviderAreasManager` - Use `UserCityManager` com `userRole="PRESTADOR_SERVICOS"`

## Migração de Dados

Dados antigos de `driver_service_areas` foram automaticamente migrados para `user_cities`:

```sql
INSERT INTO user_cities (user_id, city_id, type, radius_km, is_active, created_at)
SELECT 
  p.user_id,
  c.id,
  'MOTORISTA_ORIGEM'::user_city_type,
  dsa.radius_km,
  dsa.is_active,
  dsa.created_at
FROM driver_service_areas dsa
JOIN profiles p ON dsa.driver_id = p.id
JOIN cities c ON LOWER(TRIM(c.name)) = LOWER(TRIM(dsa.city_name)) 
  AND LOWER(TRIM(c.state)) = LOWER(TRIM(dsa.state))
ON CONFLICT (user_id, city_id, type) DO NOTHING;
```

## Hooks Úteis

### `useUserCities`

Hook para acessar as cidades do usuário:

```typescript
const { cities, loading, error, refetch } = useUserCities();
```

### `useRegionalFiltering`

Hook para filtrar itens por região:

```typescript
const { 
  items, 
  loading, 
  regionConfig,
  loadRegionalItems,
  getRegionalStats 
} = useRegionalFiltering({
  userType: 'MOTORISTA',
  profileId: profile.id
});
```

## Benefícios do Sistema

1. **Unificação**: Todos os tipos de usuários usam a mesma estrutura
2. **Hierarquia**: Relação clara entre usuários e cidades via `city_id`
3. **Performance**: Queries otimizadas usando índices em `city_id`
4. **Tempo Real**: Atualizações automáticas via Supabase Realtime
5. **Flexibilidade**: Fácil adicionar novos tipos de uso
6. **Consistência**: Mesmo comportamento para todos os tipos de usuário

## Fluxo Completo de Uso

1. **Usuário cadastra cidade** → `user_cities.insert()`
2. **Sistema cria relação hierárquica** → `user_id` + `city_id` + `type`
3. **Matching automático** → RPCs usam `user_cities` para encontrar itens compatíveis
4. **Exibição em tempo real** → Realtime subscription atualiza lista
5. **Usuário desativa cidade** → `user_cities.update(is_active = false)`
6. **Itens somem automaticamente** → Realtime dispara atualização

## Troubleshooting

### Fretes não aparecem após adicionar cidade

1. Verificar se `is_active = true` na `user_cities`
2. Verificar se o frete tem `origin_city_id` ou `destination_city_id`
3. Verificar console para erros na RPC

### Realtime não funciona

1. Verificar se o canal está subscrito corretamente
2. Verificar se `user.id` está disponível
3. Verificar logs do Supabase

### Números não atualizam

1. Forçar reload com `refetch()` ou `fetchItems()`
2. Verificar se callback `onCitiesUpdate` está sendo chamado
3. Verificar se o componente está re-renderizando

## Conclusão

O sistema hierárquico de cidades fornece uma solução robusta, escalável e em tempo real para gerenciar áreas de atendimento de todos os tipos de usuários no AgroRoute.
