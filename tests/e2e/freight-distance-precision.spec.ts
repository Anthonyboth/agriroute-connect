import { test, expect } from '@playwright/test';

/**
 * Teste E2E: Distância Sempre Arredondada
 * 
 * Valida que distâncias são sempre exibidas como inteiros (ex: "746 km")
 * e armazenadas arredondadas no banco após recálculo.
 */

test.describe('Precisão de Distância: Sempre Inteiro', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/auth');
  });

  test('Producer Dashboard exibe distâncias arredondadas', async ({ page }) => {
    // Setup: Logar como produtor
    await page.fill('input[type="email"]', 'producer@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/producer-dashboard', { timeout: 10000 });
    
    // Navegar para lista de fretes
    await page.click('button:has-text("Em Andamento")');
    
    // Verificar que todas as distâncias são inteiras
    const distanceElements = await page.locator('text=/\\d+ km/').all();
    
    for (const element of distanceElements) {
      const text = await element.textContent();
      
      // Verificar formato: deve ser "XXX km" sem decimais
      expect(text).toMatch(/^\d+ km$/);
      
      // Verificar que NÃO contém decimais
      expect(text).not.toMatch(/\d+\.\d+/);
      expect(text).not.toMatch(/\d+,\d+/);
    }
  });

  test('FreightDetails modal recalcula e armazena distância arredondada', async ({ page }) => {
    // Setup: Logar como produtor
    await page.fill('input[type="email"]', 'producer@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/producer-dashboard', { timeout: 10000 });
    
    // Abrir primeiro frete
    const firstFreight = page.locator('[data-testid^="freight-card-"]').first();
    await firstFreight.click();
    
    // Aguardar modal abrir
    await expect(page.locator('[data-testid="freight-details-modal"]')).toBeVisible({ timeout: 5000 });
    
    // Capturar ID do frete para consulta posterior
    const freightId = await page.locator('[data-testid="freight-id"]').textContent();
    
    // Clicar em "Recalcular distância"
    await page.click('button:has-text("Recalcular distância")');
    
    // Aguardar toast de sucesso
    await expect(page.locator('text=Distância recalculada com sucesso')).toBeVisible({ timeout: 10000 });
    
    // Verificar que distância exibida é inteira
    const distanceDisplay = await page.locator('text=/Distância:.*\\d+ km/').textContent();
    expect(distanceDisplay).toMatch(/\d+ km/);
    expect(distanceDisplay).not.toMatch(/\d+\.\d+/);
    
    // Fechar modal
    await page.click('button[aria-label="Close"]');
    
    // Consultar banco via API para verificar valor armazenado
    // (Isso requer configuração de acesso ao Supabase no teste)
    // Por ora, validamos apenas a UI
  });

  test('Driver Dashboard exibe distâncias sem decimais', async ({ page }) => {
    // Setup: Logar como motorista
    await page.fill('input[type="email"]', 'driver@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/driver-dashboard', { timeout: 10000 });
    
    // Verificar cards de frete
    const freightCards = await page.locator('[data-testid^="freight-card-"]').all();
    
    for (const card of freightCards) {
      const distanceText = await card.locator('text=/\\d+ km/').textContent();
      
      // Validar formato inteiro
      expect(distanceText).toMatch(/^\d+ km$/);
      expect(distanceText).not.toMatch(/\d+\.\d+/);
    }
  });

  test('Company Dashboard exibe distâncias arredondadas em histórico', async ({ page }) => {
    // Setup: Logar como transportadora
    await page.fill('input[type="email"]', 'company@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/company-dashboard', { timeout: 10000 });
    
    // Navegar para histórico
    await page.click('button:has-text("Histórico")');
    
    // Aguardar carregamento
    await page.waitForTimeout(2000);
    
    // Verificar distâncias no histórico
    const historyDistances = await page.locator('text=/\\d+ km/').all();
    
    for (const element of historyDistances) {
      const text = await element.textContent();
      
      // Deve ser inteiro
      expect(text).toMatch(/^\d+ km$/);
      
      // Não deve ter decimais
      expect(text).not.toMatch(/\d+\.\d+/);
      expect(text).not.toMatch(/\d+,\d+/);
    }
  });

  test('Marketplace exibe distâncias sem casas decimais', async ({ page }) => {
    // Acessar marketplace público
    await page.goto('/');
    
    // Aguardar cards de frete carregarem
    await page.waitForSelector('[data-testid^="freight-card-"]', { timeout: 10000 });
    
    // Verificar todas as distâncias
    const distances = await page.locator('text=/\\d+ km/').all();
    
    for (const element of distances) {
      const text = await element.textContent();
      
      // Validar formato
      expect(text).toMatch(/^\d+ km$/);
      
      // Validar que não tem decimais como "745.158 km"
      expect(text).not.toMatch(/\d+\.\d+/);
    }
  });

  test('Badges de data mostram dias corretos sem erros de epoch', async ({ page }) => {
    // Setup: Logar como produtor
    await page.fill('input[type="email"]', 'producer@test.com');
    await page.fill('input[type="password"]', 'test123');
    await page.click('button:has-text("Entrar")');
    
    await expect(page).toHaveURL('/producer-dashboard', { timeout: 10000 });
    
    // Verificar badges de data
    const dateBadges = await page.locator('text=/\\d+ dia.*para coleta|Coleta hoje|Coleta amanhã/').all();
    
    for (const badge of dateBadges) {
      const text = await badge.textContent();
      
      // NÃO deve conter anos antigos (epoch issue)
      expect(text).not.toContain('1969');
      expect(text).not.toContain('1970');
      
      // Deve ter formato válido
      expect(text).toMatch(/(\d+ dia|Coleta hoje|Coleta amanhã)/);
    }
  });
});
