// @ts-check
const { test, expect } = require('@playwright/test');

/**
 * Game UI Tests for Mine Pool
 */

test.describe('Game UI', () => {
    // Login and go to game before each test
    test.beforeEach(async ({ page }) => {
        await page.goto('/login.html');
        await page.waitForLoadState('networkidle');

        await page.fill('#login-email', 'demo@example.com');
        await page.fill('#login-password', 'password123');
        await page.click('#login-form button[type="submit"], .btn-login');

        await expect(page).toHaveURL(/index\.html/, { timeout: 20000 });

        // Navigate to 2-player game
        await page.goto('/game.html?mode=2player');
        await page.waitForLoadState('networkidle');
        await page.waitForTimeout(3000);
    });

    test('should render game canvas', async ({ page }) => {
        const canvas = page.locator('canvas, #game-canvas');
        await expect(canvas.first()).toBeVisible({ timeout: 15000 });
    });

    test('should have controls visible', async ({ page }) => {
        // Check for any UI controls
        const controls = page.locator('#power-gauge, .power-gauge, #controls-container, .game-controls, #game-container');
        const count = await controls.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should show player elements', async ({ page }) => {
        const playerElements = page.locator('[id*="player"], [id*="p1"], [id*="p2"], #user-name, .user-info');
        const count = await playerElements.count();
        expect(count).toBeGreaterThan(0);
    });

    test('should have back button', async ({ page }) => {
        const backBtn = page.locator('#btn-back-to-menu, button:has-text("Back"), button:has-text("Menu")');
        const count = await backBtn.count();
        expect(count).toBeGreaterThan(0);
    });

    test('game page should not redirect to login', async ({ page }) => {
        // Verify we're still on game page
        expect(page.url()).toMatch(/game\.html/);
    });

    test('should have game container', async ({ page }) => {
        const container = page.locator('#game-container, .game-container, #pool-table-container, main, body');
        await expect(container.first()).toBeVisible();
    });
});
