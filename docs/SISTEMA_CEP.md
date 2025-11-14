# 🏠 Sistema de Preenchimento Automático por CEP

Sistema completo de busca, cache e sincronização de CEPs implementado no AgroiRoute.

## 📋 Visão Geral

O sistema permite buscar informações de endereço automaticamente a partir do CEP, com:
- ✅ **Cache local** (IndexedDB/localStorage) - 7 dias
- ✅ **Cache Supabase** (banco de dados) - 7 dias  
- ✅ **APIs externas** (ViaCEP + BrasilAPI como fallback)
- ✅ **Autocompletar** inteligente enquanto digita
- ✅ **Modo offline** com sincronização automática
- ✅ **Exibição de CEP** em todos os cards de frete

---

## 🏗️ Arquitetura

### 1️⃣ **Database Schema**

```sql
-- Tabela cities: armazena CEP base das cidades
ALTER TABLE cities ADD COLUMN zip_code TEXT;
ALTER TABLE cities ADD COLUMN zip_code_ranges JSONB;

-- Tabela freights: CEPs de origem e destino
ALTER TABLE freights ADD COLUMN origin_zip_code TEXT;
ALTER TABLE freights ADD COLUMN destination_zip_code TEXT;

-- Cache de CEPs consultados
CREATE TABLE zip_code_cache (
  zip_code TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  state TEXT NOT NULL,
  neighborhood TEXT,
  street TEXT,
  city_id UUID REFERENCES cities(id),
  lat NUMERIC,
  lng NUMERIC,
  source TEXT CHECK (source IN ('viacep', 'brasilapi', 'manual')),
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (NOW() + INTERVAL '7 days')
);
```

### 2️⃣ **RPC Functions**

**`search_city_by_zip(p_zip_code TEXT)`**
- Busca CEP no cache Supabase
- Retorna cidade, estado, bairro, coordenadas
- Valida se não está expirado (7 dias)

**`save_zip_to_cache(...)`**
- Salva resultado de busca no cache Supabase
- Atualiza se já existir (UPSERT)
- Define expiração automática

---

## 🔧 Componentes

### **ZipCodeInput**
```tsx
<ZipCodeInput
  label="CEP"
  value={zipCode}
  onChange={(zipCode, cityData) => {
    // zipCode: string formatado (00000-000)
    // cityData: { city, state, neighborhood, cityId, lat, lng }
  }}
  required={true}
  showAutoComplete={true}
/>
```

**Recursos:**
- ✅ Formatação automática (00000-000)
- ✅ Validação em tempo real
- ✅ Ícones de status (loading, sucesso, erro)
- ✅ Autocompletar com sugestões do cache
- ✅ Busca automática ao completar 8 dígitos

---

## 📦 Serviços

### **ZipCodeService**

```typescript
// Buscar CEP (cache local → cache Supabase → APIs)
const result = await ZipCodeService.searchZipCode('78850000');
// { zipCode, city, state, neighborhood, street, cityId, lat, lng, source }

// Formatar CEP
ZipCodeService.formatZipCode('78850000'); // "78850-000"

// Validar formato
ZipCodeService.validateZipFormat('78850000'); // true

// Autocompletar
const suggestions = await ZipCodeService.autocompleteZipCode('788');
// [{ zipCode, city, state, ... }]

// Sincronizar ao reconectar
ZipCodeService.syncOnReconnect();
```

### **useZipCode Hook**

```typescript
const { loading, data, error, searchZipCode, clearData } = useZipCode();

// Buscar CEP
const result = await searchZipCode('78850-000');

// data: { zipCode, city, state, neighborhood, cityId, lat, lng }
// error: "CEP não encontrado" | "Erro ao buscar CEP"
```

---

## 🌐 APIs Externas

### **1. ViaCEP (Principal)**
- **URL:** `https://viacep.com.br/ws/{CEP}/json/`
- **Gratuita** e sem autenticação
- **Retorna:** logradouro, bairro, localidade, uf

### **2. BrasilAPI (Fallback)**
- **URL:** `https://brasilapi.com.br/api/cep/v1/{CEP}`
- **Gratuita** e sem autenticação
- **Uso:** Backup quando ViaCEP falha

---

## 💾 Sistema de Cache

### **Cache Local (localStorage)**
```typescript
{
  "zipcode_78850000": {
    "zipCode": "78850000",
    "city": "Primavera do Leste",
    "state": "MT",
    "neighborhood": "Centro",
    "cityId": "uuid",
    "expiresAt": "2025-11-21T00:00:00Z",
    "source": "viacep"
  }
}
```
**Validade:** 7 dias  
**Limpeza:** Automática ao expirar

### **Cache Supabase**
- Compartilhado entre todos os usuários
- Reduz chamadas às APIs externas
- Validade: 7 dias com renovação automática

---

## 🔄 Sincronização Offline

O sistema funciona **mesmo sem internet**:

1. **Usuário offline** → Busca no cache local
2. **Reconexão detectada** → `ZipCodeService.syncOnReconnect()`
3. **Cache expirado?** → Atualiza via APIs

**Implementação no App.tsx:**
```typescript
const ZipCodeSyncOnReconnect = () => {
  React.useEffect(() => {
    const handleOnline = () => {
      ZipCodeService.syncOnReconnect();
    };
    window.addEventListener('online', handleOnline);
    return () => window.removeEventListener('online', handleOnline);
  }, []);
  return null;
};
```

---

## 📍 Integração nos Fretes

### **CreateFreightModal**
- Opção de usar **CitySelector** (busca por nome) OU
- **ZipCodeInput** para preenchimento automático
- Salva `origin_zip_code` e `destination_zip_code`

### **FreightCard**
```tsx
{freight.origin_city} - {freight.origin_state}
{freight.origin_zip_code && (
  <span>(CEP: {formatZipCode(freight.origin_zip_code)})</span>
)}
```

---

## 🎯 Cidades do Mato Grosso (MT)

### **Edge Function: populate-mt-cities-zip**

```bash
# Disparar manualmente
curl -X POST https://seu-projeto.supabase.co/functions/v1/populate-mt-cities-zip
```

**Cidades incluídas:**
- ✅ Cuiabá (78000-000)
- ✅ Várzea Grande (78110-000)
- ✅ Rondonópolis (78700-000)
- ✅ Primavera do Leste (78850-000)
- ✅ **Poxoréu (78840-000)** ← Adicionado especialmente
- ✅ Sinop, Sorriso, Lucas do Rio Verde, e mais 15 cidades

---

## 🚀 Uso Prático

### **1. Criar Frete com CEP**
```tsx
import { ZipCodeInput } from '@/components/ZipCodeInput';

<ZipCodeInput
  label="CEP de Origem"
  value={originZip}
  onChange={(zip, cityData) => {
    setOriginZip(zip);
    if (cityData) {
      setOriginCity(cityData.city);
      setOriginState(cityData.state);
      setOriginCityId(cityData.cityId);
    }
  }}
  required
/>
```

### **2. Exibir CEP nos Cards**
```tsx
import { ZipCodeService } from '@/services/zipCodeService';

<p>
  {freight.origin_city} - {freight.origin_state}
  {freight.origin_zip_code && (
    <span className="text-muted-foreground">
      (CEP: {ZipCodeService.formatZipCode(freight.origin_zip_code)})
    </span>
  )}
</p>
```

---

## ✅ Validações

### **Formato**
```typescript
ZipCodeService.validateZipFormat('78850000'); // true
ZipCodeService.validateZipFormat('7885000');  // false (7 dígitos)
ZipCodeService.validateZipFormat('abc');      // false (não numérico)
```

### **Existência**
```typescript
const result = await ZipCodeService.searchZipCode('00000000');
// null (CEP não existe)

const result = await ZipCodeService.searchZipCode('78850000');
// { city: "Primavera do Leste", state: "MT", ... }
```

---

## 🐛 Troubleshooting

### **CEP não encontrado**
1. Verificar formato (8 dígitos)
2. Checar se está no cache local: `localStorage.getItem('zipcode_78850000')`
3. Testar APIs manualmente:
   ```bash
   curl https://viacep.com.br/ws/78850000/json/
   curl https://brasilapi.com.br/api/cep/v1/78850000
   ```

### **Cache não atualiza**
```typescript
// Limpar cache local
Object.keys(localStorage)
  .filter(k => k.startsWith('zipcode_'))
  .forEach(k => localStorage.removeItem(k));

// Limpar cache Supabase
DELETE FROM zip_code_cache WHERE expires_at < NOW();
```

### **Autocompletar não funciona**
- Mínimo 3 caracteres necessários
- Apenas CEPs em cache aparecem (não busca em APIs em tempo real)

---

## 📊 Performance

| Operação | Tempo Esperado |
|----------|----------------|
| Cache local | < 10ms |
| Cache Supabase | < 200ms |
| ViaCEP API | < 1s |
| BrasilAPI | < 1.5s |

---

## 🔐 Segurança

- ✅ RLS habilitado em `zip_code_cache`
- ✅ Apenas leitura para usuários autenticados
- ✅ Service role pode escrever (Edge Functions)
- ✅ Validação de formato antes de consultar APIs
- ✅ Rate limiting implícito (cache reduz chamadas)

---

## 🎓 Boas Práticas

### ✅ Fazer
- Sempre usar `ZipCodeInput` para novos campos de CEP
- Exibir CEP junto com cidade nos cards
- Validar CEP antes de salvar no banco
- Usar cache local quando possível

### ❌ Evitar
- Fazer múltiplas consultas simultâneas do mesmo CEP
- Modificar campos `zip_code` manualmente no banco
- Desabilitar cache (performance)
- Usar APIs direto sem passar pelo serviço

---

## 📚 Referências

- [ViaCEP Docs](https://viacep.com.br/)
- [BrasilAPI Docs](https://brasilapi.com.br/docs)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [React Hooks Best Practices](https://react.dev/reference/react)

---

**Desenvolvido para AgroiRoute** 🚜🌾
