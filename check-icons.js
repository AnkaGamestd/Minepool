// check-icons.js - Check for broken icons in HTML files
const fs = require('fs');

const files = [
    'www/index.html',
    'www/game.html',
    'www/login.html',
    'www/profile.html',
    'www/shop.html',
    'www/matchmaking.html',
    'www/tournament.html',
    'www/friends.html'
];

console.log('🔍 Checking for broken icons...\n');

files.forEach(file => {
    if (!fs.existsSync(file)) {
        console.log(`❌ ${file}: File not found`);
        return;
    }

    const content = fs.readFileSync(file, 'utf8');

    // Check for ?? patterns
    const brokenQQ = (content.match(/>\s*\?\?\s*</g) || []).length;

    // Check for common icon patterns
    const logoIcon = content.match(/class="logo-icon">([^<]+)</);
    const modeIcons = content.match(/class="mode-icon">([^<]+)</g);
    const navIcons = content.match(/class="nav-icon">([^<]+)</g);
    const statIcons = content.match(/class="stat-icon[^"]*">([^<]+)</g);

    console.log(`📄 ${file}:`);
    console.log(`   Broken ?? patterns: ${brokenQQ}`);

    if (logoIcon) console.log(`   Logo icon: ${logoIcon[1]}`);
    if (modeIcons) console.log(`   Mode icons: ${modeIcons.length} found`);
    if (navIcons) console.log(`   Nav icons: ${navIcons.length} found`);
    if (statIcons) console.log(`   Stat icons: ${statIcons.length} found`);
    console.log('');
});

console.log('✨ Check complete!');
