-- First, add the new status values to the mdfe_status enum
ALTER TYPE public.mdfe_status ADD VALUE IF NOT EXISTS 'PROCESSANDO';
ALTER TYPE public.mdfe_status ADD VALUE IF NOT EXISTS 'PROCESSANDO_ENCERRAMENTO';
ALTER TYPE public.mdfe_status ADD VALUE IF NOT EXISTS 'PROCESSANDO_CANCELAMENTO';
ALTER TYPE public.mdfe_status ADD VALUE IF NOT EXISTS 'REJEITADO';