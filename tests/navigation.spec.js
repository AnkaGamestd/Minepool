// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Navigation Tests for Mine Pool
 */

test.describe('Navigation', () => {

    // Login before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/login.html');
        await page.waitForLoadState('networkidle');

        await page.fill('#login-email', 'demo@example.com');
        await page.fill('#login-password', 'password123');
        await page.click('#login-form button[type="submit"], .btn-login');

        await expect(page).toHaveURL(/index\.html/, { timeout: 20000 });
    });

    test('should load 2-player mode without redirect to login', async ({ page }) => {
        await page.goto('/game.html?mode=2player');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);

        // Should stay on game page
        expect(page.url()).toMatch(/game\.html/);
    });

    test('should load profile page for authenticated user', async ({ page }) => {
        await page.goto('/profile.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        // Should stay on profile page
        expect(page.url()).toMatch(/profile\.html/);
    });

    test('should load settings page for authenticated user', async ({ page }) => {
        await page.goto('/settings.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        expect(page.url()).toMatch(/settings\.html/);
    });

    test('should load shop page for authenticated user', async ({ page }) => {
        await page.goto('/shop.html');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(2000);

        expect(page.url()).toMatch(/shop\.html/);
    });

    test('index page should have content', async ({ page }) => {
        // Already on index from beforeEach
        const body = page.locator('body');
        await expect(body).toBeVisible();
    });
});
