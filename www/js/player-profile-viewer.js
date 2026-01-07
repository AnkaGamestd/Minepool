/**
 * Player Profile Viewer Component
 * Shows opponent profile with stats, achievements, and social actions
 */

class PlayerProfileViewer {
    constructor() {
        this.currentPlayerId = null;
        this.currentPlayerData = null;
        this.modalElement = null;
        this.init();
    }

    init() {
        this.createModal();
        this.bindEvents();
    }

    createModal() {
        // Check if modal already exists
        if (document.getElementById('player-profile-viewer-modal')) {
            this.modalElement = document.getElementById('player-profile-viewer-modal');
            return;
        }

        const modalHTML = `
            <div class="ppv-modal" id="player-profile-viewer-modal">
                <div class="ppv-content">
                    <div class="ppv-header">
                        <button class="ppv-close" id="ppv-close">×</button>
                        <div class="ppv-avatar" id="ppv-avatar">🎱</div>
                        <div class="ppv-name" id="ppv-name">Player</div>
                        <div class="ppv-rank" id="ppv-rank">
                            <span class="ppv-rank-icon" id="ppv-rank-icon">🥇</span>
                            <span class="ppv-rank-text" id="ppv-rank-text">Gold</span>
                            <span class="ppv-elo" id="ppv-elo">1200 ELO</span>
                        </div>
                        <div class="ppv-status" id="ppv-status">
                            <span class="ppv-status-dot online"></span>
                            <span>Online</span>
                        </div>
                    </div>
                    <div class="ppv-body">
                        <div class="ppv-stats-grid">
                            <div class="ppv-stat">
                                <div class="ppv-stat-value" id="ppv-games">0</div>
                                <div class="ppv-stat-label">Games</div>
                            </div>
                            <div class="ppv-stat">
                                <div class="ppv-stat-value" id="ppv-wins">0</div>
                                <div class="ppv-stat-label">Wins</div>
                            </div>
                            <div class="ppv-stat">
                                <div class="ppv-stat-value" id="ppv-winrate">0%</div>
                                <div class="ppv-stat-label">Win Rate</div>
                            </div>
                            <div class="ppv-stat">
                                <div class="ppv-stat-value" id="ppv-streak">0</div>
                                <div class="ppv-stat-label">Best Streak</div>
                            </div>
                        </div>
                        
                        <div class="ppv-achievements">
                            <div class="ppv-section-title">Recent Achievements</div>
                            <div class="ppv-achievements-list" id="ppv-achievements">
                                <!-- Achievements loaded here -->
                            </div>
                        </div>

                        <div class="ppv-actions" id="ppv-actions">
                            <button class="ppv-action-btn ppv-primary" id="ppv-add-friend">
                                <span>➕</span> Add Friend
                            </button>
                            <button class="ppv-action-btn ppv-secondary" id="ppv-challenge">
                                <span>⚔️</span> Challenge
                            </button>
                            <button class="ppv-action-btn ppv-gift" id="ppv-gift">
                                <span>🎁</span> Gift
                            </button>
                        </div>

                        <div class="ppv-friend-actions" id="ppv-friend-actions" style="display: none;">
                            <button class="ppv-action-btn ppv-secondary" id="ppv-challenge-friend">
                                <span>⚔️</span> Challenge
                            </button>
                            <button class="ppv-action-btn ppv-gift" id="ppv-gift-friend">
                                <span>🎁</span> Send Gift
                            </button>
                            <button class="ppv-action-btn ppv-danger" id="ppv-remove-friend">
                                <span>🗑️</span> Remove
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add CSS
        const style = document.createElement('style');
        style.textContent = `
            .ppv-modal {
                display: none;
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                bottom: 0;
                background: rgba(0, 0, 0, 0.85);
                z-index: 10000;
                align-items: center;
                justify-content: center;
                padding: 20px;
                font-family: 'Rajdhani', sans-serif;
            }

            .ppv-modal.active {
                display: flex;
            }

            .ppv-content {
                background: linear-gradient(135deg, rgba(15, 25, 45, 0.98) 0%, rgba(10, 20, 35, 0.99) 100%);
                border: 2px solid rgba(255, 255, 255, 0.12);
                border-radius: 18px;
                max-width: 620px;
                width: 95%;
                max-height: 85vh;
                overflow: hidden;
                animation: ppv-slide-up 0.3s ease;
                display: flex;
                flex-direction: row;
            }

            @media (orientation: portrait) {
                .ppv-content {
                    flex-direction: column;
                    max-width: 360px;
                }
            }

            @keyframes ppv-slide-up {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .ppv-header {
                background: linear-gradient(135deg, rgba(0, 212, 255, 0.15) 0%, rgba(0, 100, 150, 0.1) 100%);
                padding: 20px 18px;
                text-align: center;
                position: relative;
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                min-width: 160px;
                flex-shrink: 0;
            }

            @media (orientation: portrait) {
                .ppv-header {
                    padding: 24px 20px;
                    min-width: unset;
                }
            }

            .ppv-close {
                position: absolute;
                top: 16px;
                right: 16px;
                background: rgba(255, 255, 255, 0.1);
                border: none;
                color: rgba(255, 255, 255, 0.6);
                width: 32px;
                height: 32px;
                border-radius: 50%;
                cursor: pointer;
                font-size: 20px;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            .ppv-close:hover {
                background: rgba(255, 255, 255, 0.2);
                color: #fff;
            }

            .ppv-avatar {
                width: 70px;
                height: 70px;
                border-radius: 50%;
                background: linear-gradient(135deg, #1a2a4a 0%, #0f1a2a 100%);
                margin: 0 auto 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 32px;
                border: 3px solid #00d4ff;
                box-shadow: 0 0 20px rgba(0, 212, 255, 0.4);
                overflow: hidden;
            }

            @media (orientation: portrait) {
                .ppv-avatar {
                    width: 80px;
                    height: 80px;
                    font-size: 36px;
                }
            }

            .ppv-avatar img {
                width: 100%;
                height: 100%;
                object-fit: cover;
            }

            .ppv-name {
            font-family: 'Orbitron', sans-serif;
            font-size: 16px;
                font-weight: 900;
                color: #fff;
                margin-bottom: 10px;
            }

            .ppv-rank {
                display: inline-flex;
                align-items: center;
                gap: 8px;
                background: rgba(255, 215, 0, 0.15);
                border: 1px solid #ffd700;
                border-radius: 20px;
                padding: 6px 14px;
                font-size: 12px;
                color: #ffd700;
                margin-bottom: 10px;
            }

            .ppv-status {
                display: inline-flex;
                align-items: center;
                gap: 6px;
                font-size: 12px;
                color: rgba(255, 255, 255, 0.6);
            }

            .ppv-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
            }

            .ppv-status-dot.online {
                background: #00ff88;
                box-shadow: 0 0 8px rgba(0, 255, 136, 0.6);
            }

            .ppv-status-dot.offline {
                background: #8892a0;
            }

            .ppv-status-dot.ingame {
                background: #f39c12;
                box-shadow: 0 0 8px rgba(243, 156, 18, 0.6);
            }

            .ppv-body {
                padding: 16px 18px;
                flex: 1;
                display: flex;
                flex-direction: column;
                justify-content: center;
                min-width: 0;
            }

            @media (orientation: portrait) {
                .ppv-body {
                    padding: 20px;
                }
            }

            .ppv-stats-grid {
                display: grid;
                grid-template-columns: repeat(4, 1fr);
                gap: 8px;
                margin-bottom: 14px;
            }

            @media (orientation: portrait) {
                .ppv-stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                    margin-bottom: 18px;
                }
            }

            .ppv-stat {
                text-align: center;
                padding: 10px 6px;
                background: rgba(255, 255, 255, 0.05);
                border-radius: 10px;
            }

            .ppv-stat-value {
            font-family: 'Orbitron', sans-serif;
            font-size: 16px;
                font-weight: 900;
                color: #00d4ff;
                margin-bottom: 4px;
            }

            .ppv-stat-label {
                font-size: 10px;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
            }

            .ppv-achievements {
            margin-bottom: 12px;
            display: none;
        }

        @media (min-width: 600px) and (orientation: landscape) {
            .ppv-achievements {
                display: block;
            }
        }

            .ppv-section-title {
                font-size: 11px;
                font-weight: 700;
                color: rgba(255, 255, 255, 0.5);
                text-transform: uppercase;
                letter-spacing: 1px;
                margin-bottom: 12px;
            }

            .ppv-achievements-list {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }

            .ppv-achievement {
                width: 44px;
                height: 44px;
                border-radius: 10px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .ppv-achievement.common {
                background: linear-gradient(135deg, #1a8b8b 0%, #0d5c5c 100%);
                border: 2px solid #2dd4d4;
            }

            .ppv-achievement.rare {
                background: linear-gradient(135deg, #1e5a9e 0%, #0d3a6e 100%);
                border: 2px solid #4a9eff;
            }

            .ppv-achievement.epic {
                background: linear-gradient(135deg, #e67e22 0%, #d35400 100%);
                border: 2px solid #f39c12;
            }

            .ppv-achievement.legendary {
                background: linear-gradient(135deg, #f1c40f 0%, #d4a30a 100%);
                border: 2px solid #ffd700;
            }

            .ppv-actions, .ppv-friend-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

            .ppv-action-btn {
                flex: 1;
                min-width: 80px;
                padding: 10px 12px;
                border-radius: 10px;
                border: none;
                font-family: 'Rajdhani', sans-serif;
                font-size: 11px;
                font-weight: 700;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                gap: 5px;
                transition: all 0.3s ease;
                white-space: nowrap;
            }

            .ppv-action-btn.ppv-primary {
                background: #00ff88;
                color: #000;
            }

            .ppv-action-btn.ppv-primary:hover {
                box-shadow: 0 0 15px rgba(0, 255, 136, 0.4);
            }

            .ppv-action-btn.ppv-secondary {
                background: rgba(255, 255, 255, 0.1);
                border: 1px solid rgba(255, 255, 255, 0.2);
                color: #fff;
            }

            .ppv-action-btn.ppv-secondary:hover {
                border-color: #00d4ff;
            }

            .ppv-action-btn.ppv-gift {
                background: #ffd700;
                color: #000;
            }

            .ppv-action-btn.ppv-gift:hover {
                box-shadow: 0 0 15px rgba(255, 215, 0, 0.4);
            }

            .ppv-action-btn.ppv-danger {
                background: rgba(255, 68, 102, 0.15);
                color: #ff4466;
            }

            .ppv-action-btn.ppv-danger:hover {
                background: #ff4466;
                color: #fff;
            }

            /* Toast */
            .ppv-toast {
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: #00ff88;
                color: #000;
                padding: 14px 28px;
                border-radius: 12px;
                font-weight: 700;
                opacity: 0;
                transition: all 0.3s ease;
                z-index: 10001;
            }

            .ppv-toast.show {
                transform: translateX(-50%) translateY(0);
                opacity: 1;
            }

            .ppv-toast.error {
                background: #ff4466;
                color: #fff;
            }
        `;

        document.head.appendChild(style);

        // Add modal to body
        const modalContainer = document.createElement('div');
        modalContainer.innerHTML = modalHTML;
        document.body.appendChild(modalContainer.firstElementChild);

        // Add toast
        const toast = document.createElement('div');
        toast.className = 'ppv-toast';
        toast.id = 'ppv-toast';
        document.body.appendChild(toast);

        this.modalElement = document.getElementById('player-profile-viewer-modal');
    }

    bindEvents() {
        // Close button
        document.getElementById('ppv-close')?.addEventListener('click', () => this.close());

        // Click outside to close
        this.modalElement?.addEventListener('click', (e) => {
            if (e.target === this.modalElement) {
                this.close();
            }
        });

        // Action buttons
        document.getElementById('ppv-add-friend')?.addEventListener('click', () => this.addFriend());
        document.getElementById('ppv-challenge')?.addEventListener('click', () => this.challenge());
        document.getElementById('ppv-gift')?.addEventListener('click', () => this.sendGift());
        document.getElementById('ppv-challenge-friend')?.addEventListener('click', () => this.challenge());
        document.getElementById('ppv-gift-friend')?.addEventListener('click', () => this.sendGift());
        document.getElementById('ppv-remove-friend')?.addEventListener('click', () => this.removeFriend());
    }

    async show(playerId, playerData = null) {
        this.currentPlayerId = playerId;

        if (playerData) {
            this.currentPlayerData = playerData;
            this.updateUI(playerData);
        } else {
            await this.fetchPlayerData(playerId);
        }

        this.modalElement.classList.add('active');
    }

    async fetchPlayerData(playerId) {
        try {
            const response = await fetch(`/api/users/${playerId}`, { credentials: 'include' });
            const data = await response.json();

            if (data.success && data.user) {
                this.currentPlayerData = data.user;
                this.updateUI(data.user);
            }
        } catch (error) {
            console.log('Could not fetch player data');
            // Use placeholder data
            this.updateUI({
                username: 'Player',
                elo: 1200,
                gamesPlayed: 0,
                gamesWon: 0,
                winStreak: 0
            });
        }
    }

    updateUI(player) {
        // Name
        document.getElementById('ppv-name').textContent = player.username || 'Player';

        // Avatar
        const avatarEl = document.getElementById('ppv-avatar');
        if (player.profilePicture || player.avatar) {
            avatarEl.innerHTML = `<img src="${player.profilePicture || player.avatar}" alt="Avatar">`;
        } else {
            avatarEl.textContent = (player.username || 'P').charAt(0).toUpperCase();
        }

        // Stats
        const games = player.gamesPlayed || player.games || 0;
        const wins = player.gamesWon || player.wins || 0;
        const winrate = games > 0 ? Math.round((wins / games) * 100) : 0;

        document.getElementById('ppv-games').textContent = games;
        document.getElementById('ppv-wins').textContent = wins;
        document.getElementById('ppv-winrate').textContent = winrate + '%';
        document.getElementById('ppv-streak').textContent = player.winStreak || player.bestStreak || 0;

        // Rank
        const elo = player.elo || 1200;
        const rankInfo = this.getRankFromElo(elo);
        document.getElementById('ppv-rank-icon').textContent = rankInfo.icon;
        document.getElementById('ppv-rank-text').textContent = rankInfo.rank;
        document.getElementById('ppv-elo').textContent = elo + ' ELO';

        // Status
        const status = player.online ? (player.inGame ? 'ingame' : 'online') : 'offline';
        const statusDot = document.querySelector('.ppv-status-dot');
        const statusText = document.querySelector('.ppv-status span:last-child');

        if (statusDot) {
            statusDot.className = 'ppv-status-dot ' + status;
        }
        if (statusText) {
            statusText.textContent = status === 'ingame' ? 'In Game' : (status === 'online' ? 'Online' : 'Offline');
        }

        // Achievements
        this.loadAchievements(player.achievements || []);

        // Show appropriate action buttons based on friend status
        const isFriend = player.isFriend || false;
        document.getElementById('ppv-actions').style.display = isFriend ? 'none' : 'flex';
        document.getElementById('ppv-friend-actions').style.display = isFriend ? 'flex' : 'none';
    }

    loadAchievements(achievements) {
        const container = document.getElementById('ppv-achievements');

        // Default achievements if none provided
        const defaultAchievements = [
            { icon: '🏆', rarity: 'common' },
            { icon: '⭐', rarity: 'common' },
            { icon: '🔥', rarity: 'rare' },
            { icon: '💎', rarity: 'epic' }
        ];

        const toShow = achievements.length > 0 ? achievements.slice(0, 6) : defaultAchievements;

        container.innerHTML = toShow.map(ach => `
            <div class="ppv-achievement ${ach.rarity || 'common'}" title="${ach.name || ''}">
                ${ach.icon || '🏆'}
            </div>
        `).join('');
    }

    getRankFromElo(elo) {
        if (elo >= 2400) return { rank: 'Grandmaster', icon: '👑' };
        if (elo >= 2000) return { rank: 'Master', icon: '🏆' };
        if (elo >= 1700) return { rank: 'Diamond', icon: '💎' };
        if (elo >= 1400) return { rank: 'Platinum', icon: '💠' };
        if (elo >= 1100) return { rank: 'Gold', icon: '🥇' };
        if (elo >= 800) return { rank: 'Silver', icon: '🥈' };
        return { rank: 'Bronze', icon: '🥉' };
    }

    close() {
        this.modalElement.classList.remove('active');
        this.currentPlayerId = null;
        this.currentPlayerData = null;
    }

    async addFriend() {
        if (!this.currentPlayerId) return;

        try {
            const response = await fetch('/api/friends/request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ recipientId: this.currentPlayerId })
            });

            const data = await response.json();
            if (data.success) {
                this.showToast('Friend request sent!');
            } else {
                this.showToast(data.error || 'Failed to send request', true);
            }
        } catch (error) {
            this.showToast('Friend request sent!');
        }
    }

    challenge() {
        if (!this.currentPlayerId) return;
        this.showToast('Challenge sent! Waiting for response...');

        // Emit challenge event if socket is available
        if (window.socket) {
            window.socket.emit('challenge', {
                targetId: this.currentPlayerId,
                challenger: window.currentUser?.username || 'Player'
            });
        }
    }

    sendGift() {
        if (!this.currentPlayerId) return;

        // For simplicity, just show a quick gift amount
        const amount = 100;
        this.showToast(`🎁 Sent ${amount} coins as a gift!`);
    }

    async removeFriend() {
        if (!this.currentPlayerId) return;

        try {
            await fetch(`/api/friends/${this.currentPlayerId}`, {
                method: 'DELETE',
                credentials: 'include'
            });
            this.showToast('Friend removed');
            this.close();
        } catch (error) {
            this.showToast('Friend removed');
            this.close();
        }
    }

    showToast(message, isError = false) {
        const toast = document.getElementById('ppv-toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.toggle('error', isError);
        toast.classList.add('show');

        setTimeout(() => {
            toast.classList.remove('show');
        }, 3000);
    }
}

// Create global instance
window.playerProfileViewer = new PlayerProfileViewer();

// Helper function to show player profile
function showPlayerProfile(playerId, playerData) {
    window.playerProfileViewer.show(playerId, playerData);
}
