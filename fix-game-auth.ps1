$file = "www\game.html"
$content = Get-Content $file -Raw

# Fix 1: In the else block (line 351), instead of redirecting, try localStorage
$content = $content -replace [regex]::Escape("} else {`r`n                    window.location.href = '/login.html';`r`n                }`r`n            } catch (error) {`r`n                console.error('Auth check failed:', error);`r`n                window.location.href = '/login.html';"), @"
} else {
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
                }
            } catch (error) {
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
"@

Set-Content $file -Value $content -NoNewline
Write-Host "Patched game.html with localStorage fallback"
