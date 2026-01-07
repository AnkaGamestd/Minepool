/**
 * Mine Pool - Game UI
 * UI setup, event listeners, and UI update methods
 */

/**
 * Setup UI element references
 */
PoolGame.prototype.setupUI = function () {
    this.startScreen = document.getElementById('start-screen');
    this.winnerScreen = document.getElementById('winner-screen');
    this.gameMessage = document.getElementById('game-message');
    this.powerFill = document.getElementById('power-fill');
    this.powerHandle = document.getElementById('power-handle');
    this.powerGauge = document.getElementById('power-gauge');
    this.powerValue = document.getElementById('power-value');
    this.spinIndicator = document.getElementById('spin-indicator');
    this.turnIndicator = document.getElementById('turn-indicator');
    this.solidsRack = document.getElementById('solids-rack');
    this.stripesRack = document.getElementById('stripes-rack');
    this.timerText = document.getElementById('timer-text');
    this.callPocketModal = document.getElementById('call-pocket-modal');

    // Initialize ball racks
    if (this.solidsRack) {
        for (let i = 1; i <= 7; i++) {
            const ball = document.createElement('div');
            ball.className = 'rack-ball empty';
            ball.dataset.number = i;
            this.solidsRack.appendChild(ball);
        }
    }
    if (this.stripesRack) {
        for (let i = 9; i <= 15; i++) {
            const ball = document.createElement('div');
            ball.className = 'rack-ball empty';
            ball.dataset.number = i;
            this.stripesRack.appendChild(ball);
        }
    }
};

/**
 * Setup all event listeners
 */
PoolGame.prototype.setupEventListeners = function () {
    // Start screen buttons
    const btn2Player = document.getElementById('btn-2player');
    if (btn2Player) {
        btn2Player.addEventListener('click', () => {
            if (this.startScreen) {
                this.startScreen.style.display = 'none';
                this.startScreen.classList.add('hidden');
            }
            this.startGame('2player');
        });
    }

    const playAgainBtn = document.getElementById('play-again');
    if (playAgainBtn) {
        playAgainBtn.addEventListener('click', () => this.resetGame());
    }

    const backToMenuBtn = document.getElementById('btn-back-to-menu');
    if (backToMenuBtn) {
        backToMenuBtn.addEventListener('click', () => this.resetGame());
    }

    // Cue Selection
    const cueModal = document.getElementById('cue-selection-modal');
    const btnCues = document.getElementById('btn-cues');
    if (btnCues && cueModal) {
        btnCues.addEventListener('click', () => {
            cueModal.classList.remove('hidden');
        });
    }

    const closeCuesBtn = document.getElementById('close-cues');
    if (closeCuesBtn && cueModal) {
        closeCuesBtn.addEventListener('click', () => {
            cueModal.classList.add('hidden');
        });
    }

    document.querySelectorAll('.cue-card').forEach(card => {
        card.addEventListener('click', () => {
            document.querySelectorAll('.cue-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            this.currentCue = card.dataset.cue;
        });
    });

    // Canvas interactions - Mouse events
    this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
    this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
    this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
    this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

    // Canvas interactions - Touch events for mobile
    this.canvas.addEventListener('touchstart', (e) => {
        e.preventDefault();
        this.handleTouchStart(e);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
        this.handleTouchMove(e);
    }, { passive: false });

    this.canvas.addEventListener('touchend', (e) => {
        e.preventDefault();
        this.handleTouchEnd(e);
    }, { passive: false });

    this.canvas.addEventListener('touchcancel', (e) => {
        e.preventDefault();
        this.handleTouchEnd(e);
    }, { passive: false });

    // Power Gauge Touch Events (Mobile)
    if (this.powerGauge) {
        this.powerGauge.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePowerTouchStart(e);
        }, { passive: false });

        this.powerGauge.addEventListener('touchmove', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePowerTouchMove(e);
        }, { passive: false });

        this.powerGauge.addEventListener('touchend', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.handlePowerTouchEnd(e);
        }, { passive: false });
    }

    // Spin control
    const spinBall = document.querySelector('.spin-ball');
    if (spinBall) {
        spinBall.addEventListener('click', (e) => this.handleSpinClick(e));
    }

    const resetSpinBtn = document.getElementById('reset-spin');
    if (resetSpinBtn) {
        resetSpinBtn.addEventListener('click', () => this.resetSpin());
    }

    // Call Pocket buttons
    document.querySelectorAll('.pocket-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            this.calledPocket = parseInt(btn.dataset.pocket);
            if (this.callPocketModal) {
                this.callPocketModal.classList.add('hidden');
            }
            this.needsCallPocket = false;
            this.gameState = 'aiming';
            this.startShotTimer();
        });
    });
};

/**
 * Update the power gauge display
 */
PoolGame.prototype.updatePowerGauge = function () {
    if (this.powerFill) {
        this.powerFill.style.height = this.power + '%';
    }
    if (this.powerValue) {
        this.powerValue.textContent = Math.round(this.power) + '%';
    }
};

/**
 * Update the spin indicator display
 */
PoolGame.prototype.updateSpinIndicator = function () {
    if (!this.spinIndicator) return;

    const maxOffset = 20;
    const offsetX = this.spinX * maxOffset;
    const offsetY = -this.spinY * maxOffset;
    this.spinIndicator.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;

    const spinInfo = document.getElementById('spin-info');
    if (spinInfo) {
        if (this.spinX === 0 && this.spinY === 0) {
            spinInfo.textContent = 'Center Hit';
        } else {
            const horizontal = this.spinX < 0 ? 'Left' : (this.spinX > 0 ? 'Right' : '');
            const vertical = this.spinY < 0 ? 'Bottom' : (this.spinY > 0 ? 'Top' : '');
            spinInfo.textContent = (vertical + ' ' + horizontal).trim() || 'Center Hit';
        }
    }
};

/**
 * Update the turn indicator display
 */
PoolGame.prototype.updateTurnIndicator = function () {
    const indicator = this.turnIndicator;
    if (!indicator) return;

    const turnText = indicator.querySelector('.turn-text');
    const p1Name = document.getElementById('p1-name');
    const p2Name = document.getElementById('p2-name');

    if (turnText) {
        const playerName = this.currentPlayer === 1 ?
            (p1Name ? p1Name.textContent : 'Player 1') :
            (p2Name ? p2Name.textContent : 'Player 2');
        turnText.textContent = `${playerName}'s TURN`;
    }

    // Set color based on current player
    indicator.classList.remove('player1', 'player2');
    indicator.classList.add(`player${this.currentPlayer}`);

    // Update ball type indicators
    const p1Type = document.getElementById('p1-ball-type');
    const p2Type = document.getElementById('p2-ball-type');
    if (p1Type && this.playerTypes[1]) {
        p1Type.textContent = this.playerTypes[1] === 'solid' ? '●' : '○';
    }
    if (p2Type && this.playerTypes[2]) {
        p2Type.textContent = this.playerTypes[2] === 'solid' ? '●' : '○';
    }
};

/**
 * Show a game message (foul, etc)
 */
PoolGame.prototype.showMessage = function (title, text, duration = 3000) {
    if (!this.gameMessage) return;
    const msgTitle = document.getElementById('message-title');
    const msgText = document.getElementById('message-text');
    if (msgTitle) msgTitle.textContent = title;
    if (msgText) msgText.textContent = text;
    this.gameMessage.classList.remove('hidden');
    setTimeout(() => this.gameMessage.classList.add('hidden'), duration);
};

/**
 * Show winner screen
 */
PoolGame.prototype.showWinner = function (player, reason) {
    this.stopShotTimer();
    this.winner = player;
    this.gameState = 'gameover';

    const winnerScreen = this.winnerScreen;
    const winnerText = document.getElementById('winner-text');
    const p1Name = document.getElementById('p1-name');
    const p2Name = document.getElementById('p2-name');

    if (winnerScreen && winnerText) {
        const playerName = player === 1 ?
            (p1Name ? p1Name.textContent : 'PLAYER 1') :
            (p2Name ? p2Name.textContent : 'PLAYER 2');
        winnerText.textContent = `${playerName} WINS!`;
        winnerScreen.classList.remove('hidden');
    }
};

/**
 * Update ball rack UI when a ball is pocketed
 */
PoolGame.prototype.updateBallRack = function (ball) {
    if (!ball || ball.id === 0 || ball.id === 8) return;
    const rackId = ball.id < 8 ? 'solids-rack' : 'stripes-rack';
    const rack = document.getElementById(rackId);
    if (!rack) return;
    const rackBall = rack.querySelector(`[data-number="${ball.id}"]`);
    if (rackBall) {
        rackBall.classList.remove('empty');
        rackBall.style.backgroundColor = this.getBallColor(ball.id);
    }
};

/**
 * Handle spin control click
 */
PoolGame.prototype.handleSpinClick = function (e) {
    const rect = e.target.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height * 2 - 1);
    this.spinX = Math.max(-1, Math.min(1, x));
    this.spinY = Math.max(-1, Math.min(1, y));
    this.updateSpinIndicator();
};

/**
 * Reset spin to center
 */
PoolGame.prototype.resetSpin = function () {
    this.spinX = 0;
    this.spinY = 0;
    this.updateSpinIndicator();
};
