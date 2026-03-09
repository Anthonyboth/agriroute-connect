

## Plan: Add Password Reset Section to Admin User Detail

### Context
The edge function `admin-reset-password` already exists with full security (admin whitelist, rate limiting, audit logging, Telegram alerts). Only the UI is missing from the admin detail page.

### What to build
Add a new Card section "Acesso e Senha" inside the "Validações e Segurança" area (after line 384) in `AdminRegistrationDetail.tsx` with:

1. **Info display**: Show user email (read-only) and last sign-in date
2. **Password reset form**: Input for new password + optional reason field + "Redefinir Senha" button
3. **Confirmation dialog**: Before executing, show a confirmation dialog with the target user email
4. **Integration**: Call the existing `admin-reset-password` edge function via `supabase.functions.invoke`

### Technical details

**File: `src/components/admin-panel/AdminRegistrationDetail.tsx`**

- Add state variables: `newPassword`, `resetReason`, `resetDialogOpen`, `resettingPassword`
- Add `import { Key } from 'lucide-react'` icon
- Import `PasswordInput` from `@/components/ui/password-input`
- Import `supabase` from `@/integrations/supabase/client`
- Add `handlePasswordReset` function that:
  - Validates password is not empty and has minimum 6 chars
  - Opens confirmation dialog
  - On confirm, calls `supabase.functions.invoke('admin-reset-password', { body: { user_email, new_password, reset_reason } })`
  - Shows success/error toast
  - Clears form on success
- Insert new Card after the "Validações e Segurança" card (after line 385):
  - Header: Key icon + "Acesso e Senha"
  - Email display (read-only)
  - PasswordInput for new password
  - Textarea for reset reason (optional)
  - Button "Redefinir Senha" with loading state
  - AlertDialog for confirmation

**Security note**: The edge function already handles all server-side security (admin verification, rate limiting, audit). The UI just needs to call it. No sensitive data (like current password hash) is ever exposed to the frontend.

