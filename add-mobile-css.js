const fs = require('fs');

// Add mobile-app.css link to index.html
const files = ['index.html', 'www/index.html'];

files.forEach(file => {
    try {
        let html = fs.readFileSync(file, 'utf8');
        if (!html.includes('mobile-app.css')) {
            html = html.replace(
                'href="styles.css">',
                'href="styles.css">\n    <link rel="stylesheet" href="mobile-app.css">'
            );
            fs.writeFileSync(file, html);
            console.log(`Added mobile-app.css link to ${file}`);
        } else {
            console.log(`${file} already has mobile-app.css`);
        }
    } catch (e) {
        console.log(`Could not update ${file}: ${e.message}`);
    }
});
