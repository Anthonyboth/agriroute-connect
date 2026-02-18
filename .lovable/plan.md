

## Corrigir Permissão de Localização no App Nativo (Capacitor)

### Problema Identificado

O componente `LocationPermissionModal` usa diretamente `navigator.geolocation` (API do navegador), que **nao funciona** dentro do WebView do Capacitor. O app nativo precisa usar o plugin `@capacitor/geolocation` atraves das funcoes utilitarias ja existentes em `src/utils/location.ts`.

O mesmo problema existe no `useLocationPermission` hook, que delega corretamente para os utilitarios, mas o modal ignora essa logica.

### Mudancas Necessarias

**1. Atualizar `src/components/LocationPermissionModal.tsx`**

Substituir todas as chamadas diretas a `navigator.geolocation` pelas funcoes `requestPermissionSafe()` e `getCurrentPositionSafe()` de `src/utils/location.ts`:

- `checkLocationStatus()` (linha 26-42): Usar `checkPermissionSafe()` em vez de `navigator.geolocation.getCurrentPosition`
- `requestLocation()` (linha 44-99): Usar `requestPermissionSafe()` + `getCurrentPositionSafe()` em vez de `navigator.geolocation.getCurrentPosition`

**2. Verificar outros componentes que usam `navigator.geolocation` diretamente**

Buscar e corrigir qualquer outro componente que use a API do navegador diretamente em vez dos utilitarios Capacitor-aware.

### Detalhes Tecnicos

O arquivo `src/utils/location.ts` ja possui toda a logica necessaria:
- `isNative()` detecta se esta rodando no Capacitor
- `checkPermissionSafe()` usa `Geolocation.checkPermissions()` no nativo
- `requestPermissionSafe()` usa `Geolocation.requestPermissions()` no nativo
- `getCurrentPositionSafe()` usa `Geolocation.getCurrentPosition()` no nativo com retries

O `LocationPermissionModal` sera atualizado para importar e usar essas funcoes, eliminando completamente o uso direto de `navigator.geolocation`.

### Resultado Esperado

Ao clicar "Permitir" no modal, o app nativo usara o plugin Capacitor para solicitar permissao ao Android, que exibira o dialog nativo de permissao. Apos conceder, a localizacao sera captada corretamente.

