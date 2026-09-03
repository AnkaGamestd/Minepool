// ============================================
// UNIFIED STAKE CONFIGURATION
// All stake tiers used across the game - USING IN-GAME COINS
// ============================================
const STAKE_CONFIG = {
    // Currency configuration
    currency: 'COINS',
    currencyIcon: '🪙',
    houseFeePercent: 10, // 10% house fee on winnings

    tiers: [
        { id: 'bronze', name: 'Bronze', wager: 50, icon: '🥉', color: '#cd7f32' },
        { id: 'silver', name: 'Silver', wager: 100, icon: '🥈', color: '#c0c0c0' },
        { id: 'gold', name: 'Gold', wager: 250, icon: '🥇', color: '#ffd700' },
        { id: 'diamond', name: 'Diamond', wager: 500, icon: '💎', color: '#b366ff' },
        { id: 'ruby', name: 'Ruby', wager: 1000, icon: '❤️‍🔥', color: '#ff4757' },
        { id: 'crown', name: 'Crown', wager: 2500, icon: '👑', color: '#ffd700' }
    ],

    getByWager: function (wager) {
        return this.tiers.find(t => t.wager === wager) || this.tiers[0];
    },

    getById: function (id) {
        return this.tiers.find(t => t.id === id) || this.tiers[0];
    },

    getDefaultTier: function () {
        return this.tiers[1]; // Silver 100 as default
    },

    // Calculate winnings after house fee
    calculateWinnings: function (stake) {
        const pot = stake * 2;
        const fee = pot * (this.houseFeePercent / 100);
        return pot - fee;
    },

    // Format amount with currency symbol
    formatAmount: function (amount) {
        return `${parseFloat(amount).toFixed(2)} ${this.currency}`;
    }
};

// Make available globally
if (typeof window !== 'undefined') {
    window.STAKE_CONFIG = STAKE_CONFIG;
}

if (typeof module !== 'undefined') {
    module.exports = STAKE_CONFIG;
}
