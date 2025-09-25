-- Criar função para processar desistência de frete
CREATE OR REPLACE FUNCTION public.process_freight_withdrawal(
  freight_id_param UUID,
  driver_profile_id UUID
)
RETURNS JSON AS $$
DECLARE
  freight_record RECORD;
  result JSON;
BEGIN
  -- Verificar se o frete existe e pertence ao motorista
  SELECT * INTO freight_record 
  FROM public.freights 
  WHERE id = freight_id_param AND driver_id = driver_profile_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Frete não encontrado ou não pertence ao motorista');
  END IF;
  
  -- Atualizar o frete para voltar ao status OPEN
  UPDATE public.freights 
  SET 
    status = 'OPEN'::freight_status,
    driver_id = NULL,
    updated_at = now()
  WHERE id = freight_id_param AND driver_id = driver_profile_id;
  
  -- Atualizar a proposta para cancelada
  UPDATE public.freight_proposals 
  SET 
    status = 'CANCELLED',
    updated_at = now()
  WHERE freight_id = freight_id_param AND driver_id = driver_profile_id;
  
  -- Inserir notificação
  INSERT INTO public.notifications (
    user_id, 
    title, 
    message, 
    type,
    data
  ) VALUES (
    (SELECT user_id FROM public.profiles WHERE id = driver_profile_id),
    'Taxa de Desistência',
    'Foi aplicada uma taxa de R$ 20,00 pela desistência do frete. O valor será descontado do próximo pagamento.',
    'warning',
    json_build_object(
      'freight_id', freight_id_param,
      'fee_amount', 20.00,
      'fee_type', 'withdrawal'
    )::jsonb
  );
  
  RETURN json_build_object('success', true, 'message', 'Desistência processada com sucesso');
  
EXCEPTION WHEN OTHERS THEN
  RETURN json_build_object('success', false, 'error', SQLERRM);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;