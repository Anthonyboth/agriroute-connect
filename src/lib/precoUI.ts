/**
 * src/lib/precoUI.ts
 *
 * REGRA UNIVERSAL DO APP:
 * - SOMENTE o SOLICITANTE (produtor que criou OU guest que criou) pode ver
 *   cálculos, totais, estimativas, metadata ("12 carretas", "500 ton").
 * - QUALQUER outro viewer (motorista, transportadora, admin, etc.) vê
 *   APENAS o preço unitário preenchido (primaryText).
 *
 * Esta é a ÚNICA função que decide o que pode ser exibido.
 */

export type UiPriceMode = 'UNIT_ONLY' | 'REQUESTER_FULL';

/**
 * Decide se o viewer atual é o solicitante do frete/serviço.
 *
 * @param viewerProfileId  ID do perfil logado (de useAuth → profile.id)
 * @param viewerRole       Role ativo (PRODUTOR, MOTORISTA, TRANSPORTADORA, etc.)
 * @param freightProducerId  producer_id do frete (quem criou)
 */
export function resolveUiPriceMode(
  viewerProfileId: string | null | undefined,
  viewerRole: string | null | undefined,
  freightProducerId: string | null | undefined,
): UiPriceMode {
  // Sem viewer → modo restrito
  if (!viewerProfileId || !viewerRole) return 'UNIT_ONLY';

  // Admin no painel admin pode ver tudo (exceção explícita)
  if (viewerRole === 'ADMIN') return 'REQUESTER_FULL';

  // Produtor que É o dono do frete
  if (
    (viewerRole === 'PRODUTOR' || viewerRole === 'PRODUCER') &&
    freightProducerId &&
    viewerProfileId === freightProducerId
  ) {
    return 'REQUESTER_FULL';
  }

  // Qualquer outro caso → só unitário
  return 'UNIT_ONLY';
}
