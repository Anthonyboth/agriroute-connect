
Objetivo aprovado: validar e endurecer TODOS os fluxos de cadastro (incluindo câmera Android/iOS) antes de novo build, com checklist técnico + plano de teste.

1) Diagnóstico do estado atual (audit de código já feito)
- Correções de câmera já presentes:
  - `CameraSelfie.tsx`: nativo usa `CapCamera.getPhoto` direto no clique; web usa stream/getUserMedia.
  - `DocumentUpload.tsx` e `DocumentUploadLocal.tsx`: nativo usa `CameraSource.Camera`; web usa `useWebDocumentCamera`.
  - `MobileAppDownloadPopup.tsx`: já bloqueia nativo/PWA (inclui `localhost` sem porta).
- Regressions já documentadas no shield:
  - FRT-057/058/059/060/061 (câmera/cadastro)
  - FRT-064 (popup download no app)
  - FRT-068 (Splash plugin noise)
- Risco crítico ainda aberto (encontrei no fluxo afiliado):
  - `AffiliatedDriverSignup.tsx` aceita `application/pdf` para comprovante, mas no upload final força `image/jpeg` + extensão `.jpg` para todos os arquivos.
  - Mesmo com falha de upload de documento, o fluxo pode continuar e notificar como “cadastro completo”.

2) Plano de implementação (todos os cadastros)
A. Hardening do upload no cadastro afiliado
- Arquivo: `src/pages/AffiliatedDriverSignup.tsx`
- Ajustes:
  - Reescrever helper `uploadDocument` para usar MIME/extensão real do blob/arquivo (não hardcode jpg).
  - Validar resultado obrigatório dos 4 uploads (selfie + 3 docs); se algum falhar, bloquear finalização.
  - Corrigir payload de notificação (`has_complete_profile`, `documents_count`) para refletir estado real.

B. Consistência de validação entre fluxos
- Arquivos:
  - `src/pages/AffiliatedDriverSignup.tsx`
  - `src/pages/CompleteProfile.tsx`
  - `src/components/ServiceProviderRegistrationForm.tsx`
  - `src/pages/TransportCompanyRegistration.tsx`
- Ajustes:
  - Garantir regra única: “sem documento obrigatório salvo => não finaliza”.
  - Padronizar mensagens de erro por documento ausente/falha de upload.

C. Gatilho anti-surpresa para build nativo
- Arquivos:
  - `scripts/validate-native-release.mjs`
  - (se necessário) `package.json`
- Ajustes:
  - Estender preflight para checar sincronização nativa mínima antes de release:
    - Android assets existentes (`android/app/src/main/assets/public/index.html`)
    - Config nativa sincronizada
    - Falha explícita com instrução de correção
- Motivo: reduzir “plugin not implemented” por build dessincronizado.

D. Biblioteca de regressão
- Arquivo: `src/hooks/useRegressionShield.ts`
- Adicionar entradas para:
  - Upload afiliado com MIME/extensão incorretos.
  - Finalização indevida quando upload falha.
- Incluir test cases objetivos de regressão.

3) Plano de testes (obrigatório antes do build)
A. Preview mobile (390x672)
- Validar UI/fluxo completo de cadastro para:
  - Produtor
  - Motorista autônomo
  - Motorista afiliado
  - Transportadora
  - Prestador
- Confirmar:
  - Botão “Abrir câmera” abre câmera no browser mobile (não galeria) nos componentes web.
  - Validação trava corretamente quando faltar doc obrigatório.

B. Android nativo (APK/AAB local)
- Testar em fluxo real:
  - Selfie (frontal), documento frente/verso, comprovante.
  - Cancelamento de câmera.
  - Retentativa após erro.
- Confirmar ausência de:
  - “plugin is not implemented” para câmera no fluxo de cadastro.
  - avanço com documento faltante.

C. iOS nativo
- Mesma matriz do Android, com foco em:
  - retorno da câmera ao app
  - persistência imediata do estado após captura
  - finalização sem race condition

D. Critério de aceite
- Nenhum fluxo finaliza com documento obrigatório ausente.
- Câmera abre corretamente em Android/iOS nativo.
- Sem falso “cadastro completo” quando upload falha.
- RegressionShield atualizado com todos os bugs corrigidos nesta rodada.

4) Execução sugerida em ordem
1. Corrigir upload/validação do `AffiliatedDriverSignup`.
2. Padronizar bloqueios de finalização nos demais cadastros.
3. Atualizar preflight nativo para bloquear build inseguro.
4. Registrar novos FRTs no `useRegressionShield.ts`.
5. Rodar checklist de testes (preview + Android + iOS) e liberar build somente se 100% dos critérios passarem.

5) Detalhes técnicos (resumo)
- Arquivos-alvo principais:
  - `src/pages/AffiliatedDriverSignup.tsx`
  - `scripts/validate-native-release.mjs`
  - `src/hooks/useRegressionShield.ts`
  - validação cruzada em `CompleteProfile`, `ServiceProviderRegistrationForm`, `TransportCompanyRegistration`
- Risco principal mapeado:
  - incoerência de MIME/extensão + conclusão indevida no afiliado.
