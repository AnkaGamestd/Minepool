// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Authentication Tests for Mine Pool
 */

test.describe('Authentication', () => {

    test('should login with valid credentials and redirect to index', async ({ page }) => {
        await page.goto('/login.html');
        await page.waitForLoadState('networkidle');

        // Use correct form IDs
        await page.fill('#login-email', 'demo@example.com');
        await page.fill('#login-password', 'password123');

        // Submit form
        await page.click('#login-form button[type="submit"], .btn-login');

        // Wait for redirect to index
        await expect(page).toHaveURL(/index\.html/, { timeout: 20000 });

        // Verify user data is in localStorage
        const userData = await page.evaluate(() => localStorage.getItem('user'));
        expect(userData).toBeTruthy();
    });

    test('should show error for invalid credentials', async ({ page }) => {
        await page.goto('/login.html');
        await page.waitForLoadState('networkidle');

        // Fill with wrong password
        await page.fill('#login-email', 'demo@example.com');
        await page.fill('#login-password', 'wrongpassword');

        // Submit form
        await page.click('#login-form button[type="submit"], .btn-login');

        // Wait a bit for response
        await page.waitForTimeout(3000);

        // Should stay on login page
        expect(page.url()).toMatch(/login\.html/);
    });

    test('should store user data in localStorage after login', async ({ page }) => {
        await page.goto('/login.html');
        await page.waitForLoadState('networkidle');

        await page.fill('#login-email', 'demo@example.com');
        await page.fill('#login-password', 'password123');
        await page.click('#login-form button[type="submit"], .btn-login');

        await expect(page).toHaveURL(/index\.html/, { timeout: 20000 });

        // Verify user is stored
        const userData = await page.evaluate(() => localStorage.getItem('user'));
        expect(userData).toBeTruthy();

        const user = JSON.parse(userData);
        expect(user.username).toBeTruthy();
    });

    test('should redirect to login when accessing protected page without auth', async ({ page }) => {
        // Start fresh
        await page.goto('/login.html');
        await page.evaluate(() => localStorage.clear());

        // Try to access protected page
        await page.goto('/index.html');

        // Wait for potential redirect
        await page.waitForTimeout(4000);

        // Should redirect to login
        await expect(page).toHaveURL(/login\.html/, { timeout: 10000 });
    });
});
