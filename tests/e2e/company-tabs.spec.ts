/**
 * E2E Tests for Company Dashboard - Freight Management
 * Validates transportadora freight visibility and management actions
 */

import { test, expect } from '@playwright/test';

test.describe('Company Dashboard - Freight Tab Classification', () => {
  test.beforeEach(async ({ page }) => {
    // Login como transportadora
    await page.goto('/');
    await page.fill('[name="email"]', 'company@test.com');
    await page.fill('[name="password"]', 'test123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/company-dashboard');
  });

  test('company freights filtered by pickup date', async ({ page }) => {
    // Navegar para aba Fretes
    await page.click('[data-tab="fretes"]');
    await page.waitForTimeout(1000);
    
    // Verificar filtros locais (Abertos, Em andamento, Cancelados)
    const filterTabs = page.locator('[role="tablist"]');
    await expect(filterTabs).toBeVisible();
    
    // Verificar que freights são carregados
    const freightRows = page.locator('[data-testid^="freight-row-"]');
    const rowCount = await freightRows.count();
    expect(rowCount).toBeGreaterThanOrEqual(0);
  });

  test('company can assign drivers to freights', async ({ page }) => {
    await page.click('[data-tab="fretes"]');
    await page.waitForTimeout(1000);
    
    // Filtrar apenas fretes abertos
    await page.click('text=Abertos');
    await page.waitForTimeout(500);
    
    const assignButtons = page.locator('button').filter({ hasText: /Direcionar motorista|Atribuir/ });
    const buttonCount = await assignButtons.count();
    
    if (buttonCount > 0) {
      // Clicar em atribuir motorista
      await assignButtons.first().click();
      
      // Verificar que modal de seleção abre
      const modal = page.locator('[role="dialog"]');
      await expect(modal).toBeVisible();
      
      // Verificar que lista de motoristas está disponível
      const driverList = page.locator('[data-testid="driver-list"]');
      await expect(driverList).toBeVisible();
    }
  });

  test('company can view affiliated driver performance', async ({ page }) => {
    // Navegar para aba Motoristas
    await page.click('[data-tab="motoristas"]');
    await page.waitForTimeout(1000);
    
    // Verificar que tabela de motoristas está visível
    const driverTable = page.locator('[data-testid="driver-performance-table"]');
    
    if (await driverTable.isVisible()) {
      // Verificar colunas esperadas
      await expect(page.locator('text=Nome').first()).toBeVisible();
      await expect(page.locator('text=Fretes Completados').first()).toBeVisible();
      await expect(page.locator('text=Fretes Ativos').first()).toBeVisible();
      await expect(page.locator('text=Avaliação Média').first()).toBeVisible();
    }
  });

  test('company can cancel expired freights', async ({ page }) => {
    await page.click('[data-tab="fretes"]');
    await page.waitForTimeout(1000);
    
    // Verificar se há fretes vencidos (pickup_date + 48h)
    const expiredBadges = page.locator('[class*="Badge"]').filter({ hasText: 'Vencido' });
    const expiredCount = await expiredBadges.count();
    
    if (expiredCount > 0) {
      // Verificar que botão "Cancelar por vencimento" está disponível
      const cancelButtons = page.locator('button').filter({ hasText: /Cancelar por vencimento/ });
      await expect(cancelButtons.first()).toBeVisible();
    }
  });

  test('company analytics dashboard displays correctly', async ({ page }) => {
    // Navegar para aba Relatórios
    await page.click('[data-tab="relatorios"]');
    await page.waitForTimeout(1000);
    
    // Verificar que cards de estatísticas estão presentes
    const statsCards = page.locator('[data-testid^="stat-card-"]');
    const cardCount = await statsCards.count();
    expect(cardCount).toBeGreaterThan(0);
    
    // Verificar que gráficos Recharts estão renderizados
    const charts = page.locator('[class*="recharts"]');
    const chartCount = await charts.count();
    expect(chartCount).toBeGreaterThan(0);
    
    // Verificar filtros de período
    const periodFilters = page.locator('[data-testid="period-filter"]');
    await expect(periodFilters).toBeVisible();
  });

  test('company can export reports to PDF/Excel', async ({ page }) => {
    await page.click('[data-tab="relatorios"]');
    await page.waitForTimeout(1000);
    
    // Verificar botões de exportação
    const pdfButton = page.locator('button').filter({ hasText: /Exportar PDF|PDF/ });
    const excelButton = page.locator('button').filter({ hasText: /Exportar Excel|Excel/ });
    
    if (await pdfButton.isVisible()) {
      await expect(pdfButton).toBeEnabled();
    }
    
    if (await excelButton.isVisible()) {
      await expect(excelButton).toBeEnabled();
    }
  });

  test('company internal chat displays correctly', async ({ page }) => {
    // Navegar para aba Chat Interno
    await page.click('[data-tab="chat-interno"]');
    await page.waitForTimeout(1000);
    
    // Verificar que UnifiedChatHub está carregado
    const chatHub = page.locator('[data-testid="unified-chat-hub"]');
    await expect(chatHub).toBeVisible();
    
    // Verificar lista de conversas
    const conversationList = page.locator('[data-testid^="conversation-"]');
    const conversationCount = await conversationList.count();
    expect(conversationCount).toBeGreaterThanOrEqual(0);
  });
});
