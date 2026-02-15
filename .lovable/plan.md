
# Correcao: Localizacao aparecendo como "Desativada" mesmo com GPS funcionando

## Problema Identificado

O GPS esta funcionando normalmente no app (coordenadas estao sendo enviadas ao banco de dados). Porem, a funcao `Geolocation.checkPermissions()` do plugin Capacitor esta retornando um status incorreto em alguns dispositivos Android, fazendo com que o app mostre erroneamente:

- Toast: "Permissao de localizacao negada"
- Alerta: "Localizacao Desativada"

Isso acontece porque o hook `useLocationPermissionSync` confia cegamente no resultado de `checkPermissions()`, ignorando evidencias de que o GPS esta ativo (como coordenadas recentes no banco).

## Solucao

### 1. Tornar `useLocationPermissionSync` mais resiliente

Adicionar uma verificacao de fallback: se `checkPermissionSafe()` retornar `false`, mas o perfil do usuario ja tem coordenadas GPS recentes (menos de 10 minutos), considerar a localizacao como ativa. Isso evita o falso negativo do Capacitor.

**Arquivo:** `src/hooks/useLocationPermissionSync.ts`

- Apos `checkDevicePermission()` retornar `false`, verificar se `profile.current_location_lat` e `profile.last_gps_update` existem e sao recentes
- Se sim, considerar `isDeviceLocationEnabled = true` e sincronizar como `true`

### 2. Adicionar fallback com `getCurrentPosition` no `checkPermissionSafe`

Quando `Geolocation.checkPermissions()` retornar nao-granted em plataforma nativa, tentar um `getCurrentPosition` rapido como prova real de que o GPS funciona.

**Arquivo:** `src/utils/location.ts`

- Na funcao `checkPermissionSafe()`, quando em plataforma nativa e o resultado for nao-granted, fazer uma tentativa rapida de `Geolocation.getCurrentPosition` com timeout curto (3s)
- Se obtiver posicao, retornar `true` (GPS funciona, permissao esta concedida)

### 3. Evitar toast duplicado no `DriverAutoLocationTracking`

**Arquivo:** `src/components/DriverAutoLocationTracking.tsx`

- Se `checkPermissionSafe()` retornar `false`, antes de mostrar erro, tentar `requestPermissionSafe()` que ja faz uma chamada real ao GPS
- Ja esta fazendo isso, mas o toast de erro aparece mesmo assim. Verificar se o `watchPositionSafe` esta disparando erro de permissao apos o check falhar

## Resumo das Alteracoes

| Arquivo | Mudanca |
|---------|---------|
| `src/utils/location.ts` | Fallback com getCurrentPosition quando checkPermissions falha em nativo |
| `src/hooks/useLocationPermissionSync.ts` | Fallback usando coordenadas recentes do perfil como evidencia de GPS ativo |

Nenhuma outra parte do codigo sera alterada.
