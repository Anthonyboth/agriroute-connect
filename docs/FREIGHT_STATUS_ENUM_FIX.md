# Freight Status Enum/Text Type Fix

## Overview

This document describes the comprehensive fix for the enum/text type mismatch error that occurred in production when updating freight statuses. The solution ensures type safety while maintaining backward compatibility with existing code.

## Problem Statement

In production, the application was encountering errors when trying to update freight status via direct database operations or when PostgreSQL couldn't implicitly convert text values (including PT-BR labels like "Em Trânsito", "Cancelado") to the `public.freight_status` enum type.

Additionally, there were permission issues where RLS policies were checking for `profiles.company_id` which is not guaranteed to exist in the schema.

## Solution Components

### 1. Database Migrations

Three migrations were created to implement a robust, server-side solution:

#### Migration 1: Text to freight_status Implicit Cast
**File:** `supabase/migrations/20251030_001_text_to_freight_status_cast.sql`

**Purpose:** Creates an implicit cast from text to the `freight_status` enum that handles:
- PT-BR labels (e.g., "Em Trânsito" → IN_TRANSIT, "Cancelado" → CANCELLED)
- Synonym mapping (CANCELED → CANCELLED)
- Accent normalization (Â, Ã, É, etc.)
- Case-insensitive matching

**Key Function:** `public.text_to_freight_status(text)`
- Normalizes input text (uppercase, replace spaces/accents)
- Maps PT-BR labels to canonical enum values
- Handles both CANCELED and CANCELLED spellings
- Returns proper enum value or raises helpful error

**Impact:** PostgreSQL can now automatically convert text to enum in any context (INSERT, UPDATE, function parameters).

#### Migration 2: Update freight_status RPC Functions
**File:** `supabase/migrations/20251030_002_update_freight_status_functions.sql`

**Purpose:** Creates two RPC functions for secure status updates:

1. **`update_freight_status(p_id UUID, p_status freight_status)`**
   - Type-safe function accepting enum parameter
   - Checks permissions using `driver_id` OR `producer_id` (no company_id dependency)
   - Validates status transitions (prevents invalid state changes)
   - Prevents changes to final statuses (DELIVERED, COMPLETED, CANCELLED)
   - Logs to freight_status_history
   - Returns structured JSONB response

2. **`update_freight_status_text(p_id UUID, p_status_text TEXT)`**
   - Tolerant wrapper for text input
   - Converts text to enum using `text_to_freight_status()`
   - Calls the typed function internally
   - Provides fallback for legacy code

**Security:** Both functions use `SECURITY DEFINER` with explicit permission checks.

#### Migration 3: RLS Policy for Freights UPDATE
**File:** `supabase/migrations/20251030_003_rls_freights_update_policy.sql`

**Purpose:** Creates/refreshes the UPDATE RLS policy on `public.freights` table.

**Policy Name:** `freights_update_status_parties`

**Logic:** Allows UPDATE when `auth.uid()` equals:
- `driver_id` (the assigned driver), OR
- `producer_id` (the freight creator)

**Note:** Does NOT depend on `profiles.company_id` which may not exist for all users.

### 2. Frontend Service Updates

**File:** `src/services/freightStatus.ts`

**Changes:**
1. Updated `updateFreightStatus()` function to:
   - Call new typed RPC `update_freight_status` with enum parameter
   - Implement fallback to `update_freight_status_text` if typed RPC fails
   - Remove dependency on `driver_update_freight_status` with its complex parameter set
   - Add inline comments explaining the dual-RPC approach

2. Removed parameters that are no longer needed:
   - `p_user_id` (server determines from auth.uid())
   - `p_notes`, `p_lat`, `p_lng`, `p_assignment_id` (simplified for core status updates)

3. The service still performs client-side validation for better UX:
   - Checks if status is final before calling RPC
   - Validates transitions
   - Shows user-friendly error messages

**Backward Compatibility:**
- `updateFreightStatusByLabel()` wrapper remains unchanged
- All existing code calling these functions continues to work
- No breaking changes to API contracts

## Enum Values

The `freight_status` enum supports these values:
- `OPEN` - Aberto
- `IN_NEGOTIATION` - Em Negociação
- `ACCEPTED` - Aceito
- `LOADING` - Coletando/Carregando
- `LOADED` - Carregado
- `IN_TRANSIT` - Em Trânsito/Em Transporte
- `DELIVERED_PENDING_CONFIRMATION` - Aguardando Confirmação
- `DELIVERED` - Entregue
- `COMPLETED` - Finalizado/Concluído
- `CANCELLED` - Cancelado (handles both CANCELED and CANCELLED)
- `REJECTED` - Rejeitado
- `PENDING` - Pendente

## PT-BR Label Mappings

The conversion function handles these PT-BR labels:
- "Aberto" → OPEN
- "Em Negociação" → IN_NEGOTIATION
- "Aceito" → ACCEPTED
- "Carregando", "Coletando" → LOADING
- "Carregado" → LOADED
- "Em Trânsito", "Em Transporte" → IN_TRANSIT
- "Aguardando Confirmação" → DELIVERED_PENDING_CONFIRMATION
- "Entregue" → DELIVERED
- "Finalizado", "Concluído" → COMPLETED
- "Cancelado" → CANCELLED
- "Rejeitado" → REJECTED
- "Pendente" → PENDING

## Permission Model

The new RPC functions check permissions as follows:

1. **User must be authenticated** (`auth.uid()` must not be NULL)
2. **User must be involved in the freight:**
   - As the driver (`driver_id` = `auth.uid()`), OR
   - As the producer (`producer_id` = `auth.uid()`)
3. **RLS policy enforces the same rules** at the database level

This model:
- Does NOT depend on `profiles.company_id`
- Does NOT require complex joins to profiles table
- Works for all user types (drivers, producers, companies)
- Is enforced both at RPC level and RLS level (defense in depth)

## Deployment

When merged to `main` branch, the Supabase GitHub integration will:

1. Automatically apply migrations in order:
   - 001: Create implicit cast
   - 002: Create RPC functions
   - 003: Create/refresh RLS policy

2. Each migration ends with `pg_notify('pgrst', 'reload schema')` to ensure PostgREST immediately recognizes:
   - New cast
   - New RPC functions
   - Policy changes

**No manual database access required.**

## Testing

### Manual Testing Steps

1. **Test typed RPC:**
   ```sql
   SELECT update_freight_status(
     '<freight-uuid>',
     'IN_TRANSIT'::freight_status
   );
   ```

2. **Test text RPC with PT-BR label:**
   ```sql
   SELECT update_freight_status_text(
     '<freight-uuid>',
     'Em Trânsito'
   );
   ```

3. **Test implicit cast:**
   ```sql
   UPDATE freights 
   SET status = 'Cancelado'
   WHERE id = '<freight-uuid>';
   ```

4. **Test permission checks:**
   - Try updating a freight as a user who is neither driver nor producer (should fail)
   - Try updating as driver (should succeed)
   - Try updating as producer (should succeed)

5. **Test transition validation:**
   - Try invalid transition like OPEN → DELIVERED (should fail)
   - Try valid transition like OPEN → ACCEPTED (should succeed)

6. **Test final status protection:**
   - Try changing status of a COMPLETED freight (should fail)
   - Try changing status of an IN_TRANSIT freight (should succeed)

### Frontend Testing

1. Use existing freight status update flows
2. Verify that updates work with both enum values and PT-BR labels
3. Check browser console for any fallback warnings
4. Verify toast messages show correctly on success/failure

## Rollback Plan

If issues occur after deployment:

1. **Frontend rollback:** Revert `src/services/freightStatus.ts` to use `driver_update_freight_status`
2. **Database rollback:** Migrations can be manually reversed in Supabase dashboard:
   - Remove RLS policy
   - Drop new functions
   - Drop implicit cast

## Future Improvements

1. Consider adding RPC function parameters for notes, location, etc. if needed
2. Add database-level tests using pg_tap
3. Consider adding audit logging for all status changes
4. Monitor performance of implicit cast function

## References

- Supabase RLS Documentation: https://supabase.com/docs/guides/auth/row-level-security
- PostgreSQL CAST Documentation: https://www.postgresql.org/docs/current/sql-createcast.html
- PostgreSQL SECURITY DEFINER: https://www.postgresql.org/docs/current/sql-createfunction.html

## Authors

- Implementation: GitHub Copilot
- Review: AgriRoute Connect Team
