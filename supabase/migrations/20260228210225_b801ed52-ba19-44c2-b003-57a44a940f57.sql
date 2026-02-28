-- Remove duplicate "Primavera do Leste, MA" entry (correct is MT)
-- This entry has coordinates matching MT (-15.56, -54.29) confirming it's a data error
DELETE FROM cities WHERE id = '1e19f94b-ffa7-40ed-a67a-2da539a87793' AND name = 'Primavera do Leste' AND state = 'MA';