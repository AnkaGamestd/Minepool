/**
 * Generate 50 AI Bot Accounts for Mine Pool
 * Run with: node scripts/generate-bots.js
 */

const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Bot name parts for random generation
const prefixes = ['Pool', 'Cue', 'Ball', 'Strike', 'Shot', 'Pocket', 'Table', 'Chalk', 'Ace', 'Pro', 'Master', 'King', 'Queen', 'Lucky', 'Swift', 'Sharp', 'Smooth', 'Cool', 'Hot', 'Ice', 'Fire', 'Thunder', 'Shadow', 'Golden', 'Silver', 'Diamond', 'Platinum', 'Elite', 'Star', 'Flash'];
const suffixes = ['Master', 'King', 'Pro', 'Shark', 'Hustler', 'Legend', 'Wizard', 'Sniper', 'Boss', 'Champ', 'Player', 'Ace', 'Star', 'Hero', 'Slayer', 'Hunter', 'Beast', 'Wolf', 'Tiger', 'Eagle', 'Dragon', 'Phoenix', 'Ghost', 'Ninja', 'Samurai', 'Knight', 'Warrior', 'Viking', 'Pirate', 'Striker'];

const nationalities = ['US', 'UK', 'TR', 'DE', 'FR', 'ES', 'IT', 'BR', 'JP', 'KR', 'CN', 'RU', 'CA', 'AU', 'MX', 'IN', 'PH', 'TH', 'VN', 'ID'];

const cueOptions = ['standard', 'dragons_breath', 'neon_striker', 'frost_bite', 'golden_classic', 'midnight_shadow'];

function generateRandomName() {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    const num = Math.floor(Math.random() * 100);
    return `${prefix}${suffix}${num}`;
}

function generateBotAccounts(count = 50) {
    const usersPath = path.join(__dirname, '..', 'data', 'users.json');
    let users = [];

    try {
        users = JSON.parse(fs.readFileSync(usersPath, 'utf8'));
    } catch (e) {
        console.log('No existing users.json, creating new one');
    }

    // Find highest existing ID
    let maxId = users.reduce((max, u) => Math.max(max, u.id || 0), 0);

    // Generate bot password hash (not used, but required)
    const botPassword = bcrypt.hashSync('bot_password_not_used', 10);

    const usedNames = new Set(users.map(u => u.username));
    const bots = [];

    for (let i = 0; i < count; i++) {
        let name;
        do {
            name = generateRandomName();
        } while (usedNames.has(name));
        usedNames.add(name);

        maxId++;

        const bot = {
            id: maxId,
            username: name,
            email: `bot${maxId}@minepool.ai`,
            password: botPassword,
            provider: 'bot',
            isBot: true,  // Important: identifies as AI
            coins: 5000 + Math.floor(Math.random() * 10000),
            elo: 1000 + Math.floor(Math.random() * 800), // 1000-1800 ELO range
            gamesPlayed: 20 + Math.floor(Math.random() * 200),
            gamesWon: 0, // Will be calculated
            nationality: nationalities[Math.floor(Math.random() * nationalities.length)],
            profilePicture: null, // Will use avatar letter
            cues: [cueOptions[Math.floor(Math.random() * cueOptions.length)]],
            achievements: [],
            matchHistory: [],
            createdAt: new Date().toISOString(),
            // AI-specific settings
            aiDifficulty: 'medium-hard',
            aiAccuracy: 0.75 + Math.random() * 0.1, // 75-85% accuracy
        };

        // Calculate realistic win rate based on ELO
        const winRate = 0.4 + (bot.elo - 1000) / 2000; // Higher ELO = higher win rate
        bot.gamesWon = Math.floor(bot.gamesPlayed * winRate);

        bots.push(bot);
    }

    // Add bots to users array
    users = users.concat(bots);

    // Save updated users.json
    fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));

    console.log(`✅ Created ${count} bot accounts`);
    console.log(`📊 Total users now: ${users.length}`);
    console.log(`\nSample bot names:`);
    bots.slice(0, 5).forEach(b => console.log(`  - ${b.username} (ELO: ${b.elo})`));
}

generateBotAccounts(50);
