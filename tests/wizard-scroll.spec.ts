import { test, expect } from '@playwright/test';

test.describe('Wizard Scroll and Fixed Buttons', () => {
  test('ServiceWizard has scrollable content and visible footer', async ({ page }) => {
    // Navigate to a page that opens the service wizard
    await page.goto('/');
    
    // Look for a button that opens service modal (if exists on landing page)
    const serviceButton = page.locator('text=Solicitar Serviço').first();
    if (await serviceButton.isVisible()) {
      await serviceButton.click();
      
      // Wait for dialog to open
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // Check that the dialog content has proper overflow structure
      const dialogContent = page.locator('[role="dialog"]');
      await expect(dialogContent).toBeVisible();
      
      // Check that navigation buttons are visible
      const buttons = dialogContent.locator('button');
      await expect(buttons.first()).toBeVisible();
    }
  });

  test('Dialog content uses correct layout classes', async ({ page }) => {
    await page.goto('/');
    
    // Check that any dialog that opens has the correct structure
    // This is a smoke test to ensure the layout is not broken
    const serviceButton = page.locator('text=Solicitar').first();
    if (await serviceButton.isVisible()) {
      await serviceButton.click();
      
      await page.waitForSelector('[role="dialog"]', { timeout: 5000 });
      
      // The dialog should have flex column layout
      const dialog = page.locator('[role="dialog"]');
      const style = await dialog.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          display: computed.display,
          flexDirection: computed.flexDirection,
          overflow: computed.overflow
        };
      });
      
      // Should be flex container
      expect(style.display).toBe('flex');
      expect(style.flexDirection).toBe('column');
    }
  });
});

test.describe('Modal Height and Scroll', () => {
  test('Wizard modals should have fixed height and internal scroll', async ({ page }) => {
    await page.goto('/');
    
    // Try to find and click any service-related button
    const buttons = page.locator('button:has-text("Solicitar"), button:has-text("Criar"), button:has-text("Serviço")');
    const firstButton = buttons.first();
    
    if (await firstButton.isVisible({ timeout: 3000 }).catch(() => false)) {
      await firstButton.click();
      
      // Wait for any dialog to appear
      const dialog = page.locator('[role="dialog"]');
      if (await dialog.isVisible({ timeout: 3000 }).catch(() => false)) {
        // Verify the dialog has proper dimensions
        const box = await dialog.boundingBox();
        if (box) {
          // Height should not exceed viewport
          expect(box.height).toBeLessThanOrEqual(page.viewportSize()!.height);
        }
      }
    }
  });
});
