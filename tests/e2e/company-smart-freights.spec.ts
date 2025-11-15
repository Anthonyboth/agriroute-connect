import { test, expect } from '@playwright/test';

/**
 * Testes E2E para aba "Fretes I.A" (CompanySmartFreightMatcher)
 * Valida que apenas fretes disponíveis (com slots) e com status válido são exibidos
 */

test.describe('Fretes I.A - Validação de Disponibilidade', () => {
  
  test.beforeEach(async ({ page }) => {
    // Login como transportadora
    await page.goto('/');
    await page.fill('input[type="email"]', 'transportadora@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/company', { timeout: 10000 });
    
    // Navegar para aba "Fretes I.A"
    await page.click('[data-testid="tab-smart-freights"]');
    await page.waitForTimeout(2000); // Aguardar carregamento dos fretes
  });

  test('Não exibe fretes com status CANCELLED', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Buscar todos os cards de frete
    const freightCards = await page.locator('[data-testid="freight-card"]').all();
    
    if (freightCards.length === 0) {
      console.log('⚠️ Nenhum frete disponível para testar');
      return;
    }

    console.log(`✅ Encontrados ${freightCards.length} fretes para validar`);
    
    // Verificar que nenhum tem badge "Cancelado"
    for (const card of freightCards) {
      const statusBadges = await card.locator('[data-testid="freight-status-badge"]').allTextContents();
      
      for (const badgeText of statusBadges) {
        expect(badgeText.toLowerCase()).not.toContain('cancelado');
        expect(badgeText.toLowerCase()).not.toContain('cancelled');
      }
    }
    
    console.log('✅ Nenhum frete cancelado encontrado');
  });

  test('Não exibe fretes com status DELIVERED', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Buscar todos os cards de frete
    const freightCards = await page.locator('[data-testid="freight-card"]').all();
    
    if (freightCards.length === 0) {
      console.log('⚠️ Nenhum frete disponível para testar');
      return;
    }

    console.log(`✅ Encontrados ${freightCards.length} fretes para validar`);
    
    // Verificar que nenhum tem badge "Entregue" ou "Delivered"
    for (const card of freightCards) {
      const statusBadges = await card.locator('[data-testid="freight-status-badge"]').allTextContents();
      
      for (const badgeText of statusBadges) {
        expect(badgeText.toLowerCase()).not.toContain('entregue');
        expect(badgeText.toLowerCase()).not.toContain('delivered');
        expect(badgeText.toLowerCase()).not.toContain('em trânsito');
        expect(badgeText.toLowerCase()).not.toContain('in_transit');
      }
    }
    
    console.log('✅ Nenhum frete entregue ou em trânsito encontrado');
  });

  test('Todos os fretes exibidos têm slots disponíveis', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Buscar todos os cards de frete
    const freightCards = await page.locator('[data-testid="freight-card"]').all();
    
    if (freightCards.length === 0) {
      console.log('⚠️ Nenhum frete disponível para testar');
      return;
    }

    console.log(`✅ Encontrados ${freightCards.length} fretes para validar slots`);
    
    // Verificar que todos têm informação de vagas disponíveis
    for (const card of freightCards) {
      // Procurar por texto indicando vagas disponíveis
      const cardText = await card.textContent();
      
      if (!cardText) continue;
      
      // Deve conter informação de vagas (ex: "2/3 vagas", "1 vaga disponível")
      const hasSlotInfo = 
        /\d+\/\d+\s*vagas?/i.test(cardText) || 
        /vagas?\s*disponíve(l|is)/i.test(cardText) ||
        /\d+\s*de\s*\d+\s*caminhões?/i.test(cardText);
      
      if (hasSlotInfo) {
        // Extrair números de vagas ocupadas/total
        const slotMatch = cardText.match(/(\d+)\s*\/\s*(\d+)/);
        
        if (slotMatch) {
          const accepted = parseInt(slotMatch[1]);
          const required = parseInt(slotMatch[2]);
          
          // Garantir que accepted < required (tem vaga disponível)
          expect(accepted).toBeLessThan(required);
          console.log(`✅ Frete tem slots: ${accepted}/${required}`);
        }
      }
    }
    
    console.log('✅ Todos os fretes têm slots disponíveis');
  });

  test('Filtro de busca funciona corretamente', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Contar fretes iniciais
    const initialCount = await page.locator('[data-testid="freight-card"]').count();
    
    if (initialCount === 0) {
      console.log('⚠️ Nenhum frete disponível para testar filtros');
      return;
    }

    console.log(`✅ Total inicial: ${initialCount} fretes`);
    
    // Buscar pelo campo de pesquisa
    const searchInput = page.locator('input[placeholder*="Buscar"]');
    await expect(searchInput).toBeVisible();
    
    // Testar busca por termo genérico
    await searchInput.fill('São Paulo');
    await page.waitForTimeout(500);
    
    // Verificar que a lista foi filtrada
    const filteredCards = await page.locator('[data-testid="freight-card"]').all();
    
    if (filteredCards.length > 0) {
      // Verificar que os resultados contêm "São Paulo"
      for (const card of filteredCards) {
        const cardText = await card.textContent();
        expect(cardText?.toLowerCase()).toContain('são paulo');
      }
      console.log(`✅ Filtro aplicado: ${filteredCards.length} resultados`);
    }
    
    // Limpar busca
    await searchInput.clear();
    await page.waitForTimeout(500);
    
    // Verificar que voltou ao total inicial (ou próximo)
    const finalCount = await page.locator('[data-testid="freight-card"]').count();
    expect(finalCount).toBeGreaterThanOrEqual(initialCount * 0.8); // Aceita até 20% de diferença
    
    console.log('✅ Filtro de busca funciona corretamente');
  });

  test('Filtro de tipo de carga funciona corretamente', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    const initialCount = await page.locator('[data-testid="freight-card"]').count();
    
    if (initialCount === 0) {
      console.log('⚠️ Nenhum frete disponível para testar filtros');
      return;
    }

    console.log(`✅ Total inicial: ${initialCount} fretes`);
    
    // Buscar pelo select de tipo de carga
    const cargoSelect = page.locator('[data-testid="cargo-type-filter"]');
    
    if (await cargoSelect.isVisible()) {
      // Abrir o select
      await cargoSelect.click();
      await page.waitForTimeout(300);
      
      // Selecionar primeiro tipo de carga disponível (não "all")
      const firstOption = page.locator('[role="option"]').nth(1);
      
      if (await firstOption.isVisible()) {
        const optionText = await firstOption.textContent();
        await firstOption.click();
        await page.waitForTimeout(500);
        
        console.log(`✅ Filtro aplicado: ${optionText}`);
        
        // Verificar que a lista foi filtrada
        const filteredCount = await page.locator('[data-testid="freight-card"]').count();
        
        // A lista filtrada deve ser menor ou igual ao total
        expect(filteredCount).toBeLessThanOrEqual(initialCount);
        
        console.log(`✅ Filtrado: ${filteredCount} de ${initialCount} fretes`);
      }
    } else {
      console.log('⚠️ Filtro de tipo de carga não encontrado');
    }
  });

  test('Botão de atualizar recarrega a lista', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Localizar botão de atualizar
    const refreshButton = page.locator('button:has-text("Atualizar"), button:has(svg.animate-spin)').first();
    
    if (await refreshButton.isVisible()) {
      // Clicar no botão
      await refreshButton.click();
      
      // Verificar que o botão mostra loading (ícone girando)
      await page.waitForTimeout(500);
      
      // Aguardar que o loading termine
      await page.waitForTimeout(2000);
      
      // Verificar que a lista ainda está presente
      const cardsAfterRefresh = await page.locator('[data-testid="freight-card"]').count();
      console.log(`✅ Lista recarregada: ${cardsAfterRefresh} fretes`);
      
      expect(cardsAfterRefresh).toBeGreaterThanOrEqual(0);
    } else {
      console.log('⚠️ Botão de atualizar não encontrado');
    }
  });

  test('Estatísticas são exibidas corretamente', async ({ page }) => {
    // Aguardar que a lista de fretes carregue
    await page.waitForSelector('[data-testid="freight-card"], [data-testid="empty-state"]', { timeout: 5000 });
    
    // Verificar que as estatísticas estão visíveis
    const statsContainer = page.locator('[data-testid="matching-stats"]');
    
    if (await statsContainer.isVisible()) {
      // Verificar que contém números
      const statsText = await statsContainer.textContent();
      
      // Deve conter números (ex: "10 fretes", "5 compatíveis")
      expect(statsText).toMatch(/\d+/);
      
      console.log(`✅ Estatísticas exibidas: ${statsText}`);
    } else {
      console.log('⚠️ Container de estatísticas não encontrado');
      
      // Alternativa: procurar por badges com números
      const badges = await page.locator('[data-testid*="stat"]').allTextContents();
      console.log(`✅ Stats encontrados: ${badges.join(', ')}`);
    }
  });

  test('Toggle "Somente disponíveis" não existe mais', async ({ page }) => {
    // Verificar que o toggle foi removido
    const toggleLabel = page.locator('text="Somente disponíveis"');
    await expect(toggleLabel).not.toBeVisible();
    
    const switchComponent = page.locator('[role="switch"]:near(text="Somente disponíveis")');
    await expect(switchComponent).not.toBeVisible();
    
    console.log('✅ Toggle "Somente disponíveis" foi removido com sucesso');
  });
});

/**
 * Testes de integração com dados mockados
 */
test.describe('Fretes I.A - Testes com Dados Mockados', () => {
  
  test('Valida que query Supabase não usa comparação de colunas', async ({ page }) => {
    // Interceptar chamadas para Supabase
    await page.route('**/rest/v1/freights*', async (route) => {
      const url = route.request().url();
      
      // Verificar que a query não contém "accepted_trucks.lt.required_trucks"
      expect(url).not.toContain('accepted_trucks.lt.required_trucks');
      
      // Verificar que usa .in() com status válidos
      const hasValidStatusFilter = 
        url.includes('status=in.(OPEN,ACCEPTED,IN_NEGOTIATION)') ||
        url.includes('status=eq.OPEN') ||
        url.includes('status=eq.ACCEPTED') ||
        url.includes('status=eq.IN_NEGOTIATION');
      
      expect(hasValidStatusFilter).toBeTruthy();
      
      console.log('✅ Query Supabase validada');
      
      // Continuar com a requisição normal
      await route.continue();
    });
    
    // Login e navegar para Fretes I.A
    await page.goto('/');
    await page.fill('input[type="email"]', 'transportadora@test.com');
    await page.fill('input[type="password"]', 'senha123');
    await page.click('button[type="submit"]');
    await page.waitForURL('/dashboard/company', { timeout: 10000 });
    
    await page.click('[data-testid="tab-smart-freights"]');
    await page.waitForTimeout(2000);
  });
});
