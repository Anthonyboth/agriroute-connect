import { test, expect } from '@playwright/test';

test.describe('Fluxo de Entrega e Avaliação de Frete', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login como motorista
    await page.goto('/');
    await page.fill('input[type="email"]', 'motorista@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/driver');
  });
  
  test('Motorista reporta entrega e produtor confirma com avaliação', async ({ page, context }) => {
    // 1. Motorista marca frete como entregue
    const freightCard = page.locator('[data-testid="freight-card-ongoing"]').first();
    await freightCard.click();
    
    const deliveredButton = page.locator('[data-testid="mark-delivered-button"]');
    await deliveredButton.click();
    
    // Verificar toast de sucesso
    await expect(page.locator('.sonner-toast')).toContainText(/entrega/i);
    
    // 2. Abrir nova aba como produtor
    const producerPage = await context.newPage();
    await producerPage.goto('/');
    await producerPage.fill('input[type="email"]', 'produtor@test.com');
    await producerPage.fill('input[type="password"]', 'senha123');
    await producerPage.click('button[type="submit"]');
    await producerPage.waitForURL('/dashboard/producer');
    
    // 3. Verificar notificação de entrega
    const notificationsButton = producerPage.locator('[data-testid="notifications-button"]');
    await notificationsButton.click();
    
    const deliveryNotification = producerPage.locator('.notification-item').filter({ 
      hasText: /entrega/i 
    });
    await expect(deliveryNotification).toBeVisible();
    
    // 4. Clicar na notificação e ir para "Confirmar Entrega"
    await deliveryNotification.click();
    await producerPage.waitForTimeout(1000);
    
    // 5. Verificar contador de prazo
    const deadlineIndicator = producerPage.locator('[data-testid="delivery-deadline"]');
    await expect(deadlineIndicator).toContainText(/restantes/i);
    
    // 6. Confirmar entrega
    const confirmButton = producerPage.locator('button').filter({ hasText: /confirmar entrega/i }).first();
    await confirmButton.click();
    
    // 7. Aguardar modal de avaliação abrir automaticamente
    await producerPage.waitForTimeout(1500);
    
    const ratingModal = producerPage.locator('[data-testid="rating-modal"]');
    await expect(ratingModal).toBeVisible({ timeout: 5000 });
    
    // 8. Verificar que é avaliação de motorista
    await expect(ratingModal).toContainText(/avaliar/i);
    
    // 9. Enviar avaliação
    const star5 = producerPage.locator('[data-testid="star-rating-5"]');
    await star5.click();
    
    const commentField = producerPage.locator('textarea[placeholder*="comentário"]');
    await commentField.fill('Excelente motorista, entrega no prazo!');
    
    const submitButton = producerPage.locator('button').filter({ hasText: /enviar/i });
    await submitButton.click();
    
    // 10. Verificar sucesso e modal fechado
    await expect(producerPage.locator('.sonner-toast')).toContainText(/avaliação/i);
    await expect(ratingModal).not.toBeVisible();
  });
  
  test('Verificar proteção contra tradução automática do navegador', async ({ page }) => {
    // Forçar navegador com idioma inglês
    await page.goto('/', { 
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' } 
    });
    
    // Verificar atributos HTML de proteção
    const htmlElement = page.locator('html');
    await expect(htmlElement).toHaveAttribute('lang', 'pt-BR');
    await expect(htmlElement).toHaveAttribute('translate', 'no');
    
    // Verificar meta tag Google
    const metaTag = page.locator('meta[name="google"]');
    await expect(metaTag).toHaveAttribute('content', 'notranslate');
    
    // Login e verificar textos em português
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer');
    
    // Verificar que tabs principais estão em português COMPLETO
    const tabs = page.locator('[role="tablist"]').first();
    await expect(tabs).toContainText('Avaliações'); // NÃO "Aval"
    await expect(tabs).toContainText('Pagamentos'); // NÃO "Pag"
    
    // Verificar que NÃO há traduções corrompidas
    const body = page.locator('body');
    await expect(body).not.toContainText('Ele se fez ouvir');
    await expect(body).not.toContainText('Democratas Pendentes');
    await expect(body).not.toContainText(/\bPag\b/); // Abreviação proibida
    await expect(body).not.toContainText(/\bAval\b/); // Abreviação proibida
  });
  
  test('Sistema de deadline de 72h com notificações automáticas', async ({ page }) => {
    // Simular que se passou 50 horas desde entrega reportada
    await page.addInitScript(() => {
      const originalDate = Date;
      // @ts-ignore
      globalThis.Date = class extends originalDate {
        constructor(...args: any[]) {
          if (args.length === 0) {
            const now = new originalDate();
            now.setHours(now.getHours() + 50); // Avançar 50h (dentro de 72h, mas após 48h)
            return now as any;
          }
          return new originalDate(...args) as any;
        }
        static now() {
          return new originalDate().getTime() + (50 * 60 * 60 * 1000);
        }
      } as any;
    });
    
    // Login como produtor
    await page.goto('/');
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer');
    
    // Verificar notificação de urgência (<24h restantes)
    const notificationsButton = page.locator('[data-testid="notifications-button"]');
    await notificationsButton.click();
    
    const urgentNotification = page.locator('.notification-item').filter({ 
      hasText: /24 horas/i 
    });
    await expect(urgentNotification).toBeVisible();
    
    // Ir para aba "Confirmar Entrega"
    const confirmTab = page.locator('[role="tab"]').filter({ hasText: /confirmar entrega/i });
    await confirmTab.click();
    
    // Verificar badge de urgência (crítico < 6h, urgente < 24h)
    const urgentBadge = page.locator('[data-testid="freight-urgent-badge"]').first();
    await expect(urgentBadge).toBeVisible();
    await expect(urgentBadge).toContainText(/restantes/i);
    
    // Badge deve ter classe de urgência (destructive ou warning)
    const badgeClass = await urgentBadge.getAttribute('class');
    expect(badgeClass).toMatch(/(destructive|warning)/);
  });
  
  test('Filtros avançados de fretes funcionam corretamente', async ({ page }) => {
    // Login
    await page.goto('/');
    await page.fill('input[type="email"]', 'motorista@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/driver');
    
    // Abrir filtros avançados
    const filterButton = page.locator('button').filter({ hasText: /filtro/i });
    await filterButton.click();
    
    // Verificar componente de filtros
    const filterCard = page.locator('[data-testid="advanced-filters"]');
    await expect(filterCard).toBeVisible();
    
    // Ajustar faixa de preço
    const priceSlider = page.locator('input[type="range"]').first();
    await priceSlider.fill('5000');
    
    // Selecionar ordenação
    const sortSelect = page.locator('select', { hasText: /ordenar/i });
    await sortSelect.selectOption('price');
    
    // Aplicar filtros
    const applyButton = page.locator('button').filter({ hasText: /aplicar/i });
    await applyButton.click();
    
    // Verificar que filtros foram aplicados
    await page.waitForTimeout(1000);
    const freightCards = page.locator('[data-testid="freight-card"]');
    await expect(freightCards.first()).toBeVisible();
  });
});
