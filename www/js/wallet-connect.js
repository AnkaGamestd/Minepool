/**
 * WalletConnect Integration for Mine Pool
 * Provides wallet connection functionality for native mobile apps
 * Supports: MetaMask, Trust Wallet, and other WalletConnect-compatible wallets
 */

const WALLETCONNECT_CONFIG = {
    // Reown/WalletConnect Project ID from https://cloud.reown.com/
    PROJECT_ID: '552b76549cfdaa2c137b7670d9edfd69',

    // BSC Mainnet configuration
    CHAIN_ID: 56,
    CHAIN_NAME: 'BNB Smart Chain',
    RPC_URL: 'https://bsc-dataseed.binance.org/',
    BLOCK_EXPLORER: 'https://bscscan.com',
    NATIVE_CURRENCY: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
    }
};

const TAIN_CONFIG = {
    CONTRACT_ADDRESS: '0x3fe59e287f58e5a83443bcfd34dd72f045663e8b',
    DECIMALS: 18,
    SYMBOL: 'TAIN',
    GAME_CONTRACT_ADDRESS: '0x0fbc316c1Ea82E90526aBeE57EE6C4eC5691F891',
    HOUSE_FEE_PERCENT: 10
};

// Minimal ABI for ERC-20 Token
const TAIN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function approve(address spender, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

class WalletConnectManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contract = null;
        this.isConnected = false;
        this.connectionMethod = null; // 'injected' or 'walletconnect'
    }

    /**
     * Check if an injected wallet (MetaMask, etc.) is available
     */
    hasInjectedWallet() {
        return typeof window.ethereum !== 'undefined';
    }

    /**
     * Connect using injected provider (MetaMask browser extension or in-app browser)
     */
    async connectInjected() {
        if (!this.hasInjectedWallet()) {
            throw new Error('No injected wallet found');
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.userAddress = accounts[0];

            // Create ethers provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();

            // Ensure correct network
            await this.switchToCorrectNetwork();

            // Initialize token contract
            this.contract = new ethers.Contract(
                TAIN_CONFIG.CONTRACT_ADDRESS,
                TAIN_ABI,
                this.signer
            );

            this.isConnected = true;
            this.connectionMethod = 'injected';

            console.log('✅ Connected via injected wallet:', this.userAddress);
            return this.userAddress;

        } catch (error) {
            console.error('❌ Injected wallet connection failed:', error);
            throw error;
        }
    }

    /**
     * Switch to BSC network if not already connected
     */
    async switchToCorrectNetwork() {
        if (!window.ethereum) return;

        const chainIdHex = '0x' + WALLETCONNECT_CONFIG.CHAIN_ID.toString(16);

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId: chainIdHex }],
            });
        } catch (switchError) {
            // Chain doesn't exist, add it
            if (switchError.code === 4902) {
                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [{
                            chainId: chainIdHex,
                            chainName: WALLETCONNECT_CONFIG.CHAIN_NAME,
                            nativeCurrency: WALLETCONNECT_CONFIG.NATIVE_CURRENCY,
                            rpcUrls: [WALLETCONNECT_CONFIG.RPC_URL],
                            blockExplorerUrls: [WALLETCONNECT_CONFIG.BLOCK_EXPLORER]
                        }],
                    });
                } catch (addError) {
                    console.error('Failed to add network:', addError);
                    throw addError;
                }
            } else {
                throw switchError;
            }
        }
    }

    /**
     * Connect using WalletConnect protocol
     * This shows a QR code that users can scan with their mobile wallet
     */
    async connectWalletConnect() {
        try {
            // Dynamic import of WalletConnect provider
            // Using the standalone sign client for simplicity
            const { WalletConnectModal } = await import('https://cdn.jsdelivr.net/npm/@walletconnect/modal@2.6.2/+esm');
            const { SignClient } = await import('https://cdn.jsdelivr.net/npm/@walletconnect/sign-client@2.10.0/+esm');

            const projectId = WALLETCONNECT_CONFIG.PROJECT_ID;

            if (projectId === 'YOUR_PROJECT_ID') {
                throw new Error('Please configure your WalletConnect Project ID in wallet-connect.js');
            }

            // Create modal
            const modal = new WalletConnectModal({
                projectId,
                chains: [`eip155:${WALLETCONNECT_CONFIG.CHAIN_ID}`],
                themeMode: 'dark',
                themeVariables: {
                    '--wcm-accent-color': '#ffd700',
                    '--wcm-background-color': '#0f1923'
                }
            });

            // Create sign client
            const signClient = await SignClient.init({
                projectId,
                metadata: {
                    name: 'Mine Pool',
                    description: 'Play 8-Ball Pool and Win TAIN Tokens',
                    url: window.location.origin,
                    icons: ['https://your-icon-url.com/icon.png']
                }
            });

            // Connect
            const { uri, approval } = await signClient.connect({
                requiredNamespaces: {
                    eip155: {
                        methods: ['eth_sendTransaction', 'personal_sign', 'eth_signTypedData'],
                        chains: [`eip155:${WALLETCONNECT_CONFIG.CHAIN_ID}`],
                        events: ['chainChanged', 'accountsChanged']
                    }
                }
            });

            if (uri) {
                modal.openModal({ uri });
            }

            const session = await approval();
            modal.closeModal();

            // Get the account from the session
            const accounts = Object.values(session.namespaces)
                .flatMap(ns => ns.accounts)
                .map(account => account.split(':')[2]);

            this.userAddress = accounts[0];

            // Create a provider from the session
            // For WalletConnect, we'll use a JSON-RPC provider and sign transactions through the session
            this.provider = new ethers.providers.JsonRpcProvider(WALLETCONNECT_CONFIG.RPC_URL);

            // Store session for signing
            this._signClient = signClient;
            this._session = session;

            // Initialize read-only contract
            this.contract = new ethers.Contract(
                TAIN_CONFIG.CONTRACT_ADDRESS,
                TAIN_ABI,
                this.provider
            );

            this.isConnected = true;
            this.connectionMethod = 'walletconnect';

            console.log('✅ Connected via WalletConnect:', this.userAddress);
            return this.userAddress;

        } catch (error) {
            console.error('❌ WalletConnect connection failed:', error);
            throw error;
        }
    }

    /**
     * Unified connect method - tries injected first, then WalletConnect
     */
    async connect(preferWalletConnect = false) {
        if (preferWalletConnect || !this.hasInjectedWallet()) {
            return await this.connectWalletConnect();
        } else {
            return await this.connectInjected();
        }
    }

    /**
     * Sign a message for authentication
     */
    async signMessage(message) {
        if (!this.isConnected) throw new Error('Wallet not connected');

        if (this.connectionMethod === 'injected') {
            return await this.signer.signMessage(message);
        } else if (this.connectionMethod === 'walletconnect') {
            // Sign via WalletConnect
            const result = await this._signClient.request({
                topic: this._session.topic,
                chainId: `eip155:${WALLETCONNECT_CONFIG.CHAIN_ID}`,
                request: {
                    method: 'personal_sign',
                    params: [
                        ethers.utils.hexlify(ethers.utils.toUtf8Bytes(message)),
                        this.userAddress
                    ]
                }
            });
            return result;
        }

        throw new Error('Unknown connection method');
    }

    /**
     * Get TAIN Token Balance
     */
    async getTokenBalance() {
        if (!this.contract || !this.userAddress) return '0';
        try {
            const balance = await this.contract.balanceOf(this.userAddress);
            return ethers.utils.formatUnits(balance, TAIN_CONFIG.DECIMALS);
        } catch (error) {
            console.error('Error fetching token balance:', error);
            return '0';
        }
    }

    /**
     * Disconnect wallet
     */
    async disconnect() {
        if (this.connectionMethod === 'walletconnect' && this._signClient && this._session) {
            try {
                await this._signClient.disconnect({
                    topic: this._session.topic,
                    reason: { code: 6000, message: 'User disconnected' }
                });
            } catch (e) {
                console.error('Error disconnecting WalletConnect:', e);
            }
        }

        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contract = null;
        this.isConnected = false;
        this.connectionMethod = null;
        this._signClient = null;
        this._session = null;

        console.log('👋 Wallet disconnected');
    }

    /**
     * Get current connection status
     */
    getStatus() {
        return {
            isConnected: this.isConnected,
            address: this.userAddress,
            method: this.connectionMethod
        };
    }
}

// Export global instance
window.walletConnectManager = new WalletConnectManager();
