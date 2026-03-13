

## Plano: Revisão Jurídica Completa dos Documentos Legais do AgriRoute

### Escopo

Atualizar **3 arquivos** com conteúdo jurídico revisado, alinhado à LGPD, Marco Civil da Internet, CDC, e exigências Google Play/App Store:

1. **`src/components/LegalDocumentDialog.tsx`** — Reescrever `termsContent` e `privacyContent`
2. **`src/components/TrackingConsentModal.tsx`** — Reescrever `CONSENT_TEXT` com linguagem LGPD-compliant
3. **`src/pages/Auth.tsx`** — Atualizar texto do checkbox de cadastro com cláusula de vinculação

---

### 1. Termos de Uso (`termsContent`) — Conteúdo Revisado

Substituir as 7 seções atuais + 6 seções de responsabilização por uma estrutura consolidada e juridicamente consistente:

| Seção | Conteúdo |
|---|---|
| 1. Aceitação dos Termos | Acordo legal, aceitação integral, alterações com notificação |
| 2. Definições e Serviços | Plataforma, produtor, motorista, frete, intermediação tecnológica |
| 3. Formalização e Vinculação Contratual | **Cláusula antigolpe**: negociação originada no app permanece vinculada mesmo com acordos externos |
| 4. Responsabilidades dos Usuários | Dados verdadeiros, credenciais, leis, acordos, comunicação de uso indevido |
| 5. Limitações de Responsabilidade e Monitoramento | AgriRoute como intermediadora, registros de operação, localização mediante consentimento, cooperação jurídica, medidas administrativas (suspensão/bloqueio/preservação de provas) |
| 6. Inadimplência e Execução de Obrigações | Multa de 20%, correção monetária, juros, indenização por danos, responsabilidade independente de exclusão de conta |
| 7. Suspensão e Bloqueio Permanente | Bloqueio por CPF/CNPJ/telefone/dispositivo/IP, condutas que geram bloqueio |
| 8. Verificação e Auditoria | Validação de CPF/CNPJ, documentos, comportamento, ações em inconsistências |
| 9. Avaliação e Reputação | Sistema de avaliação, histórico, restrições por comportamento |
| 10. Responsabilidade por Uso Indevido | Compromisso de boa-fé, consequências de fraude |
| 11. Preservação de Provas Digitais | Registros eletrônicos como prova, Marco Civil, provas do dispositivo do usuário |
| 12. Responsabilidade Penal | Ciência de crimes eletrônicos, cooperação com autoridades |
| 13. Atividades Proibidas | Contas falsas, bots, assédio, hacking, PI |
| 14. Pagamentos e Taxas | Taxa 3%, processamento, reembolso, impostos |
| 15. Disposições Gerais | Lei brasileira, foro SP, vigência, independência das cláusulas |

### 2. Política de Privacidade (`privacyContent`) — Conteúdo Revisado

| Seção | Conteúdo |
|---|---|
| 1. Quem Somos | Identificação da AgriRoute, papel de intermediadora |
| 2. Dados Coletados | Pessoais, documentos, localização GPS (com consentimento), histórico, dados técnicos |
| 3. Finalidades do Tratamento | Conta, matching, pagamentos, documentos fiscais, rastreamento, prevenção de fraudes, **auditoria de operações, resolução de disputas, cooperação com autoridades** |
| 4. Base Legal (LGPD Art. 7) | Consentimento, execução contratual, obrigação legal, legítimo interesse |
| 5. Rastreamento e Localização | Coleta apenas durante frete ativo, consentimento explícito, finalidade clara, possibilidade de recusar |
| 6. Segurança | TLS/SSL, bcrypt, RLS, backups, monitoramento |
| 7. Compartilhamento | Nunca vende dados, compartilha entre partes do frete, processadores de pagamento, autoridades |
| 8. Retenção e Exclusão | Prazos de retenção, exclusão automática de dados sensíveis pós-frete, direito ao esquecimento |
| 9. Direitos do Titular (LGPD) | Acesso, retificação, exclusão, portabilidade, oposição, revogação, **como exercer** |
| 10. Cookies e Dados Técnicos | Cookies essenciais, analytics |
| 11. Contato e DPO | Email, WhatsApp, canal de atendimento |

### 3. Termo de Rastreamento (`CONSENT_TEXT`)

Reescrever para ser LGPD-compliant com linguagem clara:
- Finalidade explícita (segurança da carga, acompanhamento)
- Coleta apenas durante frete ativo (não 24h)
- Direito de recusar (com consequência de não poder executar o frete)
- Dados armazenados com segurança
- Compartilhamento apenas mediante ordem judicial ou autorização

### 4. Checkbox de Cadastro (`Auth.tsx`)

Atualizar label para incluir a cláusula de vinculação:
> "Declaro que li e aceito os Termos de Uso e reconheço que negociações iniciadas na plataforma permanecem vinculadas aos Termos, mesmo que parte da comunicação ocorra por meios externos."

---

### Arquivos modificados

| Arquivo | Mudança |
|---|---|
| `src/components/LegalDocumentDialog.tsx` | Reescrever `termsContent` (15 seções) e `privacyContent` (11 seções) |
| `src/components/TrackingConsentModal.tsx` | Reescrever `CONSENT_TEXT` LGPD-compliant |
| `src/pages/Auth.tsx` | Atualizar labels dos checkboxes de termos com cláusula de vinculação |

### O que NÃO muda

- Layout, design, UX dos modais e formulários
- Lógica de aceitação/rejeição
- Registro de consentimento no banco (tracking_consents)
- Fluxo de cadastro
- Componentes UI (Dialog, Checkbox, Button)

