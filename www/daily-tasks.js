// ============================================
// DAILY TASKS SYSTEM
// Social tasks to earn coins
// ============================================
(function initDailyTasks() {
    // Task definitions
    const TASKS = [
        {
            id: 'twitter_follow',
            name: 'Follow on Twitter',
            description: 'Follow @MinePoolGame',
            icon: '🐦',
            iconClass: 'twitter',
            reward: 500,
            url: 'https://twitter.com/MinePoolGame',
            type: 'social'
        },
        {
            id: 'telegram_join',
            name: 'Join Telegram',
            description: 'Join our community',
            icon: '✈️',
            iconClass: 'telegram',
            reward: 500,
            url: 'https://t.me/MinePoolGame',
            type: 'social'
        },
        {
            id: 'invite_friend',
            name: 'Invite a Friend',
            description: 'Share your code',
            icon: '👥',
            iconClass: 'invite',
            reward: 500,
            type: 'invite',
            repeatable: true
        }
    ];

    const INVITE_REWARD_PER_FRIEND = 500;

    // Get tasks data from localStorage
    function getTasksData() {
        const data = localStorage.getItem('dailyTasks');
        if (data) return JSON.parse(data);
        return {
            completedTasks: [],
            pendingTasks: [],
            inviteCode: null,
            invitedFriends: 0,
            lastResetDate: null
        };
    }

    // Save tasks data
    function saveTasksData(data) {
        localStorage.setItem('dailyTasks', JSON.stringify(data));
    }

    // Get today's date string
    function getToday() {
        return new Date().toISOString().split('T')[0];
    }

    // Check and reset if new day (for repeatable social tasks)
    function checkDailyReset(data) {
        const today = getToday();
        if (data.lastResetDate !== today) {
            // Reset pending tasks but keep permanent completions
            data.pendingTasks = [];
            data.lastResetDate = today;
            // Note: completedTasks for social tasks are permanent (one-time)
            // Only invite rewards reset daily for the claim button
        }
        return data;
    }

    // Generate invite code based on user
    function generateInviteCode() {
        const user = window.currentUser;
        if (user && user.username) {
            // Create a unique code from username
            const base = user.username.toUpperCase().substring(0, 4);
            const random = Math.random().toString(36).substring(2, 6).toUpperCase();
            return `${base}${random}`;
        }
        return 'MINE' + Math.random().toString(36).substring(2, 8).toUpperCase();
    }

    // Open task URL and mark as pending
    function openTask(taskId) {
        const task = TASKS.find(t => t.id === taskId);
        if (!task || task.type === 'invite') return;

        let data = getTasksData();

        // Check if already completed
        if (data.completedTasks.includes(taskId)) {
            return;
        }

        // Open the URL
        if (task.url) {
            window.open(task.url, '_blank');
        }

        // Mark as pending (can claim after opening)
        if (!data.pendingTasks.includes(taskId)) {
            data.pendingTasks.push(taskId);
            saveTasksData(data);
            updateTasksUI(data);
        }
    }

    // Claim task reward
    async function claimTask(taskId) {
        let data = getTasksData();
        const task = TASKS.find(t => t.id === taskId);

        if (!task) return;

        // Check if already claimed
        if (data.completedTasks.includes(taskId) && !task.repeatable) {
            return;
        }

        // For social tasks, must be in pending
        if (task.type === 'social' && !data.pendingTasks.includes(taskId)) {
            return;
        }

        // Mark as completed
        if (!data.completedTasks.includes(taskId)) {
            data.completedTasks.push(taskId);
        }

        // Remove from pending
        data.pendingTasks = data.pendingTasks.filter(id => id !== taskId);

        saveTasksData(data);

        // Award coins
        const reward = task.reward;
        try {
            const response = await fetch('/api/tasks/claim', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify({ taskId, reward })
            });

            if (response.ok) {
                if (window.currentUser) {
                    window.currentUser.coins = (window.currentUser.coins || 0) + reward;
                    localStorage.setItem('user', JSON.stringify(window.currentUser));

                    // Update coin displays
                    const coinsEls = document.querySelectorAll('#stat-coins, #user-coins');
                    coinsEls.forEach(el => {
                        if (el) el.textContent = window.currentUser.coins.toLocaleString();
                    });
                }

                showToast(`🎉 +${reward} coins earned!`);
            }
        } catch (error) {
            console.error('Failed to claim task reward:', error);
        }

        updateTasksUI(data);
    }

    // Fetch referral code from server
    async function fetchReferralCode() {
        try {
            const response = await fetch('/api/referral/code', { credentials: 'include' });
            const data = await response.json();
            if (data.success) {
                return {
                    code: data.referralCode,
                    link: data.referralLink,
                    totalReferrals: data.totalReferrals,
                    totalEarnings: data.totalEarnings
                };
            }
        } catch (error) {
            console.error('Failed to fetch referral code:', error);
        }
        return null;
    }

    // Copy invite code
    async function copyInviteCode() {
        const referral = await fetchReferralCode();
        if (!referral) {
            showToast('❌ Failed to get invite code');
            return;
        }

        navigator.clipboard.writeText(referral.link).then(() => {
            const btn = document.getElementById('copy-code-btn');
            if (btn) {
                btn.classList.add('copied');
                btn.textContent = 'Copied!';
                setTimeout(() => {
                    btn.classList.remove('copied');
                    btn.textContent = '📋 Copy';
                }, 2000);
            }
            showToast('📋 Invite link copied!');
        }).catch(() => {
            // Fallback for older browsers
            const input = document.createElement('input');
            input.value = referral.link;
            document.body.appendChild(input);
            input.select();
            document.execCommand('copy');
            document.body.removeChild(input);
            showToast('📋 Invite link copied!');
        });
    }

    // Share invite via platforms
    async function shareInvite(platform) {
        const referral = await fetchReferralCode();
        if (!referral) {
            showToast('❌ Failed to get invite link');
            return;
        }

        const inviteLink = referral.link;
        const message = `🎱 Join me on Mine Pool! Use my invite code and get bonus coins! ${inviteLink}`;

        let shareUrl = '';
        switch (platform) {
            case 'whatsapp':
                shareUrl = `https://wa.me/?text=${encodeURIComponent(message)}`;
                break;
            case 'telegram':
                shareUrl = `https://t.me/share/url?url=${encodeURIComponent(inviteLink)}&text=${encodeURIComponent('🎱 Join me on Mine Pool!')}`;
                break;
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(message)}`;
                break;
        }

        if (shareUrl) {
            window.open(shareUrl, '_blank', 'width=600,height=400');
        }
    }

    // Show toast notification
    function showToast(message) {
        let toast = document.getElementById('tasks-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'tasks-toast';
            toast.className = 'toast';
            toast.style.cssText = `
                position: fixed;
                bottom: 30px;
                left: 50%;
                transform: translateX(-50%) translateY(100px);
                background: linear-gradient(135deg, #00ff88, #00cc6a);
                color: #000;
                padding: 14px 28px;
                border-radius: 12px;
                font-weight: 700;
                opacity: 0;
                transition: all 0.3s ease;
                z-index: 10001;
            `;
            document.body.appendChild(toast);
        }

        toast.textContent = message;
        toast.style.transform = 'translateX(-50%) translateY(0)';
        toast.style.opacity = '1';

        setTimeout(() => {
            toast.style.transform = 'translateX(-50%) translateY(100px)';
            toast.style.opacity = '0';
        }, 3000);
    }

    // Update tasks UI
    function updateTasksUI(data) {
        const tasksContainer = document.getElementById('tasks-list');
        if (!tasksContainer) return;

        // Calculate progress
        const completedCount = data.completedTasks.length;
        const totalTasks = TASKS.filter(t => t.type === 'social').length;
        const progressPercent = Math.round((completedCount / totalTasks) * 100);

        // Update progress circle
        const progressCircle = document.querySelector('.progress-circle');
        if (progressCircle) {
            progressCircle.style.setProperty('--progress', `${progressPercent}%`);
        }

        const progressInner = document.querySelector('.progress-circle-inner');
        if (progressInner) {
            progressInner.textContent = `${completedCount}/${totalTasks}`;
        }

        // Update potential earnings
        const potentialEarnings = TASKS.filter(t => t.type === 'social' && !data.completedTasks.includes(t.id))
            .reduce((sum, t) => sum + t.reward, 0);
        const potentialEl = document.getElementById('potential-earnings');
        if (potentialEl) {
            potentialEl.textContent = potentialEarnings.toLocaleString();
        }

        // Render tasks
        tasksContainer.innerHTML = '';
        TASKS.forEach(task => {
            const isCompleted = data.completedTasks.includes(task.id);
            const isPending = data.pendingTasks.includes(task.id);

            const taskEl = document.createElement('div');
            taskEl.className = `task-item ${isCompleted ? 'completed' : ''}`;

            let buttonHtml = '';
            if (task.type === 'invite') {
                // Invite task - just show info, actual sharing is below
                buttonHtml = `<button class="task-btn go" onclick="window.scrollToInvite()">Share</button>`;
            } else if (isCompleted) {
                buttonHtml = `<button class="task-btn completed">Done</button>`;
            } else if (isPending) {
                buttonHtml = `<button class="task-btn claim" onclick="window.claimDailyTask('${task.id}')">Claim</button>`;
            } else {
                buttonHtml = `<button class="task-btn go" onclick="window.openDailyTask('${task.id}')">Go</button>`;
            }

            taskEl.innerHTML = `
                <div class="task-icon ${task.iconClass}">${task.icon}</div>
                <div class="task-info">
                    <div class="task-name">${task.name}</div>
                    <div class="task-description">${task.description}</div>
                </div>
                <div class="task-reward">
                    <span class="coin-emoji">💰</span>
                    <span>${task.reward}</span>
                </div>
                ${buttonHtml}
            `;

            tasksContainer.appendChild(taskEl);
        });

        // Fetch and update referral info from server
        fetchReferralCode().then(referral => {
            if (referral) {
                const inviteCodeEl = document.getElementById('invite-code-display');
                if (inviteCodeEl) {
                    inviteCodeEl.textContent = referral.code;
                }

                const invitedCountEl = document.getElementById('invited-count');
                if (invitedCountEl) {
                    invitedCountEl.textContent = referral.totalReferrals || 0;
                }
            }
        });
    }

    // Create tasks section HTML
    function createTasksSection() {
        const section = document.createElement('div');
        section.className = 'daily-tasks-section';
        section.id = 'daily-tasks-section';
        section.style.display = 'none';

        section.innerHTML = `
            <div class="daily-tasks-header">
                <span class="daily-tasks-title">
                    <span class="tasks-icon">📋</span>
                    DAILY TASKS
                </span>
                <span class="tasks-reset-timer">Earn up to <span id="potential-earnings">1,500</span> 💰</span>
            </div>
            
            <div class="tasks-progress">
                <div class="progress-circle" style="--progress: 0%">
                    <div class="progress-circle-inner">0/3</div>
                </div>
                <div class="tasks-progress-info">
                    <h4>Complete Tasks</h4>
                    <p>Follow us & earn <span>bonus coins</span></p>
                </div>
            </div>
            
            <div id="tasks-list" class="tasks-list">
                <!-- Tasks will be rendered here -->
            </div>
            
            <div class="invite-section" id="invite-section">
                <div class="invite-code-header">
                    <span class="invite-code-title">👥 Your Invite Code</span>
                    <span class="invite-count">Friends invited: <span id="invited-count">0</span></span>
                </div>
                <div class="invite-code-box">
                    <div class="invite-code" id="invite-code-display">LOADING...</div>
                    <button class="copy-code-btn" id="copy-code-btn" onclick="window.copyInviteCode()">📋 Copy</button>
                </div>
                <div class="share-buttons">
                    <button class="share-btn whatsapp" onclick="window.shareInviteCode('whatsapp')">
                        📱 WhatsApp
                    </button>
                    <button class="share-btn telegram" onclick="window.shareInviteCode('telegram')">
                        ✈️ Telegram
                    </button>
                    <button class="share-btn twitter" onclick="window.shareInviteCode('twitter')">
                        🐦 Twitter
                    </button>
                </div>
            </div>
        `;

        return section;
    }

    // Initialize
    function init() {
        // Wait for currentUser to be available
        const checkUser = setInterval(() => {
            if (window.currentUser) {
                clearInterval(checkUser);
                initTasks();
            }
        }, 500);

        // Stop checking after 10 seconds
        setTimeout(() => clearInterval(checkUser), 10000);
    }

    function initTasks() {
        // Use existing HTML if present, otherwise create dynamically
        let section = document.getElementById('daily-tasks-section');

        if (!section) {
            // Insert tasks section after daily rewards section or main content
            const dailyRewards = document.getElementById('daily-rewards-section');
            const mainContent = document.getElementById('main-content');

            const tasksSection = createTasksSection();
            if (dailyRewards) {
                dailyRewards.parentNode.insertBefore(tasksSection, dailyRewards.nextSibling);
            } else if (mainContent) {
                mainContent.appendChild(tasksSection);
            }
            section = document.getElementById('daily-tasks-section');
        } else {
            // Section exists, but check if invite-section is missing
            let inviteSection = document.getElementById('invite-section');
            if (!inviteSection) {
                // Add invite section to existing tasks section
                const inviteHtml = `
                    <div class="invite-section" id="invite-section">
                        <div class="invite-code-header">
                            <span class="invite-code-title">👥 Your Invite Code</span>
                            <span class="invite-count">Friends invited: <span id="invited-count">0</span></span>
                        </div>
                        <div class="invite-code-box">
                            <div class="invite-code" id="invite-code-display">LOADING...</div>
                            <button class="copy-code-btn" id="copy-code-btn" onclick="window.copyInviteCode()">📋 Copy</button>
                        </div>
                        <div class="share-buttons">
                            <button class="share-btn whatsapp" onclick="window.shareInviteCode('whatsapp')">
                                📱 WhatsApp
                            </button>
                            <button class="share-btn telegram" onclick="window.shareInviteCode('telegram')">
                                ✈️ Telegram
                            </button>
                            <button class="share-btn twitter" onclick="window.shareInviteCode('twitter')">
                                🐦 Twitter
                            </button>
                        </div>
                    </div>
                `;
                section.insertAdjacentHTML('beforeend', inviteHtml);
            }
        }

        let data = getTasksData();
        data = checkDailyReset(data);

        // Generate invite code if needed
        if (!data.inviteCode) {
            data.inviteCode = generateInviteCode();
            saveTasksData(data);
        }

        // Show section and update invite code display
        if (section) {
            section.style.display = 'block';
        }

        // Update invite code in both possible element IDs
        const inviteCodeEl = document.getElementById('invite-code') || document.getElementById('invite-code-display');
        if (inviteCodeEl) {
            inviteCodeEl.textContent = data.inviteCode;
        }

        updateTasksUI(data);
    }

    // Expose functions globally
    window.openDailyTask = openTask;
    window.claimDailyTask = claimTask;
    window.copyInviteCode = copyInviteCode;
    window.shareInviteCode = shareInvite;
    window.scrollToInvite = function () {
        const inviteSection = document.getElementById('invite-section');
        if (inviteSection) {
            inviteSection.scrollIntoView({ behavior: 'smooth' });
        }
    };

    // Check for referral code on login page
    window.checkReferralCode = function () {
        const urlParams = new URLSearchParams(window.location.search);
        const refCode = urlParams.get('ref');
        if (refCode) {
            localStorage.setItem('referralCode', refCode);
        }
    };

    // Get referral code for registration
    window.getReferralCode = function () {
        return localStorage.getItem('referralCode');
    };

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
