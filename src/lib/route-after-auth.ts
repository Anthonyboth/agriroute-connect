/**
 * routeAfterAuth — Helper centralizado de redirecionamento pós-autenticação.
 *
 * REGRAS:
 * 1. waitForProfile: polling com retry progressivo (sem setTimeout fixo)
 * 2. Se selfie_url ou document_photo_url ausentes => /complete-profile
 * 3. MOTORISTA autônomo sem vínculo ATIVO e status != APPROVED => /awaiting-approval
 * 4. Caso contrário => dashboard por role (via panelAccessGuard)
 *
 * Usado por: Auth.tsx, AffiliateSignup.tsx, DriverInviteSignup.tsx,
 *            CompanyInviteAccept.tsx, AffiliatedDriverSignup.tsx
 */

import { supabase } from '@/integrations/supabase/client';
import { getDefaultRouteForProfile } from '@/security/panelAccessGuard';

export interface ProfileForRouting {
  id: string;
  role: string;
  status: string;
  selfie_url: string | null;
  document_photo_url: string | null;
}

/**
 * Aguarda o profile ser criado pelo trigger handle_new_user com retry progressivo.
 * Delays: 250, 400, 650, 900, 1200, 1600ms (total ~5s)
 */
export async function waitForProfile(userId: string): Promise<ProfileForRouting | null> {
  const delays = [250, 400, 650, 900, 1200, 1600];

  for (let i = 0; i < delays.length; i++) {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, role, status, selfie_url, document_photo_url')
      .eq('user_id', userId)
      .maybeSingle();

    if (data && !error) {
      return {
        id: data.id,
        role: data.role || 'PRODUTOR',
        status: data.status || 'PENDING',
        selfie_url: data.selfie_url,
        document_photo_url: data.document_photo_url,
      };
    }

    // Não esperar após a última tentativa
    if (i < delays.length - 1) {
      await new Promise(r => setTimeout(r, delays[i]));
    }
  }

  console.error('[routeAfterAuth] Profile não encontrado após 6 tentativas para userId:', userId);
  return null;
}

/**
 * Verifica se o perfil tem os documentos mínimos obrigatórios preenchidos.
 */
function isProfileComplete(profile: ProfileForRouting): boolean {
  return !!(profile.selfie_url && profile.document_photo_url);
}

/**
 * Resolve a rota de destino pós-autenticação.
 *
 * GATE UNIVERSAL:
 * - Documentos ausentes => /complete-profile
 * - MOTORISTA autônomo não aprovado => /awaiting-approval
 * - Caso contrário => dashboard por role
 */
export async function resolvePostAuthRoute(profile: ProfileForRouting): Promise<string> {
  // Gate 1: Perfil incompleto — sempre força /complete-profile
  if (!isProfileComplete(profile)) {
    return '/complete-profile';
  }

  // Gate 2: Motorista autônomo precisa aprovação admin
  if (profile.role === 'MOTORISTA' && profile.status !== 'APPROVED') {
    // Verificar se possui vínculo ATIVO com alguma transportadora
    const { data: activeLink } = await supabase
      .from('company_drivers')
      .select('id')
      .eq('driver_profile_id', profile.id)
      .eq('status', 'ACTIVE')
      .limit(1)
      .maybeSingle();

    if (!activeLink) {
      return '/awaiting-approval';
    }
  }

  // Gate 3: Dashboard por role (fonte única: panelAccessGuard)
  return getDefaultRouteForProfile({ role: profile.role });
}

/**
 * Fluxo completo: aguarda profile + resolve rota.
 * Retorna a rota de destino ou '/complete-profile' como fallback seguro.
 */
export async function routeAfterAuth(userId: string): Promise<string> {
  const profile = await waitForProfile(userId);

  if (!profile) {
    // Fallback seguro: se profile não foi encontrado, ir para complete-profile
    return '/complete-profile';
  }

  return resolvePostAuthRoute(profile);
}
