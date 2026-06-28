import { test, expect } from '@playwright/test';

test.describe('Credit Default Risk Assessor E2E Flows', () => {
  
  test('should redirect unauthenticated user to login page', async ({ page }) => {
    // Attempt to access dashboard
    await page.goto('/dashboard');
    
    // Should be redirected to /login
    await expect(page).toHaveURL(/\/login/);
    await expect(page.locator('h2')).toContainText('Analyst Command Center');
  });

  test('should display login page layout and assets', async ({ page }) => {
    await page.goto('/login');
    
    // Check brand logo header
    await expect(page.locator('h1')).toContainText('ANTIGRAVITY');
    
    // Check right panel exposure summary
    await expect(page.locator('text=Active Portfolio Analysis')).toBeVisible();
    await expect(page.locator('text=INR 254.9 Cr')).toBeVisible();
  });

  test('should display input validation errors on bad login submission', async ({ page }) => {
    await page.goto('/login');
    
    // Fill bad credentials
    await page.fill('input[type="email"]', 'wrong@bank.in');
    await page.fill('input[type="password"]', 'short');
    
    // Click submit
    await page.click('button[type="submit"]');
    
    // Spinner loader or error toast should be captured
    const errorBox = page.locator('.bg-red-950\\/40');
    await expect(errorBox).toBeVisible();
  });

  test('should allow navigation between sidebar links on dashboard', async ({ page }) => {
    // Log in bypass or authenticated mock (assuming auth cookie is set or using mock session bypass)
    await page.goto('/login');
    
    // Enter credentials (assuming seeded user exists)
    await page.fill('input[type="email"]', 'analyst@bank.in');
    await page.fill('input[type="password"]', 'SecurePass123!');
    await page.click('button[type="submit"]');
    
    // Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard/);
    
    // Verify dashboard metrics load
    await expect(page.locator('text=Portfolio Risk Overview')).toBeVisible();
    await expect(page.locator('text=Weighted PD')).toBeVisible();
    
    // Navigate to Customer 360 page
    await page.click('text=Customer 360');
    await expect(page).toHaveURL(/\/dashboard\/customer-360/);
    await expect(page.locator('text=Customer 360 Risk Profile')).toBeVisible();
    
    // Navigate to Portfolio Upload page
    await page.click('text=Portfolio Upload');
    await expect(page).toHaveURL(/\/dashboard\/portfolio/);
    await expect(page.locator('text=Portfolio Ingestion Hub')).toBeVisible();
  });
});
