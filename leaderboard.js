/**
 * Leaderboard UI Component
 * Displays player rankings and handles leaderboard interactions
 */

class LeaderboardUI {
    constructor() {
        this.isOpen = false;
        this.leaderboardData = [];
        this.refreshInterval = null;

        this.init();
    }

    init() {
        this.createUI();
        this.bindEvents();
        this.loadLeaderboard();

        // Auto-refresh every 30 seconds
        this.refreshInterval = setInterval(() => {
            if (this.isOpen) {
                this.loadLeaderboard();
            }
        }, 30000);
    }

    createUI() {
        // Create leaderboard panel
        const panel = document.createElement('div');
        panel.id = 'leaderboard-panel';
        panel.className = 'leaderboard-panel';
        panel.innerHTML = `
            <div class="leaderboard-header">
                <div class="leaderboard-title">
                    <span class="leaderboard-icon">🏆</span>
                    <span>LEADERBOARD</span>
                </div>
                <button class="leaderboard-close" id="leaderboard-close">✕</button>
            </div>
            <div class="leaderboard-content" id="leaderboard-content">
                <div class="leaderboard-loading">Loading...</div>
            </div>
        `;

        // Create toggle button
        const toggle = document.createElement('button');
        toggle.id = 'leaderboard-toggle';
        toggle.className = 'leaderboard-toggle';
        toggle.innerHTML = `
            <span class="leaderboard-icon">🏆</span>
        `;
        toggle.title = 'View Leaderboard';

        // Add to page
        document.body.appendChild(panel);
        document.body.appendChild(toggle);
    }

    bindEvents() {
        const toggle = document.getElementById('leaderboard-toggle');
        const close = document.getElementById('leaderboard-close');

        if (toggle) {
            toggle.addEventListener('click', () => this.toggleLeaderboard());
        }

        if (close) {
            close.addEventListener('click', () => this.closeLeaderboard());
        }
    }

    toggleLeaderboard() {
        this.isOpen = !this.isOpen;
        const panel = document.getElementById('leaderboard-panel');
        if (panel) {
            panel.classList.toggle('open', this.isOpen);
        }

        if (this.isOpen) {
            this.loadLeaderboard();
        }
    }

    openLeaderboard() {
        this.isOpen = true;
        const panel = document.getElementById('leaderboard-panel');
        if (panel) {
            panel.classList.add('open');
        }
        this.loadLeaderboard();
    }

    closeLeaderboard() {
        this.isOpen = false;
        const panel = document.getElementById('leaderboard-panel');
        if (panel) {
            panel.classList.remove('open');
        }
    }

    async loadLeaderboard() {
        try {
            const response = await fetch('/api/leaderboard');
            const data = await response.json();

            if (data.success) {
                this.leaderboardData = data.leaderboard;
                this.renderLeaderboard();
            }
        } catch (error) {
            console.error('Failed to load leaderboard:', error);
            this.renderError();
        }
    }

    renderLeaderboard() {
        const content = document.getElementById('leaderboard-content');
        if (!content) return;

        if (this.leaderboardData.length === 0) {
            content.innerHTML = '<div class="leaderboard-empty">No players yet. Be the first!</div>';
            return;
        }

        const currentUser = window.currentUser?.username;

        content.innerHTML = this.leaderboardData
            .slice(0, 10) // Top 10
            .map((player, index) => {
                const rank = index + 1;
                const isCurrentUser = player.username === currentUser;
                const rankClass = rank === 1 ? 'gold' : rank === 2 ? 'silver' : rank === 3 ? 'bronze' : '';
                const rankEmoji = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;

                return `
                    <div class="leaderboard-item ${isCurrentUser ? 'current-user' : ''} ${rankClass}">
                        <div class="leaderboard-rank">${rankEmoji}</div>
                        <div class="leaderboard-avatar">${player.username.charAt(0).toUpperCase()}</div>
                        <div class="leaderboard-info">
                            <div class="leaderboard-name">${player.username}</div>
                            <div class="leaderboard-stats">
                                <span>🏆 ${player.wins}</span>
                                <span>💰 ${player.coins}</span>
                            </div>
                        </div>
                    </div>
                `;
            })
            .join('');
    }

    renderError() {
        const content = document.getElementById('leaderboard-content');
        if (content) {
            content.innerHTML = '<div class="leaderboard-error">Failed to load leaderboard. Please try again.</div>';
        }
    }

    destroy() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }
    }
}

// Initialize leaderboard when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.leaderboardUI = new LeaderboardUI();
});
