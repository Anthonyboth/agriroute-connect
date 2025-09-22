-- Fix security issues for functions by setting search_path
ALTER FUNCTION create_payment_deadline_on_accept() SET search_path = 'public';
ALTER FUNCTION update_payment_deadline_status(UUID) SET search_path = 'public';
ALTER FUNCTION check_payment_deadline_on_payment() SET search_path = 'public';