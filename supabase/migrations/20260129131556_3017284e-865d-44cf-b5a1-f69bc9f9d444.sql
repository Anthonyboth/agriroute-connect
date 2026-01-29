-- Tighten participant cross-visibility to ACTIVE relationships only
-- Fixes: profiles_select_freight_participants granting permanent access to PII after any past freight/service.

create or replace function public.is_freight_participant(target_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = 'public'
as $$
  with current_ctx as (
    select public.get_current_profile_id() as me
  )
  select exists (
    -- FREIGHTS: only active/ongoing freights (no "ever participated" access)
    select 1
    from public.freights f, current_ctx c
    where
      (
        f.status::text in ('ACCEPTED','LOADING','LOADED','IN_TRANSIT','DELIVERED_PENDING_CONFIRMATION')
        or (f.status::text = 'OPEN' and coalesce(f.accepted_trucks, 0) > 0)
      )
      and (
        -- Producer can view drivers of their active freights
        (f.producer_id = c.me and (f.driver_id = target_profile_id or target_profile_id = any(f.drivers_assigned)))
        or
        -- Driver can view producer of their active freights
        ((f.driver_id = c.me or c.me = any(f.drivers_assigned)) and f.producer_id = target_profile_id)
        or
        -- Participants of the same active freight can see each other
        ((f.driver_id = c.me or c.me = any(f.drivers_assigned))
          and (f.driver_id = target_profile_id or target_profile_id = any(f.drivers_assigned) or f.producer_id = target_profile_id)
        )
      )

    union

    -- SERVICE REQUESTS: only while accepted and not completed/cancelled
    select 1
    from public.service_requests sr, current_ctx c
    where
      sr.accepted_at is not null
      and sr.completed_at is null
      and sr.cancelled_at is null
      and (
        (sr.client_id = c.me and sr.provider_id = target_profile_id)
        or
        (sr.provider_id = c.me and sr.client_id = target_profile_id)
      )
  );
$$;
