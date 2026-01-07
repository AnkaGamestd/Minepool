// ============================================
// DAILY REWARDS SYSTEM
// ============================================
(function initDailyRewards() {
    const GAMES_REQUIRED = 3;
    const STREAK_DAYS = 7;
    const DAILY_REWARD = 500;
    const STREAK_BONUS = 2000;

    function getDailyRewardsData() {
        const data = localStorage.getItem('dailyRewards');
        if (data) return JSON.parse(data);
        return {
            streakDays: [],
            gamesToday: 0,
            lastPlayDate: null,
            claimedToday: false
        };
    }

    function saveDailyRewardsData(data) {
        localStorage.setItem('dailyRewards', JSON.stringify(data));
    }

    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    function resetIfNewDay(data) {
        const today = getToday();
        if (data.lastPlayDate !== today) {
            if (data.lastPlayDate) {
                const lastDate = new Date(data.lastPlayDate);
                const todayDate = new Date(today);
                const diffDays = Math.ceil((todayDate - lastDate) / (1000 * 60 * 60 * 24));
                if (diffDays > 1) data.streakDays = [];
            }
            data.gamesToday = 0;
            data.claimedToday = false;
            data.lastPlayDate = today;
        }
        return data;
    }

    function getCurrentStreakDay(data) {
        return data.streakDays.length + 1;
    }

    function updateUI(data) {
        const currentDay = getCurrentStreakDay(data);
        const dailyRewardsSection = document.getElementById('daily-rewards-section');
        const gamesTodayEl = document.getElementById('games-today');
        const currentStreakDayEl = document.getElementById('current-streak-day');
        const claimBtn = document.getElementById('claim-reward-btn');
        const streakDays = document.querySelectorAll('.streak-day');

        if (dailyRewardsSection) dailyRewardsSection.style.display = 'block';
        if (gamesTodayEl) gamesTodayEl.textContent = Math.min(data.gamesToday, GAMES_REQUIRED);
        if (currentStreakDayEl) currentStreakDayEl.textContent = Math.min(currentDay, STREAK_DAYS);

        streakDays.forEach((dayEl, index) => {
            const dayNum = index + 1;
            dayEl.classList.remove('completed', 'current', 'upcoming');
            if (data.streakDays.includes(dayNum)) {
                dayEl.classList.add('completed');
            } else if (dayNum === currentDay && currentDay <= STREAK_DAYS) {
                dayEl.classList.add('current');
            } else {
                dayEl.classList.add('upcoming');
            }
        });

        if (claimBtn) {
            if (data.claimedToday) {
                claimBtn.disabled = true;
                claimBtn.innerHTML = '<span class="coin-icon">✓</span> CLAIMED TODAY';
            } else if (data.gamesToday >= GAMES_REQUIRED) {
                claimBtn.disabled = false;
                const reward = currentDay === STREAK_DAYS ? STREAK_BONUS : DAILY_REWARD;
                claimBtn.innerHTML = `<span class="coin-icon">💰</span> CLAIM ${reward} COINS`;
            } else {
                claimBtn.disabled = true;
                const remaining = GAMES_REQUIRED - data.gamesToday;
                claimBtn.innerHTML = `<span class="coin-icon">🎮</span> PLAY ${remaining} MORE GAME${remaining > 1 ? 'S' : ''}`;
            }
        }
        updateTimer();
    }

    function updateTimer() {
        const timerEl = document.getElementById('reward-timer');
        if (!timerEl) return;
        const now = new Date();
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const diff = tomorrow - now;
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        timerEl.textContent = `${hours}h ${minutes}m`;
    }

    async function claimReward() {
        let data = getDailyRewardsData();
        data = resetIfNewDay(data);
        if (data.claimedToday || data.gamesToday < GAMES_REQUIRED) return;

        const currentDay = getCurrentStreakDay(data);
        const reward = currentDay === STREAK_DAYS ? STREAK_BONUS : DAILY_REWARD;

        data.claimedToday = true;
        if (!data.streakDays.includes(currentDay)) data.streakDays.push(currentDay);
        if (data.streakDays.length >= STREAK_DAYS) data.streakDays = [];
        saveDailyRewardsData(data);

        try {
            await fetch('/api/rewards/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ reward, day: currentDay })
            });
            if (window.currentUser) {
                window.currentUser.coins = (window.currentUser.coins || 0) + reward;
                localStorage.setItem('user', JSON.stringify(window.currentUser));
                const coinsEl = document.getElementById('stat-coins');
                if (coinsEl) coinsEl.textContent = window.currentUser.coins.toLocaleString();
            }
        } catch (error) {
            console.error('Failed to claim reward:', error);
        }
        updateUI(data);
        alert(`🎉 You claimed ${reward} coins!`);
    }

    // Initialize when DOM is ready
    function init() {
        let data = getDailyRewardsData();
        data = resetIfNewDay(data);
        saveDailyRewardsData(data);
        updateUI(data);
        setInterval(updateTimer, 60000);

        const claimBtn = document.getElementById('claim-reward-btn');
        if (claimBtn) claimBtn.addEventListener('click', claimReward);
    }

    // Run init when DOM is ready or immediately if already loaded
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Expose for game.js to call when game ends
    window.incrementDailyGames = function () {
        let data = getDailyRewardsData();
        data = resetIfNewDay(data);
        data.gamesToday++;
        saveDailyRewardsData(data);
        updateUI(data);
    };

    // For testing
    window.testAddGame = function () {
        window.incrementDailyGames();
        console.log('Game added!');
    };
})();
