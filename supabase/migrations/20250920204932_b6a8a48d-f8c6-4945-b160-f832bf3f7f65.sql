-- Corrigir problemas de segurança identificados pelo linter

-- Corrigir search_path das funções para segurança
DROP FUNCTION IF EXISTS public.update_updated_at_column() CASCADE;
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Recriar triggers com função segura
CREATE OR REPLACE TRIGGER update_payments_updated_at
  BEFORE UPDATE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_driver_withdrawals_updated_at
  BEFORE UPDATE ON public.driver_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_external_payments_updated_at
  BEFORE UPDATE ON public.external_payments
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE TRIGGER update_driver_stripe_accounts_updated_at
  BEFORE UPDATE ON public.driver_stripe_accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Corrigir funções de auditoria
DROP FUNCTION IF EXISTS public.audit_payments() CASCADE;
CREATE OR REPLACE FUNCTION public.audit_payments()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, new_data, user_id)
    VALUES ('payments', NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES ('payments', NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, user_id)
    VALUES ('payments', OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

DROP FUNCTION IF EXISTS public.audit_driver_withdrawals() CASCADE;
CREATE OR REPLACE FUNCTION public.audit_driver_withdrawals()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, new_data, user_id)
    VALUES ('driver_withdrawals', NEW.id, TG_OP, row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, new_data, user_id)
    VALUES ('driver_withdrawals', NEW.id, TG_OP, row_to_json(OLD), row_to_json(NEW), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO public.financial_audit_logs (table_name, record_id, operation, old_data, user_id)
    VALUES ('driver_withdrawals', OLD.id, TG_OP, row_to_json(OLD), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- Recriar triggers de auditoria
CREATE OR REPLACE TRIGGER audit_payments_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_payments();

CREATE OR REPLACE TRIGGER audit_driver_withdrawals_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.driver_withdrawals
  FOR EACH ROW
  EXECUTE FUNCTION public.audit_driver_withdrawals();