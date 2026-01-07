$content = Get-Content 'www/index.html' -Raw

# Update stake values
$content = $content -replace 'data-stake="25"', 'data-stake="50"'
$content = $content -replace 'selectStake\(this, 25\)', 'selectStake(this, 50)'
$content = $content -replace '<span class="stake-card-amount">25</span>', '<span class="stake-card-amount">50</span>'

# Update 50 to 100 (but keep the ones we just changed as 50)
$content = $content -replace 'data-stake="50" onclick="selectStake\(this, 50\)">\s*<span class="stake-card-icon">🥈', 'data-stake="100" onclick="selectStake(this, 100)"><span class="stake-card-icon">🥈'
$content = $content -replace '🥈</span>\s*<span class="stake-card-amount">50</span>', '🥈</span><span class="stake-card-amount">100</span>'

# Update 100 to 250
$content = $content -replace 'data-stake="100" onclick="selectStake\(this, 100\)">\s*<span class="stake-card-icon">🥇', 'data-stake="250" onclick="selectStake(this, 250)"><span class="stake-card-icon">🥇'
$content = $content -replace '🥇</span>\s*<span class="stake-card-amount">100</span>', '🥇</span><span class="stake-card-amount">250</span>'

# Update 250 to 500
$content = $content -replace 'data-stake="250" onclick="selectStake\(this, 250\)">\s*<span class="stake-card-icon">💎', 'data-stake="500" onclick="selectStake(this, 500)"><span class="stake-card-icon">💎'
$content = $content -replace '💎</span>\s*<span class="stake-card-amount">250</span>', '💎</span><span class="stake-card-amount">500</span>'

# Update 500 to 1000
$content = $content -replace 'data-stake="500" onclick="selectStake\(this, 500\)">\s*<span class="stake-card-icon">💜', 'data-stake="1000" onclick="selectStake(this, 1000)"><span class="stake-card-icon">❤️‍🔥'
$content = $content -replace '💜</span>\s*<span class="stake-card-amount">500</span>', '❤️‍🔥</span><span class="stake-card-amount">1K</span>'
$content = $content -replace '<span class="stake-card-name">Ruby</span>', '<span class="stake-card-name">Ruby</span>'

# Update 1000 to 2500
$content = $content -replace 'data-stake="1000" onclick="selectStake\(this, 1000\)">\s*<span class="stake-card-icon">👑', 'data-stake="2500" onclick="selectStake(this, 2500)"><span class="stake-card-icon">👑'
$content = $content -replace '👑</span>\s*<span class="stake-card-amount">1K</span>\s*<span class="stake-card-name">Crown</span>', '👑</span><span class="stake-card-amount">2.5K</span><span class="stake-card-name">Crown</span>'

Set-Content 'www/index.html' $content -NoNewline

Write-Host "Stakes updated successfully!"
