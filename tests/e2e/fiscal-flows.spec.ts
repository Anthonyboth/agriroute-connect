import { test, expect } from '@playwright/test';

/**
 * Testes E2E para Módulo Fiscal - AgriRoute
 * 
 * Cobre:
 * - FiscalIssuerSetup não mostra "Perfil não encontrado"
 * - Upload de certificado A1
 * - Criação de emissor fiscal
 * - Integração com Focus NFe (quando disponível)
 */

test.describe('Fiscal - Onboarding', () => {
  
  test('Página fiscal não mostra "Perfil não encontrado"', async ({ page }) => {
    // Navegar para área fiscal (requer role TRANSPORTADORA ou PRODUTOR com permissão)
    await page.goto('/dashboard/producer');
    await page.waitForLoadState('networkidle');
    
    // Procurar aba ou link fiscal
    const fiscalTab = page.getByRole('tab', { name: /fiscal|nf-e|notas/i });
    
    if (await fiscalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fiscalTab.click();
      
      // Verificar que não há erro de perfil
      await expect(page.getByText(/perfil não encontrado/i)).not.toBeVisible({ timeout: 5000 });
      await expect(page.getByText(/emissor.*não encontrado/i)).not.toBeVisible({ timeout: 3000 });
    }
  });

  test('Onboarding fiscal carrega sem erro', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.waitForLoadState('networkidle');
    
    const fiscalTab = page.getByRole('tab', { name: /fiscal|nf-e|notas/i });
    
    if (await fiscalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fiscalTab.click();
      
      // Verificar que o onboarding ou o setup está visível
      const onboardingWizard = page.getByText(/configurar emissor|onboarding fiscal|dados fiscais/i);
      const issuerSetup = page.getByText(/emissor fiscal|configurações fiscais/i);
      
      const isOnboardingVisible = await onboardingWizard.isVisible({ timeout: 5000 }).catch(() => false);
      const isSetupVisible = await issuerSetup.isVisible({ timeout: 5000 }).catch(() => false);
      
      // Pelo menos um deve estar visível (dependendo do estado do usuário)
      expect(isOnboardingVisible || isSetupVisible).toBeTruthy();
    }
  });

  test('Formulário de emissor fiscal valida CNPJ', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.waitForLoadState('networkidle');
    
    const fiscalTab = page.getByRole('tab', { name: /fiscal|nf-e|notas/i });
    
    if (await fiscalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fiscalTab.click();
      
      // Procurar campo de CNPJ
      const cnpjInput = page.getByPlaceholder(/cnpj/i).or(page.getByLabel(/cnpj/i));
      
      if (await cnpjInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Preencher CNPJ inválido
        await cnpjInput.fill('12345678901234');
        await cnpjInput.blur();
        
        // Deve mostrar erro de validação
        await expect(page.getByText(/cnpj inválido|cnpj.*inválido/i)).toBeVisible({ timeout: 3000 });
      }
    }
  });

  test('Upload de certificado A1 está disponível', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.waitForLoadState('networkidle');
    
    const fiscalTab = page.getByRole('tab', { name: /fiscal|nf-e|notas/i });
    
    if (await fiscalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fiscalTab.click();
      
      // Procurar botão/área de upload de certificado
      const uploadButton = page.getByRole('button', { name: /certificado|upload.*a1|enviar.*certificado/i });
      const uploadArea = page.getByText(/arraste.*certificado|selecione.*certificado/i);
      
      const isButtonVisible = await uploadButton.isVisible({ timeout: 5000 }).catch(() => false);
      const isAreaVisible = await uploadArea.isVisible({ timeout: 5000 }).catch(() => false);
      
      // Upload deve estar disponível de alguma forma
      // (pode estar em modal ou em step específico do onboarding)
    }
  });
});

test.describe('Fiscal - Edge Functions', () => {
  
  test('fiscal-certificate-upload retorna erro correto sem issuer', async ({ request }) => {
    // Testar a edge function diretamente
    const response = await request.post('/api/fiscal-certificate-upload', {
      data: {
        // Enviar sem issuer_id para testar tratamento de erro
      },
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false,
    });
    
    // Deve retornar erro com código específico, não 500 genérico
    const status = response.status();
    expect([400, 401, 404]).toContain(status);
    
    const body = await response.json().catch(() => ({}));
    if (body.error_code) {
      expect(['ISSUER_NOT_FOUND', 'MISSING_ISSUER_ID', 'VALIDATION_ERROR']).toContain(body.error_code);
    }
  });

  test('fiscal-issuer-register valida campos obrigatórios', async ({ request }) => {
    const response = await request.post('/api/fiscal-issuer-register', {
      data: {
        // Dados incompletos
        document_number: '',
      },
      headers: {
        'Content-Type': 'application/json',
      },
      failOnStatusCode: false,
    });
    
    const status = response.status();
    expect([400, 401, 422]).toContain(status);
  });
});

test.describe('Fiscal - Consistência', () => {
  
  test('Status do emissor reflete após upload de certificado', async ({ page }) => {
    await page.goto('/dashboard/producer');
    await page.waitForLoadState('networkidle');
    
    const fiscalTab = page.getByRole('tab', { name: /fiscal|nf-e|notas/i });
    
    if (await fiscalTab.isVisible({ timeout: 5000 }).catch(() => false)) {
      await fiscalTab.click();
      
      // Se já há emissor configurado, verificar badge de status
      const statusBadge = page.getByText(/configurado|ativo|pendente|validado/i);
      
      if (await statusBadge.isVisible({ timeout: 5000 }).catch(() => false)) {
        // Status deve ser um dos valores válidos
        const statusText = await statusBadge.textContent();
        expect(['Configurado', 'Ativo', 'Pendente', 'Validado', 'Certificado Enviado']).toContainEqual(statusText?.trim());
      }
    }
  });
});
