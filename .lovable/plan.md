

# Plano: Emissão Assistida de NF-A para MEI

## Contexto (informacoes confirmadas pelo SEFAZ)

A SEFAZ-MT confirmou que **nao existe API para NFA-e**. A emissao deve ser feita diretamente no portal SEFAZ. O app so pode **guiar o usuario** passo a passo. As informacoes-chave extraidas do atendimento:

- **NFA-e**: emitida no portal SEFAZ-MT, sem certificado digital, apenas login/senha
- **Login**: Inscricao Estadual (IE) — **nao** o CNPJ
- **Senha**: senha de contribuinte criada no portal
- **Link para criar senha**: https://www5.sefaz.mt.gov.br/servicos?c=6346394&e=6398811
- **Webservice (verificar credenciamento)**: https://www.sefaz.mt.gov.br/acesso/pages/login/login.xhtml
- **e-PAC (requer e-CNPJ)**: https://www5.sefaz.mt.gov.br/portal-de-atendimento-ao-contribuinte
- MEI emite NFA-e **por padrao** — nao precisa credenciamento especifico para NFA-e
- Para NF-e (diferente de NFA-e), MEI precisa: credenciamento voluntario + certificado A1 + programa emissor

## O que sera construido

Um **wizard de emissao assistida de NF-A** integrado ao app, com 4 etapas guiadas que orientam o MEI a emitir a NFA-e no portal SEFAZ sem sair do fluxo do app.

## Componentes

### 1. `NfaAssistedWizard` (novo componente)

Dialog com stepper de 4 etapas:

**Etapa 1 - Verificar Acesso SEFAZ**
- Pergunta: "Voce ja tem senha de contribuinte na SEFAZ-MT?"
- Se SIM: avanca
- Se NAO: mostra passo a passo para criar senha com link direto
- Link: Solicitar Senha → Liberar Senha (2 sub-etapas)

**Etapa 2 - Preparar Dados da Nota**
- Formulario para o usuario preencher localmente (dentro do app) os dados que vai precisar no portal:
  - Destinatario (nome, CNPJ/CPF)
  - Descricao do servico/produto
  - Valor total
  - Observacoes
- Botao "Copiar dados" para facilitar o preenchimento no portal SEFAZ

**Etapa 3 - Emitir no Portal SEFAZ**
- Instrucoes visuais numeradas:
  1. Acesse o portal com sua IE + senha
  2. Navegue ate "NFA-e → Emissao de NFA-e"
  3. Preencha os dados (use o botao "Copiar" da etapa anterior)
  4. Transmita e imprima o DANFA-e
- Botao que abre o portal SEFAZ-MT em nova aba
- Lembrete: "Login = sua IE, nao o CNPJ"

**Etapa 4 - Confirmar e Vincular ao Frete**
- Campo para colar a chave de acesso da NFA-e emitida
- Campo para upload do DANFA-e (PDF)
- Vinculacao automatica ao frete no banco de dados

### 2. Integracao com fluxos existentes

- Botao "Emitir NF-A (Assistida)" no `AptidaoWizardStep0` quando MEI seleciona NF-e/CT-e (onde hoje ja aparece o aviso de MEI)
- Botao no painel de documentos do frete
- Reutilizar `StateGuideViewer` existente para links e guias por estado

### 3. Tabela para registrar NFA-e emitidas

Registro no banco para tracking (chave de acesso, PDF, vinculo com frete).

## Detalhes Tecnicos

### Novo componente principal
- `src/components/fiscal/nfa/NfaAssistedWizard.tsx` — Dialog com stepper de 4 etapas

### Componentes auxiliares
- `src/components/fiscal/nfa/NfaDataPreparation.tsx` — Formulario da etapa 2
- `src/components/fiscal/nfa/NfaPortalInstructions.tsx` — Instrucoes da etapa 3
- `src/components/fiscal/nfa/NfaConfirmation.tsx` — Confirmacao e upload da etapa 4

### Migracao SQL
- Tabela `nfa_documents` (id, freight_id, user_id, access_key, status, pdf_url, recipient_name, recipient_doc, description, amount, created_at)
- RLS: usuario so ve suas proprias NFA-e

### Alteracoes em arquivos existentes
- `src/components/fiscal/education/AptidaoWizardStep0.tsx` — Adicionar botao para abrir NfaAssistedWizard
- `src/components/fiscal/education/index.ts` — Exportar novos componentes
- Feature flag `enable_nfa_assisted_emission` em `featureFlags.ts`

### Arquivos que NAO serao alterados
- Nenhuma edge function nova (nao ha API SEFAZ para NFA-e)
- Nenhuma alteracao nos wizards de NF-e, CT-e, MDF-e existentes
- Nenhuma alteracao no StateGuideViewer existente

