

## Correção do Header da Landing Page no Mobile

### Problema
Os botões "Entrar" e "Cadastrar-se" aparecem em telas Android porque usam `hidden sm:flex` (breakpoint 640px). Como a WebView do Android frequentemente tem viewport >= 640px, os botões ficam visíveis junto com o menu hambúrguer.

### Correção
Alterar **2 linhas** em `src/pages/Landing.tsx`:

- **Linha 220**: `hidden sm:flex` para `hidden md:flex` (botão "Cadastrar-se")
- **Linha 231**: `hidden sm:flex` para `hidden md:flex` (botão "Entrar")

Isso alinha os botões com a navegação desktop (linha 204), que já usa `hidden md:flex` (breakpoint 768px). Abaixo de 768px, só o menu hambúrguer aparece.

### Verificação de danos colaterais

Confirmado que **nenhum arquivo de landing, header, navegação ou hero** foi alterado durante a migração de storage. Os únicos arquivos editados foram:

- `FreightCheckinModal.tsx` (storage)
- `FreightAttachments.tsx` (storage)
- `FreightCheckinsViewer.tsx` (storage)
- `DriverInfoTab.tsx` (storage)
- `VehiclePhotoGallery.tsx` (storage)
- `authUploadHelper.ts` (storage)
- `DocumentRequestChat.tsx` (storage)
- `useProposalChat.ts` (storage)
- `ProposalChatPanel.tsx` (storage)

Nenhum desses arquivos tem relação com a Landing page. O problema do `sm:flex` já existia antes da migração -- não foi introduzido por ela.

### Escopo da alteração
Apenas 2 classes CSS em 1 arquivo. Nenhum outro arquivo será tocado.
