-- Inserir dados de exemplo na tabela antt_freight_prices para que seja utilizada
INSERT INTO public.antt_freight_prices (service_type, distance_range_min, distance_range_max, base_price, price_per_km) VALUES
('graos', 0, 200, 150.00, 2.20),
('graos', 201, 500, 300.00, 2.00),
('graos', 501, 1000, 500.00, 1.80),
('graos', 1001, NULL, 800.00, 1.60),

('fertilizantes', 0, 200, 180.00, 2.50),
('fertilizantes', 201, 500, 350.00, 2.20),
('fertilizantes', 501, 1000, 600.00, 2.00),
('fertilizantes', 1001, NULL, 900.00, 1.80),

('carga_geral', 0, 200, 200.00, 2.80),
('carga_geral', 201, 500, 400.00, 2.50),
('carga_geral', 501, 1000, 700.00, 2.20),
('carga_geral', 1001, NULL, 1000.00, 2.00),

('combustivel', 0, 200, 300.00, 3.50),
('combustivel', 201, 500, 600.00, 3.20),
('combustivel', 501, 1000, 1000.00, 3.00),
('combustivel', 1001, NULL, 1500.00, 2.80),

('produtos_quimicos', 0, 200, 350.00, 3.80),
('produtos_quimicos', 201, 500, 700.00, 3.50),
('produtos_quimicos', 501, 1000, 1200.00, 3.20),
('produtos_quimicos', 1001, NULL, 1800.00, 3.00);

-- Criar função para verificar se sistema está usando tabela ANTT
CREATE OR REPLACE FUNCTION public.log_antt_usage()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RAISE LOG 'ANTT freight prices table accessed for service_type: %', NEW.service_type;
  RETURN NEW;
END;
$$;