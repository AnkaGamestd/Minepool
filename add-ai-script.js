const fs = require('fs');
let content = fs.readFileSync('www/game.html', 'utf8');
content = content.replace(
    '<script src="physics.js?v=17"></script>',
    '<script src="physics.js?v=17"></script>\n    <script src="ai-player.js?v=2"></script>'
);
fs.writeFileSync('www/game.html', content);
console.log('Added ai-player.js to game.html');
