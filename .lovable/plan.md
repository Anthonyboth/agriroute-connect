

## Plano: Sincronizar páginas /termos e /privacidade com conteúdo jurídico revisado

### Situação atual

- As rotas `/termos` e `/privacidade` **já existem** e são públicas (sem login).
- O `LegalDocumentDialog.tsx` já contém o conteúdo jurídico revisado (15 seções de Termos, 11 seções de Privacidade).
- **Problema**: As páginas `Terms.tsx` e `Privacy.tsx` ainda exibem o conteúdo antigo (apenas 4 seções de termos, 5 seções de privacidade), desalinhado com o que o usuário aceita no cadastro.

### O que será feito

| Arquivo | Mudança |
|---|---|
| `src/pages/Terms.tsx` | Reescrever usando as 15 seções do `termsContent` revisado (vinculação contratual, cláusula antigolpe, inadimplência 20%, bloqueio permanente, verificação, reputação, provas digitais, responsabilidade penal) |
| `src/pages/Privacy.tsx` | Reescrever usando as 11 seções do `privacyContent` revisado (base legal LGPD Art. 7, rastreamento apenas durante frete ativo, direitos do titular, retenção e exclusão, DPO) |

### Abordagem

- Importar e reutilizar os arrays `termsContent` e `privacyContent` diretamente do `LegalDocumentDialog.tsx` (exportá-los), garantindo uma **única fonte de verdade** para o conteúdo jurídico.
- Manter o layout visual existente das páginas (header, hero, cards, footer de contato).
- Manter as páginas acessíveis sem autenticação (já são).

### Sobre o item 3 (revisão jurídica)

A revisão jurídica completa já foi implementada na mensagem anterior — os Termos de Uso (15 seções), Política de Privacidade (11 seções), `CONSENT_TEXT` LGPD-compliant e checkbox de cadastro com cláusula de vinculação já estão no código. Este plano apenas sincroniza as páginas públicas dedicadas.

