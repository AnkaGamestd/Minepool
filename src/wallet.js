import { createAppKit } from '@reown/appkit';
import { EthersAdapter } from '@reown/appkit-adapter-ethers';
import { bsc } from '@reown/appkit/networks';

const projectId = '552b76549cfdaa2c137b7670d9edfd69';

const metadata = {
    name: 'Mine Pool',
    description: 'Play 8-Ball Pool and Win TAIN Tokens',
    url: 'https://minepool.app',
    icons: ['https://minepool.app/icon.png']
};

// Create AppKit instance
const appkit = createAppKit({
    adapters: [new EthersAdapter()],
    metadata,
    networks: [bsc],
    projectId,
    themeMode: 'dark',
    themeVariables: {
        '--w3m-accent': '#ffd700',
        '--w3m-border-radius-master': '12px'
    },
    features: {
        analytics: false,
        email: false,
        socials: false,
        onramp: false
    }
});

// API URL
const API_URL = '/api/auth';

// Show message
function showMessage(text, type) {
    const msgEl = document.getElementById('message');
    if (msgEl) {
        msgEl.textContent = text;
        msgEl.className = 'message show ' + type;
    }
    console.log(`[${type}] ${text}`);
}

// Authenticate with backend
async function authenticateWithBackend(walletAddress, message, signature) {
    const urlParams = new URLSearchParams(window.location.search);
    const referralCode = urlParams.get('ref');

    const response = await fetch(`${API_URL}/wallet-login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress, message, signature, referralCode }),
        credentials: 'include'
    });

    return response.json();
}

// Handle wallet connection
let isAuthenticating = false;
let lastAddress = null;

async function handleWalletConnection(address) {
    if (isAuthenticating || !address || address === lastAddress) return;

    isAuthenticating = true;
    lastAddress = address;

    showMessage('Connected! Requesting signature...', 'success');

    try {
        const walletAddress = address;
        const message = `Login to Mine Pool: ${walletAddress} at ${Date.now()}`;

        // Wait a bit for provider to be ready
        await new Promise(resolve => setTimeout(resolve, 500));

        // Get the wallet provider
        const provider = await appkit.getWalletProvider();
        console.log('Provider:', provider);

        if (!provider) {
            // Try to get from window
            if (window.ethereum) {
                showMessage('Using injected provider...', 'success');
                const signature = await window.ethereum.request({
                    method: 'personal_sign',
                    params: [message, walletAddress]
                });
                await completeLogin(walletAddress, message, signature);
            } else {
                throw new Error('No wallet provider available');
            }
            return;
        }

        showMessage('Please sign the message in your wallet...', 'success');

        // Request signature
        const signature = await provider.request({
            method: 'personal_sign',
            params: [message, walletAddress]
        });

        await completeLogin(walletAddress, message, signature);

    } catch (e) {
        console.error('Auth error:', e);
        showMessage('Error: ' + e.message, 'error');
        isAuthenticating = false;
    }
}

async function completeLogin(walletAddress, message, signature) {
    showMessage('Authenticating...', 'success');

    const data = await authenticateWithBackend(walletAddress, message, signature);

    if (data.success) {
        showMessage('Success! Redirecting...', 'success');
        localStorage.setItem('user', JSON.stringify(data.user));
        localStorage.setItem('walletAddress', walletAddress);

        setTimeout(() => {
            window.location.href = data.user.profileComplete ? '/index.html' : '/complete-profile.html';
        }, 1000);
    } else {
        showMessage(data.error || 'Login failed', 'error');
        isAuthenticating = false;
    }
}

// Subscribe to connection events (only on login page for auto-auth)
const isLoginPage = window.location.pathname.includes('login');

if (isLoginPage) {
    appkit.subscribeAccount(async (account) => {
        console.log('Account update:', account);
        if (account && account.address && account.isConnected) {
            await handleWalletConnection(account.address);
        }
    });

    // Also subscribe to state
    appkit.subscribeState(async (state) => {
        console.log('State update:', state);
        if (state.address && state.selectedNetworkId) {
            await handleWalletConnection(state.address);
        }
    });
}

// Check if already logged in (only on login page)
async function checkAuth() {
    // Only redirect on login page
    if (!window.location.pathname.includes('login')) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/me`, { credentials: 'include' });
        const data = await response.json();
        if (data.success && data.user) {
            window.location.href = data.user.profileComplete ? '/index.html' : '/complete-profile.html';
        }
    } catch (e) {
        console.log('Not logged in');
    }
}

checkAuth();

// Export for debugging
window.appkit = appkit;
window.handleWalletConnection = handleWalletConnection;
