export interface FeedIntegrityGuardInput {
  scope: 'driver' | 'carrier' | 'provider' | 'unified';
  backendEligible: number;
  backendDisplayed: number;
  renderedDisplayed: number;
  fallbackUsed: boolean;
  frontendFiltersActive?: boolean;
  role?: string;
}

export function runFeedIntegrityGuard(input: FeedIntegrityGuardInput): void {
  if (!import.meta.env.DEV) return;

  const {
    scope,
    backendEligible,
    backendDisplayed,
    renderedDisplayed,
    fallbackUsed,
    frontendFiltersActive = false,
    role,
  } = input;

  if (backendEligible > backendDisplayed) {
    console.error('[FeedIntegrityGuard] backendEligible > backendDisplayed', {
      scope,
      role,
      backendEligible,
      backendDisplayed,
    });
  }

  // ✅ Tolerância de 1 item: race conditions normais (item expira entre fetch e render)
  const discrepancy = backendDisplayed - renderedDisplayed;
  if (backendDisplayed > 0 && discrepancy > 1 && !frontendFiltersActive) {
    console.warn('[FeedIntegrityGuard] renderedDisplayed < backendDisplayed sem filtro explícito do usuário', {
      scope,
      role,
      backendDisplayed,
      renderedDisplayed,
      discrepancy,
    });
  }

  if (fallbackUsed) {
    console.error('[FeedIntegrityGuard] fail-safe fallback acionado para preservar visibilidade', {
      scope,
      role,
      backendEligible,
      backendDisplayed,
      renderedDisplayed,
    });
  }
}
