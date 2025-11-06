# Guest User Validation - Security Implementation

## 🔒 Security Improvements

The `validate-guest-user` edge function has been completely rewritten to prevent **user enumeration attacks** and implement defense-in-depth security measures.

---

## ✅ Security Features Implemented

### 1. **User Enumeration Prevention** 
**CRITICAL SECURITY FIX**

**Before (VULNERABLE):**
```json
// Revealed if user exists:
{
  "user_exists": true,
  "profile_name": "João Silva",
  "profile_email": "joao@example.com"
}
```

**After (SECURE):**
```json
// Generic response for ALL users:
{
  "success": true,
  "message": "Informações recebidas com sucesso! Você receberá as próximas instruções em breve.",
  "next_steps": "Se você já possui uma conta, faça login para continuar. Caso contrário, aguarde as instruções de cadastro."
}
```

**Impact:** Attackers can no longer:
- Enumerate registered users by testing CPF/CNPJ numbers
- Harvest email addresses and names
- Build targeted phishing campaigns
- Violate LGPD privacy regulations

---

### 2. **hCaptcha Integration**
Prevents automated attacks and bot scraping:
- ✅ CAPTCHA verification required for every request
- ✅ Protects against automated user enumeration
- ✅ Prevents credential stuffing attacks
- ✅ Free tier: 100,000 requests/month

---

### 3. **Aggressive Rate Limiting**
**3 attempts per hour per IP address**

```typescript
// Rate limit response:
{
  "error": "Rate limit exceeded",
  "message": "Você atingiu o limite de tentativas. Aguarde até 15:30 para tentar novamente.",
  "retry_after": "2025-01-06T15:30:00Z",
  "current_attempts": 3,
  "max_allowed": 3
}
```

**Protection:**
- Prevents brute-force enumeration
- Limits reconnaissance attempts
- Reduces infrastructure costs
- HTTP 429 status code for rate limit violations

---

## 🛠️ Frontend Implementation Required

### Step 1: Install hCaptcha

```bash
npm install @hcaptcha/react-hcaptcha
```

### Step 2: Get hCaptcha Credentials

1. Sign up at [hCaptcha.com](https://www.hcaptcha.com/)
2. Create a new site
3. Copy your **Site Key** (public, safe for frontend)
4. Add to `.env`:
   ```
   VITE_HCAPTCHA_SITE_KEY=your_site_key_here
   ```
5. The **Secret Key** is already configured in Supabase Edge Functions

### Step 3: Update Guest Validation Form

```tsx
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface GuestFormData {
  name: string;
  email?: string;
  phone?: string;
  document: string;
}

export function GuestValidationForm() {
  const [formData, setFormData] = useState<GuestFormData>({
    name: '',
    email: '',
    phone: '',
    document: ''
  });
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const captchaRef = useRef<HCaptcha>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate CAPTCHA
    if (!captchaToken) {
      toast.error('Por favor, complete a verificação de segurança');
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.functions.invoke('validate-guest-user', {
        body: {
          name: formData.name,
          email: formData.email,
          phone: formData.phone,
          document: formData.document,
          captchaToken // Required!
        }
      });

      if (error) {
        // Handle specific error cases
        if (error.message?.includes('Rate limit')) {
          toast.error(error.message);
          return;
        }
        
        if (error.message?.includes('CAPTCHA')) {
          toast.error('Verificação de segurança falhou. Tente novamente.');
          captchaRef.current?.resetCaptcha();
          setCaptchaToken(null);
          return;
        }

        throw error;
      }

      // Success - Generic message for security
      toast.success(data.message);
      toast.info(data.next_steps, { duration: 8000 });
      
      // Reset form
      setFormData({ name: '', email: '', phone: '', document: '' });
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);

    } catch (error: any) {
      console.error('Validation error:', error);
      toast.error('Erro ao validar dados. Tente novamente.');
      
      // Reset CAPTCHA on error
      captchaRef.current?.resetCaptcha();
      setCaptchaToken(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name Field */}
      <div>
        <label htmlFor="name" className="block text-sm font-medium mb-1">
          Nome Completo *
        </label>
        <input
          id="name"
          type="text"
          required
          value={formData.name}
          onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="João da Silva"
        />
      </div>

      {/* Document Field */}
      <div>
        <label htmlFor="document" className="block text-sm font-medium mb-1">
          CPF ou CNPJ *
        </label>
        <input
          id="document"
          type="text"
          required
          value={formData.document}
          onChange={(e) => setFormData(prev => ({ ...prev, document: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="000.000.000-00"
        />
      </div>

      {/* Email Field */}
      <div>
        <label htmlFor="email" className="block text-sm font-medium mb-1">
          Email
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="seu@email.com"
        />
      </div>

      {/* Phone Field */}
      <div>
        <label htmlFor="phone" className="block text-sm font-medium mb-1">
          Telefone
        </label>
        <input
          id="phone"
          type="tel"
          value={formData.phone}
          onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
          className="w-full px-3 py-2 border rounded-md"
          placeholder="(00) 00000-0000"
        />
      </div>

      {/* hCaptcha Component */}
      <div className="my-4 flex justify-center">
        <HCaptcha
          ref={captchaRef}
          sitekey={import.meta.env.VITE_HCAPTCHA_SITE_KEY}
          onVerify={(token) => {
            console.log('CAPTCHA verified');
            setCaptchaToken(token);
          }}
          onExpire={() => {
            console.log('CAPTCHA expired');
            setCaptchaToken(null);
            toast.warning('Verificação expirou. Complete novamente.');
          }}
          onError={(err) => {
            console.error('CAPTCHA error:', err);
            setCaptchaToken(null);
            toast.error('Erro na verificação. Tente novamente.');
          }}
        />
      </div>

      {/* Submit Button */}
      <button
        type="submit"
        disabled={!captchaToken || isSubmitting}
        className="w-full py-2 px-4 bg-primary text-white rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors"
      >
        {isSubmitting ? 'Validando...' : 'Validar Dados'}
      </button>

      {/* Security Notice */}
      <p className="text-xs text-muted-foreground text-center mt-2">
        🔒 Suas informações são protegidas por verificação de segurança e criptografia
      </p>
    </form>
  );
}
```

---

## 📋 Rate Limiting Details

| Parameter | Value |
|-----------|-------|
| **Max Attempts** | 3 per hour |
| **Tracking** | IP address |
| **Reset Time** | 60 minutes after last attempt |
| **HTTP Status** | 429 (Too Many Requests) |

**Rate limit is enforced even if:**
- User changes document numbers
- User changes names or emails
- User uses different CAPTCHA tokens

**Tracked in database:**
- IP address (hashed for privacy)
- Timestamp of each attempt
- Total attempt count per window

---

## 🧪 Testing the Implementation

### Test Rate Limiting

```bash
# Attempt 1-3: Should work (with valid CAPTCHA)
curl -X POST https://[project].supabase.co/functions/v1/validate-guest-user \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","document":"12345678900","captchaToken":"test_token"}'

# Attempt 4: Should return 429 Rate Limit
# Response:
{
  "error": "Rate limit exceeded",
  "retry_after": "2025-01-06T15:30:00Z"
}
```

### Test CAPTCHA Enforcement

```bash
# Missing CAPTCHA token
curl -X POST https://[project].supabase.co/functions/v1/validate-guest-user \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","document":"12345678900"}'

# Response: 400 Bad Request
{
  "error": "CAPTCHA verification required"
}
```

### Test Generic Response

```bash
# Test with REGISTERED user document
# Response will be generic (doesn't reveal user exists)

# Test with NEW user document
# Response will be IDENTICAL (prevents enumeration)
```

---

## 🛡️ Security Guarantees

✅ **No User Enumeration:** Identical responses for existing and non-existing users  
✅ **Rate Limiting:** 3 attempts per hour per IP (tracked in database)  
✅ **CAPTCHA Required:** Prevents automated attacks and bots  
✅ **Generic Errors:** Internal errors don't leak system information  
✅ **IP Tracking:** Monitored for abuse patterns (LGPD compliant)  
✅ **LGPD Compliant:** No PII exposed through API responses  

---

## 📊 Database Changes

### New Function
```sql
check_guest_validation_rate_limit(p_ip_address TEXT) → JSONB
```

### Updated Table
```sql
prospect_users
  + metadata JSONB -- Stores IP, user agent, CAPTCHA verification status
  + (indexed on metadata->>'ip_address')
```

---

## 🔍 Monitoring & Auditing

All validation attempts are logged with:
- ✅ IP address (for rate limiting and abuse detection)
- ✅ User agent (for bot detection)
- ✅ CAPTCHA verification timestamp
- ✅ Whether user has registered account (internal only)
- ✅ Attempt timestamps and counts

**View rate limit violations:**
```sql
SELECT 
  metadata->>'ip_address' as ip,
  COUNT(*) as attempts,
  MAX(created_at) as last_attempt
FROM prospect_users
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY metadata->>'ip_address'
HAVING COUNT(*) >= 3;
```

---

## ⚠️ Important Notes

1. **Frontend MUST implement hCaptcha** - The endpoint will reject requests without valid CAPTCHA tokens

2. **Always show generic messages** - Never tell users whether their document is already registered

3. **Don't bypass rate limiting** - It's there for security, not convenience

4. **Test with real hCaptcha tokens** - Test tokens won't work in production

5. **Monitor abuse patterns** - Check logs regularly for suspicious activity

---

## 🚀 Deployment Checklist

- [ ] hCaptcha account created
- [ ] Site key added to frontend (.env)
- [ ] Secret key configured in Supabase (already done)
- [ ] Frontend form updated with hCaptcha component
- [ ] Rate limiting tested
- [ ] Generic responses verified
- [ ] Error handling implemented
- [ ] User messaging updated to be security-conscious
- [ ] Monitoring dashboard configured

---

## 📞 Support

For questions about this security implementation:
- Review the edge function code: `supabase/functions/validate-guest-user/index.ts`
- Check rate limiting function: See latest migration file
- hCaptcha docs: https://docs.hcaptcha.com/
- LGPD compliance: https://www.gov.br/lgpd/

---

**Security Note:** This implementation follows OWASP guidelines for preventing user enumeration and implements defense-in-depth security principles. Do not modify the security mechanisms without proper security review.
