/**
 * 8-Ball Pool Admin Panel JavaScript
 */

class AdminPanel {
    constructor() {
        this.token = localStorage.getItem('admin_token');
        this.user = JSON.parse(localStorage.getItem('admin_user') || 'null');
        this.apiBase = '/api/admin';
        this.currentPage = 'overview';

        this.init();
    }

    init() {
        if (this.token && this.user) {
            this.showDashboard();
            this.loadCurrentPage();
        } else {
            this.showLogin();
        }

        this.setupEventListeners();
    }

    setupEventListeners() {
        // Login form
        document.getElementById('login-form').addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleLogin();
        });

        // Logout
        document.getElementById('logout-btn').addEventListener('click', () => {
            this.handleLogout();
        });

        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const page = item.dataset.page;
                this.navigateTo(page);
            });
        });

        // Refresh button
        document.getElementById('refresh-btn').addEventListener('click', () => {
            this.loadCurrentPage();
        });

        // User search
        document.getElementById('user-search').addEventListener('input', (e) => {
            this.searchUsers(e.target.value);
        });

        // User filter
        document.getElementById('user-filter').addEventListener('change', (e) => {
            this.filterUsers(e.target.value);
        });

        // Report filter
        document.getElementById('report-filter').addEventListener('change', (e) => {
            this.filterReports(e.target.value);
        });

        // Tabs
        document.querySelectorAll('.tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabId = tab.dataset.tab;
                this.switchTab(tabId);
            });
        });

        // Settings buttons
        document.getElementById('save-game-settings').addEventListener('click', () => {
            this.saveGameSettings();
        });

        document.getElementById('save-features').addEventListener('click', () => {
            this.saveFeatures();
        });

        document.getElementById('save-economy').addEventListener('click', () => {
            this.saveEconomy();
        });

        // Physics settings
        document.getElementById('save-physics-settings').addEventListener('click', () => {
            this.savePhysicsSettings();
        });


        // Message filters
        const msgTypeFilter = document.getElementById('msg-type-filter');
        const msgStatusFilter = document.getElementById('msg-status-filter');

        if (msgTypeFilter) {
            msgTypeFilter.addEventListener('change', () => {
                this.loadMessages(msgTypeFilter.value, msgStatusFilter.value);
            });
        }

        if (msgStatusFilter) {
            msgStatusFilter.addEventListener('change', () => {
                this.loadMessages(msgTypeFilter.value, msgStatusFilter.value);
            });
        }

        // Modal close
        document.querySelector('.modal-close').addEventListener('click', () => {
            this.closeModal();
        });
    }

    // API Helper
    async api(endpoint, method = 'GET', data = null) {
        const options = {
            method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (this.token) {
            options.headers['Authorization'] = `Bearer ${this.token}`;
        }

        if (data) {
            options.body = JSON.stringify(data);
        }

        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, options);
            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'API Error');
            }

            return result;
        } catch (error) {
            console.error('API Error:', error);
            if (error.message.includes('token')) {
                this.handleLogout();
            }
            throw error;
        }
    }

    // Authentication
    async handleLogin() {
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        try {
            const result = await this.api('/auth/login', 'POST', { username, password });

            if (result.success) {
                this.token = result.token;
                this.user = result.user;
                localStorage.setItem('admin_token', result.token);
                localStorage.setItem('admin_user', JSON.stringify(result.user));

                this.showDashboard();
                this.loadCurrentPage();
                this.showToast('Login successful!', 'success');
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    }

    handleLogout() {
        this.token = null;
        this.user = null;
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        this.showLogin();
        this.showToast('Logged out successfully', 'success');
    }

    showLogin() {
        document.getElementById('login-screen').classList.remove('hidden');
        document.getElementById('dashboard').classList.add('hidden');
    }

    showDashboard() {
        document.getElementById('login-screen').classList.add('hidden');
        document.getElementById('dashboard').classList.remove('hidden');
        document.getElementById('admin-name').textContent = this.user?.username || 'Admin';
    }

    // Navigation
    navigateTo(page) {
        this.currentPage = page;

        // Update nav
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
            if (item.dataset.page === page) {
                item.classList.add('active');
            }
        });

        // Update page title
        const titles = {
            overview: 'Dashboard',
            users: 'User Management',
            games: 'Game Management',
            moderation: 'Moderation',
            analytics: 'Analytics',
            settings: 'Settings'
        };
        document.getElementById('page-title').textContent = titles[page] || 'Dashboard';

        // Show page
        document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
        document.getElementById(`page-${page}`).classList.add('active');

        // Load page data
        this.loadCurrentPage();
    }

    loadCurrentPage() {
        switch (this.currentPage) {
            case 'overview':
                this.loadOverview();
                break;
            case 'users':
                this.loadUsers();
                break;
            case 'games':
                this.loadGames();
                break;
            case 'moderation':
                this.loadModeration();
                break;
            case 'analytics':
                this.loadAnalytics();
                break;
            case 'settings':
                this.loadSettings();
                break;
            case 'messages':
                this.loadMessages();
                break;
        }
    }

    // Overview Page
    async loadOverview() {
        try {
            // Load stats
            const [analytics, games, userStats] = await Promise.all([
                this.api('/analytics/overview'),
                this.api('/games/live'),
                this.api('/users/stats')
            ]);

            // Update stat cards
            document.getElementById('stat-total-users').textContent =
                this.formatNumber(userStats.stats.totalUsers);
            document.getElementById('stat-online-users').textContent =
                this.formatNumber(analytics.overview.today.activeUsers);
            document.getElementById('stat-live-games').textContent =
                games.count;
            document.getElementById('stat-revenue').textContent =
                `$${analytics.overview.today.revenue.toFixed(2)}`;

            // Update live games table
            document.getElementById('live-count').textContent = games.count;
            const liveTable = document.getElementById('live-games-table');

            if (games.games.length === 0) {
                liveTable.innerHTML = '<tr><td colspan="5" class="loading">No live games</td></tr>';
            } else {
                liveTable.innerHTML = games.games.map(game => {
                    const duration = Math.floor((Date.now() - new Date(game.startedAt)) / 1000);
                    return `
                        <tr>
                            <td>${game.id}</td>
                            <td>${game.player1.username}</td>
                            <td>${game.player2.username}</td>
                            <td>${game.player1.score} - ${game.player2.score}</td>
                            <td>${this.formatDuration(duration)}</td>
                        </tr>
                    `;
                }).join('');
            }

            // Update activity list
            this.loadActivityList();

        } catch (error) {
            console.error('Failed to load overview:', error);
        }
    }

    async loadActivityList() {
        try {
            const result = await this.api('/settings/activity');
            const list = document.getElementById('activity-list');

            if (result.logs.length === 0) {
                list.innerHTML = '<li>No recent activity</li>';
            } else {
                list.innerHTML = result.logs.slice(0, 10).map(log => {
                    const icon = this.getActivityIcon(log.action);
                    const time = this.formatTimeAgo(new Date(log.timestamp));
                    return `<li>${icon} ${log.action.replace(/_/g, ' ')} - ${time}</li>`;
                }).join('');
            }
        } catch (error) {
            document.getElementById('activity-list').innerHTML = '<li>Failed to load activity</li>';
        }
    }

    // Users Page
    async loadUsers(search = '', status = 'all') {
        try {
            let endpoint = `/users?limit=50`;
            if (search) endpoint += `&search=${encodeURIComponent(search)}`;
            if (status !== 'all') endpoint += `&status=${status}`;

            const result = await this.api(endpoint);
            const table = document.getElementById('users-table');

            if (result.users.length === 0) {
                table.innerHTML = '<tr><td colspan="8" class="loading">No users found</td></tr>';
            } else {
                table.innerHTML = result.users.map(user => {
                    const winRate = user.gamesPlayed > 0
                        ? Math.round((user.wins / user.gamesPlayed) * 100)
                        : 0;
                    return `
                        <tr>
                            <td>${user.id}</td>
                            <td>${user.username}</td>
                            <td>${user.email}</td>
                            <td><span class="status ${user.status}">${user.status}</span></td>
                            <td>${user.elo}</td>
                            <td>${user.gamesPlayed}</td>
                            <td>${winRate}%</td>
                            <td>
                                <button class="btn-action" onclick="admin.viewUser(${user.id})">View</button>
                                ${user.status === 'banned'
                            ? `<button class="btn-action success" onclick="admin.unbanUser(${user.id})">Unban</button>`
                            : `<button class="btn-action danger" onclick="admin.banUser(${user.id}, '${user.username}')">Ban</button>`
                        }
                            </td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to load users:', error);
        }
    }

    searchUsers(query) {
        clearTimeout(this.searchTimeout);
        this.searchTimeout = setTimeout(() => {
            const status = document.getElementById('user-filter').value;
            this.loadUsers(query, status);
        }, 300);
    }

    filterUsers(status) {
        const search = document.getElementById('user-search').value;
        this.loadUsers(search, status);
    }

    async viewUser(id) {
        try {
            const result = await this.api(`/users/${id}`);
            const user = result.user;

            document.getElementById('modal-title').textContent = `User: ${user.username}`;
            document.getElementById('modal-body').innerHTML = `
                <div class="user-details">
                    <p><strong>ID:</strong> ${user.id}</p>
                    <p><strong>Email:</strong> ${user.email}</p>
                    <p><strong>Status:</strong> <span class="status ${user.status}">${user.status}</span></p>
                    <p><strong>ELO Rating:</strong> ${user.elo}</p>
                    <p><strong>Games Played:</strong> ${user.gamesPlayed}</p>
                    <p><strong>Wins:</strong> ${user.wins}</p>
                    <p><strong>Losses:</strong> ${user.losses}</p>
                    <p><strong>Win Rate:</strong> ${user.winRate}%</p>
                    <p><strong>Coins:</strong> ${user.coins}</p>
                    <p><strong>Joined:</strong> ${new Date(user.createdAt).toLocaleDateString()}</p>
                </div>
            `;

            this.openModal();
        } catch (error) {
            this.showToast('Failed to load user details', 'error');
        }
    }

    async banUser(id, username) {
        const reason = prompt(`Enter ban reason for ${username}:`);
        if (!reason) return;

        try {
            await this.api(`/users/${id}/ban`, 'POST', { reason, type: 'permanent' });
            this.showToast(`${username} has been banned`, 'success');
            this.loadUsers();
        } catch (error) {
            this.showToast('Failed to ban user', 'error');
        }
    }

    async unbanUser(id) {
        try {
            await this.api(`/users/${id}/unban`, 'POST');
            this.showToast('User has been unbanned', 'success');
            this.loadUsers();
        } catch (error) {
            this.showToast('Failed to unban user', 'error');
        }
    }

    // Games Page
    async loadGames() {
        try {
            const [live, history] = await Promise.all([
                this.api('/games/live'),
                this.api('/games/history')
            ]);

            // Live games
            const liveTable = document.getElementById('games-live-table');
            if (live.games.length === 0) {
                liveTable.innerHTML = '<tr><td colspan="7" class="loading">No live games</td></tr>';
            } else {
                liveTable.innerHTML = live.games.map(game => {
                    const duration = Math.floor((Date.now() - new Date(game.startedAt)) / 1000);
                    return `
                        <tr>
                            <td>${game.id}</td>
                            <td>${game.player1.username}</td>
                            <td>${game.player2.username}</td>
                            <td>${game.player1.score} - ${game.player2.score}</td>
                            <td>${game.bet} coins</td>
                            <td>${this.formatDuration(duration)}</td>
                            <td>
                                <button class="btn-action danger" onclick="admin.endGame('${game.id}')">End</button>
                            </td>
                        </tr>
                    `;
                }).join('');
            }

            // History
            const historyTable = document.getElementById('games-history-table');
            if (history.games.length === 0) {
                historyTable.innerHTML = '<tr><td colspan="7" class="loading">No game history</td></tr>';
            } else {
                historyTable.innerHTML = history.games.map(game => {
                    const winner = game.winner === game.player1.id ? game.player1.username : game.player2.username;
                    return `
                        <tr>
                            <td>${game.id}</td>
                            <td>${game.player1.username}</td>
                            <td>${game.player2.username}</td>
                            <td>${winner}</td>
                            <td>${game.score}</td>
                            <td>${this.formatDuration(game.duration)}</td>
                            <td>${new Date(game.playedAt).toLocaleString()}</td>
                        </tr>
                    `;
                }).join('');
            }
        } catch (error) {
            console.error('Failed to load games:', error);
        }
    }

    async endGame(gameId) {
        if (!confirm(`Are you sure you want to end game ${gameId}?`)) return;

        try {
            await this.api(`/games/${gameId}/end`, 'POST', { reason: 'Ended by admin' });
            this.showToast('Game ended successfully', 'success');
            this.loadGames();
        } catch (error) {
            this.showToast('Failed to end game', 'error');
        }
    }

    switchTab(tabId) {
        // Update tab buttons
        document.querySelectorAll('.tab').forEach(tab => {
            tab.classList.remove('active');
            if (tab.dataset.tab === tabId) {
                tab.classList.add('active');
            }
        });

        // Update tab content
        document.querySelectorAll('.tab-content').forEach(content => {
            content.classList.remove('active');
        });
        document.getElementById(`tab-${tabId}`).classList.add('active');
    }

    // Moderation Page
    async loadModeration() {
        try {
            const [reports, stats] = await Promise.all([
                this.api('/moderation/reports'),
                this.api('/moderation/reports/stats')
            ]);

            // Update stats
            document.getElementById('reports-open').textContent = stats.stats.open;
            document.getElementById('reports-reviewing').textContent = stats.stats.reviewing;
            document.getElementById('reports-resolved').textContent = stats.stats.resolved;
            document.getElementById('reports-count').textContent = stats.stats.open;

            // Update table
            const table = document.getElementById('reports-table');
            if (reports.reports.length === 0) {
                table.innerHTML = '<tr><td colspan="7" class="loading">No reports</td></tr>';
            } else {
                table.innerHTML = reports.reports.map(report => `
                    <tr>
                        <td>#${report.id}</td>
                        <td>${report.reporterName}</td>
                        <td>${report.reportedName}</td>
                        <td>${report.reason.replace(/_/g, ' ')}</td>
                        <td><span class="status ${report.status}">${report.status}</span></td>
                        <td>${this.formatTimeAgo(new Date(report.createdAt))}</td>
                        <td>
                            <button class="btn-action" onclick="admin.viewReport(${report.id})">View</button>
                            ${report.status === 'open' ? `
                                <button class="btn-action success" onclick="admin.resolveReport(${report.id})">Resolve</button>
                            ` : ''}
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load moderation:', error);
        }
    }

    filterReports(status) {
        // Reload with filter
        this.loadModeration();
    }

    async viewReport(id) {
        try {
            const result = await this.api(`/moderation/reports/${id}`);
            const report = result.report;

            document.getElementById('modal-title').textContent = `Report #${report.id}`;
            document.getElementById('modal-body').innerHTML = `
                <div class="report-details">
                    <p><strong>Reporter:</strong> ${report.reporterName}</p>
                    <p><strong>Reported User:</strong> ${report.reportedName}</p>
                    <p><strong>Reason:</strong> ${report.reason.replace(/_/g, ' ')}</p>
                    <p><strong>Description:</strong></p>
                    <p class="description">${report.description}</p>
                    <p><strong>Status:</strong> <span class="status ${report.status}">${report.status}</span></p>
                    <p><strong>Created:</strong> ${new Date(report.createdAt).toLocaleString()}</p>
                </div>
            `;

            this.openModal();
        } catch (error) {
            this.showToast('Failed to load report', 'error');
        }
    }

    async resolveReport(id) {
        try {
            await this.api(`/moderation/reports/${id}`, 'PUT', { status: 'resolved' });
            this.showToast('Report resolved', 'success');
            this.loadModeration();
        } catch (error) {
            this.showToast('Failed to resolve report', 'error');
        }
    }

    // Analytics Page
    async loadAnalytics() {
        try {
            const [users, games, revenue] = await Promise.all([
                this.api('/analytics/users'),
                this.api('/analytics/games'),
                this.api('/analytics/revenue')
            ]);

            // Update stats
            document.getElementById('analytics-dau').textContent =
                this.formatNumber(users.data.activeUsers[users.data.activeUsers.length - 1]?.value || 0);
            document.getElementById('analytics-games-today').textContent =
                this.formatNumber(games.data.gamesPerDay[games.data.gamesPerDay.length - 1]?.value || 0);
            document.getElementById('analytics-avg-duration').textContent =
                this.formatDuration(games.data.avgDuration);
            document.getElementById('analytics-revenue').textContent =
                `$${revenue.data.totalRevenue.toFixed(2)}`;

            // Render charts
            this.renderCharts(users.data, games.data);

        } catch (error) {
            console.error('Failed to load analytics:', error);
        }
    }

    renderCharts(userData, gameData) {
        // User chart
        const userCtx = document.getElementById('users-chart');
        if (userCtx) {
            if (this.userChart) this.userChart.destroy();

            this.userChart = new Chart(userCtx, {
                type: 'line',
                data: {
                    labels: userData.newUsers.map(d => d.date),
                    datasets: [{
                        label: 'New Users',
                        data: userData.newUsers.map(d => d.value),
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.1)',
                        fill: true,
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true }
                    }
                }
            });
        }

        // Games chart
        const gameCtx = document.getElementById('games-chart');
        if (gameCtx) {
            if (this.gameChart) this.gameChart.destroy();

            this.gameChart = new Chart(gameCtx, {
                type: 'bar',
                data: {
                    labels: gameData.gamesPerDay.map(d => d.date),
                    datasets: [{
                        label: 'Games',
                        data: gameData.gamesPerDay.map(d => d.value),
                        backgroundColor: '#0ea5e9',
                        borderRadius: 4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false }
                    },
                    scales: {
                        x: { grid: { display: false } },
                        y: { beginAtZero: true }
                    }
                }
            });
        }
    }

    // Settings Page
    async loadSettings() {
        try {
            const result = await this.api('/settings');
            const settings = result.settings;

            // Physics settings
            document.getElementById('setting-ball-radius').value = settings.game.physics.ballRadius;
            document.getElementById('setting-pocket-radius').value = settings.game.physics.pocketRadius;
            document.getElementById('setting-cushion-width').value = settings.game.physics.cushionWidth;
            document.getElementById('setting-max-cue-speed').value = settings.game.physics.maxCueSpeed;
            document.getElementById('setting-gravity').value = settings.game.physics.gravity;
            document.getElementById('setting-mu-roll').value = settings.game.physics.muRoll;
            document.getElementById('setting-mu-slide').value = settings.game.physics.muSlide;
            document.getElementById('setting-mu-spin').value = settings.game.physics.muSpin;
            document.getElementById('setting-e-ball').value = settings.game.physics.eBall;
            document.getElementById('setting-e-cushion').value = settings.game.physics.eCushion;

            // Gameplay settings
            document.getElementById('setting-shot-time').value = settings.game.gameplay.shotTimeLimit;
            document.getElementById('setting-break-time').value = settings.game.gameplay.breakTimeLimit;
            document.getElementById('setting-max-power').value = settings.game.gameplay.maxPower;
            document.getElementById('setting-enable-spin').checked = settings.game.gameplay.enableSpin;
            document.getElementById('setting-call-pocket').checked = settings.game.gameplay.callPocket;

            // Feature flags
            document.getElementById('flag-maintenance').checked = settings.features.maintenance;
            document.getElementById('flag-registration').checked = settings.features.newUserRegistration;
            document.getElementById('flag-chat').checked = settings.features.chatEnabled;
            document.getElementById('flag-tournament').checked = settings.features.tournamentMode;

            // Economy
            document.getElementById('setting-starting-coins').value = settings.game.economy.startingCoins;
            document.getElementById('setting-min-bet').value = settings.game.economy.minBet;
            document.getElementById('setting-max-bet').value = settings.game.economy.maxBet;
            document.getElementById('setting-win-reward').value = settings.game.economy.winReward;

        } catch (error) {
            console.error('Failed to load settings:', error);
        }
    }

    async savePhysicsSettings() {
        try {
            const physics = {
                ballRadius: parseInt(document.getElementById('setting-ball-radius').value),
                pocketRadius: parseInt(document.getElementById('setting-pocket-radius').value),
                cushionWidth: parseInt(document.getElementById('setting-cushion-width').value),
                maxCueSpeed: parseInt(document.getElementById('setting-max-cue-speed').value),
                gravity: parseInt(document.getElementById('setting-gravity').value),
                muRoll: parseFloat(document.getElementById('setting-mu-roll').value),
                muSlide: parseFloat(document.getElementById('setting-mu-slide').value),
                muSpin: parseFloat(document.getElementById('setting-mu-spin').value),
                eBall: parseFloat(document.getElementById('setting-e-ball').value),
                eCushion: parseFloat(document.getElementById('setting-e-cushion').value)
            };

            await this.api('/settings/game', 'PUT', { physics });
            this.showToast('Physics settings saved!', 'success');
        } catch (error) {
            this.showToast('Failed to save physics settings', 'error');
        }
    }

    async saveGameSettings() {
        try {
            const gameplay = {
                shotTimeLimit: parseInt(document.getElementById('setting-shot-time').value),
                maxPower: parseInt(document.getElementById('setting-max-power').value),
                enableSpin: document.getElementById('setting-enable-spin').checked,
                callPocket: document.getElementById('setting-call-pocket').checked
            };

            await this.api('/settings/game', 'PUT', { gameplay });
            this.showToast('Game settings saved!', 'success');
        } catch (error) {
            this.showToast('Failed to save settings', 'error');
        }
    }

    async saveFeatures() {
        try {
            const features = {
                maintenance: document.getElementById('flag-maintenance').checked,
                newUserRegistration: document.getElementById('flag-registration').checked,
                chatEnabled: document.getElementById('flag-chat').checked,
                tournamentMode: document.getElementById('flag-tournament').checked
            };

            await this.api('/settings/features', 'PUT', features);
            this.showToast('Feature flags saved!', 'success');
        } catch (error) {
            this.showToast('Failed to save features', 'error');
        }
    }

    async saveEconomy() {
        try {
            const economy = {
                startingCoins: parseInt(document.getElementById('setting-starting-coins').value),
                minBet: parseInt(document.getElementById('setting-min-bet').value),
                maxBet: parseInt(document.getElementById('setting-max-bet').value)
            };

            await this.api('/settings/game', 'PUT', { economy });
            this.showToast('Economy settings saved!', 'success');
        } catch (error) {
            this.showToast('Failed to save economy settings', 'error');
        }
    }

    // Messages Page (User Reports & Feature Suggestions)
    async loadMessages(typeFilter = 'all', statusFilter = 'all') {
        try {
            const params = new URLSearchParams();
            if (typeFilter !== 'all') params.append('type', typeFilter);
            if (statusFilter !== 'all') params.append('status', statusFilter);

            const response = await fetch(`/api/admin/reports?${params.toString()}`);
            const data = await response.json();

            if (!data.success) {
                throw new Error(data.error);
            }

            // Update stats
            document.getElementById('msg-total').textContent = data.stats.total;
            document.getElementById('msg-open').textContent = data.stats.open;
            document.getElementById('msg-bugs').textContent = data.stats.bugs;
            document.getElementById('msg-features').textContent = data.stats.features;
            document.getElementById('messages-count').textContent = data.stats.open;

            // Update table
            const table = document.getElementById('messages-table');
            if (data.reports.length === 0) {
                table.innerHTML = '<tr><td colspan="8" class="loading">No messages found</td></tr>';
            } else {
                table.innerHTML = data.reports.map(report => `
                    <tr>
                        <td>#${report.id}</td>
                        <td><span class="type-badge ${report.type}">${report.type === 'bug' ? '🐛 Bug' : '💡 Feature'}</span></td>
                        <td title="${this.escapeHtml(report.description)}">${this.escapeHtml(report.subject.substring(0, 40))}${report.subject.length > 40 ? '...' : ''}</td>
                        <td>${this.escapeHtml(report.username)}</td>
                        <td><span class="priority-badge ${report.priority}">${report.priority}</span></td>
                        <td><span class="status ${report.status}">${report.status.replace(/_/g, ' ')}</span></td>
                        <td>${this.formatTimeAgo(new Date(report.createdAt))}</td>
                        <td>
                            <button class="btn-action" onclick="admin.viewMessage(${report.id})">View</button>
                            ${report.status === 'open' ? `
                                <button class="btn-action warning" onclick="admin.updateMessageStatus(${report.id}, 'in_progress')">Start</button>
                            ` : ''}
                            ${report.status !== 'resolved' ? `
                                <button class="btn-action success" onclick="admin.updateMessageStatus(${report.id}, 'resolved')">Resolve</button>
                            ` : ''}
                            <button class="btn-action danger" onclick="admin.deleteMessage(${report.id})">Delete</button>
                        </td>
                    </tr>
                `).join('');
            }
        } catch (error) {
            console.error('Failed to load messages:', error);
            this.showToast('Failed to load messages', 'error');
        }
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async viewMessage(id) {
        try {
            const response = await fetch('/api/admin/reports');
            const data = await response.json();
            const report = data.reports.find(r => r.id === id);

            if (!report) {
                this.showToast('Message not found', 'error');
                return;
            }

            document.getElementById('modal-title').textContent = `${report.type === 'bug' ? '🐛 Bug Report' : '💡 Feature Request'} #${report.id}`;
            document.getElementById('modal-body').innerHTML = `
                <div class="message-detail">
                    <div class="detail-row">
                        <span class="label">Subject:</span>
                        <span class="value">${this.escapeHtml(report.subject)}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">From:</span>
                        <span class="value">${this.escapeHtml(report.username)} (${report.userEmail})</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Category:</span>
                        <span class="value">${report.category}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Priority:</span>
                        <span class="priority-badge ${report.priority}">${report.priority}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Status:</span>
                        <span class="status ${report.status}">${report.status.replace(/_/g, ' ')}</span>
                    </div>
                    <div class="detail-row">
                        <span class="label">Submitted:</span>
                        <span class="value">${new Date(report.createdAt).toLocaleString()}</span>
                    </div>
                    <div class="detail-row full">
                        <span class="label">Description:</span>
                        <div class="description-box">${this.escapeHtml(report.description)}</div>
                    </div>
                    ${report.adminNotes ? `
                        <div class="detail-row full">
                            <span class="label">Admin Notes:</span>
                            <div class="description-box">${this.escapeHtml(report.adminNotes)}</div>
                        </div>
                    ` : ''}
                </div>
            `;
            this.openModal();
        } catch (error) {
            console.error('Failed to view message:', error);
            this.showToast('Failed to load message details', 'error');
        }
    }

    async updateMessageStatus(id, status) {
        try {
            const response = await fetch(`/api/admin/reports/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ status })
            });
            const data = await response.json();

            if (data.success) {
                this.showToast(`Message status updated to ${status.replace(/_/g, ' ')}`);
                this.loadMessages(
                    document.getElementById('msg-type-filter').value,
                    document.getElementById('msg-status-filter').value
                );
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to update message:', error);
            this.showToast('Failed to update message', 'error');
        }
    }

    async deleteMessage(id) {
        if (!confirm('Are you sure you want to delete this message?')) return;

        try {
            const response = await fetch(`/api/admin/reports/${id}`, {
                method: 'DELETE'
            });
            const data = await response.json();

            if (data.success) {
                this.showToast('Message deleted');
                this.loadMessages(
                    document.getElementById('msg-type-filter').value,
                    document.getElementById('msg-status-filter').value
                );
            } else {
                throw new Error(data.error);
            }
        } catch (error) {
            console.error('Failed to delete message:', error);
            this.showToast('Failed to delete message', 'error');
        }
    }

    // Modal
    openModal() {
        document.getElementById('modal').classList.remove('hidden');
    }

    closeModal() {
        document.getElementById('modal').classList.add('hidden');
    }

    // Toast notifications
    showToast(message, type = 'success') {
        const container = document.getElementById('toast-container');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <span>${type === 'success' ? '✓' : type === 'error' ? '✗' : '!'}</span>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.remove();
        }, 3000);
    }

    // Utility functions
    formatNumber(num) {
        if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
        if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
        return num.toString();
    }

    formatDuration(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    formatTimeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);

        if (seconds < 60) return 'just now';
        if (seconds < 3600) return `${Math.floor(seconds / 60)} min ago`;
        if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
        return `${Math.floor(seconds / 86400)} days ago`;
    }

    getActivityIcon(action) {
        const icons = {
            login: '🔵',
            logout: '🔴',
            ban_user: '🔴',
            unban_user: '🟢',
            update_user: '🟡',
            delete_user: '🔴',
            update_game_settings: '⚙️',
            toggle_feature: '🚀',
            update_report: '📋'
        };
        return icons[action] || '📋';
    }
}

// Initialize admin panel
let admin;
document.addEventListener('DOMContentLoaded', () => {
    admin = new AdminPanel();
});
