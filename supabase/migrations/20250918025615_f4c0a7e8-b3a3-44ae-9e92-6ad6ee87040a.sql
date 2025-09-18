-- Corrigir migração do sistema de rastreamento (políticas condicionais)

-- Adicionar campos de rastreamento à tabela freights (se não existirem)
DO $$ 
BEGIN 
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'freights' AND column_name = 'tracking_required') THEN
    ALTER TABLE public.freights 
    ADD COLUMN tracking_required boolean DEFAULT false,
    ADD COLUMN tracking_status text DEFAULT 'INACTIVE',
    ADD COLUMN route_waypoints jsonb,
    ADD COLUMN tracking_started_at timestamp with time zone,
    ADD COLUMN tracking_ended_at timestamp with time zone;
  END IF;
END $$;

-- Criar políticas condicionalmente para trip_locations
DO $$
BEGIN
  -- Política para inserção
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_locations' AND policyname = 'Users can insert their own locations') THEN
    EXECUTE 'CREATE POLICY "Users can insert their own locations" ON public.trip_locations
    FOR INSERT WITH CHECK (
      user_id = auth.uid() AND 
      freight_id IN (
        SELECT f.id FROM public.freights f
        JOIN public.profiles p ON f.driver_id = p.id
        WHERE p.user_id = auth.uid()
      )
    )';
  END IF;

  -- Política para visualização
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'trip_locations' AND policyname = 'Users can view locations for their freights') THEN
    EXECUTE 'CREATE POLICY "Users can view locations for their freights" ON public.trip_locations
    FOR SELECT USING (
      freight_id IN (
        SELECT f.id FROM public.freights f
        JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
        WHERE p.user_id = auth.uid()
      ) OR is_admin()
    )';
  END IF;
END $$;

-- Criar políticas condicionalmente para incident_logs
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incident_logs' AND policyname = 'Users can view incidents for their freights') THEN
    EXECUTE 'CREATE POLICY "Users can view incidents for their freights" ON public.incident_logs
    FOR SELECT USING (
      freight_id IN (
        SELECT f.id FROM public.freights f
        JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
        WHERE p.user_id = auth.uid()
      ) OR is_admin()
    )';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incident_logs' AND policyname = 'System can create incidents') THEN
    EXECUTE 'CREATE POLICY "System can create incidents" ON public.incident_logs FOR INSERT WITH CHECK (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'incident_logs' AND policyname = 'Admins can update incidents') THEN
    EXECUTE 'CREATE POLICY "Admins can update incidents" ON public.incident_logs FOR UPDATE USING (is_admin())';
  END IF;
END $$;

-- Criar políticas condicionalmente para evidence_files
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'evidence_files' AND policyname = 'Users can view evidence for their incidents') THEN
    EXECUTE 'CREATE POLICY "Users can view evidence for their incidents" ON public.evidence_files
    FOR SELECT USING (
      incident_id IN (
        SELECT il.id FROM public.incident_logs il
        JOIN public.freights f ON il.freight_id = f.id
        JOIN public.profiles p ON (f.producer_id = p.id OR f.driver_id = p.id)
        WHERE p.user_id = auth.uid()
      ) OR is_admin()
    )';
  END IF;
END $$;

-- Criar políticas condicionalmente para tracking_consents
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_consents' AND policyname = 'Users can manage their own consents') THEN
    EXECUTE 'CREATE POLICY "Users can manage their own consents" ON public.tracking_consents
    FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid())';
  END IF;
END $$;

-- Criar políticas condicionalmente para tracking_settings
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_settings' AND policyname = 'Anyone can view tracking settings') THEN
    EXECUTE 'CREATE POLICY "Anyone can view tracking settings" ON public.tracking_settings FOR SELECT USING (true)';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'tracking_settings' AND policyname = 'Admins can manage tracking settings') THEN
    EXECUTE 'CREATE POLICY "Admins can manage tracking settings" ON public.tracking_settings
    FOR ALL USING (is_admin()) WITH CHECK (is_admin())';
  END IF;
END $$;