-- Tabela de mensagens/chat entre produtor e motorista
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

-- Tabela para anexos/fotos da viagem
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

-- Tabela para tracking de status da viagem
CREATE TABLE public.freight_status_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID NOT NULL,
  status freight_status NOT NULL,
  changed_by UUID NOT NULL,
  location_lat NUMERIC,
  location_lng NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  FOREIGN KEY (freight_id) REFERENCES freights(id) ON DELETE CASCADE,
  FOREIGN KEY (changed_by) REFERENCES profiles(id) ON DELETE CASCADE
);

-- Atualizar enum de status de frete se necessário
DO $$
BEGIN
  -- Adicionar novos status se não existirem
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOADING' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_status')) THEN
    ALTER TYPE freight_status ADD VALUE 'LOADING';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'LOADED' AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'freight_status')) THEN
    ALTER TYPE freight_status ADD VALUE 'LOADED';
  END IF;
END$$;

-- Adicionar colunas de geolocalização atual ao frete
ALTER TABLE public.freights 
ADD COLUMN IF NOT EXISTS current_lat NUMERIC,
ADD COLUMN IF NOT EXISTS current_lng NUMERIC,
ADD COLUMN IF NOT EXISTS last_location_update TIMESTAMP WITH TIME ZONE;

-- Criar bucket para anexos de frete
INSERT INTO storage.buckets (id, name, public) VALUES ('freight-attachments', 'freight-attachments', false)
ON CONFLICT (id) DO NOTHING;

-- RLS Policies para freight_messages
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

-- RLS Policies para freight_attachments  
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

-- RLS Policies para freight_status_history
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

-- Storage policies para freight-attachments
CREATE POLICY "Users can view attachments for their freights" 
ON storage.objects FOR SELECT 
USING (
  bucket_id = 'freight-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload attachments" 
ON storage.objects FOR INSERT 
WITH CHECK (
  bucket_id = 'freight-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can update their own attachments" 
ON storage.objects FOR UPDATE 
USING (
  bucket_id = 'freight-attachments' 
  AND auth.uid()::text = (storage.foldername(name))[1]
);

-- Trigger para updated_at
CREATE TRIGGER update_freight_messages_updated_at
  BEFORE UPDATE ON public.freight_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar status do frete automaticamente
CREATE OR REPLACE FUNCTION update_freight_status()
RETURNS TRIGGER AS $$
BEGIN
  -- Atualizar o status principal do frete
  UPDATE public.freights 
  SET status = NEW.status,
      current_lat = NEW.location_lat,
      current_lng = NEW.location_lng,
      last_location_update = NEW.created_at
  WHERE id = NEW.freight_id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER freight_status_update_trigger
  AFTER INSERT ON public.freight_status_history
  FOR EACH ROW
  EXECUTE FUNCTION update_freight_status();

-- Enable realtime para as novas tabelas
ALTER TABLE public.freight_messages REPLICA IDENTITY FULL;
ALTER TABLE public.freight_attachments REPLICA IDENTITY FULL;
ALTER TABLE public.freight_status_history REPLICA IDENTITY FULL;

-- Adicionar tabelas à publicação realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_attachments;  
ALTER PUBLICATION supabase_realtime ADD TABLE public.freight_status_history;