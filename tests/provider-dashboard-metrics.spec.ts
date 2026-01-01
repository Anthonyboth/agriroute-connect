import { test, expect } from '@playwright/test';

test.describe('Provider Dashboard Metrics', () => {
  test.skip('Should display 4 separate stats cards', async ({ page }) => {
    // This test requires authentication as a service provider
    // Skipping for now as it needs proper auth setup
    
    await page.goto('/dashboard/prestador');
    
    // Wait for dashboard to load
    await page.waitForLoadState('networkidle');
    
    // Check that there are 4 distinct stats cards
    const statsCards = page.locator('[class*="grid"] > div').filter({
      has: page.locator('[class*="CardContent"]')
    });
    
    const cardCount = await statsCards.count();
    expect(cardCount).toBe(4);
  });

  test.skip('Stats cards should not have concatenated values', async ({ page }) => {
    // This test requires authentication as a service provider
    // Skipping for now as it needs proper auth setup
    
    await page.goto('/dashboard/prestador');
    await page.waitForLoadState('networkidle');
    
    // Check that no stats card contains values like "6-0" or similar concatenation
    const statsValues = page.locator('[class*="StatsCard"] p[class*="font-bold"], [class*="stats"] p[class*="font-bold"]');
    
    const values = await statsValues.allTextContents();
    for (const value of values) {
      // Values should be either numbers or currency formatted
      const isCurrency = value.includes('R$') || value.includes('****');
      const isNumber = /^\d+$/.test(value.trim());
      
      expect(isCurrency || isNumber).toBe(true);
    }
  });

  test.skip('Saldo should be formatted with 2 decimal places', async ({ page }) => {
    // This test requires authentication as a service provider
    // Skipping for now as it needs proper auth setup
    
    await page.goto('/dashboard/prestador');
    await page.waitForLoadState('networkidle');
    
    // Find the Saldo stats card
    const saldoCard = page.locator('text=Saldo').locator('..');
    if (await saldoCard.isVisible()) {
      const valueElement = saldoCard.locator('p[class*="font-bold"]');
      const value = await valueElement.textContent();
      
      // Should be either masked (****) or properly formatted currency
      if (value && !value.includes('****')) {
        expect(value).toMatch(/R\$\s*[\d.,]+/);
        // Should have 2 decimal places
        expect(value).toMatch(/,\d{2}$/);
      }
    }
  });
});

test.describe('Provider Dashboard Layout', () => {
  test.skip('Grid should have proper gap between cards', async ({ page }) => {
    // This test requires authentication as a service provider
    // Skipping for now as it needs proper auth setup
    
    await page.goto('/dashboard/prestador');
    await page.waitForLoadState('networkidle');
    
    // Find the stats grid
    const grid = page.locator('[class*="grid-cols-2"][class*="md:grid-cols-4"]').first();
    
    if (await grid.isVisible()) {
      const gridStyle = await grid.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          gap: computed.gap,
          display: computed.display,
          gridTemplateColumns: computed.gridTemplateColumns
        };
      });
      
      // Should have gap defined
      expect(gridStyle.gap).not.toBe('0px');
      expect(gridStyle.display).toBe('grid');
    }
  });
});
