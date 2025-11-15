-- Create freight_templates table for producers to save freight configurations as reusable templates
create table public.freight_templates (
  id uuid primary key default gen_random_uuid(),
  producer_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Create trigger function for updated_at if it doesn't exist
create or replace function public.set_freight_template_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end; 
$$ language plpgsql;

-- Create trigger to automatically update updated_at
create trigger freight_templates_set_updated_at
before update on public.freight_templates
for each row execute procedure public.set_freight_template_updated_at();

-- Enable RLS
alter table public.freight_templates enable row level security;

-- Producers can select their own templates
create policy "Producers can select own templates"
on public.freight_templates for select
using (producer_id in (select id from profiles where user_id = auth.uid()));

-- Producers can insert their own templates
create policy "Producers can insert own templates"
on public.freight_templates for insert
with check (producer_id in (select id from profiles where user_id = auth.uid()));

-- Producers can update their own templates
create policy "Producers can update own templates"
on public.freight_templates for update
using (producer_id in (select id from profiles where user_id = auth.uid()))
with check (producer_id in (select id from profiles where user_id = auth.uid()));

-- Producers can delete their own templates
create policy "Producers can delete own templates"
on public.freight_templates for delete
using (producer_id in (select id from profiles where user_id = auth.uid()));

-- Create index for faster queries
create index idx_freight_templates_producer_id on public.freight_templates(producer_id);
create index idx_freight_templates_created_at on public.freight_templates(created_at desc);