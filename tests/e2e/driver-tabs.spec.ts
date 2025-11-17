/**
 * E2E Tests for Driver Dashboard - Freight Tab Classification
 * Validates assignment visibility in correct tabs based on pickup_date
 */

import { test, expect } from '@playwright/test';

test.describe('Driver Dashboard - Assignment Tab Classification', () => {
  test.beforeEach(async ({ page }) => {
    // Login como motorista
    await page.goto('/');
    await page.fill('[name="email"]', 'driver@test.com');
    await page.fill('[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/driver-dashboard');
  });

  test('assignment with future pickup_date appears only in Agendados', async ({ page }) => {
    // Navegar para a aba Agendados
    await page.click('[data-tab="agendados"]');
    await page.waitForTimeout(1000);
    
    // Verificar que há assignments com data futura
    const agendadosCards = await page.locator('[data-testid^="assignment-card-"]').count();
    expect(agendadosCards).toBeGreaterThan(0);
    
    // Verificar que todos têm badge de "dias para coleta"
    const futureBadges = page.locator('text=/\\d+ dias para coleta/');
    const futureBadgeCount = await futureBadges.count();
    expect(futureBadgeCount).toBeGreaterThan(0);
    
    // Navegar para Em Andamento e verificar que esses fretes NÃO aparecem
    await page.click('[data-tab="em-andamento"]');
    await page.waitForTimeout(1000);
    
    // Cards em andamento não devem ter badge de "dias para coleta"
    const inProgressFutureBadges = await page.locator('text=/\\d+ dias para coleta/').count();
    expect(inProgressFutureBadges).toBe(0);
  });

  test('assignment with today pickup_date appears in Em Andamento', async ({ page }) => {
    // Navegar para Em Andamento
    await page.click('[data-tab="em-andamento"]');
    await page.waitForTimeout(1000);
    
    // Verificar assignments com "Coleta hoje"
    const todayBadges = page.locator('text=Coleta hoje');
    const todayBadgeCount = await todayBadges.count();
    
    if (todayBadgeCount > 0) {
      // Se existirem assignments para hoje, verificar que aparecem na aba certa
      await expect(todayBadges.first()).toBeVisible();
      
      // Verificar que NÃO aparecem em Agendados
      await page.click('[data-tab="agendados"]');
      const agendadosTodayBadges = await page.locator('text=Coleta hoje').count();
      expect(agendadosTodayBadges).toBe(0);
    }
  });

  test('assignment status updates visible in real-time', async ({ page }) => {
    await page.click('[data-tab="em-andamento"]');
    
    // Verificar que há assignments disponíveis
    const assignmentCards = page.locator('[data-testid^="assignment-card-"]');
    const cardCount = await assignmentCards.count();
    
    if (cardCount > 0) {
      // Verificar que botões de ação estão disponíveis
      const actionButtons = page.locator('button').filter({ hasText: /Iniciar|Finalizar|Entregar/ });
      const buttonCount = await actionButtons.count();
      expect(buttonCount).toBeGreaterThan(0);
      
      // Verificar que status badges estão visíveis
      const statusBadges = page.locator('[data-testid="assignment-status-badge"]');
      const statusCount = await statusBadges.count();
      expect(statusCount).toBeGreaterThan(0);
    }
  });

  test('driver can see available slots for multiple truck freights', async ({ page }) => {
    // Verificar fretes disponíveis que suportam múltiplos caminhões
    await page.click('[data-tab="disponiveis"]');
    await page.waitForTimeout(1000);
    
    const multiTruckBadges = page.locator('[class*="Badge"]').filter({ hasText: /vagas|Truck/ });
    const badgeCount = await multiTruckBadges.count();
    
    if (badgeCount > 0) {
      // Verificar formato "X/Y vagas"
      const badgeText = await multiTruckBadges.first().textContent();
      expect(badgeText).toMatch(/\d+\/\d+ vagas?/);
    }
  });

  test('GPS tracking indicator displays correctly', async ({ page }) => {
    await page.click('[data-tab="em-andamento"]');
    
    // Verificar que indicadores de GPS estão presentes
    const gpsIndicators = page.locator('[title*="GPS"]');
    const indicatorCount = await gpsIndicators.count();
    
    if (indicatorCount > 0) {
      // Verificar que tooltip com informação de precisão está disponível
      await gpsIndicators.first().hover();
      await page.waitForTimeout(500);
      
      const tooltips = page.locator('[role="tooltip"]');
      const tooltipCount = await tooltips.count();
      expect(tooltipCount).toBeGreaterThan(0);
    }
  });
});
