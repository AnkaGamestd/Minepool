// Compact Turn Indicator - Toggle active class on player avatars
(function () {
    document.addEventListener('DOMContentLoaded', function () {
        const player1 = document.querySelector('#game-header .player-1');
        const player2 = document.querySelector('#game-header .player-2');

        if (!player1 || !player2) {
            console.warn('Player elements not found in header');
            return;
        }

        // Function to update active state based on turn text
        function updateActivePlayer() {
            const turnText = document.querySelector('.turn-text');
            if (!turnText) return;

            const text = turnText.textContent.toUpperCase();

            // Determine which player's turn it is
            if (text.includes('PLAYER 1') || text.includes('P1') || text.includes('YOUR TURN')) {
                player1.classList.add('active');
                player2.classList.remove('active');
            } else if (text.includes('PLAYER 2') || text.includes('P2') || text.includes('OPPONENT')) {
                player1.classList.remove('active');
                player2.classList.add('active');
            }

            // Also check game instance for more accurate state
            if (window.gameInstance) {
                const game = window.gameInstance;
                if (game.currentPlayer === 1) {
                    player1.classList.add('active');
                    player2.classList.remove('active');
                } else if (game.currentPlayer === 2) {
                    player1.classList.remove('active');
                    player2.classList.add('active');
                }
            }
        }

        // Initial state - Player 1 starts
        player1.classList.add('active');
        player2.classList.remove('active');

        // Poll for changes every 200ms
        setInterval(updateActivePlayer, 200);

        console.log('✅ Compact turn indicator initialized');
    });
})();
