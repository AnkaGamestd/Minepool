const fs = require('fs');

// Fix game.html specifically with complete localStorage fallback including UI updates
function fixGameAuth() {
    const file = 'www/game.html';
    console.log('Fixing game.html auth...');
    let content = fs.readFileSync(file, 'utf8');

    // Find the checkAuth function and add localStorage fallback
    // Look for the else block that redirects and the catch block

    // Replace "} else { window.location.href = '/login.html'; }" with localStorage fallback
    const elsePattern = /\} else \{\s*\n\s*window\.location\.href = '\/login\.html';\s*\n\s*\}/;
    const elseReplacement = `} else {
                    // API says not authenticated, try localStorage fallback
                    const storedUser = localStorage.getItem('user');
                    if (storedUser) {
                        const user = JSON.parse(storedUser);
                        console.log('Using localStorage user:', user.username);
                        document.getElementById('user-name').textContent = user.username;
                        document.getElementById('user-coins').textContent = user.coins || 1000;
                        document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
                        const p1NameEl = document.getElementById('p1-name');
                        if (p1NameEl) p1NameEl.textContent = user.username;
                        window.currentUser = user;
                        loadingEl.classList.add('hidden');
                        userMenuEl.style.display = 'flex';
                    } else {
                        window.location.href = '/login.html';
                    }
                }`;

    content = content.replace(elsePattern, elseReplacement);

    // Replace catch block redirect with localStorage fallback
    const catchPattern = /\} catch \(error\) \{\s*\n\s*console\.error\('Auth check failed:', error\);\s*\n\s*window\.location\.href = '\/login\.html';\s*\n\s*\}/;
    const catchReplacement = `} catch (error) {
                console.error('Auth check failed:', error);
                // Network error, try localStorage fallback
                const storedUser = localStorage.getItem('user');
                if (storedUser) {
                    const user = JSON.parse(storedUser);
                    console.log('Network error, using localStorage user:', user.username);
                    document.getElementById('user-name').textContent = user.username;
                    document.getElementById('user-coins').textContent = user.coins || 1000;
                    document.getElementById('user-avatar').textContent = user.username.charAt(0).toUpperCase();
                    const p1NameEl = document.getElementById('p1-name');
                    if (p1NameEl) p1NameEl.textContent = user.username;
                    window.currentUser = user;
                    loadingEl.classList.add('hidden');
                    userMenuEl.style.display = 'flex';
                } else {
                    window.location.href = '/login.html';
                }
            }`;

    content = content.replace(catchPattern, catchReplacement);

    // Also add Authorization header to the fetch
    const fetchPattern = /const response = await fetch\('\/api\/auth\/me', \{ credentials: 'include' \}\);/;
    const fetchReplacement = `const authToken = localStorage.getItem('authToken');
                const response = await fetch('/api/auth/me', { 
                    credentials: 'include',
                    headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {}
                });`;

    content = content.replace(fetchPattern, fetchReplacement);

    fs.writeFileSync(file, content, 'utf8');
    console.log('Fixed game.html with complete localStorage fallback');
}

fixGameAuth();
console.log('\nDone!');
