const fs = require('fs');

// Fix a file by wrapping login redirects with localStorage check
function fixAuthRedirects(filePath) {
    console.log(`Fixing ${filePath}...`);
    let content = fs.readFileSync(filePath, 'utf8');

    // Count occurrences before
    const before = (content.match(/window\.location\.href = '\/login\.html';/g) || []).length;

    // Replace login redirects with localStorage fallback
    // Only redirect if no user in localStorage
    content = content.replace(
        /window\.location\.href = '\/login\.html';/g,
        `{
                    const _storedUser = localStorage.getItem('user');
                    if (!_storedUser) {
                        window.location.href = '/login.html';
                    } else {
                        console.log('Using localStorage user instead of redirecting');
                        window.currentUser = JSON.parse(_storedUser);
                    }
                }`
    );

    // Count occurrences after
    const after = (content.match(/window\.location\.href = '\/login\.html';/g) || []).length;

    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`  Replaced ${before} redirect(s) in ${filePath}`);
}

// Fix all key pages
const files = [
    'www/game.html',
    'www/profile.html',
    'www/settings.html',
    'www/index.html'
];

files.forEach(file => {
    try {
        fixAuthRedirects(file);
    } catch (e) {
        console.error(`Error fixing ${file}:`, e.message);
    }
});

console.log('\nDone! All auth redirects now check localStorage first.');
