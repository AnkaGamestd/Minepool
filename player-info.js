/**
 * Player Info Manager - Handles profile pictures, national flags, and player info bar
 */

// Convert country code to flag emoji
function getFlagEmoji(countryCode) {
    if (!countryCode) return '';
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt(0));
    return String.fromCodePoint(...codePoints);
}

// Country code to name mapping
const COUNTRY_NAMES = {
    'TR': 'Turkey', 'US': 'United States', 'GB': 'United Kingdom', 'DE': 'Germany',
    'FR': 'France', 'ES': 'Spain', 'IT': 'Italy', 'NL': 'Netherlands',
    'BR': 'Brazil', 'AR': 'Argentina', 'MX': 'Mexico', 'JP': 'Japan',
    'KR': 'South Korea', 'CN': 'China', 'IN': 'India', 'RU': 'Russia',
    'AU': 'Australia', 'CA': 'Canada', 'PL': 'Poland', 'SE': 'Sweden'
};

// Default avatar images
const DEFAULT_AVATARS = [
    'assets/avatars/default_1.png',
    'assets/avatars/default_2.png',
    'assets/avatars/default_3.png',
    'assets/avatars/default_4.png'
];

// Get a consistent default avatar based on username
function getDefaultAvatar(username) {
    if (!username) return DEFAULT_AVATARS[0];
    const hash = username.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return DEFAULT_AVATARS[hash % DEFAULT_AVATARS.length];
}

// Create and inject the player info bar above the table
function createPlayerInfoBar() {
    // DISABLED: Player info bar removed per user request (removed D and P2 panels from all devices)
    // The function is kept for compatibility but does nothing
    return;
}

// Update player 1 info with user data
function updatePlayer1Info(user) {
    if (!user) return;

    // Update in header (old location)
    const p1Name = document.getElementById('p1-name');
    if (p1Name) p1Name.textContent = user.username;

    const p1AvatarFallback = document.getElementById('p1-avatar-fallback');
    if (p1AvatarFallback) {
        p1AvatarFallback.textContent = user.username ? user.username.charAt(0).toUpperCase() : 'P1';
    }

    const p1Flag = document.getElementById('p1-flag');
    if (p1Flag && user.nationality) {
        p1Flag.textContent = getFlagEmoji(user.nationality);
    }

    // Update header avatar image
    const p1AvatarHeader = document.getElementById('p1-avatar-header');
    if (p1AvatarHeader) {
        const avatarSrc = user.profilePicture || getDefaultAvatar(user.username);
        p1AvatarHeader.src = avatarSrc;
        p1AvatarHeader.style.display = 'block';
        if (p1AvatarFallback) p1AvatarFallback.style.display = 'none';
    }

    // Update in new info bar (above table)
    const p1NameTop = document.getElementById('p1-name-top');
    if (p1NameTop) p1NameTop.textContent = user.username;

    // Update avatar image
    const p1AvatarImg = document.getElementById('p1-avatar-img');
    const p1AvatarTop = document.getElementById('p1-avatar-top');

    if (p1AvatarImg) {
        // Use profile picture if available, otherwise use default based on username
        const avatarSrc = user.profilePicture || getDefaultAvatar(user.username);
        p1AvatarImg.src = avatarSrc;
        p1AvatarImg.style.display = 'block';
        if (p1AvatarTop) p1AvatarTop.style.display = 'none';
    }

    if (p1AvatarTop) {
        p1AvatarTop.textContent = user.username ? user.username.charAt(0).toUpperCase() : 'P1';
    }

    const p1FlagTop = document.getElementById('p1-flag-top');
    if (p1FlagTop && user.nationality) {
        p1FlagTop.textContent = getFlagEmoji(user.nationality);
        p1FlagTop.title = COUNTRY_NAMES[user.nationality] || user.nationality;
    }
}

// Update player 2 info
function updatePlayer2Info(user) {
    if (!user) return;

    // Update in header
    const p2Name = document.getElementById('p2-name');
    if (p2Name) p2Name.textContent = user.username;

    const p2AvatarFallback = document.getElementById('p2-avatar-fallback');
    if (p2AvatarFallback) {
        p2AvatarFallback.textContent = user.username ? user.username.charAt(0).toUpperCase() : 'P2';
    }

    const p2Flag = document.getElementById('p2-flag');
    if (p2Flag && user.nationality) {
        p2Flag.textContent = getFlagEmoji(user.nationality);
    }

    // Update header avatar image
    const p2AvatarHeader = document.getElementById('p2-avatar-header');
    if (p2AvatarHeader) {
        const avatarSrc = user.profilePicture || getDefaultAvatar(user.username);
        p2AvatarHeader.src = avatarSrc;
        p2AvatarHeader.style.display = 'block';
        if (p2AvatarFallback) p2AvatarFallback.style.display = 'none';
    }

    // Update in new info bar
    const p2NameTop = document.getElementById('p2-name-top');
    if (p2NameTop) p2NameTop.textContent = user.username;

    // Update avatar image
    const p2AvatarImg = document.getElementById('p2-avatar-img');
    const p2AvatarTop = document.getElementById('p2-avatar-top');

    if (p2AvatarImg) {
        // Use profile picture if available, otherwise use default based on username
        const avatarSrc = user.profilePicture || getDefaultAvatar(user.username);
        p2AvatarImg.src = avatarSrc;
        p2AvatarImg.style.display = 'block';
        if (p2AvatarTop) p2AvatarTop.style.display = 'none';
    }

    if (p2AvatarTop) {
        p2AvatarTop.textContent = user.username ? user.username.charAt(0).toUpperCase() : 'P2';
    }

    const p2FlagTop = document.getElementById('p2-flag-top');
    if (p2FlagTop && user.nationality) {
        p2FlagTop.textContent = getFlagEmoji(user.nationality);
        p2FlagTop.title = COUNTRY_NAMES[user.nationality] || user.nationality;
    }
}

// Update turn bar text
function updateTurnBar(text) {
    const turnBarText = document.getElementById('turn-bar-text');
    if (turnBarText) turnBarText.textContent = text;

    const turnText = document.querySelector('.turn-text');
    if (turnText) turnText.textContent = text;
}

// Set active player highlight
function setActivePlayer(playerNum) {
    const p1Panel = document.getElementById('p1-panel');
    const p2Panel = document.getElementById('p2-panel');

    if (p1Panel) p1Panel.classList.toggle('active', playerNum === 1);
    if (p2Panel) p2Panel.classList.toggle('active', playerNum === 2);
}

// Export for use in other scripts
window.playerInfoManager = {
    getFlagEmoji,
    createPlayerInfoBar,
    updatePlayer1Info,
    updatePlayer2Info,
    updateTurnBar,
    setActivePlayer,
    COUNTRY_NAMES
};

// Auto-create and update when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create the player info bar
    createPlayerInfoBar();

    // Wait for currentUser to be available
    const checkInterval = setInterval(() => {
        if (window.currentUser) {
            updatePlayer1Info(window.currentUser);
            console.log('🏳️ Player info updated with nationality:', window.currentUser.nationality);
            clearInterval(checkInterval);
        }
    }, 500);

    // Stop checking after 10 seconds
    setTimeout(() => clearInterval(checkInterval), 10000);
});

// Also try immediately in case DOMContentLoaded already fired
if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(createPlayerInfoBar, 100);
}
