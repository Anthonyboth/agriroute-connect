-- ============================================================
-- MIGRATION: Corrigir default de active_mode e backfill dados
-- ============================================================

-- 1) Remover o default 'MOTORISTA' da coluna active_mode
ALTER TABLE public.profiles 
  ALTER COLUMN active_mode DROP DEFAULT;

-- 2) Backfill: Para perfis que NÃO são motoristas/transportadora mas têm active_mode = 'MOTORISTA',
-- setar active_mode = NULL (constraint só permite MOTORISTA ou TRANSPORTADORA)
UPDATE public.profiles
SET active_mode = NULL
WHERE active_mode = 'MOTORISTA' 
  AND role IS NOT NULL 
  AND role NOT IN ('MOTORISTA', 'MOTORISTA_AFILIADO', 'TRANSPORTADORA');

-- 3) Para motoristas afiliados que estão com active_mode = 'TRANSPORTADORA',
-- limpar o active_mode (não precisam dele)
UPDATE public.profiles
SET active_mode = NULL
WHERE role = 'MOTORISTA_AFILIADO' 
  AND active_mode = 'TRANSPORTADORA';

-- 4) Para produtores/prestadores sem active_mode, garantir que fique NULL
-- (já que constraint não aceita esses valores)
UPDATE public.profiles
SET active_mode = NULL
WHERE role IN ('PRODUTOR', 'PRESTADOR_SERVICOS')
  AND active_mode IS NOT NULL
  AND active_mode NOT IN ('MOTORISTA', 'TRANSPORTADORA');