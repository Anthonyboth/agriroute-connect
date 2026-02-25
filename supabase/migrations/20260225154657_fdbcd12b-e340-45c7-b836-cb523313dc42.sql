-- Correção cirúrgica: remover overload ambíguo da RPC autoritativa de feed
-- Mantemos apenas a assinatura com filtros (p_types, p_expiry_bucket, p_sort)
-- para evitar PGRST203 "Could not choose the best candidate function".

DROP FUNCTION IF EXISTS public.get_authoritative_feed(uuid, text, boolean);