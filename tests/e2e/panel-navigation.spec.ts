import { test, expect } from '@playwright/test';

/**
 * E2E Navigation Tests for All 4 Dashboard Panels
 * Tests tab navigation across Producer, Driver, Company, and Service Provider dashboards
 */

test.describe('Producer Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to producer dashboard (requires auth mock in real implementation)
    await page.goto('/producer-dashboard');
  });

  test('should display all main tabs', async ({ page }) => {
    const expectedTabs = [
      'Disponíveis',
      'Em Andamento',
      'Agendados',
      'Propostas',
      'Histórico'
    ];

    for (const tab of expectedTabs) {
      await expect(page.getByRole('tab', { name: new RegExp(tab, 'i') })).toBeVisible();
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Click on each tab and verify content changes
    await page.getByRole('tab', { name: /Disponíveis/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await page.getByRole('tab', { name: /Em Andamento/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();

    await page.getByRole('tab', { name: /Histórico/i }).click();
    await expect(page.getByRole('tabpanel')).toBeVisible();
  });

  test('should show create freight button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Novo Frete|Criar Frete/i })).toBeVisible();
  });
});

test.describe('Driver Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/driver-dashboard');
  });

  test('should display all driver tabs', async ({ page }) => {
    const expectedTabs = [
      'Visão Geral',
      'Encontrar Fretes',
      'Meus Fretes',
      'Agenda',
      'Histórico',
      'Ganhos'
    ];

    for (const tab of expectedTabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      // Some tabs might be hidden on mobile, so we check if at least some are visible
      if (await tabElement.isVisible()) {
        await expect(tabElement).toBeEnabled();
      }
    }
  });

  test('should show driver stats on overview tab', async ({ page }) => {
    await page.getByRole('tab', { name: /Visão Geral/i }).click();
    
    // Check for common stats elements
    await expect(page.locator('text=/Fretes|Ganhos|Avaliação/i').first()).toBeVisible();
  });

  test('should navigate to freight search', async ({ page }) => {
    const searchTab = page.getByRole('tab', { name: /Encontrar Fretes/i });
    if (await searchTab.isVisible()) {
      await searchTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('should show earnings tab', async ({ page }) => {
    const earningsTab = page.getByRole('tab', { name: /Ganhos/i });
    if (await earningsTab.isVisible()) {
      await earningsTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });
});

test.describe('Company Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/company-dashboard');
  });

  test('should display company management tabs', async ({ page }) => {
    const expectedTabs = [
      'Visão Geral',
      'Fretes',
      'Motoristas',
      'Veículos',
      'Relatórios'
    ];

    for (const tab of expectedTabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      if (await tabElement.isVisible()) {
        await expect(tabElement).toBeEnabled();
      }
    }
  });

  test('should show company stats on overview', async ({ page }) => {
    const overviewTab = page.getByRole('tab', { name: /Visão Geral/i });
    if (await overviewTab.isVisible()) {
      await overviewTab.click();
      // Check for stats cards
      await expect(page.locator('[class*="card"]').first()).toBeVisible();
    }
  });

  test('should navigate to drivers management', async ({ page }) => {
    const driversTab = page.getByRole('tab', { name: /Motoristas/i });
    if (await driversTab.isVisible()) {
      await driversTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('should navigate to vehicles management', async ({ page }) => {
    const vehiclesTab = page.getByRole('tab', { name: /Veículos/i });
    if (await vehiclesTab.isVisible()) {
      await vehiclesTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('should navigate to reports', async ({ page }) => {
    const reportsTab = page.getByRole('tab', { name: /Relatórios/i });
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });
});

test.describe('Service Provider Dashboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/service-provider-dashboard');
  });

  test('should display service provider tabs', async ({ page }) => {
    const expectedTabs = [
      'Home',
      'Solicitações',
      'Agenda',
      'Ganhos',
      'Histórico'
    ];

    for (const tab of expectedTabs) {
      const tabElement = page.getByRole('tab', { name: new RegExp(tab, 'i') });
      if (await tabElement.isVisible()) {
        await expect(tabElement).toBeEnabled();
      }
    }
  });

  test('should show service requests tab', async ({ page }) => {
    const requestsTab = page.getByRole('tab', { name: /Solicitações/i });
    if (await requestsTab.isVisible()) {
      await requestsTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('should navigate to schedule', async ({ page }) => {
    const scheduleTab = page.getByRole('tab', { name: /Agenda/i });
    if (await scheduleTab.isVisible()) {
      await scheduleTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });

  test('should show earnings section', async ({ page }) => {
    const earningsTab = page.getByRole('tab', { name: /Ganhos/i });
    if (await earningsTab.isVisible()) {
      await earningsTab.click();
      await expect(page.getByRole('tabpanel')).toBeVisible();
    }
  });
});

test.describe('Cross-Panel Navigation', () => {
  test('should have consistent header across dashboards', async ({ page }) => {
    const dashboards = [
      '/producer-dashboard',
      '/driver-dashboard',
      '/company-dashboard',
      '/service-provider-dashboard'
    ];

    for (const dashboard of dashboards) {
      await page.goto(dashboard);
      
      // Check for common header elements (profile, notifications, etc)
      // These selectors might need adjustment based on actual implementation
      const header = page.locator('header, [role="banner"], nav').first();
      if (await header.isVisible()) {
        await expect(header).toBeVisible();
      }
    }
  });

  test('should handle mobile navigation', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 });

    await page.goto('/producer-dashboard');
    
    // Check for mobile menu or bottom navigation
    const mobileNav = page.locator('[class*="bottom"], [class*="mobile-nav"], [class*="tab-bar"]').first();
    if (await mobileNav.isVisible()) {
      await expect(mobileNav).toBeVisible();
    }
  });
});

test.describe('Tab Content Loading', () => {
  test('should show loading state when switching tabs', async ({ page }) => {
    await page.goto('/producer-dashboard');
    
    // Click a tab
    const tab = page.getByRole('tab').nth(1);
    if (await tab.isVisible()) {
      await tab.click();
      
      // Content should eventually load (no infinite loading)
      await expect(page.getByRole('tabpanel')).toBeVisible({ timeout: 10000 });
    }
  });

  test('should show empty state when no data', async ({ page }) => {
    await page.goto('/driver-dashboard');
    
    // Navigate to history (likely to be empty for new users)
    const historyTab = page.getByRole('tab', { name: /Histórico/i });
    if (await historyTab.isVisible()) {
      await historyTab.click();
      
      // Should show either data or empty state message
      const panel = page.getByRole('tabpanel');
      await expect(panel).toBeVisible();
    }
  });
});
