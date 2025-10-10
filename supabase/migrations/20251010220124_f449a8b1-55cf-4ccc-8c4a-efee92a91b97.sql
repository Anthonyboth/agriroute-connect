-- Adicionar preços para FRETE_MOTO na tabela antt_freight_prices
INSERT INTO antt_freight_prices (service_type, distance_range_min, distance_range_max, base_price, price_per_km)
VALUES
  ('FRETE_MOTO', 0, 10, 10.00, 2.00),      -- 0-10km: R$ 10 base + R$ 2/km
  ('FRETE_MOTO', 11, 25, 20.00, 1.80),     -- 11-25km: R$ 20 base + R$ 1.80/km
  ('FRETE_MOTO', 26, 50, 40.00, 1.50),     -- 26-50km: R$ 40 base + R$ 1.50/km
  ('FRETE_MOTO', 51, NULL, 70.00, 1.20);   -- 51+km: R$ 70 base + R$ 1.20/km