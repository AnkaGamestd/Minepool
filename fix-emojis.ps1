# PowerShell script to fix broken emojis in HTML files
# The emojis were corrupted during file operations

$files = @(
    "www\index.html",
    "www\game.html",
    "www\game-mp.html",
    "www\login.html",
    "www\profile.html",
    "www\shop.html",
    "www\matchmaking.html",
    "www\tournament.html",
    "www\tournament-bracket.html",
    "www\friends.html",
    "www\settings.html",
    "www\achievements.html"
)

# Emoji replacements mapping - ?? to actual emoji
$replacements = @{
    # Game/App icons
    '🎱' = '🎱'  # 8-ball
    # These are the broken ones we need to fix based on context
}

# Common patterns and their replacements
$patterns = @(
    # Logo
    @{ Pattern = '<span class="logo-icon">??</span>'; Replace = '<span class="logo-icon">🎱</span>' }
    @{ Pattern = '<span class="header-8ball">??</span>'; Replace = '<span class="header-8ball">🎱</span>' }
    
    # Header buttons
    @{ Pattern = '(id="btn-announcements"[^>]*>)\s*\?\?'; Replace = '$1📢'; Regex = $true }
    @{ Pattern = '(id="btn-settings"[^>]*>)\s*\?\?'; Replace = '$1⚙️'; Regex = $true }
    
    # Stat icons
    @{ Pattern = '<span class="stat-icon coins">??</span>'; Replace = '<span class="stat-icon coins">💰</span>' }
    @{ Pattern = '<span class="stat-icon winrate">??</span>'; Replace = '<span class="stat-icon winrate">📈</span>' }
    @{ Pattern = '<span class="stat-icon rank">??</span>'; Replace = '<span class="stat-icon rank">🏆</span>' }
    
    # Section titles
    @{ Pattern = '>?? PLAY NOW<'; Replace = '>🎮 PLAY NOW<' }
    @{ Pattern = '>?? FRIENDS ACTIVITY<'; Replace = '>👥 FRIENDS ACTIVITY<' }
    
    # Mode icons based on button ID
    @{ Pattern = '(id="btn-online"[^>]*>)\s*<span class="mode-icon">\?\?'; Replace = '$1<span class="mode-icon">🌐'; Regex = $true }
    @{ Pattern = '(id="btn-2player"[^>]*>)\s*<span class="mode-icon">\?\?'; Replace = '$1<span class="mode-icon">👥'; Regex = $true }
    @{ Pattern = '(id="btn-tournament"[^>]*>)\s*<span class="mode-icon">\?\?'; Replace = '$1<span class="mode-icon">🏆'; Regex = $true }
    @{ Pattern = '(id="btn-cues"[^>]*>)\s*<span class="mode-icon">\?\?'; Replace = '$1<span class="mode-icon">🎯'; Regex = $true }
    
    # Navigation icons
    @{ Pattern = '(id="nav-home"[^>]*>)\s*<span class="nav-icon">\?\?'; Replace = '$1<span class="nav-icon">🏠'; Regex = $true }
    @{ Pattern = '(id="nav-shop"[^>]*>)\s*<span class="nav-icon">\?\?'; Replace = '$1<span class="nav-icon">🛒'; Regex = $true }
    @{ Pattern = '(id="nav-friends"[^>]*>)\s*<span class="nav-icon">\?\?'; Replace = '$1<span class="nav-icon">👥'; Regex = $true }
    @{ Pattern = '(id="nav-profile"[^>]*>)\s*<span class="nav-icon">\?\?'; Replace = '$1<span class="nav-icon">👤'; Regex = $true }
    
    # Other common icons
    @{ Pattern = '<span class="rotate-icon">??</span>'; Replace = '<span class="rotate-icon">📱</span>' }
    @{ Pattern = '<span class="trophy">??</span>'; Replace = '<span class="trophy">🏆</span>' }
    @{ Pattern = '<div class="trophy">??</div>'; Replace = '<div class="trophy">🏆</div>' }
    @{ Pattern = '<span class="chat-icon">??</span>'; Replace = '<span class="chat-icon">💬</span>' }
    
    # Daily rewards
    @{ Pattern = '>?? DAILY REWARDS<'; Replace = '>🎁 DAILY REWARDS<' }
    @{ Pattern = '>?? DAILY TASKS<'; Replace = '>📋 DAILY TASKS<' }
    
    # Card/Section titles
    @{ Pattern = '<span>??</span>'; Replace = '<span>👤</span>' }
    
    # Generic remaining ??
    @{ Pattern = 'class="logo-icon">??<'; Replace = 'class="logo-icon">🎱<' }
)

Write-Host "Emoji Fix Script" -ForegroundColor Cyan
Write-Host "================`n"

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Processing: $file" -ForegroundColor Yellow
        $content = Get-Content $file -Raw -Encoding UTF8
        $originalContent = $content
        $changeCount = 0
        
        foreach ($p in $patterns) {
            if ($p.Regex) {
                $newContent = $content -replace $p.Pattern, $p.Replace
            }
            else {
                $newContent = $content.Replace($p.Pattern, $p.Replace)
            }
            if ($newContent -ne $content) {
                $changeCount++
                $content = $newContent
            }
        }
        
        if ($content -ne $originalContent) {
            Set-Content $file $content -Encoding UTF8 -NoNewline
            Write-Host "  Fixed $changeCount patterns" -ForegroundColor Green
        }
        else {
            Write-Host "  No changes needed or patterns not found" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "File not found: $file" -ForegroundColor Red
    }
}

Write-Host "`nDone!" -ForegroundColor Cyan
