-- Tighten freight_messages visibility to sender/targeted driver/producer/company-owner only
-- This addresses the finding: messages (incl. phone/address) were visible to all freight participants.

begin;

-- 1) Backfill target_driver_id for existing rows where we can infer safely
-- a) messages sent by a driver: bind to their own thread
update public.freight_messages
set target_driver_id = sender_id
where target_driver_id is null;

-- b) if freight has a single driver_id, bind any remaining nulls to that driver
update public.freight_messages m
set target_driver_id = f.driver_id
from public.freights f
where m.freight_id = f.id
  and m.target_driver_id is null
  and f.driver_id is not null;

-- 2) Replace overly-broad SELECT policy
DROP POLICY IF EXISTS "freight_messages_select_participants" ON public.freight_messages;

CREATE POLICY "freight_messages_select_direct_parties"
ON public.freight_messages
FOR SELECT
TO authenticated
USING (
  -- admins
  has_role(auth.uid(), 'admin'::app_role)
  -- sender always sees
  OR sender_id = get_current_profile_id()
  -- targeted driver sees
  OR (target_driver_id is not null AND target_driver_id = get_current_profile_id())
  -- producer of the freight sees
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    WHERE f.id = freight_messages.freight_id
      AND f.producer_id = get_current_profile_id()
  )
  -- transport company owner sees messages for freights owned by their company
  OR EXISTS (
    SELECT 1
    FROM public.freights f
    JOIN public.transport_companies tc ON tc.id = f.company_id
    WHERE f.id = freight_messages.freight_id
      AND tc.profile_id = get_current_profile_id()
  )
);

-- 3) Tighten INSERT policy to require a target_driver_id and limit to direct parties
DROP POLICY IF EXISTS "freight_messages_insert_participants" ON public.freight_messages;

CREATE POLICY "freight_messages_insert_direct_parties"
ON public.freight_messages
FOR INSERT
TO authenticated
WITH CHECK (
  sender_id = get_current_profile_id()
  AND target_driver_id is not null
  AND (
    -- producer can write to a specific driver's thread
    EXISTS (
      SELECT 1
      FROM public.freights f
      WHERE f.id = freight_messages.freight_id
        AND f.producer_id = get_current_profile_id()
    )
    -- targeted driver can write only to their own thread
    OR (
      target_driver_id = get_current_profile_id()
      AND (
        EXISTS (
          SELECT 1
          FROM public.freights f
          WHERE f.id = freight_messages.freight_id
            AND (
              f.driver_id = get_current_profile_id()
              OR (f.drivers_assigned IS NOT NULL AND get_current_profile_id() = ANY (f.drivers_assigned))
            )
        )
        OR EXISTS (
          SELECT 1
          FROM public.freight_assignments fa
          WHERE fa.freight_id = freight_messages.freight_id
            AND fa.driver_id = get_current_profile_id()
        )
        OR EXISTS (
          SELECT 1
          FROM public.freight_chat_participants fcp
          WHERE fcp.freight_id = freight_messages.freight_id
            AND fcp.participant_id = get_current_profile_id()
            AND fcp.is_active = true
        )
      )
    )
    -- transport company owner can write to a specific driver's thread for its company freights
    OR EXISTS (
      SELECT 1
      FROM public.freights f
      JOIN public.transport_companies tc ON tc.id = f.company_id
      WHERE f.id = freight_messages.freight_id
        AND tc.profile_id = get_current_profile_id()
    )
  )
);

commit;