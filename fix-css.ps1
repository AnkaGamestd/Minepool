$content = Get-Content "styles.css" -Raw

# Fix the corrupted section between .player-2 .avatar and #game-main
$pattern = '(?s)(\.player-2 \.avatar \{[^}]+\})\s*====.*?#game-main'
$replacement = @'
$1

.player-details {
    display: flex;
    flex-direction: column;
    gap: 2px;
}

.player-name {
    font-weight: 600;
    font-size: 1rem;
}

.ball-type {
    font-size: 0.75rem;
    color: var(--text-secondary);
    text-transform: uppercase;
}

.turn-indicator {
    padding: 12px 25px;
    background: linear-gradient(135deg, var(--accent-gold) 0%, var(--accent-gold-dark) 100%);
    border-radius: 30px;
    animation: pulse 2s infinite;
}

.turn-text {
    font-family: 'Orbitron', sans-serif;
    font-weight: 700;
    font-size: 0.9rem;
    color: var(--bg-primary);
    text-transform: uppercase;
}

@keyframes pulse {

    0%,
    100% {
        transform: scale(1);
    }

    50% {
        transform: scale(1.02);
    }
}

/* ============================================
   MAIN GAME AREA
   ============================================ */

#game-main
'@

$content = $content -replace $pattern, $replacement

# Save the fixed content
$content | Set-Content "styles.css" -NoNewline

Write-Output "CSS file fixed successfully"
