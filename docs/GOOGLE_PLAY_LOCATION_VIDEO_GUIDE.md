# 📹 Guia para Gravação do Vídeo de Compliance — Google Play

## Objetivo
Demonstrar ao Google que o app AgriRoute usa `ACCESS_BACKGROUND_LOCATION` de forma legítima, com Foreground Service real e notificação persistente, exclusivamente durante fretes ativos.

---

## 🎬 Roteiro de Gravação (máx. 30 segundos)

### Cena 1 — App aberto, SEM frete ativo (3s)
- Mostrar o dashboard do motorista
- **Nenhuma notificação de rastreamento visível**
- **Nenhum ícone de GPS na barra de status**

### Cena 2 — Iniciar frete / Entrar em trânsito (5s)
- Navegar até um frete ativo
- Tocar em "Iniciar Viagem" ou equivalente
- O app solicita permissão de localização (popup do Android)

### Cena 3 — Permissão concedida + Notificação aparece (5s)
- Aprovar a permissão
- A notificação persistente aparece: **"AgriRoute — Rastreamento Ativo"**
- Mostrar a notificação puxando a barra de status

### Cena 4 — Minimizar app (5s)
- Pressionar botão Home
- A notificação continua visível
- O ícone de GPS continua na barra de status

### Cena 5 — Bloquear/Desbloquear tela (5s)  
- Bloquear a tela
- Aguardar 2-3 segundos
- Desbloquear — notificação ainda presente

### Cena 6 — Finalizar viagem (5s)
- Voltar ao app
- Finalizar o frete (marcar como "Entregue" ou "Concluído")
- **Notificação desaparece automaticamente**
- **Rastreamento encerrado**

---

## ⚠️ Dicas Importantes

### O que DIZER na declaração do Google Play:
> "O AgriRoute monitora a localização do motorista **com o app em segundo plano e com a tela bloqueada** durante fretes ativos, para segurança da carga e compliance logístico. Uma notificação persistente informa o motorista sobre o rastreamento ativo. O serviço é encerrado automaticamente quando o frete é concluído."

### O que NÃO dizer:
- ❌ "Funciona com o celular desligado" (impossível, causa rejeição)
- ❌ "Rastreia o tempo todo" (implica surveillance sem consentimento)
- ❌ "Localização em background permanente" (implica uso contínuo)

### Termos corretos:
- ✅ "Em segundo plano"
- ✅ "Com tela bloqueada"  
- ✅ "Durante frete ativo"
- ✅ "Notificação persistente informando o usuário"
- ✅ "Encerramento automático ao concluir a viagem"

---

## 🔧 Checklist de Validação Pré-Envio

| Item | Status |
|------|--------|
| Foreground Service real com `startForeground()` | ✅ |
| `NotificationChannel` criado (Android 8+) | ✅ |
| Notificação persistente (ongoing, não descartável) | ✅ |
| Botão "Parar Rastreamento" na notificação | ✅ |
| Serviço inicia SOMENTE com frete ativo + gesto do usuário | ✅ |
| Serviço para quando frete finaliza/cancela | ✅ |
| Sem rastreamento no login/dashboard/sem frete | ✅ |
| Permissão solicitada contextualmente (não ao abrir app) | ✅ |
| App não trava se permissão negada | ✅ |
| `webContentsDebuggingEnabled: false` em produção | ✅ |
| `POST_NOTIFICATIONS` declarada no manifest (Android 13+) | ✅ |
| `foregroundServiceType="location"` no service | ✅ |

---

## 📁 Arquivos Envolvidos

### Android Nativo
- `android/app/src/main/AndroidManifest.xml` — permissões + declaração do service
- Plugin: `@capawesome-team/capacitor-android-foreground-service` (registrado via `npx cap sync`)

### TypeScript (Camada Web)
- `src/utils/foregroundService.ts` — wrapper do plugin com NotificationChannel + callbacks
- `src/hooks/location/useLocationSecurityMonitor.ts` — start/stop do service integrado ao watch
- `src/components/DriverAutoLocationTracking.tsx` — atualiza notificação com última posição
- `src/components/UnifiedTrackingControl.tsx` — start/stop manual
- `src/components/ManualLocationTracking.tsx` — start/stop manual (legado)

### Configuração
- `capacitor.config.ts` — `webContentsDebuggingEnabled: false`, `allowMixedContent: true`
