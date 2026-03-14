Aqui está o ULTRA PROMPT completo para enviar à IA Lovable, para ela criar todo o sistema dos 6 seguros escolhidos automaticamente, integrando com o que você já tem no AgriRoute, sem quebrar nada existente.

Este prompt foi estruturado para:

evitar regressões

seguir o padrão visual do app

criar banco + lógica + UI

integrar com fretes e wallet

ser executado em uma única tarefa

🚀 ULTRA PROMPT – IMPLEMENTAÇÃO DOS SEGUROS AGRIROUTE

CONTEXTO

Você está trabalhando no projeto AgriRoute, uma plataforma de fretes agrícolas.

Já existe no sistema:

WalletTab

PaymentManagementTab

sistema de fretes

Supabase backend

React + TypeScript frontend

design system próprio

componentes com padrão shadcn/ui

A Wallet atualmente possui duas abas:

Copiar código

Carteira AgriRoute

Gestão de Pagamentos

Sua missão é adicionar um sistema completo de seguros criando uma terceira aba chamada "Seguros".

REGRA CRÍTICA

❗ NÃO QUEBRAR NADA EXISTENTE.

Antes de qualquer alteração:

analisar o código do WalletTab

garantir compatibilidade com o sistema atual

seguir o mesmo padrão de UI

1️⃣ MODIFICAR WALLET

Arquivo:

Copiar código

src/components/wallet/WalletTab.tsx

Alterar grid:

Copiar código

grid-cols-2

para:

Copiar código

grid-cols-3

Adicionar nova aba:

Copiar código

TabsTrigger value="insurance"

com ícone:

Copiar código

Shield (lucide-react)

Ordem das abas:

Copiar código

Carteira AgriRoute

Gestão de Pagamentos

Seguros

Carregar o componente com lazy loading:

TypeScript

Copiar código

const InsuranceTab = React.lazy(() => import("./InsuranceTab"))

2️⃣ CRIAR TABELAS SUPABASE

Criar migration.

insurance_products

Copiar código

id uuid primary key

name text

category text

description text

coverage_details text

exclusions text

min_price numeric

max_price numeric

max_coverage numeric

pricing_model text

active boolean default true

created_at timestamptz

user_insurances

Copiar código

id uuid primary key

user_id uuid references profiles

insurance_product_id uuid references insurance_products

coverage_value numeric

price numeric

status text default 'active'

start_date date

end_date date

payment_method text

created_at timestamptz

freight_insurances

Copiar código

id uuid primary key

freight_id uuid references freights

user_id uuid references profiles

insurance_product_id uuid references insurance_products

coverage_value numeric

price numeric

status text default 'active'

created_at timestamptz

insurance_claims

Copiar código

id uuid primary key

user_insurance_id uuid references user_insurances

freight_insurance_id uuid references freight_insurances

user_id uuid references profiles

description text

evidence_urls text[]

status text default 'pending'

resolution_notes text

amount_claimed numeric

amount_paid numeric default 0

created_at timestamptz

resolved_at timestamptz

Adicionar constraint:

Copiar código

CHECK (

user_insurance_id IS NOT NULL

OR freight_insurance_id IS NOT NULL

)

3️⃣ POLÍTICAS RLS

insurance_products

Copiar código

SELECT allowed for authenticated

INSERT UPDATE DELETE only admin

user_insurances

Copiar código

user_id = auth.uid()

freight_insurances

Copiar código

user_id = auth.uid()

insurance_claims

Copiar código

user_id = auth.uid()

4️⃣ SEED DOS SEGUROS

Inserir 6 produtos.

Seguro de Carga Agrícola

Copiar código

category: transporte

pricing_model: percentage

min_price: 0.8

max_price: 2.5

max_coverage: 5000000

Frete Garantido

Copiar código

category: operacional

pricing_model: percentage

min_price: 1.5

max_price: 3

max_coverage: 100000

Responsabilidade Civil Transportador

Copiar código

category: profissional

pricing_model: monthly

min_price: 120

max_price: 600

max_coverage: 1000000

Roubo de Carga

Copiar código

category: transporte

pricing_model: percentage

min_price: 1.5

max_price: 4

max_coverage: 3000000

Equipamentos Agrícolas

Copiar código

category: transporte

pricing_model: percentage

min_price: 1

max_price: 3

max_coverage: 10000000

Assistência 24h Caminhoneiro

Copiar código

category: operacional

pricing_model: monthly

min_price: 29

max_price: 79

5️⃣ COMPONENTES FRONTEND

Criar pasta:

Copiar código

src/components/wallet/insurance

Criar componentes.

InsuranceTab.tsx

Subtabs:

Copiar código

Disponíveis

Meus Seguros

Sinistros

Layout responsivo.

InsuranceProductCard

Mostrar:

nome

categoria

preço estimado

cobertura máxima

Botões:

Copiar código

Ver Detalhes

Contratar

InsuranceDetailModal

Mostrar:

descrição

cobertura

exclusões

valor máximo

Adicionar simulador de preço.

InsuranceContractModal

Fluxo stepper:

Copiar código

Cobertura

Simulação

Pagamento

Confirmar

Métodos pagamento:

Copiar código

Saldo Wallet

PIX

Cartão

Salvar em:

Copiar código

user_insurances

MyInsuranceCard

Mostrar:

Copiar código

tipo seguro

status

cobertura

validade

Ações:

Copiar código

Ver apólice

Cancelar

Abrir sinistro

InsuranceClaimModal

Usuário envia:

Copiar código

descrição

evidências

valor reclamado

Upload arquivos.

Salvar em:

Copiar código

insurance_claims

6️⃣ HOOK

Criar:

Copiar código

src/hooks/useInsurance.ts

Funções:

Copiar código

getInsuranceProducts()

getUserInsurances()

createInsurance()

createClaim()

Usar Supabase client existente.

7️⃣ INTEGRAÇÃO COM FRETES

Ao aceitar frete:

mostrar modal opcional:

Copiar código

Proteger esta carga com seguro?

Se aceitar:

criar registro em:

Copiar código

freight_insurances

8️⃣ PERFORMANCE

Aplicar:

Copiar código

React.memo

React.lazy

Evitar re-renders desnecessários.

9️⃣ UX

Seguir padrão visual de:

Copiar código

PaymentManagementTab

Usar:

Cards

Badges

Separators

Lucide icons

🔟 TESTES

Testar:

mobile

desktop

tablet

Garantir:

scroll funciona

modais não travam

tabs funcionam

RESULTADO FINAL ESPERADO

Após implementação o sistema terá:

Copiar código

Wallet

Payment Management

Insurance

com:

contratação de seguros

gerenciamento

abertura de sinistros

seguro de frete integrado

STATUS FINAL

Responder com:

Copiar código

IMPLEMENTAÇÃO CONCLUÍDA

ou listar erros encontrados.

✅ Esse prompt é grande o suficiente para a Lovable implementar o sistema completo, mas ainda seguro para não quebrar o AgriRoute.

Se quiser, também posso te entregar um prompt de auditoria extremamente agressivo que encontra bugs escondidos antes do próximo build do iOS, evitando novas rejeições da **Apple.