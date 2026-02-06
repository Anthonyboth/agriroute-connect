import { test, expect, type Page } from '@playwright/test';

/**
 * Testes E2E de Conformidade i18n PT-BR — AgriRoute
 *
 * Cenário obrigatório:
 * E) Garantir que NENHUMA string de status/ação em inglês aparece em:
 *    - Cards de frete
 *    - Modais de proposta
 *    - Chat / mensagens
 *    - Notificações exibidas
 *    - Badges de status
 *    - Botões de ação
 *
 * Termos proibidos: ACCEPTED, PENDING, IN_TRANSIT, COUNTER_PROPOSAL,
 * LOADING, LOADED, DELIVERED_PENDING_CONFIRMATION, etc.
 */

// ===========================================================================
// CONSTANTES
// ===========================================================================

/**
 * Lista de termos em inglês que NUNCA devem aparecer como texto visível.
 * (podem existir em data-attributes para rastreabilidade)
 */
const FORBIDDEN_VISIBLE_TERMS = [
  'ACCEPTED',
  'PENDING',
  'IN_TRANSIT',
  'COUNTER_PROPOSAL',
  'LOADING',
  'LOADED',
  'DELIVERED_PENDING_CONFIRMATION',
  'DELIVERED',
  'COMPLETED',
  'CANCELLED',
  'REJECTED',
  'NEW',
  'APPROVED',
  'OPEN',
  'IN_NEGOTIATION',
  'EXPIRED',
  'PROCESSING',
  'FAILED',
  'PROPOSED',
  'PAID_BY_PRODUCER',
  'CONFIRMED',
  'REFUNDED',
  'ASSIGNED',
  'UNASSIGNED',
  'REMOVED',
  'WAITING_DRIVER',
  'WAITING_PRODUCER',
];

/**
 * Elementos internos onde códigos em inglês são aceitáveis
 * (data-attributes, console, etc.)
 */
const INTERNAL_ATTRIBUTES = [
  'data-raw-status',
  'data-action',
  'data-testid',
  'data-freight-id',
  'value',
  'name',
  'id',
  'class',
];

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
 * Verifica se o texto visível na página contém termos proibidos em inglês.
 * Retorna lista de violações encontradas.
 */
async function findForbiddenTermsInPage(page: Page): Promise<string[]> {
  return page.evaluate((forbiddenTerms: string[]) => {
    const violations: string[] = [];

    // Pegar todo texto visível (excluindo scripts, styles, inputs)
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode(node) {
          const parent = node.parentElement;
          if (!parent) return NodeFilter.FILTER_REJECT;

          // Ignorar scripts, styles, inputs
          const tag = parent.tagName.toUpperCase();
          if (['SCRIPT', 'STYLE', 'NOSCRIPT', 'CODE', 'PRE'].includes(tag)) {
            return NodeFilter.FILTER_REJECT;
          }

          // Ignorar elementos invisíveis
          const style = window.getComputedStyle(parent);
          if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
            return NodeFilter.FILTER_REJECT;
          }

          // Ignorar tooltips ocultos
          if (parent.getAttribute('role') === 'tooltip') {
            return NodeFilter.FILTER_REJECT;
          }

          return NodeFilter.FILTER_ACCEPT;
        },
      }
    );

    let node: Node | null;
    while ((node = walker.nextNode())) {
      const text = (node.textContent || '').trim();
      if (!text || text.length < 2) continue;

      // Verificar se algum termo proibido aparece como palavra inteira
      for (const term of forbiddenTerms) {
        // Regex para palavra inteira (delimitadores de palavra)
        const regex = new RegExp(`\\b${term}\\b`, 'g');
        if (regex.test(text)) {
          // Dupla verificação: é realmente o código cru? (todo maiúsculo)
          const words = text.split(/[\s,;.:!?\-_/\\()\[\]{}]+/);
          for (const word of words) {
            if (word === term || word.toUpperCase() === term) {
              // Verificar se é parte de um texto natural (ex: "Open" em frase)
              // Só reportar se for o código cru exato
              if (word === word.toUpperCase() && word === term) {
                const parentEl = node.parentElement;
                const isInternalAttr = parentEl?.hasAttribute('data-raw-status') ||
                  parentEl?.hasAttribute('data-action');

                if (!isInternalAttr) {
                  violations.push(`"${term}" encontrado em: "${text.substring(0, 80)}"`);
                }
              }
            }
          }
        }
      }
    }

    return [...new Set(violations)]; // Deduplica
  }, FORBIDDEN_VISIBLE_TERMS);
}

// ===========================================================================
// TESTES POR PAINEL
// ===========================================================================

test.describe('E.1) Dashboard do Motorista — i18n PT-BR', () => {

  test('Nenhum termo proibido em inglês no dashboard do motorista', async ({ page }) => {
    await loginAs(page, 'motorista');
    await page.waitForTimeout(3000);

    const violations = await findForbiddenTermsInPage(page);

    expect(
      violations,
      `Termos em inglês encontrados no dashboard do motorista:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  test('Tabs do motorista estão em PT-BR', async ({ page }) => {
    await loginAs(page, 'motorista');
    await page.waitForTimeout(2000);

    const tabs = page.locator('[role="tab"]');
    const count = await tabs.count();

    for (let i = 0; i < count; i++) {
      const tab = tabs.nth(i);
      const text = (await tab.textContent())?.trim() || '';

      if (text.length > 0) {
        // Tab não deve ser código cru em inglês
        expect(
          /^[A-Z_]{3,}$/.test(text),
          `Tab com texto em inglês cru: "${text}"`
        ).toBe(false);
      }
    }
  });
});

test.describe('E.2) Dashboard do Produtor — i18n PT-BR', () => {

  test('Nenhum termo proibido em inglês no dashboard do produtor', async ({ page }) => {
    await loginAs(page, 'produtor');
    await page.waitForTimeout(3000);

    const violations = await findForbiddenTermsInPage(page);

    expect(
      violations,
      `Termos em inglês encontrados no dashboard do produtor:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  test('Aba de pagamentos em PT-BR', async ({ page }) => {
    await loginAs(page, 'produtor');

    const paymentsTab = page.getByRole('tab', { name: /pagamentos/i });
    if (await paymentsTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await paymentsTab.click();
      await page.waitForTimeout(2000);

      const violations = await findForbiddenTermsInPage(page);
      expect(
        violations,
        `Termos em inglês na aba de pagamentos:\n${violations.join('\n')}`
      ).toHaveLength(0);
    }
  });
});

test.describe('E.3) Dashboard da Transportadora — i18n PT-BR', () => {

  test('Nenhum termo proibido em inglês no dashboard da transportadora', async ({ page }) => {
    await loginAs(page, 'transportadora');
    await page.waitForTimeout(3000);

    const violations = await findForbiddenTermsInPage(page);

    expect(
      violations,
      `Termos em inglês encontrados no dashboard da transportadora:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });
});

// ===========================================================================
// VERIFICAÇÃO GLOBAL
// ===========================================================================

test.describe('E.4) Verificação Global i18n', () => {

  test('HTML tem lang="pt-BR" e translate="no"', async ({ page }) => {
    await page.goto('/');

    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'pt-BR');
    await expect(htmlElement).toHaveAttribute('translate', 'no');
  });

  test('Meta tag notranslate presente', async ({ page }) => {
    await page.goto('/');

    const metaTag = page.locator('meta[name="google"]');
    await expect(metaTag).toHaveAttribute('content', 'notranslate');
  });

  test('Badges de status usam SafeStatusBadge (data-raw-status)', async ({ page }) => {
    await loginAs(page, 'motorista');
    await page.waitForTimeout(2000);

    // Todos os badges com data-raw-status devem ter texto traduzido
    const safeBadges = page.locator('[data-raw-status]');
    const count = await safeBadges.count();

    for (let i = 0; i < count; i++) {
      const badge = safeBadges.nth(i);
      const rawStatus = await badge.getAttribute('data-raw-status');
      const visibleText = (await badge.textContent())?.trim();

      if (rawStatus && visibleText) {
        // Remover emojis para comparação
        const cleanText = visibleText.replace(/[\u{1F000}-\u{1FFFF}]/gu, '').trim();

        // Texto visível NÃO pode ser o código cru
        if (/^[A-Z_]+$/.test(rawStatus)) {
          expect(
            cleanText !== rawStatus,
            `Badge mostrando código cru "${rawStatus}" ao invés de tradução PT-BR`
          ).toBe(true);
        }
      }
    }
  });

  test('Nenhum console.error contém status cru em mensagem ao usuário', async ({ page }) => {
    const userFacingErrors: string[] = [];

    page.on('console', msg => {
      if (msg.type() === 'error') {
        const text = msg.text();
        // Verificar se erros para o usuário contêm códigos crus
        if (text.includes('toast') || text.includes('Toast') || text.includes('Sonner')) {
          for (const term of FORBIDDEN_VISIBLE_TERMS) {
            if (text.includes(term) && !text.includes('data-raw-status')) {
              userFacingErrors.push(`Erro com termo cru "${term}": ${text.substring(0, 100)}`);
            }
          }
        }
      }
    });

    await loginAs(page, 'motorista');
    await page.waitForTimeout(3000);

    expect(
      userFacingErrors,
      `Erros com termos em inglês:\n${userFacingErrors.join('\n')}`
    ).toHaveLength(0);
  });
});
