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
    },
    // Force QR code only - prevents opening MetaMask browser
    enableWalletConnect: true,
    enableInjected: false,
    enableEIP6963: false,
    enableCoinbase: false
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

// Handle wallet connection state changes
let lastAddress = null;

appkit.subscribeState(async (state) => {
    console.log('AppKit state:', state);

    // Check if newly connected
    if (state.address && state.address !== lastAddress) {
        lastAddress = state.address;

        showMessage('Connected! Signing in...', 'success');

        try {
            const walletAddress = state.address;
            const message = `Login to Mine Pool: ${walletAddress} at ${Date.now()}`;

            // Get the wallet provider from appkit
            const provider = appkit.getWalletProvider();

            if (!provider) {
                throw new Error('No provider available');
            }

            // Request signature
            const signature = await provider.request({
                method: 'personal_sign',
                params: [message, walletAddress]
            });

            // Authenticate with backend
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
            }
        } catch (e) {
            console.error('Auth error:', e);
            showMessage('Signature failed. Please try again.', 'error');
        }
    }
});

// Check if already logged in
async function checkAuth() {
    try {
        const response = await fetch(`${API_URL}/me`, { credentials: 'include' });
        const data = await response.json();
        if (data.success && data.user) {
            window.location.href = data.user.profileComplete ? '/index.html' : '/complete-profile.html';
        }
    } catch (e) {
        // Not logged in
    }
}

checkAuth();

// Export for debugging
window.appkit = appkit;
