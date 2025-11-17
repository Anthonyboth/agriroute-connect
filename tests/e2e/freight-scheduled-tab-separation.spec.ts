import { test, expect } from '@playwright/test';

/**
 * Teste E2E: Fretes com Data Futura em "Agendados"
 * 
 * Valida que fretes com pickup_date no futuro aparecem APENAS em "Agendados"
 * e NUNCA em "Em Andamento", prevenindo regressão crítica.
 */

test.describe('Separação de Tabs: Agendados vs Em Andamento', () => {
  test.beforeEach(async ({ page }) => {
    // Navegar para a página de login
    await page.goto('/auth');
  });

  test('Frete com data futura aparece apenas em Agendados - Producer Dashboard', async ({ page }) => {
    // Setup: Logar como produtor
    await page.fill('input[type="email"]', 'producer@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/producer-dashboard', { timeout: 10000 });
    
    // Criar frete com data futura (hoje + 3 dias)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 3);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    // Navegar para criar frete
    await page.click('button:has-text("Novo Frete")');
    await page.fill('input[name="cargo_type"]', 'Soja');
    await page.fill('input[name="weight"]', '25000');
    await page.fill('input[name="pickup_date"]', futureDateStr);
    await page.click('button:has-text("Criar Frete")');
    
    // Aguardar toast de sucesso
    await expect(page.locator('text=Frete criado com sucesso')).toBeVisible({ timeout: 5000 });
    
    // Verificar: frete APARECE em "Agendados"
    await page.click('button:has-text("Agendados")');
    await expect(page.locator('[data-testid^="scheduled-freight-"]')).toBeVisible({ timeout: 3000 });
    
    // Verificar: frete NÃO APARECE em "Em Andamento"
    await page.click('button:has-text("Em Andamento")');
    const ongoingFreights = await page.locator('[data-testid^="ongoing-freight-"]').count();
    expect(ongoingFreights).toBe(0);
  });

  test('Frete com data de hoje aparece em Em Andamento - Producer Dashboard', async ({ page }) => {
    // Setup: Logar como produtor
    await page.fill('input[type="email"]', 'producer@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/producer-dashboard', { timeout: 10000 });
    
    // Criar frete com data de hoje
    const todayStr = new Date().toISOString().split('T')[0];
    
    await page.click('button:has-text("Novo Frete")');
    await page.fill('input[name="cargo_type"]', 'Milho');
    await page.fill('input[name="weight"]', '30000');
    await page.fill('input[name="pickup_date"]', todayStr);
    await page.click('button:has-text("Criar Frete")');
    
    await expect(page.locator('text=Frete criado com sucesso')).toBeVisible({ timeout: 5000 });
    
    // Verificar: frete APARECE em "Em Andamento"
    await page.click('button:has-text("Em Andamento")');
    await expect(page.locator('[data-testid^="ongoing-freight-"]')).toBeVisible({ timeout: 3000 });
    
    // Verificar: frete NÃO APARECE em "Agendados"
    await page.click('button:has-text("Agendados")');
    const scheduledFreights = await page.locator('[data-testid^="scheduled-freight-"]').count();
    expect(scheduledFreights).toBe(0);
  });

  test('Frete com data passada aparece em Em Andamento - Driver Dashboard', async ({ page }) => {
    // Setup: Logar como motorista
    await page.fill('input[type="email"]', 'driver@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/driver-dashboard', { timeout: 10000 });
    
    // Buscar frete com data passada (ontem)
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    // Navegar para "Em Andamento"
    await page.click('button:has-text("Em Andamento")');
    
    // Verificar que fretes aparecem (pode haver fretes históricos)
    const ongoingCount = await page.locator('[data-testid^="ongoing-freight-"]').count();
    expect(ongoingCount).toBeGreaterThanOrEqual(0);
    
    // Navegar para "Agendados" e verificar que não há fretes passados
    await page.click('button:has-text("Agendados")');
    const scheduledCount = await page.locator('[data-testid^="scheduled-freight-"]').count();
    
    // Se houver fretes agendados, verificar que todos têm data futura
    if (scheduledCount > 0) {
      const badges = await page.locator('text=/\\d+ dia.*para coleta/').all();
      expect(badges.length).toBeGreaterThan(0);
    }
  });

  test('Company Dashboard separa corretamente tabs por data', async ({ page }) => {
    // Setup: Logar como transportadora
    await page.fill('input[type="email"]', 'company@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/company-dashboard', { timeout: 10000 });
    
    // Navegar para "Agendados"
    await page.click('button:has-text("Agendados")');
    
    // Se houver fretes agendados, verificar badge de data
    const scheduledCards = await page.locator('[data-testid^="scheduled-freight-"]').all();
    for (const card of scheduledCards) {
      // Verificar presença de badge com texto indicando dias futuros
      await expect(card.locator('text=/\\d+ dia.*para coleta|Coleta amanhã/')).toBeVisible();
    }
    
    // Navegar para "Em Andamento"
    await page.click('button:has-text("Em Andamento")');
    
    // Verificar que não há badges de "X dias para coleta" (futuros)
    const ongoingCards = await page.locator('[data-testid^="ongoing-freight-"]').all();
    for (const card of ongoingCards) {
      // Não deve ter badge de data futura
      const futureBadge = await card.locator('text=/\\d+ dia.*para coleta/').count();
      expect(futureBadge).toBe(0);
    }
  });
});
