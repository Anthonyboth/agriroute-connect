
-- Tabela para registrar NFA-e emitidas via emissão assistida
CREATE TABLE public.nfa_documents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  freight_id UUID REFERENCES public.freights(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  access_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  pdf_url TEXT,
  recipient_name TEXT,
  recipient_doc TEXT,
  description TEXT,
  amount NUMERIC(12,2),
  observations TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.nfa_documents ENABLE ROW LEVEL SECURITY;

-- Policies: user only sees their own NFA-e
CREATE POLICY "Users can view their own NFA documents"
ON public.nfa_documents FOR SELECT
USING ((SELECT id FROM public.profiles WHERE user_id = auth.uid()) = nfa_documents.user_id
  OR auth.uid()::text = nfa_documents.user_id::text);

CREATE POLICY "Users can insert their own NFA documents"
ON public.nfa_documents FOR INSERT
WITH CHECK ((SELECT id FROM public.profiles WHERE user_id = auth.uid()) = nfa_documents.user_id
  OR auth.uid()::text = nfa_documents.user_id::text);

CREATE POLICY "Users can update their own NFA documents"
ON public.nfa_documents FOR UPDATE
USING ((SELECT id FROM public.profiles WHERE user_id = auth.uid()) = nfa_documents.user_id
  OR auth.uid()::text = nfa_documents.user_id::text);

-- Index for faster lookups
CREATE INDEX idx_nfa_documents_user_id ON public.nfa_documents(user_id);
CREATE INDEX idx_nfa_documents_freight_id ON public.nfa_documents(freight_id);

-- Trigger for updated_at
CREATE TRIGGER update_nfa_documents_updated_at
BEFORE UPDATE ON public.nfa_documents
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();
