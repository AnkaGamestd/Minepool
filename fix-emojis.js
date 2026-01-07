// fix-emojis.js - Fix broken emoji characters in HTML files
const fs = require('fs');
const path = require('path');

const files = [
    'www/index.html',
    'www/game.html',
    'www/game-mp.html',
    'www/login.html',
    'www/profile.html',
    'www/shop.html',
    'www/matchmaking.html',
    'www/tournament.html',
    'www/tournament-bracket.html',
    'www/friends.html',
    'www/settings.html',
    'www/achievements.html'
];

// Simple string replacements for broken emojis
const replacements = [
    // Logo icons
    { from: '<span class="logo-icon">??</span>', to: '<span class="logo-icon">🎱</span>' },
    { from: '<span class="header-8ball">??</span>', to: '<span class="header-8ball">🎱</span>' },
    { from: 'class="logo-icon">??<', to: 'class="logo-icon">🎱<' },

    // Rotate device
    { from: '<div class="rotate-icon">??</div>', to: '<div class="rotate-icon">📱</div>' },

    // Stat icons
    { from: '<span class="stat-icon coins">??</span>', to: '<span class="stat-icon coins">💰</span>' },
    { from: '<span class="stat-icon winrate">??</span>', to: '<span class="stat-icon winrate">📈</span>' },
    { from: '<span class="stat-icon rank">??</span>', to: '<span class="stat-icon rank">🏆</span>' },

    // Section titles
    { from: '>?? PLAY NOW<', to: '>🎮 PLAY NOW<' },
    { from: '>?? FRIENDS ACTIVITY<', to: '>👥 FRIENDS ACTIVITY<' },
    { from: '>?? DAILY REWARDS<', to: '>🎁 DAILY REWARDS<' },
    { from: '>?? DAILY TASKS<', to: '>📋 DAILY TASKS<' },
    { from: '?? CHAT', to: '💬 CHAT' },

    // Mode buttons
    {
        from: 'id="btn-online" class="btn-mode btn-online-play">\n                    <span class="mode-icon">??</span>',
        to: 'id="btn-online" class="btn-mode btn-online-play">\n                    <span class="mode-icon">🌐</span>'
    },
    {
        from: 'id="btn-2player" class="btn-mode">\n                    <span class="mode-icon">??</span>',
        to: 'id="btn-2player" class="btn-mode">\n                    <span class="mode-icon">👥</span>'
    },
    {
        from: 'id="btn-tournament" class="btn-mode btn-tournament">\n                    <span class="mode-icon">??</span>',
        to: 'id="btn-tournament" class="btn-mode btn-tournament">\n                    <span class="mode-icon">🏆</span>'
    },
    {
        from: 'id="btn-cues" class="btn-mode">\n                    <span class="mode-icon">??</span>',
        to: 'id="btn-cues" class="btn-mode">\n                    <span class="mode-icon">🎯</span>'
    },

    // Header buttons
    {
        from: 'id="btn-announcements" title="Announcements">\n                ??',
        to: 'id="btn-announcements" title="Announcements">\n                📢'
    },
    {
        from: 'id="btn-settings" title="Settings">\n                ??',
        to: 'id="btn-settings" title="Settings">\n                ⚙️'
    },

    // Nav icons
    {
        from: '<span class="nav-icon">??</span>\n                    <span class="nav-text">Home</span>',
        to: '<span class="nav-icon">🏠</span>\n                    <span class="nav-text">Home</span>'
    },
    {
        from: '<span class="nav-icon">??</span>\n                    <span class="nav-text">Shop</span>',
        to: '<span class="nav-icon">🛒</span>\n                    <span class="nav-text">Shop</span>'
    },
    {
        from: '<span class="nav-icon">??</span>\n                    <span class="nav-text">Friends</span>',
        to: '<span class="nav-icon">👥</span>\n                    <span class="nav-text">Friends</span>'
    },
    {
        from: '<span class="nav-icon">??</span>\n                    <span class="nav-text">Profile</span>',
        to: '<span class="nav-icon">👤</span>\n                    <span class="nav-text">Profile</span>'
    },

    // Friend avatar default
    {
        from: '<span>??</span>\n                    <div class="status-dot',
        to: '<span>👤</span>\n                    <div class="status-dot'
    },

    // Trophy
    { from: '<div class="trophy">??</div>', to: '<div class="trophy">🏆</div>' },

    // Chat icon
    { from: '<span class="chat-icon">??</span>', to: '<span class="chat-icon">💬</span>' },

    // View all arrow
    { from: 'View All ?</a>', to: 'View All →</a>' },

    // Generic mode icons with ?
    {
        from: '>??</span>\n                    <span class="mode-text">PLAY LIVE</span>',
        to: '>🌐</span>\n                    <span class="mode-text">PLAY LIVE</span>'
    },
    {
        from: '>??</span>\n                    <span class="mode-text">2 PLAYERS</span>',
        to: '>👥</span>\n                    <span class="mode-text">2 PLAYERS</span>'
    },
    {
        from: '>??</span>\n                    <span class="mode-text">TOURNAMENTS</span>',
        to: '>🏆</span>\n                    <span class="mode-text">TOURNAMENTS</span>'
    },
    {
        from: '>??</span>\n                    <span class="mode-text">CUES</span>',
        to: '>🎯</span>\n                    <span class="mode-text">CUES</span>'
    },

    // Quick chat buttons
    { from: '>?? Good luck!</button>', to: '>🍀 Good luck!</button>' },
    { from: '>?? Nice shot!</button>', to: '>👏 Nice shot!</button>' },
    { from: '>?? Oops!</button>', to: '>😅 Oops!</button>' },
    { from: '>?? Well played!</button>', to: '>🎯 Well played!</button>' },
    { from: '>?? Your turn!</button>', to: '>⏰ Your turn!</button>' },
    { from: '>?? GG</button>', to: '>🏆 GG</button>' },
];

console.log('🔧 Emoji Fix Script');
console.log('==================\n');

files.forEach(file => {
    const fullPath = path.join(__dirname, file);

    if (!fs.existsSync(fullPath)) {
        console.log(`❌ File not found: ${file}`);
        return;
    }

    console.log(`📄 Processing: ${file}`);
    let content = fs.readFileSync(fullPath, 'utf8');
    const originalContent = content;
    let changeCount = 0;

    replacements.forEach(r => {
        if (content.includes(r.from)) {
            content = content.split(r.from).join(r.to);
            changeCount++;
        }
    });

    if (content !== originalContent) {
        fs.writeFileSync(fullPath, content, 'utf8');
        console.log(`   ✅ Fixed ${changeCount} patterns`);
    } else {
        console.log(`   ⚪ No changes needed`);
    }
});

console.log('\n✨ Done!');
