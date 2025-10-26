-- Create document_request_messages table for chat-like experience
CREATE TABLE document_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_request_id UUID NOT NULL REFERENCES document_requests(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES profiles(id),
  message TEXT NOT NULL,
  message_type TEXT NOT NULL DEFAULT 'TEXT',
  image_url TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  read_at TIMESTAMPTZ
);

-- Indexes for performance
CREATE INDEX idx_doc_req_messages_request ON document_request_messages(document_request_id);
CREATE INDEX idx_doc_req_messages_sender ON document_request_messages(sender_id);
CREATE INDEX idx_doc_req_messages_created ON document_request_messages(created_at DESC);

-- Enable RLS
ALTER TABLE document_request_messages ENABLE ROW LEVEL SECURITY;

-- Users can view messages from their document requests
CREATE POLICY "Users can view their document request messages"
  ON document_request_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM document_requests dr
      WHERE dr.id = document_request_messages.document_request_id
      AND (
        dr.driver_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM transport_companies tc
          WHERE tc.id = dr.company_id
          AND tc.profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- Users can send messages to their document requests
CREATE POLICY "Users can send messages to their document requests"
  ON document_request_messages FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM document_requests dr
      WHERE dr.id = document_request_id
      AND (
        dr.driver_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM transport_companies tc
          WHERE tc.id = dr.company_id
          AND tc.profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
      )
    )
    AND sender_id IN (
      SELECT id FROM profiles WHERE user_id = auth.uid()
    )
  );

-- Users can mark their messages as read
CREATE POLICY "Users can update read status"
  ON document_request_messages FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM document_requests dr
      WHERE dr.id = document_request_messages.document_request_id
      AND (
        dr.driver_profile_id IN (
          SELECT id FROM profiles WHERE user_id = auth.uid()
        )
        OR EXISTS (
          SELECT 1 FROM transport_companies tc
          WHERE tc.id = dr.company_id
          AND tc.profile_id IN (
            SELECT id FROM profiles WHERE user_id = auth.uid()
          )
        )
      )
    )
  );

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE document_request_messages;