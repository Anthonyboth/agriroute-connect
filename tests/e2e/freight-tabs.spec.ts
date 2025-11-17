/**
 * E2E Tests for Freight Tab Classification
 * Validates that freights with future pickup_date appear only in "Agendados"
 * and freights with today/past pickup_date appear in "Em Andamento"
 */

import { test, expect } from '@playwright/test';

test.describe('Producer Dashboard - Freight Tab Classification', () => {
  test.beforeEach(async ({ page }) => {
    // Login como produtor
    await page.goto('/');
    await page.fill('[name="email"]', 'producer@test.com');
    await page.fill('[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/producer-dashboard');
  });

  test('freight with future pickup_date appears only in Agendados tab', async ({ page }) => {
    // Criar frete com data futura (5 dias no futuro)
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 5);
    const futureDateStr = futureDate.toISOString().split('T')[0];
    
    await page.click('text=Criar Frete');
    await page.waitForSelector('[data-testid="freight-form"]');
    
    // Preencher formulário com pickup_date futura
    await page.fill('[name="cargo_type"]', 'SOJA');
    await page.fill('[name="weight"]', '30');
    await page.fill('[name="origin_city"]', 'Goiânia');
    await page.fill('[name="destination_city"]', 'São Paulo');
    await page.fill('[name="pickup_date"]', futureDateStr);
    await page.fill('[name="price"]', '5000');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000); // Aguardar criação
    
    // Verificar que aparece em Agendados
    await page.click('[data-tab="agendados"]');
    await expect(page.locator('[data-testid^="freight-card-"]').first()).toBeVisible();
    
    // Verificar que NÃO aparece em Em Andamento
    await page.click('[data-tab="em-andamento"]');
    const emAndamentoCards = await page.locator('[data-testid^="freight-card-"]').count();
    expect(emAndamentoCards).toBe(0);
  });

  test('freight with today pickup_date appears in Em Andamento', async ({ page }) => {
    // Criar frete com data de hoje
    const today = new Date().toISOString().split('T')[0];
    
    await page.click('text=Criar Frete');
    await page.waitForSelector('[data-testid="freight-form"]');
    
    // Preencher com pickup_date = hoje
    await page.fill('[name="cargo_type"]', 'MILHO');
    await page.fill('[name="weight"]', '25');
    await page.fill('[name="origin_city"]', 'Brasília');
    await page.fill('[name="destination_city"]', 'Rio de Janeiro');
    await page.fill('[name="pickup_date"]', today);
    await page.fill('[name="price"]', '3500');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Verificar que aparece em Em Andamento
    await page.click('[data-tab="em-andamento"]');
    await expect(page.locator('[data-testid^="freight-card-"]').first()).toBeVisible();
    
    // Verificar que NÃO aparece em Agendados
    await page.click('[data-tab="agendados"]');
    const agendadosCards = await page.locator('[data-testid^="freight-card-"]').count();
    expect(agendadosCards).toBe(0);
  });

  test('freight with past pickup_date appears in Em Andamento', async ({ page }) => {
    // Criar frete com data passada (2 dias atrás)
    const pastDate = new Date();
    pastDate.setDate(pastDate.getDate() - 2);
    const pastDateStr = pastDate.toISOString().split('T')[0];
    
    await page.click('text=Criar Frete');
    await page.waitForSelector('[data-testid="freight-form"]');
    
    // Preencher com pickup_date passada
    await page.fill('[name="cargo_type"]', 'ALGODAO');
    await page.fill('[name="weight"]', '20');
    await page.fill('[name="origin_city"]', 'Cuiabá');
    await page.fill('[name="destination_city"]', 'Porto Alegre');
    await page.fill('[name="pickup_date"]', pastDateStr);
    await page.fill('[name="price"]', '4200');
    
    await page.click('button[type="submit"]');
    await page.waitForTimeout(2000);
    
    // Verificar que aparece em Em Andamento (não vencidos)
    await page.click('[data-tab="em-andamento"]');
    await expect(page.locator('[data-testid^="freight-card-"]').first()).toBeVisible();
    
    // Badge deve mostrar "X dias atrasado"
    await expect(page.locator('text=atrasado').first()).toBeVisible();
  });

  test('freight date badges display correctly', async ({ page }) => {
    await page.click('[data-tab="agendados"]');
    
    // Verificar que badges de data estão visíveis
    const dateBadges = page.locator('[class*="Badge"]').filter({ hasText: /dias|Coleta|amanhã|hoje/ });
    const badgeCount = await dateBadges.count();
    
    expect(badgeCount).toBeGreaterThan(0);
    
    // Verificar formato correto dos badges
    const badgeTexts = await dateBadges.allTextContents();
    for (const text of badgeTexts) {
      expect(text).toMatch(/(Coleta hoje|Coleta amanhã|\d+ dias para coleta|\d+ dia\(s\) atrasado)/);
    }
  });
});
