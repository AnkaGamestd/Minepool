$loginFile = "www\login.html"
$gameFile = "www\game.html"

# Fix login.html - add token storage after login
$loginContent = Get-Content $loginFile -Raw
$loginContent = $loginContent -replace "localStorage\.setItem\('user', JSON\.stringify\(data\.user\)\);", "localStorage.setItem('user', JSON.stringify(data.user)); if (data.token) localStorage.setItem('authToken', data.token);"
Set-Content $loginFile -Value $loginContent -NoNewline
Write-Host "Fixed login.html"

# Fix game.html - add Authorization header
$gameContent = Get-Content $gameFile -Raw
$gameContent = $gameContent -replace "const response = await fetch\('/api/auth/me', \{ credentials: 'include' \}\);", "const authToken = localStorage.getItem('authToken'); const response = await fetch('/api/auth/me', { credentials: 'include', headers: authToken ? { 'Authorization': 'Bearer ' + authToken } : {} });"
Set-Content $gameFile -Value $gameContent -NoNewline
Write-Host "Fixed game.html"

Write-Host "Done"
