$file = "index.html"
$content = Get-Content $file -Raw -Encoding UTF8

# Fix all emoji characters with HTML entities
$replacements = @{
    # Controls hint emojis
    '🖱️' = '&#128433;&#65039;'  # Mouse
    '⬅️' = '&#11013;&#65039;'   # Left arrow
    '🎯' = '&#127919;'          # Target
    
    # Chat and UI emojis
    '💬' = '&#128172;'          # Speech bubble
    '✕' = '&#10005;'            # X mark
    '➤' = '&#10148;'            # Arrow
    
    # Quick chat emojis
    '🍀' = '&#127808;'          # Four leaf clover
    '👏' = '&#128079;'          # Clapping hands
    '😅' = '&#128517;'          # Grinning face with sweat
    '⏳' = '&#8987;'            # Hourglass
    '🏆' = '&#127942;'          # Trophy
    
    # Game mode emojis
    '👥' = '&#128101;'          # Busts in silhouette
    '🎱' = '&#127921;'          # Pool 8 ball
    
    # Pocket direction emojis
    '↖️' = '&#8598;&#65039;'    # Up-left arrow
    '⬆️' = '&#11014;&#65039;'   # Up arrow
    '↗️' = '&#8599;&#65039;'    # Up-right arrow
    '↙️' = '&#8601;&#65039;'    # Down-left arrow
    '⬇️' = '&#11015;&#65039;'   # Down arrow
    '↘️' = '&#8600;&#65039;'    # Down-right arrow
    
    # Instruction emojis
    '🔄' = '&#128260;'          # Counterclockwise arrows
    '⏱️' = '&#9201;&#65039;'    # Stopwatch
}

foreach ($emoji in $replacements.Keys) {
    $content = $content.Replace($emoji, $replacements[$emoji])
}

# Save with UTF-8 encoding
[System.IO.File]::WriteAllText((Resolve-Path $file).Path, $content, [System.Text.UTF8Encoding]::new($false))

Write-Host "Fixed all emoji encoding issues in $file"
