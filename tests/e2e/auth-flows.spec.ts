import { test, expect } from '@playwright/test';

/**
 * Testes E2E para Fluxos de Autenticação - AgriRoute
 * 
 * Cobre:
 * - Modal de seleção de role na Landing
 * - Signup com role específica via deep link
 * - Login e redirecionamento para dashboard correto
 * - Multi-profile selector
 * - Recuperação de senha
 */

test.describe('Landing - Modal de Cadastro', () => {
  
  test.beforeEach(async ({ page }) => {
    await page.context().clearCookies();
  });

  test('Botão "Cadastrar-se" abre modal com 4 opções de role', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no botão Cadastrar-se
    const cadastrarBtn = page.getByRole('button', { name: /cadastrar/i }).first();
    await expect(cadastrarBtn).toBeVisible({ timeout: 10000 });
    await cadastrarBtn.click();
    
    // Verificar que o modal abriu
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    
    // Verificar que tem aba de cadastro ativa
    await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
    
    // Verificar que as 4 opções estão visíveis
    await expect(page.getByText(/produtor.*contratante/i)).toBeVisible();
    await expect(page.getByText(/^motorista$/i)).toBeVisible();
    await expect(page.getByText(/transportadora/i)).toBeVisible();
    await expect(page.getByText(/prestador.*serviços/i)).toBeVisible();
  });

  test('Selecionar "Motorista" navega para /auth com mode=signup e role=MOTORISTA', async ({ page }) => {
    await page.goto('/');
    
    // Abrir modal
    const cadastrarBtn = page.getByRole('button', { name: /cadastrar/i }).first();
    await cadastrarBtn.click();
    
    // Selecionar Motorista
    await page.getByText(/^motorista$/i).click();
    
    // Clicar em continuar/prosseguir
    const continueBtn = page.getByRole('button', { name: /continuar|prosseguir|cadastro/i });
    await continueBtn.click();
    
    // Verificar URL
    await expect(page).toHaveURL(/\/auth.*mode=signup.*role=MOTORISTA/i, { timeout: 10000 });
    
    // Verificar que role foi persistido em sessionStorage
    const sessionRole = await page.evaluate(() => sessionStorage.getItem('pending_signup_role'));
    expect(sessionRole).toBe('MOTORISTA');
  });

  test('Selecionar "Produtor" navega para /auth com mode=signup e role=PRODUTOR', async ({ page }) => {
    await page.goto('/');
    
    // Abrir modal
    const cadastrarBtn = page.getByRole('button', { name: /cadastrar/i }).first();
    await cadastrarBtn.click();
    
    // Selecionar Produtor
    await page.getByText(/produtor.*contratante/i).click();
    
    // Clicar em continuar
    const continueBtn = page.getByRole('button', { name: /continuar|prosseguir|cadastro/i });
    await continueBtn.click();
    
    // Verificar URL
    await expect(page).toHaveURL(/\/auth.*mode=signup.*role=PRODUTOR/i, { timeout: 10000 });
    
    // Verificar sessionStorage
    const sessionRole = await page.evaluate(() => sessionStorage.getItem('pending_signup_role'));
    expect(sessionRole).toBe('PRODUTOR');
  });

  test('Botão "Começar Agora" (CTA) abre modal de cadastro', async ({ page }) => {
    await page.goto('/');
    
    // Scroll para o CTA e clicar
    const ctaBtn = page.getByRole('button', { name: /começar agora/i });
    await ctaBtn.scrollIntoViewIfNeeded();
    await ctaBtn.click();
    
    // Verificar que o modal abriu com aba signup ativa
    const modal = page.getByRole('dialog');
    await expect(modal).toBeVisible({ timeout: 5000 });
    await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
  });

  test('Botão "Entrar" continua funcionando normalmente', async ({ page }) => {
    await page.goto('/');
    
    // Clicar no botão Entrar
    const entrarBtn = page.getByRole('button', { name: /^entrar$/i }).first();
    await expect(entrarBtn).toBeVisible({ timeout: 10000 });
    await entrarBtn.click();
    
    // Verificar navegação para /auth com mode=login
    await expect(page).toHaveURL(/\/auth.*mode=login/i, { timeout: 10000 });
  });
});

test.describe('Autenticação - Fluxos Principais', () => {
  
  test.beforeEach(async ({ page }) => {
    // Limpar cookies e storage antes de cada teste
    await page.context().clearCookies();
  });

  test('Deep link /auth?mode=signup&role=MOTORISTA abre cadastro direto', async ({ page }) => {
    // Navegar para o deep link de cadastro com role
    await page.goto('/auth?mode=signup&role=MOTORISTA');
    
    // Verificar que a aba de cadastro está ativa (não a de login)
    await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
    
    // Verificar que o formulário de cadastro está visível
    await expect(page.getByPlaceholder(/nome completo|seu nome/i)).toBeVisible({ timeout: 10000 });
    
    // Verificar que o role foi persistido (via sessionStorage ou no formulário)
    const sessionRole = await page.evaluate(() => sessionStorage.getItem('pending_signup_role'));
    expect(sessionRole).toBe('MOTORISTA');
  });

  test('Deep link /auth?mode=signup&role=PRODUTOR abre cadastro para produtor', async ({ page }) => {
    await page.goto('/auth?mode=signup&role=PRODUTOR');
    
    await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
    
    const sessionRole = await page.evaluate(() => sessionStorage.getItem('pending_signup_role'));
    expect(sessionRole).toBe('PRODUTOR');
  });

  test('Deep link /auth?mode=login abre tela de login', async ({ page }) => {
    await page.goto('/auth?mode=login');
    
    // Verificar que a aba de login está ativa
    await expect(page.locator('[data-value="login"]')).toHaveAttribute('data-state', 'active');
    
    // Verificar campos de login visíveis
    await expect(page.getByPlaceholder(/email|e-mail/i).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByPlaceholder(/senha|password/i).first()).toBeVisible();
  });

  test('Página de login não mostra erro genérico', async ({ page }) => {
    await page.goto('/auth');
    
    // Aguardar carregamento
    await page.waitForLoadState('networkidle');
    
    // Não deve haver toasts de erro genérico
    await expect(page.locator('[data-sonner-toast][data-type="error"]')).not.toBeVisible({ timeout: 3000 });
    
    // Não deve haver texto "Perfil não encontrado" ou "temporariamente indisponível"
    await expect(page.getByText(/perfil não encontrado/i)).not.toBeVisible();
    await expect(page.getByText(/temporariamente indisponível/i)).not.toBeVisible();
  });

  test('Refresh na página de cadastro mantém modo e role', async ({ page }) => {
    // Primeiro acesso
    await page.goto('/auth?mode=signup&role=TRANSPORTADORA');
    
    // Aguardar o formulário
    await page.waitForLoadState('networkidle');
    
    // Refresh
    await page.reload();
    
    // Verificar que ainda está no modo de cadastro
    await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
    
    // Role deve ter sido preservado
    const sessionRole = await page.evaluate(() => sessionStorage.getItem('pending_signup_role'));
    expect(sessionRole).toBe('TRANSPORTADORA');
  });

  test('Clicar em "Criar conta" navega para signup, não login', async ({ page }) => {
    await page.goto('/auth?mode=login');
    
    // Procurar e clicar no link/botão de criar conta
    const createAccountLink = page.getByText(/criar conta|cadastrar|registrar/i).first();
    
    if (await createAccountLink.isVisible()) {
      await createAccountLink.click();
      
      // Verificar que agora está no modo signup
      await expect(page.locator('[data-value="signup"]')).toHaveAttribute('data-state', 'active');
    }
  });

  test('Loading não fica infinito na tela de auth', async ({ page }) => {
    await page.goto('/auth');
    
    // Se houver loader, deve desaparecer em no máximo 5 segundos
    const loader = page.locator('[data-testid="loader"], .animate-spin').first();
    
    if (await loader.isVisible({ timeout: 1000 }).catch(() => false)) {
      await expect(loader).not.toBeVisible({ timeout: 5000 });
    }
    
    // O formulário deve ser visível
    await expect(page.getByRole('form').or(page.locator('form')).first()).toBeVisible({ timeout: 5000 });
  });
});

test.describe('Autenticação - Validações', () => {
  
  test('Email inválido mostra erro específico', async ({ page }) => {
    await page.goto('/auth?mode=signup');
    
    // Preencher email inválido
    const emailInput = page.getByPlaceholder(/email|e-mail/i).first();
    await emailInput.fill('email-invalido');
    await emailInput.blur();
    
    // Deve mostrar erro de validação (não genérico)
    const errorText = page.getByText(/email inválido|e-mail inválido|formato.*inválido/i);
    await expect(errorText).toBeVisible({ timeout: 3000 });
  });

  test('Senha fraca mostra requisitos', async ({ page }) => {
    await page.goto('/auth?mode=signup');
    
    // Preencher senha fraca
    const passwordInput = page.getByPlaceholder(/senha|password/i).first();
    await passwordInput.fill('123');
    await passwordInput.blur();
    
    // Deve mostrar requisitos ou erro
    const passwordHint = page.getByText(/mínimo|caracteres|requisitos|fraca/i);
    await expect(passwordHint).toBeVisible({ timeout: 3000 });
  });
});

test.describe('Multi-Profile', () => {
  
  test.skip('Profile selector aparece quando há múltiplos perfis', async ({ page }) => {
    // Este teste requer usuário logado com múltiplos perfis
    // Implementar com mock ou fixture quando disponível
    
    await page.goto('/');
    
    // Esperar modal de seleção de perfil
    const profileModal = page.getByRole('dialog').filter({ hasText: /selecione.*perfil|escolha.*conta/i });
    
    if (await profileModal.isVisible({ timeout: 5000 }).catch(() => false)) {
      // Verificar que há opções de perfil
      await expect(page.getByRole('button').filter({ hasText: /motorista|produtor|transportadora/i }).first()).toBeVisible();
    }
  });
});
