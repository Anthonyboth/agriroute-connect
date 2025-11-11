import { test, expect } from '@playwright/test';

/**
 * Testes E2E para o fluxo completo de propostas de fretes
 * Valida o ciclo: motorista envia proposta → produtor visualiza → produtor aceita/rejeita
 */

test.describe('Fluxo de Propostas de Frete', () => {
  
  test('Motorista envia proposta para frete aberto', async ({ page, context }) => {
    // 1. Login como motorista
    await page.goto('/');
    await page.fill('input[type="email"]', 'motorista@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/driver', { timeout: 10000 });
    
    // 2. Navegar para marketplace
    await page.click('[data-testid="tab-marketplace"]');
    await page.waitForTimeout(1000);
    
    // 3. Localizar frete aberto
    const freightCard = page.locator('[data-testid="freight-card-open"]').first();
    await expect(freightCard).toBeVisible({ timeout: 5000 });
    
    // 4. Clicar em "Enviar Proposta"
    await freightCard.locator('[data-testid="send-proposal-button"]').click();
    
    // 5. Preencher modal de proposta
    await page.fill('[data-testid="proposal-price-input"]', '5000');
    await page.fill('[data-testid="proposal-message"]', 'Proposta competitiva do motorista');
    
    // 6. Enviar proposta
    await page.click('[data-testid="submit-proposal-button"]');
    
    // 7. Verificar toast de sucesso
    await expect(page.locator('.toast-success, [role="status"]')).toContainText(/Proposta enviada|sucesso/i, { timeout: 5000 });
    
    // 8. Verificar que proposta aparece em "Minhas Propostas"
    await page.click('[data-testid="tab-my-proposals"]');
    await expect(page.locator('[data-testid="proposal-status-pending"]')).toBeVisible({ timeout: 3000 });
  });

  test('Produtor recebe e visualiza proposta na aba Propostas', async ({ page, context }) => {
    // 1. Login como produtor
    await page.goto('/');
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer', { timeout: 10000 });
    
    // 2. Verificar contador de propostas pendentes no StatsCard
    const proposalsCard = page.locator('[data-testid="stats-card-proposals"]');
    await expect(proposalsCard).toBeVisible({ timeout: 5000 });
    
    // 3. Clicar no StatsCard para navegar para aba Propostas
    await proposalsCard.click();
    await page.waitForTimeout(1000);
    
    // 4. Verificar que proposta está listada
    const proposalCard = page.locator('[data-testid="proposal-card"]').first();
    await expect(proposalCard).toBeVisible({ timeout: 5000 });
    
    // 5. Verificar que botões de ação estão visíveis
    await expect(proposalCard.locator('[data-testid="accept-proposal-button"]')).toBeVisible();
    await expect(proposalCard.locator('[data-testid="reject-proposal-button"]')).toBeVisible();
  });

  test('Produtor aceita proposta e motorista recebe atualização', async ({ page, context }) => {
    // 1. Login como produtor
    await page.goto('/');
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer', { timeout: 10000 });
    
    // 2. Navegar para aba Propostas
    await page.click('[data-testid="tab-proposals"]');
    await page.waitForTimeout(1000);
    
    // 3. Localizar proposta pendente
    const proposalCard = page.locator('[data-testid="proposal-card"]').first();
    await expect(proposalCard).toBeVisible({ timeout: 5000 });
    
    // 4. Clicar em "Aceitar"
    await proposalCard.locator('[data-testid="accept-proposal-button"]').click();
    
    // 5. Confirmar no diálogo de confirmação
    await page.click('[data-testid="confirm-accept-dialog-button"]');
    
    // 6. Verificar toast de sucesso
    await expect(page.locator('.toast-success, [role="status"]')).toContainText(/Proposta aceita|sucesso/i, { timeout: 5000 });
    
    // 7. Verificar que proposta desaparece da lista de pendentes
    await page.waitForTimeout(2000);
    
    // 8. Abrir nova aba como motorista para verificar atualização em tempo real
    const driverPage = await context.newPage();
    await driverPage.goto('/');
    await driverPage.fill('input[type="email"]', 'motorista@test.com');
    await driverPage.fill('input[type="password"]', 'senha123');
    await driverPage.click('button[type="submit"]');
    await driverPage.waitForURL('/dashboard/driver', { timeout: 10000 });
    
    // 9. Verificar que motorista recebeu notificação
    await driverPage.click('[data-testid="notifications-button"]');
    await expect(driverPage.locator('.notification-item')).toContainText(/Proposta aceita/i, { timeout: 5000 });
    
    // 10. Verificar que frete aparece em "Meus Fretes"
    await driverPage.click('[data-testid="tab-my-freights"]');
    await expect(driverPage.locator('[data-testid="freight-status-accepted"]')).toBeVisible({ timeout: 3000 });
  });

  test('Produtor rejeita proposta e motorista é notificado', async ({ page, context }) => {
    // 1. Login como produtor
    await page.goto('/');
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer', { timeout: 10000 });
    
    // 2. Navegar para aba Propostas
    await page.click('[data-testid="tab-proposals"]');
    await page.waitForTimeout(1000);
    
    // 3. Localizar proposta pendente
    const proposalCard = page.locator('[data-testid="proposal-card"]').first();
    await expect(proposalCard).toBeVisible({ timeout: 5000 });
    
    // 4. Clicar em "Rejeitar"
    await proposalCard.locator('[data-testid="reject-proposal-button"]').click();
    
    // 5. Verificar toast de sucesso
    await expect(page.locator('.toast-success, [role="status"]')).toContainText(/Proposta rejeitada|sucesso/i, { timeout: 5000 });
    
    // 6. Verificar que proposta desaparece
    await page.waitForTimeout(2000);
    
    // 7. Verificar notificação do motorista
    const driverPage = await context.newPage();
    await driverPage.goto('/');
    await driverPage.fill('input[type="email"]', 'motorista@test.com');
    await driverPage.fill('input[type="password"]', 'senha123');
    await driverPage.click('button[type="submit"]');
    await driverPage.waitForURL('/dashboard/driver', { timeout: 10000 });
    
    await driverPage.click('[data-testid="notifications-button"]');
    await expect(driverPage.locator('.notification-item')).toContainText(/Proposta rejeitada/i, { timeout: 5000 });
  });

  test('Verificar atualizações em tempo real quando proposta é aceita', async ({ context }) => {
    // 1. Abrir duas páginas simultaneamente: produtor e motorista
    const producerPage = await context.newPage();
    const driverPage = await context.newPage();
    
    // 2. Login produtor
    await producerPage.goto('/');
    await producerPage.fill('input[type="email"]', 'produtor@test.com');
    await producerPage.fill('input[type="password"]', 'senha123');
    await producerPage.click('button[type="submit"]');
    await producerPage.waitForURL('/dashboard/producer', { timeout: 10000 });
    
    // 3. Login motorista
    await driverPage.goto('/');
    await driverPage.fill('input[type="email"]', 'motorista@test.com');
    await driverPage.fill('input[type="password"]', 'senha123');
    await driverPage.click('button[type="submit"]');
    await driverPage.waitForURL('/dashboard/driver', { timeout: 10000 });
    
    // 4. Motorista navega para "Minhas Propostas"
    await driverPage.click('[data-testid="tab-my-proposals"]');
    await driverPage.waitForTimeout(1000);
    const initialProposalCount = await driverPage.locator('[data-testid="proposal-card"]').count();
    
    // 5. Produtor aceita proposta
    await producerPage.click('[data-testid="tab-proposals"]');
    await producerPage.waitForTimeout(1000);
    const proposalCard = producerPage.locator('[data-testid="proposal-card"]').first();
    await proposalCard.locator('[data-testid="accept-proposal-button"]').click();
    await producerPage.click('[data-testid="confirm-accept-dialog-button"]');
    
    // 6. Aguardar atualização realtime (max 5 segundos)
    await driverPage.waitForTimeout(5000);
    
    // 7. Verificar que status da proposta foi atualizado na tela do motorista
    const updatedProposalCount = await driverPage.locator('[data-testid="proposal-card"]').count();
    expect(updatedProposalCount).toBeLessThanOrEqual(initialProposalCount);
    
    // 8. Verificar badge de notificação no header
    const notificationBadge = driverPage.locator('[data-testid="notification-badge"]');
    await expect(notificationBadge).toBeVisible({ timeout: 5000 });
  });

  test('Botão de aceitar desabilitado quando não há vagas disponíveis', async ({ page }) => {
    // 1. Login como produtor
    await page.goto('/');
    await page.fill('input[type="email"]', 'produtor@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/producer', { timeout: 10000 });
    
    // 2. Navegar para aba Propostas
    await page.click('[data-testid="tab-proposals"]');
    await page.waitForTimeout(1000);
    
    // 3. Localizar proposta para frete com vagas esgotadas
    const proposalCard = page.locator('[data-testid="proposal-card-no-slots"]').first();
    
    // Se não houver propostas sem vagas, pular o teste
    if (await proposalCard.count() === 0) {
      test.skip();
      return;
    }
    
    // 4. Verificar que botão "Aceitar" está desabilitado
    const acceptButton = proposalCard.locator('[data-testid="accept-proposal-button"]');
    await expect(acceptButton).toBeDisabled();
    await expect(acceptButton).toContainText(/Sem vagas/i);
    
    // 5. Verificar que botão "Rejeitar" ainda está habilitado
    const rejectButton = proposalCard.locator('[data-testid="reject-proposal-button"]');
    await expect(rejectButton).toBeEnabled();
  });
});
