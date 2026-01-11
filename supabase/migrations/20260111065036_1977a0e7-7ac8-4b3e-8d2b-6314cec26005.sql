-- Criar unique constraint na company_id para mdfe_config
CREATE UNIQUE INDEX IF NOT EXISTS mdfe_config_company_id_unique_idx 
ON mdfe_config (company_id) WHERE company_id IS NOT NULL;

-- Cadastrar empresa fiscal AgriRoute na tabela mdfe_config
INSERT INTO mdfe_config (
  company_id,
  cnpj,
  razao_social,
  nome_fantasia,
  inscricao_estadual,
  rntrc,
  logradouro,
  numero,
  bairro,
  municipio_nome,
  municipio_codigo,
  uf,
  cep,
  telefone,
  serie_mdfe,
  ultimo_numero_mdfe,
  ambiente_fiscal,
  auto_emit_on_acceptance,
  auto_close_on_delivery
) VALUES (
  '76bc21ba-a7ba-48a7-8238-07a841de5759',
  '62965243000111',
  'AGRIROUTE TECNOLOGIA LTDA',
  'AgriRoute',
  '123456789',
  '12345678',
  'Avenida Paulista',
  '1000',
  'Bela Vista',
  'Sao Paulo',
  '3550308',
  'SP',
  '01310100',
  '1140028922',
  '1',
  0,
  'homologacao',
  false,
  false
);