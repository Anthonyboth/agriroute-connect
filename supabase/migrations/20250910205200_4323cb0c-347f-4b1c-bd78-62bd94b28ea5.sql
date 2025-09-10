-- Verificar se as tabelas já existem antes de criar
DO $$
BEGIN
  -- Tabela freight_messages
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freight_messages') THEN
    CREATE TABLE public.freight_messages (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      freight_id UUID NOT NULL,
      sender_id UUID NOT NULL,
      message TEXT NOT NULL,
      image_url TEXT,
      message_type TEXT NOT NULL DEFAULT 'TEXT' CHECK (message_type IN ('TEXT', 'IMAGE', 'SYSTEM')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      read_at TIMESTAMP WITH TIME ZONE,
      FOREIGN KEY (freight_id) REFERENCES freights(id) ON DELETE CASCADE,
      FOREIGN KEY (sender_id) REFERENCES profiles(id) ON DELETE CASCADE
    );

    -- RLS para freight_messages
    ALTER TABLE public.freight_messages ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view messages for their freights" 
    ON public.freight_messages FOR SELECT 
    USING (
      freight_id IN (
        SELECT id FROM freights 
        WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ) OR is_admin()
    );

    CREATE POLICY "Users can send messages for their freights" 
    ON public.freight_messages FOR INSERT 
    WITH CHECK (
      sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND freight_id IN (
        SELECT id FROM freights 
        WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    );

    CREATE POLICY "Users can update their own messages" 
    ON public.freight_messages FOR UPDATE 
    USING (sender_id IN (SELECT id FROM profiles WHERE user_id = auth.uid()));
  END IF;

  -- Tabela freight_attachments  
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freight_attachments') THEN
    CREATE TABLE public.freight_attachments (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      freight_id UUID NOT NULL,
      uploaded_by UUID NOT NULL,
      file_url TEXT NOT NULL,
      file_type TEXT NOT NULL CHECK (file_type IN ('LOAD_PHOTO', 'DELIVERY_RECEIPT', 'DOCUMENT', 'OTHER')),
      description TEXT,
      upload_stage TEXT NOT NULL CHECK (upload_stage IN ('LOADING', 'IN_TRANSIT', 'DELIVERY', 'COMPLETED')),
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      FOREIGN KEY (freight_id) REFERENCES freights(id) ON DELETE CASCADE,
      FOREIGN KEY (uploaded_by) REFERENCES profiles(id) ON DELETE CASCADE
    );

    -- RLS para freight_attachments
    ALTER TABLE public.freight_attachments ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view attachments for their freights" 
    ON public.freight_attachments FOR SELECT 
    USING (
      freight_id IN (
        SELECT id FROM freights 
        WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ) OR is_admin()
    );

    CREATE POLICY "Users can upload attachments for their freights" 
    ON public.freight_attachments FOR INSERT 
    WITH CHECK (
      uploaded_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND freight_id IN (
        SELECT id FROM freights 
        WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    );
  END IF;

  -- Tabela freight_status_history
  IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'freight_status_history') THEN
    CREATE TABLE public.freight_status_history (
      id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
      freight_id UUID NOT NULL,
      status TEXT NOT NULL,
      changed_by UUID NOT NULL,
      location_lat NUMERIC,
      location_lng NUMERIC,
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      FOREIGN KEY (freight_id) REFERENCES freights(id) ON DELETE CASCADE,
      FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE CASCADE
    );

    -- RLS para freight_status_history
    ALTER TABLE public.freight_status_history ENABLE ROW LEVEL SECURITY;

    CREATE POLICY "Users can view status history for their freights" 
    ON public.freight_status_history FOR SELECT 
    USING (
      freight_id IN (
        SELECT id FROM freights 
        WHERE producer_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
           OR driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      ) OR is_admin()
    );

    CREATE POLICY "Drivers can update status for their accepted freights" 
    ON public.freight_status_history FOR INSERT 
    WITH CHECK (
      changed_by IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      AND freight_id IN (
        SELECT id FROM freights 
        WHERE driver_id IN (SELECT id FROM profiles WHERE user_id = auth.uid())
      )
    );
  END IF;
END$$;

-- Adicionar colunas de geolocalização atual ao frete se não existirem
ALTER TABLE public.freights 
ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
ADD COLUMN IF NOT EXISTS current_lng NUMERIC,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- Criar bucket para anexos de frete se não existir
INSERT INTO storage.buckets (id, name, public) VALUES ('freight-attachments', 'freight-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- Storage policies para freight-attachments
DO $$
BEGIN
  -- Verificar se a policy já existe antes de criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'freight_attachments_select_policy'
  ) THEN
    CREATE POLICY "freight_attachments_select_policy" 
    ON storage.objects FOR SELECT 
    USING (
      bucket_id = 'freight-attachments' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'freight_attachments_insert_policy'
  ) THEN
    CREATE POLICY "freight_attachments_insert_policy" 
    ON storage.objects FOR INSERT 
    WITH CHECK (
      bucket_id = 'freight-attachments' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'objects' 
    AND policyname = 'freight_attachments_update_policy'
  ) THEN
    CREATE POLICY "freight_attachments_update_policy" 
    ON storage.objects FOR UPDATE 
    USING (
      bucket_id = 'freight-attachments' 
      AND auth.uid()::text = (storage.foldername(name))[1]
    );
  END IF;
END$$;

-- Função para atualizar status do frete automaticamente
CREATE OR REPLACE FUNCTION update_freight_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o status principal do frete
  UPDATE public.freights 
  SET status = NEW.status::freight_status,
      current_lat = NEW.location_lat,
      current_lng = NEW.location_lng,
      last_location_update = NEW.created_at
  WHERE id = NEW.freight_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Criar trigger se não existir
DROP TRIGGER IF EXISTS freight_status_update_trigger ON public.freight_status_history;
CREATE TRIGGER freight_status_update_trigger
  AFTER INSERT ON public.freight_status_history
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_status();