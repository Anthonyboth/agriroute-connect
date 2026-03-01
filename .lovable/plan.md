

## Plano: Remover botão X do dialog de detalhes do frete (CompanyDashboard)

**Problema**: O dialog de detalhes do frete em `CompanyDashboard.tsx` (linha 1198) mostra dois botões X -- o botão vermelho padrão do DialogContent (canto superior direito) e outro X menor ao lado do badge "Aceito". O usuário quer remover o X grande do dialog.

**Solução**: Adicionar `hideCloseButton={true}` no `DialogContent` da linha 1198. O componente `dialog.tsx` já suporta essa prop (linha 60-63, 87).

**Alteração**:
- `src/pages/CompanyDashboard.tsx` linha 1198: trocar `<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">` por `<DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" hideCloseButton>`.

