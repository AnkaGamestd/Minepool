/**
 * Tournament Client for 16-Player Pool Tournaments
 * Handles API calls, WebSocket events, and UI updates
 */

class TournamentClient {
    constructor() {
        this.socket = null;
        this.currentFilter = 'all';
        this.selectedEntryFee = 100;
        this.tournaments = [];
        this.userCoins = 0;

        this.init();
    }

    async init() {
        await this.loadUserData();
        this.connectSocket();
        this.bindEvents();
        await this.loadTournaments();
    }

    // ==================== USER DATA ====================

    async loadUserData() {
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                this.userCoins = user.coins || 0;
            }

            // Try to get fresh data from server
            const response = await fetch('/api/auth/me', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.user) {
                    this.userCoins = data.user.coins;
                }
            }
        } catch (error) {
            console.error('Failed to load user data:', error);
        }

        this.updateCoinsDisplay();
    }

    updateCoinsDisplay() {
        const coinsEl = document.getElementById('user-coins');
        if (coinsEl) {
            coinsEl.textContent = this.userCoins.toLocaleString();
        }
    }

    // ==================== SOCKET CONNECTION ====================

    connectSocket() {
        this.socket = io();

        this.socket.on('connect', () => {
            console.log('Tournament socket connected');
        });

        this.socket.on('tournament16:player_joined', (data) => {
            this.handlePlayerJoined(data);
        });

        this.socket.on('tournament16:player_left', (data) => {
            this.handlePlayerLeft(data);
        });

        this.socket.on('tournament16:started', (data) => {
            this.handleTournamentStarted(data);
        });

        this.socket.on('tournament16:match_completed', (data) => {
            this.handleMatchCompleted(data);
        });

        this.socket.on('tournament16:finished', (data) => {
            this.handleTournamentFinished(data);
        });
    }

    // ==================== EVENT BINDINGS ====================

    bindEvents() {
        // Tier filter buttons
        document.querySelectorAll('.tier-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.tier-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.dataset.tier;
                this.renderTournaments();
            });
        });

        // Create tournament button
        document.getElementById('create-tournament-btn')?.addEventListener('click', () => {
            this.showCreateModal();
        });

        // Entry tier selection in modal
        document.querySelectorAll('.entry-tier').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.entry-tier').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedEntryFee = parseInt(e.target.dataset.fee);
                this.updatePrizePreview();
            });
        });

        // Modal buttons
        document.getElementById('cancel-create')?.addEventListener('click', () => {
            this.hideCreateModal();
        });

        document.getElementById('confirm-create')?.addEventListener('click', () => {
            this.createTournament();
        });

        // Close modal on background click
        document.getElementById('create-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'create-modal') {
                this.hideCreateModal();
            }
        });
    }

    // ==================== API CALLS ====================

    async loadTournaments() {
        try {
            const response = await fetch('/api/tournaments16');
            const data = await response.json();

            if (data.success) {
                this.tournaments = data.tournaments;
                this.renderTournaments();
            }
        } catch (error) {
            console.error('Failed to load tournaments:', error);
        }
    }

    async createTournament() {
        const nameInput = document.getElementById('tournament-name');
        const name = nameInput?.value?.trim() || '16-Player Pool Tournament';

        try {
            const response = await fetch('/api/tournaments16', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({
                    name,
                    entryFee: this.selectedEntryFee
                })
            });

            const data = await response.json();

            if (data.success) {
                this.hideCreateModal();
                await this.loadTournaments();
                this.showNotification('Tournament created!', 'success');
            } else {
                this.showNotification(data.error || 'Failed to create', 'error');
            }
        } catch (error) {
            console.error('Create tournament error:', error);
            this.showNotification('Network error', 'error');
        }
    }

    async joinTournament(tournamentId) {
        try {
            const response = await fetch(`/api/tournaments16/${tournamentId}/register`, {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Joined! Position: ${data.position}/16`, 'success');

                if (data.tournamentStarted) {
                    // Redirect to bracket view
                    window.location.href = `/tournament-bracket.html?id=${tournamentId}`;
                } else {
                    await this.loadTournaments();
                    await this.loadUserData(); // Refresh coins
                }
            } else {
                this.showNotification(data.error || 'Failed to join', 'error');
            }
        } catch (error) {
            console.error('Join tournament error:', error);
            this.showNotification('Network error', 'error');
        }
    }

    async leaveTournament(tournamentId) {
        try {
            const response = await fetch(`/api/tournaments16/${tournamentId}/unregister`, {
                method: 'POST',
                credentials: 'include'
            });

            const data = await response.json();

            if (data.success) {
                this.showNotification(`Left tournament. Refunded: ${data.refund} coins`, 'success');
                await this.loadTournaments();
                await this.loadUserData();
            } else {
                this.showNotification(data.error || 'Failed to leave', 'error');
            }
        } catch (error) {
            console.error('Leave tournament error:', error);
        }
    }

    // ==================== RENDERING ====================

    renderTournaments() {
        const container = document.getElementById('tournament-list');
        if (!container) return;

        let filtered = this.tournaments;

        if (this.currentFilter !== 'all') {
            const tier = parseInt(this.currentFilter);
            filtered = filtered.filter(t => t.entryFee === tier);
        }

        if (filtered.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="icon">🏆</div>
                    <h3>No Tournaments Found</h3>
                    <p>Create one to get started!</p>
                </div>
            `;
            return;
        }

        container.innerHTML = '';

        filtered.forEach(tournament => {
            container.appendChild(this.createTournamentCard(tournament));
        });
    }

    createTournamentCard(tournament) {
        const card = document.createElement('div');
        card.className = 'tournament-card';
        card.dataset.id = tournament.id;

        const fillPercent = (tournament.currentPlayers / tournament.maxPlayers) * 100;
        const statusClass = tournament.status.toLowerCase().replace('_', '-');
        const isRegistering = tournament.status === 'REGISTERING';
        const canJoin = isRegistering && this.userCoins >= tournament.entryFee;

        card.innerHTML = `
            <div class="card-header">
                <span class="tournament-name">${this.escapeHtml(tournament.name)}</span>
                <span class="entry-fee">${tournament.entryFee} 🪙</span>
            </div>
            <div class="card-body">
                <div class="player-count">
                    <div class="count-bar">
                        <div class="count-fill" style="width: ${fillPercent}%"></div>
                    </div>
                    <span class="count-text">${tournament.currentPlayers}/${tournament.maxPlayers} Players</span>
                </div>
                <div class="prize-info">
                    <span class="label">Prize Pool:</span>
                    <span class="prize-amount">${tournament.prizes?.totalPot?.toLocaleString() || (tournament.entryFee * 16).toLocaleString()} 🪙</span>
                </div>
                <div class="status-badge ${statusClass}">${this.formatStatus(tournament.status)}</div>
            </div>
            <div class="card-footer">
                ${isRegistering
                ? `<button class="btn-join" ${canJoin ? '' : 'disabled'}>${canJoin ? 'Join Tournament' : 'Insufficient Coins'}</button>`
                : `<button class="btn-join btn-view">View Bracket</button>`
            }
            </div>
        `;

        // Add click handlers
        const btn = card.querySelector('.btn-join');
        if (isRegistering && canJoin) {
            btn.addEventListener('click', () => this.joinTournament(tournament.id));
        } else if (!isRegistering) {
            btn.addEventListener('click', () => {
                window.location.href = `/tournament-bracket.html?id=${tournament.id}`;
            });
        }

        return card;
    }

    // ==================== MODAL ====================

    showCreateModal() {
        const modal = document.getElementById('create-modal');
        if (modal) {
            modal.classList.remove('hidden');
            this.updatePrizePreview();
        }
    }

    hideCreateModal() {
        const modal = document.getElementById('create-modal');
        if (modal) {
            modal.classList.add('hidden');
        }
    }

    updatePrizePreview() {
        const totalPot = this.selectedEntryFee * 16;
        const houseFee = Math.floor(totalPot * 0.05);
        const netPool = totalPot - houseFee;
        const winner = Math.floor(netPool * 0.80);
        const runner = Math.floor(netPool * 0.20);

        document.getElementById('preview-pot').textContent = `${totalPot.toLocaleString()} 🪙`;
        document.getElementById('preview-house').textContent = `${houseFee.toLocaleString()} 🪙`;
        document.getElementById('preview-winner').textContent = `${winner.toLocaleString()} 🪙`;
        document.getElementById('preview-runner').textContent = `${runner.toLocaleString()} 🪙`;
    }

    // ==================== SOCKET HANDLERS ====================

    handlePlayerJoined(data) {
        const tournament = this.tournaments.find(t => t.id === data.tournamentId);
        if (tournament) {
            tournament.currentPlayers = data.currentPlayers;
            this.renderTournaments();
        }
    }

    handlePlayerLeft(data) {
        this.loadTournaments();
    }

    handleTournamentStarted(data) {
        this.showNotification('Tournament started! Check your match!', 'success');
        this.loadTournaments();
    }

    handleMatchCompleted(data) {
        console.log('Match completed:', data);
    }

    handleTournamentFinished(data) {
        this.showNotification(`Tournament finished! Winner: ${data.winner.username}`, 'success');
        this.loadTournaments();
        this.loadUserData(); // Refresh coins in case we won
    }

    // ==================== UTILITIES ====================

    formatStatus(status) {
        const statusMap = {
            'REGISTERING': 'Registering',
            'LOCKED': 'Starting...',
            'IN_PROGRESS': 'In Progress',
            'FINISHED': 'Completed'
        };
        return statusMap[status] || status;
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showNotification(message, type = 'info') {
        // Simple notification - can be enhanced
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#00aa55' : type === 'error' ? '#ff4444' : '#0088aa'};
            color: white;
            padding: 15px 30px;
            border-radius: 10px;
            font-family: 'Rajdhani', sans-serif;
            font-weight: 600;
            z-index: 9999;
            animation: slideDown 0.3s ease;
        `;

        document.body.appendChild(notification);

        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.tournamentClient = new TournamentClient();
});
