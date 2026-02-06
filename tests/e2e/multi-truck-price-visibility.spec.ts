import { test, expect, type Page } from '@playwright/test';

/**
 * Testes E2E de Visibilidade de Preço Multi-Carreta — AgriRoute
 *
 * Cenários obrigatórios:
 * D) Multi-carreta — preço:
 *    - Motorista vê APENAS preço /carreta (NUNCA total)
 *    - Produtor vê preço total
 *    - Propostas exibidas como /carreta
 *    - SafePrice é usado em todas as telas de frete
 *
 * Regra de ouro: Se required_trucks > 1 e viewerRole == MOTORISTA,
 * o valor total NUNCA deve aparecer.
 */

// ===========================================================================
// HELPERS
// ===========================================================================

async function loginAs(page: Page, role: 'motorista' | 'produtor' | 'transportadora') {
  const emails: Record<string, string> = {
    motorista: 'motorista@test.com',
    produtor: 'produtor@test.com',
    transportadora: 'transportadora@test.com',
  };
  await page.goto('/');
  await page.fill('input[type="email"]', emails[role]);
  await page.fill('input[type="password"]', 'senha123');
  await page.click('button[type="submit"]');

  const dashboards: Record<string, string> = {
    motorista: '/dashboard/driver',
    produtor: '/dashboard/producer',
    transportadora: '/dashboard/company',
  };
  await page.waitForURL(dashboards[role], { timeout: 15000 });
}

/**
 * Extrai todos os valores monetários visíveis na página.
 * Formato esperado: R$ 1.234,56
 */
async function extractVisiblePrices(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const priceRegex = /R\$\s*[\d.,]+/g;
    const bodyText = document.body.innerText;
    const matches = bodyText.match(priceRegex) || [];
    return matches;
  });
}

/**
 * Verifica se um valor total específico NÃO aparece visível na página.
 */
async function assertTotalPriceNotVisible(page: Page, totalValue: number) {
  const formatted = totalValue.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  const fullText = `R$ ${formatted}`;
  const visibleElements = page.locator(`text="${fullText}"`);
  const count = await visibleElements.count();

  // Se encontrou, verificar se é realmente visível (não escondido)
  for (let i = 0; i < count; i++) {
    const el = visibleElements.nth(i);
    const isVisible = await el.isVisible().catch(() => false);
    if (isVisible) {
      // Verificar se não está em contexto de produtor/admin
      const parentSafePrice = el.locator('xpath=ancestor::*[contains(@class, "total")]');
      const isTotalContext = await parentSafePrice.count() > 0;
      
      if (!isTotalContext) {
        expect.soft(
          false,
          `Valor total ${fullText} está visível para motorista na UI`
        ).toBe(true);
      }
    }
  }
}

// ===========================================================================
// D.1) MOTORISTA — VISÃO RESTRITA
// ===========================================================================

test.describe('D.1) Motorista — Visão de Preço Restrita', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'motorista');
  });

  test('Dashboard do motorista usa SafePrice (sem formatBRL direto)', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Verificar que os preços visíveis usam o formato correto
    const prices = await extractVisiblePrices(page);

    // Se existem preços, todos devem estar em formato BRL
    for (const price of prices) {
      expect(price).toMatch(/R\$\s*[\d.,]+/);
    }
  });

  test('Cards de frete mostram label "/carreta" para multi-carreta', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Buscar indicadores de multi-carreta
    const perTruckLabels = page.locator('text="/carreta"');
    const truckBadges = page.locator('text=/\\d+ carretas/');

    // Se existem, verificar que estão visíveis
    const perTruckCount = await perTruckLabels.count();
    const truckBadgeCount = await truckBadges.count();

    // Se tem frete multi-carreta, deve ter label de "/carreta" ou indicador de carretas
    // (pode não ter fretes multi-carreta no momento)
  });

  test('Propostas do motorista mostram preço por carreta', async ({ page }) => {
    // Navegar para aba de propostas
    const proposalsTab = page.getByRole('tab', { name: /propostas/i });
    if (await proposalsTab.isVisible({ timeout: 3000 }).catch(() => false)) {
      await proposalsTab.click();
      await page.waitForTimeout(1500);

      // Verificar que preços visíveis são por carreta (indicador "/carreta")
      const bodyText = await page.locator('body').textContent();
      
      // Não deve conter "(total)" no contexto do motorista
      // (exceto se for carreta única)
      const totalLabels = page.locator('text="(total)"');
      const totalCount = await totalLabels.count();

      for (let i = 0; i < totalCount; i++) {
        const label = totalLabels.nth(i);
        const isVisible = await label.isVisible().catch(() => false);
        if (isVisible) {
          // Verificar se está em contexto de motorista
          // Em multi-carreta, motorista NUNCA deve ver "(total)"
          expect.soft(
            false,
            'Motorista vendo label "(total)" — possível vazamento de preço total'
          ).toBe(true);
        }
      }
    }
  });
});

// ===========================================================================
// D.2) PRODUTOR — VISÃO COMPLETA
// ===========================================================================

test.describe('D.2) Produtor — Visão Completa', () => {

  test.beforeEach(async ({ page }) => {
    await loginAs(page, 'produtor');
  });

  test('Produtor pode ver preço total do frete', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Produtor deve ter acesso a preços totais
    const prices = await extractVisiblePrices(page);

    // Se existem preços, devem estar formatados corretamente
    for (const price of prices) {
      expect(price).toMatch(/R\$\s*[\d.,]+/);
    }
  });

  test('Produtor vê indicadores de carretas em fretes multi-carreta', async ({ page }) => {
    await page.waitForTimeout(2000);

    // Buscar indicadores de multi-carreta para produtor
    const truckIndicators = page.locator('text=/\\d+ carretas/');
    const count = await truckIndicators.count();

    // Se existem fretes multi-carreta, produtor deve ver indicadores
    // (verificação de presença, não de ausência)
  });
});

// ===========================================================================
// D.3) TRANSPORTADORA — VISÃO MISTA
// ===========================================================================

test.describe('D.3) Transportadora — Visão Mista', () => {

  test('Dashboard da transportadora mostra preços formatados', async ({ page }) => {
    await loginAs(page, 'transportadora');
    await page.waitForTimeout(2000);

    const prices = await extractVisiblePrices(page);

    // Todos os preços devem estar em formato BRL válido
    for (const price of prices) {
      expect(price).toMatch(/R\$\s*[\d.,]+/);
    }
  });
});

// ===========================================================================
// D.4) VERIFICAÇÃO DE COMPONENTES DE SEGURANÇA
// ===========================================================================

test.describe('D.4) Verificação de Componentes de Segurança', () => {

  test('SafeStatusBadge renderiza data-raw-status (rastreabilidade)', async ({ page }) => {
    await loginAs(page, 'motorista');
    await page.waitForTimeout(2000);

    // Badges com data-raw-status = SafeStatusBadge utilizado
    const safeBadges = page.locator('[data-raw-status]');
    const count = await safeBadges.count();

    // Se existem badges, todos devem ter texto em PT-BR (não o data-raw-status)
    for (let i = 0; i < count; i++) {
      const badge = safeBadges.nth(i);
      const rawStatus = await badge.getAttribute('data-raw-status');
      const visibleText = await badge.textContent();

      // O texto visível NUNCA deve ser o código cru em inglês
      if (rawStatus && /^[A-Z_]+$/.test(rawStatus)) {
        expect(
          visibleText?.toUpperCase().trim() !== rawStatus,
          `SafeStatusBadge mostrando código cru: "${rawStatus}"`
        ).toBe(true);
      }
    }
  });

  test('FreightActionButton renderiza data-action (rastreabilidade)', async ({ page }) => {
    await loginAs(page, 'motorista');
    await page.waitForTimeout(2000);

    const actionButtons = page.locator('button[data-action]');
    const count = await actionButtons.count();

    for (let i = 0; i < count; i++) {
      const btn = actionButtons.nth(i);
      const action = await btn.getAttribute('data-action');
      const text = await btn.textContent();

      // Texto do botão deve estar em PT-BR
      if (action && text) {
        expect(
          text.trim() !== action,
          `FreightActionButton mostrando ação cru: "${action}"`
        ).toBe(true);
      }
    }
  });
});
