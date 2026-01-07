// @ts-check
const { defineConfig, devices } = require('@playwright/test');

/**
 * Mine Pool QA Testing Configuration
 */
module.exports = defineConfig({
    testDir: './tests',

    /* Run tests sequentially to avoid overwhelming the server */
    fullyParallel: false,
    workers: 1,

    /* Increase timeout for slower operations */
    timeout: 60000,
    expect: {
        timeout: 15000
    },

    /* Fail the build on CI if you accidentally left test.only in the source code */
    forbidOnly: !!process.env.CI,

    /* Retry failed tests */
    retries: 1,

    /* Reporter to use */
    reporter: 'html',

    /* Shared settings for all the projects below */
    use: {
        /* Base URL to use in tests */
        baseURL: 'http://localhost:8000',

        /* Collect trace when retrying the failed test */
        trace: 'on-first-retry',

        /* Take screenshot on failure */
        screenshot: 'only-on-failure',

        /* Slower actions for stability */
        actionTimeout: 15000,
    },

    /* Configure projects - only desktop chrome for reliability */
    projects: [
        {
            name: 'chromium',
            use: { ...devices['Desktop Chrome'] },
        },
    ],

    /* Run your local dev server before starting the tests */
    webServer: {
        command: 'node server.js',
        url: 'http://localhost:8000',
        reuseExistingServer: true,
        timeout: 120000,
    },
});
