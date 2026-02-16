

## Correções de Exibição para URLs Assinadas Expiradas

A verificação dos 5 arquivos de upload confirmou que a lógica de `createSignedUrl` está correta em todos eles. Porém, foram encontrados **2 problemas nos componentes de exibição** que farão com que imagens/arquivos não carreguem após 24h:

### Problema 1: FreightCheckinsViewer.tsx (linha 295)

O componente usa `<img src={photo}>` diretamente para exibir fotos de check-in. Como as URLs assinadas expiram em 24h, fotos antigas ficarão quebradas.

**Correção**: Substituir `<img>` por `StorageImage` (que já possui fallback automático para regenerar signed URLs expiradas).

```
// ANTES (linha 295):
<img src={photo} alt={...} className={...} />

// DEPOIS:
<StorageImage src={photo} alt={...} className={...} />
```

Adicionar import de `StorageImage` no topo do arquivo.

### Problema 2: FreightAttachments.tsx (linhas 430 e 459)

Dois sub-problemas:
- **Linha 430**: Link de download `<a href={attachment.file_url}>` usa URL que pode estar expirada.
- **Linha 459**: Preview de imagem `<img src={previewUrl}>` usa URL que pode estar expirada.

**Correção**:
1. Substituir `<img src={previewUrl}>` no dialog de preview por `StorageImage`.
2. Substituir o link de download direto por um botão que gera uma signed URL fresca antes de abrir o download.

### Arquivos a serem modificados

| Arquivo | Alteração |
|---------|-----------|
| `src/components/FreightCheckinsViewer.tsx` | Importar `StorageImage`, substituir `<img>` na linha 295 |
| `src/components/freight/FreightAttachments.tsx` | Importar `StorageImage`, substituir `<img>` na preview (linha 459), adicionar função de download com signed URL fresca |

### Detalhes técnicos

**FreightCheckinsViewer.tsx**:
- Adicionar `import { StorageImage } from '@/components/ui/storage-image';`
- Linha 295: trocar `<img src={photo} alt={...} className="w-full h-64 object-cover rounded border" />` por `<StorageImage src={photo} alt={...} className="w-full h-64 object-cover rounded border" />`

**FreightAttachments.tsx**:
- Adicionar `import { StorageImage } from '@/components/ui/storage-image';`
- Criar uma funcao `handleDownload` que extrai bucket/path da URL, gera uma signed URL fresca via `createSignedUrl`, e abre o download com `window.open()`
- Linha 430: trocar `<a href={attachment.file_url} download>` por `<button onClick={() => handleDownload(attachment.file_url, attachment.file_name)}>`
- Linha 459: trocar `<img src={previewUrl}>` por `<StorageImage src={previewUrl} alt="Preview" className="w-full h-auto max-h-[70vh] object-contain rounded-lg" />`

Nenhuma migração de banco de dados é necessária. As políticas RLS e INSERT já estão corretas.

