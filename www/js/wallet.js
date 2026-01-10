/**
 * Wallet Manager for TAIN Token Integration
 * Handles wallet connection, network switching, and token interactions.
 * Supports both injected wallets (MetaMask, Trust Wallet) and WalletConnect.
 */

const TAIN_CONFIG = {
    // TAIN Token on BSC Mainnet
    CONTRACT_ADDRESS: '0x3fe59e287f58e5a83443bcfd34dd72f045663e8b',
    CHAIN_ID: 56, // BNB Smart Chain Mainnet
    CHAIN_ID_HEX: '0x38',
    CHAIN_NAME: 'BNB Smart Chain',
    RPC_URL: 'https://bsc-dataseed.binance.org/',
    BLOCK_EXPLORER: 'https://bscscan.com',
    SYMBOL: 'TAIN',
    DECIMALS: 18,
    // Game contract address for deposits
    GAME_CONTRACT_ADDRESS: '0x0fbc316c1Ea82E90526aBeE57EE6C4eC5691F891',
    // House fee on winnings (10%)
    HOUSE_FEE_PERCENT: 10
};

// Minimal ABI for ERC-20 Token (Balance, Transfer, Approve)
const TAIN_ABI = [
    "function balanceOf(address owner) view returns (uint256)",
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)",
    "function transfer(address to, uint amount) returns (bool)",
    "function approve(address spender, uint amount) returns (bool)",
    "function allowance(address owner, address spender) view returns (uint256)"
];

class WalletManager {
    constructor() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contract = null;
        this.isConnected = false;
        this.connectionMethod = null; // 'injected' or 'walletconnect'
    }

    /**
     * Check if an injected wallet is available
     */
    hasInjectedWallet() {
        return typeof window.ethereum !== 'undefined';
    }

    /**
     * Initialize the wallet manager
     * Checks if window.ethereum is available
     */
    init() {
        if (window.ethereum) {
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            console.log('✅ Web3 Provider Initialized');
            return true;
        } else {
            console.warn('⚠️ No crypto wallet found.');
            return false;
        }
    }

    /**
     * Connect to the wallet (injected provider)
     */
    async connect() {
        if (!this.hasInjectedWallet()) {
            throw new Error('No wallet detected. Please install MetaMask or Trust Wallet.');
        }

        try {
            // Request account access
            const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
            this.userAddress = accounts[0];

            // Create provider and signer
            this.provider = new ethers.providers.Web3Provider(window.ethereum);
            this.signer = this.provider.getSigner();
            this.isConnected = true;
            this.connectionMethod = 'injected';

            console.log('👛 Wallet Connected:', this.userAddress);

            // Ensure we are on the correct network
            await this.checkNetwork();

            // Initialize token contract
            this.contract = new ethers.Contract(
                TAIN_CONFIG.CONTRACT_ADDRESS,
                TAIN_ABI,
                this.signer
            );

            return this.userAddress;

        } catch (error) {
            console.error('❌ Wallet Connection Failed:', error);
            throw error;
        }
    }

    /**
     * Check and switch to BNB Chain if necessary
     */
    async checkNetwork() {
        if (!window.ethereum) return;

        const network = await this.provider.getNetwork();
        if (network.chainId !== TAIN_CONFIG.CHAIN_ID) {
            try {
                await window.ethereum.request({
                    method: 'wallet_switchEthereumChain',
                    params: [{ chainId: TAIN_CONFIG.CHAIN_ID_HEX }],
                });
                // Refresh provider after network switch
                this.provider = new ethers.providers.Web3Provider(window.ethereum);
                this.signer = this.provider.getSigner();
            } catch (switchError) {
                // This error code indicates that the chain has not been added to MetaMask.
                if (switchError.code === 4902) {
                    try {
                        await window.ethereum.request({
                            method: 'wallet_addEthereumChain',
                            params: [{
                                chainId: TAIN_CONFIG.CHAIN_ID_HEX,
                                chainName: TAIN_CONFIG.CHAIN_NAME,
                                nativeCurrency: {
                                    name: 'BNB',
                                    symbol: 'BNB',
                                    decimals: 18
                                },
                                rpcUrls: [TAIN_CONFIG.RPC_URL],
                                blockExplorerUrls: [TAIN_CONFIG.BLOCK_EXPLORER]
                            }],
                        });
                        // Refresh provider after adding network
                        this.provider = new ethers.providers.Web3Provider(window.ethereum);
                        this.signer = this.provider.getSigner();
                    } catch (addError) {
                        console.error('Failed to add network:', addError);
                        throw addError;
                    }
                } else {
                    console.error('Failed to switch network:', switchError);
                    throw switchError;
                }
            }
        }
    }

    /**
     * Sign a message for authentication
     * @param {string} message - Message to sign
     */
    async signMessage(message) {
        if (!this.signer) throw new Error('Wallet not connected');
        return await this.signer.signMessage(message);
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
     * Deposit TAIN tokens to game contract
     * @param {string} amount - Amount to deposit
     */
    async deposit(amount) {
        if (!this.contract) throw new Error('Wallet not connected');

        try {
            // Check if game contract address is set
            if (TAIN_CONFIG.GAME_CONTRACT_ADDRESS === '0x0000000000000000000000000000000000000000') {
                console.warn('⚠️ Game contract address not set. Mocking deposit for testing.');
                await new Promise(resolve => setTimeout(resolve, 1000));
                return { success: true, mock: true };
            }

            const amountWei = ethers.utils.parseUnits(amount.toString(), TAIN_CONFIG.DECIMALS);

            // Transfer TAIN to game contract
            const tx = await this.contract.transfer(TAIN_CONFIG.GAME_CONTRACT_ADDRESS, amountWei);
            console.log('💰 Deposit transaction sent:', tx.hash);
            await tx.wait();
            console.log('✅ Deposit confirmed');

            return { success: true, txHash: tx.hash };
        } catch (error) {
            console.error('❌ Deposit failed:', error);
            throw error;
        }
    }

    /**
     * Withdraw TAIN tokens from game
     * @param {string} amount - Amount to withdraw
     */
    async withdraw(amount) {
        // This requires backend interaction
        console.log('Withdrawal requested:', amount);
        // In a real implementation, this would call an API endpoint
        await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        return true;
    }

    /**
     * Disconnect wallet
     */
    disconnect() {
        this.provider = null;
        this.signer = null;
        this.userAddress = null;
        this.contract = null;
        this.isConnected = false;
        this.connectionMethod = null;
        console.log('👋 Wallet disconnected');
    }

    /**
     * Get connection status
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
window.walletManager = new WalletManager();
window.TAIN_CONFIG = TAIN_CONFIG;
