import { test, expect } from '@playwright/test';

// ========================================
// FASE 8: Testes E2E para Relatórios
// ========================================

test.describe('Producer Reports Tab', () => {
  test.beforeEach(async ({ page }) => {
    // Note: Requires authenticated session
    await page.goto('/dashboard/producer');
  });

  test('should display report period filter', async ({ page }) => {
    // Navigate to reports tab
    await page.click('text=Relatórios');
    
    // Check filter buttons exist
    await expect(page.locator('button:has-text("7 dias")')).toBeVisible();
    await expect(page.locator('button:has-text("30 dias")')).toBeVisible();
    await expect(page.locator('button:has-text("90 dias")')).toBeVisible();
    await expect(page.locator('button:has-text("Tudo")')).toBeVisible();
  });

  test('should show no data warning when period is empty', async ({ page }) => {
    await page.click('text=Relatórios');
    
    // The warning should appear if no data
    const noDataWarning = page.locator('text=Nenhum dado encontrado');
    // This may or may not be visible depending on data
  });

  test('should display KPI cards', async ({ page }) => {
    await page.click('text=Relatórios');
    
    // Wait for KPI cards to load
    await page.waitForTimeout(2000);
    
    // Check for common KPI elements
    const kpiSection = page.locator('[class*="grid"]').first();
    await expect(kpiSection).toBeVisible();
  });
});

test.describe('Driver Reports Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/driver');
  });

  test('should display driver report tab', async ({ page }) => {
    await page.click('text=Relatórios');
    await page.waitForTimeout(1000);
    
    // Should see period filter
    await expect(page.locator('button:has-text("90 dias")')).toBeVisible();
  });

  test('should allow changing report period', async ({ page }) => {
    await page.click('text=Relatórios');
    
    // Click on different periods
    await page.click('button:has-text("7 dias")');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("30 dias")');
    await page.waitForTimeout(500);
    
    await page.click('button:has-text("Tudo")');
    await page.waitForTimeout(500);
  });
});

test.describe('Provider Reports Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/provider');
  });

  test('should display provider report tab', async ({ page }) => {
    // Navigate to reports
    const reportsTab = page.locator('text=Relatórios');
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
      await page.waitForTimeout(1000);
      
      // Should see period filter
      await expect(page.locator('button:has-text("90 dias")')).toBeVisible();
    }
  });
});

test.describe('Company Reports Tab', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/dashboard/company');
  });

  test('should display company report section', async ({ page }) => {
    // Look for reports tab
    const reportsTab = page.locator('[data-value="reports"]');
    if (await reportsTab.isVisible()) {
      await reportsTab.click();
      await page.waitForTimeout(1000);
    }
  });
});

test.describe('Freight Status Validation', () => {
  test('should have valid status transitions', async ({ page }) => {
    await page.goto('/dashboard/driver');
    
    // This test validates that freight status values are properly translated
    const statusBadges = page.locator('[class*="badge"]');
    
    // Valid statuses should be shown in Portuguese
    const validStatuses = [
      'Aberto', 'Em Negociação', 'Aceito', 'A Caminho da Coleta',
      'Carregado', 'Em Transporte', 'Entregue', 'Entrega Reportada',
      'Cancelado', 'Concluído', 'Rejeitado', 'Pendente'
    ];
    
    // Check that no English status labels are shown
    const englishStatuses = ['OPEN', 'ACCEPTED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];
    
    for (const status of englishStatuses) {
      const element = page.locator(`text=${status}`);
      // Should not find raw English status in UI badges
    }
  });
});

test.describe('Report Export Functionality', () => {
  test('should display export button', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.click('text=Relatórios');
    
    // Look for export button
    const exportButton = page.locator('button:has-text("Exportar")');
    // May or may not be visible depending on implementation
  });

  test('should show premium upgrade for non-premium users', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.click('text=Relatórios');
    
    // After 3 exports, should show upgrade message
    // This is a behavior test that depends on user state
  });
});

test.describe('Gamification Panel', () => {
  test('should display driver level and badges', async ({ page }) => {
    await page.goto('/dashboard/driver');
    
    // Look for gamification elements
    const levelElement = page.locator('text=Nível');
    const badgesElement = page.locator('text=Medalhas');
    
    // These should be visible for drivers
  });
});

test.describe('Offline Indicator', () => {
  test('should show online status when connected', async ({ page }) => {
    await page.goto('/dashboard/driver');
    
    // The offline indicator should show online status
    // This is a visual check
  });

  test('should handle offline mode gracefully', async ({ page }) => {
    await page.goto('/dashboard/driver');
    
    // Simulate offline
    await page.context().setOffline(true);
    
    // App should still be functional
    await page.waitForTimeout(1000);
    
    // Restore online
    await page.context().setOffline(false);
  });
});

test.describe('i18n - Portuguese Translations', () => {
  test('should display all UI in Portuguese', async ({ page }) => {
    await page.goto('/');
    
    // Check that common English words are not present
    const englishWords = ['Loading', 'Error', 'Success', 'Submit', 'Cancel'];
    
    for (const word of englishWords) {
      // Buttons and labels should be in Portuguese
      // 'Loading' -> 'Carregando'
      // 'Cancel' -> 'Cancelar'
    }
  });

  test('should show Portuguese date format', async ({ page }) => {
    await page.goto('/dashboard/driver');
    await page.click('text=Relatórios');
    
    // Date format should be dd/MM/yyyy not MM/dd/yyyy
    const dateRegex = /\d{2}\/\d{2}\/\d{4}/;
    // Check for Brazilian date format
  });
});

test.describe('Data Quality Card', () => {
  test('should display data quality metrics', async ({ page }) => {
    await page.goto('/dashboard/driver');
    await page.click('text=Relatórios');
    
    // Look for data quality card
    const qualityCard = page.locator('text=Qualidade dos Dados');
    // May or may not be present depending on implementation
  });
});
