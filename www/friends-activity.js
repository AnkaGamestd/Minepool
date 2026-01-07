// ============================================
// FRIENDS ACTIVITY WIDGET
// Shows online friends on the main menu
// ============================================
(function initFriendsActivity() {

    // Sample friends data (will be replaced with API call)
    const sampleFriends = [
        { id: 1, name: 'ProPlayer', status: 'online', statusText: 'Online', avatar: '🎮' },
        { id: 2, name: 'PoolMaster', status: 'ingame', statusText: 'In Game', avatar: '🎱' },
        { id: 3, name: 'Champion99', status: 'online', statusText: 'Online', avatar: '🏆' },
        { id: 4, name: 'CueMaster', status: 'offline', statusText: 'Offline', avatar: '👤' },
    ];

    // Render friends list
    function renderFriendsList(friends) {
        const listContainer = document.getElementById('friends-activity-list');
        if (!listContainer) return;

        if (!friends || friends.length === 0) {
            listContainer.innerHTML = `
                <div class="no-friends-msg">
                    No friends online. <a href="friends.html">Add friends</a> to see their activity!
                </div>
            `;
            return;
        }

        // Sort: online first, then ingame, then offline
        const sortedFriends = [...friends].sort((a, b) => {
            const order = { online: 0, ingame: 1, offline: 2 };
            return (order[a.status] || 2) - (order[b.status] || 2);
        });

        // Show only first 4 friends
        const displayFriends = sortedFriends.slice(0, 4);

        listContainer.innerHTML = displayFriends.map(friend => `
            <div class="friend-activity-item" data-friend-id="${friend.id}">
                <div class="friend-avatar">
                    ${friend.avatarUrl
                ? `<img src="${friend.avatarUrl}" alt="${friend.name}">`
                : `<span>${friend.avatar || '👤'}</span>`
            }
                    <div class="status-dot ${friend.status}"></div>
                </div>
                <div class="friend-info">
                    <div class="friend-name">${friend.name}</div>
                    <div class="friend-status ${friend.status}">${friend.statusText}</div>
                </div>
                ${friend.status === 'online'
                ? `<button class="challenge-btn" onclick="window.challengeFriend(${friend.id}, '${friend.name}')">Challenge</button>`
                : ''
            }
            </div>
        `).join('');
    }

    // Load friends from API
    async function loadFriends() {
        try {
            const response = await fetch('/api/friends', {
                credentials: 'include'
            });

            if (response.ok) {
                const data = await response.json();
                if (data.success && data.friends) {
                    renderFriendsList(data.friends);
                    return;
                }
            }
        } catch (error) {
            console.log('Friends API not available, using sample data');
        }

        // Fallback to sample data
        renderFriendsList(sampleFriends);
    }

    // Challenge friend
    window.challengeFriend = function (friendId, friendName) {
        if (confirm(`Challenge ${friendName} to a game?`)) {
            // TODO: Implement friend challenge via WebSocket
            alert(`Challenge sent to ${friendName}!`);
        }
    };

    // Initialize
    function init() {
        // Wait for auth before loading friends
        const checkAuth = setInterval(() => {
            if (window.currentUser) {
                clearInterval(checkAuth);
                loadFriends();
            }
        }, 500);

        // Stop checking after 10 seconds
        setTimeout(() => {
            clearInterval(checkAuth);
            // Show sample data if auth takes too long
            renderFriendsList(sampleFriends);
        }, 10000);
    }

    // Run init when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Refresh friends every 30 seconds
    setInterval(loadFriends, 30000);
})();
