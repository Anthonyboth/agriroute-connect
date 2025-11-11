import { defineConfig, devices } from '@playwright/test';

/**
 * Configuração do Playwright para testes E2E do AGRIROUTE
 * Todos os testes devem validar textos em português brasileiro
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
    
    // Configurações de localização brasileira
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    
    // Headers para evitar tradução automática
    extraHTTPHeaders: {
      'Accept-Language': 'pt-BR,pt;q=0.9'
    },
    
    // Atributo para identificação de elementos em testes
    testIdAttribute: 'data-testid'
  },
  
  projects: [
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      }
    },
    
    {
      name: 'firefox',
      use: { 
        ...devices['Desktop Firefox'],
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      }
    },
    
    {
      name: 'webkit',
      use: { 
        ...devices['Desktop Safari'],
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      }
    },
    
    /* Testes mobile */
    {
      name: 'Mobile Chrome',
      use: { 
        ...devices['Pixel 5'],
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      }
    },
    
    {
      name: 'Mobile Safari',
      use: { 
        ...devices['iPhone 12'],
        locale: 'pt-BR',
        timezoneId: 'America/Sao_Paulo'
      }
    }
  ],
  
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000
  }
});
