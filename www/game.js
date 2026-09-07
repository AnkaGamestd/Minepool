/**
 * Mine Pool Game Logic
 * Main game controller and rendering
 */

class PoolGame {
    constructor() {
        console.log('PoolGame constructor started...');

        this.canvas = document.getElementById('pool-table');
        if (!this.canvas) {
            throw new Error('Canvas element "pool-table" not found!');
        }
        console.log('Canvas found');

        this.ctx = this.canvas.getContext('2d');
        console.log('Canvas context created');

        // Table dimensions
        this.tableWidth = 1000;
        this.tableHeight = 500;
        this.cushionWidth = 25;

        // Backing pixels follow the display; physics and pointer input remain
        // in the original 1000 x 500 logical table coordinate system.
        this.resizeSurface = () => {
            const rect = this.canvas.getBoundingClientRect();
            if (!rect.width || !rect.height) return;
            const density = Math.min(window.devicePixelRatio || 1, 3);
            const scale = Math.min(3, Math.max(1, rect.width * density / this.tableWidth));
            const width = Math.round(this.tableWidth * scale);
            const height = Math.round(this.tableHeight * scale);
            if (this.canvas.width !== width || this.canvas.height !== height) {
                this.canvas.width = width;
                this.canvas.height = height;
            }
            this.ctx.setTransform(width / this.tableWidth, 0, 0, height / this.tableHeight, 0, 0);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        };
        this.canvas.width = this.tableWidth;
        this.canvas.height = this.tableHeight;
        this.surfaceObserver = new ResizeObserver(this.resizeSurface);
        this.surfaceObserver.observe(this.canvas);
        window.addEventListener('resize', this.resizeSurface);
        this.resizeSurface();
        console.log('Canvas sized');

        // Initialize systems
        if (typeof PhysicsEngine === 'undefined') {
            alert('PhysicsEngine not loaded! Check console for errors.');
            throw new Error('PhysicsEngine not loaded');
        }
        console.log('Creating PhysicsEngine...');
        this.physics = new PhysicsEngine();
        this.physics.initTable(this.tableWidth, this.tableHeight, this.cushionWidth);
        console.log('PhysicsEngine initialized');

        console.log('Creating SoundManager...');
        this.sound = new SoundManager();
        this.physics.setSoundManager(this.sound);
        console.log('SoundManager initialized');

        // Load the cue from the local mobile player profile.
        const savedCue = window.MinePoolPlatform?.getPlayer()?.selectedCue || window.selectedCue || 'standard';
        // Valid cue IDs in the game
        const validCues = ['standard', 'premium', 'legendary', 'dragon', 'ice', 'viper', 'phoenix', 'shadow',
            'dragons_breath', 'neon_striker', 'frost_bite', 'shadow_master', 'classic_oak'];
        this.selectedCue = validCues.includes(savedCue) ? savedCue : 'standard';
        console.log('Selected cue loaded:', this.selectedCue);

        // Game state
        this.balls = [];
        this.currentPlayer = 1;
        this.playerTypes = { 1: null, 2: null }; // 'solid' or 'stripe'
        this.gameMode = null;
        this.gameState = 'start';
        this.ballInHand = false;
        this.ballInHandKitchen = false; // True when ball-in-hand is restricted to kitchen
        this.tableState = 'open'; // 'open' or 'closed'
        this.isBreakShot = true;
        this.foulReason = null;
        this.winner = null;
        this.aiDifficulty = 'medium';
        this.aiPlayer = null;
        this.aiTurnTimeout = null;

        // MINICLIP FEATURES
        this.shotTimer = null;
        this.shotTimeLimit = 30; // 30 seconds per shot
        this.timeRemaining = 30;
        this.calledPocket = null; // For 8-ball shot
        this.needsCallPocket = false;
        this.shotPocketedBalls = []; // Track pocketed balls during current shot

        // Ball-in-hand dragging
        this.isDraggingBall = false;

        // Aiming
        this.aimAngle = 0;
        this.power = 0;
        this.spinX = 0;
        this.spinY = 0;
        this.isDragging = false;
        this.dragStartX = 0;
        this.dragStartY = 0;
        this.aimLocked = false;

        // Animation
        this.animationId = null;

        // ========== MOBILE CONTROLS ==========
        // Detect mobile/touch device
        this.isMobile = ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        // Mobile control settings (adjustable for sensitivity)
        this.mobileSettings = {
            aimSensitivity: 0.003,      // How fast aim changes with swipe (lower = more precise)
            powerSensitivity: 0.8,      // How fast power builds (lower = more control)
            minSwipeDistance: 20,       // Minimum pixels to register as a swipe
            maxPower: 100,              // Max power cap
            tapThreshold: 200,          // Time in ms to distinguish tap from drag
            deadZone: 10,               // Pixels of movement ignored (prevents jitter)
        };

        // Mobile touch state tracking
        this.mobileTouch = {
            startX: 0,
            startY: 0,
            startTime: 0,
            currentX: 0,
            currentY: 0,
            lastX: 0,              // For delta tracking
            lastY: 0,              // For delta tracking
            isAiming: false,
            isPullingBack: false,
            initialAimAngle: 0,
            touchId: null,
        };

        // Visual feedback for mobile
        this.touchFeedback = {
            visible: false,
            x: 0,
            y: 0,
            radius: 30,
            pullIndicator: { x: 0, y: 0, visible: false }
        };

        // UI Elements
        console.log('Setting up UI...');
        this.setupUI();
        console.log('UI setup complete');

        console.log('Setting up event listeners...');
        this.setupEventListeners();
        console.log('Event listeners setup complete');

        // Initialize balls and render table immediately so it's visible when page loads
        console.log('Initializing table view...');
        this.initializeBalls();
        this.render();
        console.log('Table rendered - ready for game start');

        console.log('PoolGame constructor finished successfully');
    }

    setupUI() {
        this.startScreen = document.getElementById('start-screen');
        this.winnerScreen = document.getElementById('winner-screen');
        this.gameMessage = document.getElementById('game-message');
        this.powerFill = document.getElementById('power-fill');
        this.powerHandle = document.getElementById('power-handle'); // New handle
        this.powerGauge = document.getElementById('power-gauge');   // Gauge container
        this.powerValue = document.getElementById('power-value');
        this.spinIndicator = document.getElementById('spin-indicator');
        this.turnIndicator = document.getElementById('turn-indicator');
        this.solidsRack = document.getElementById('solids-rack');
        this.stripesRack = document.getElementById('stripes-rack');
        this.timerText = document.getElementById('timer-text');
        this.callPocketModal = document.getElementById('call-pocket-modal');

        // Initialize ball racks
        for (let i = 1; i <= 7; i++) {
            const ball = document.createElement('div');
            ball.className = 'rack-ball empty';
            ball.dataset.number = i;
            this.solidsRack.appendChild(ball);
        }
        for (let i = 9; i <= 15; i++) {
            const ball = document.createElement('div');
            ball.className = 'rack-ball empty';
            ball.dataset.number = i;
            this.stripesRack.appendChild(ball);
        }
    }

    setupEventListeners() {
        // Start screen buttons (may not exist on game.html)
        const btn2player = document.getElementById('btn-2player');
        if (btn2player) {
            btn2player.addEventListener('click', () => {
                if (this.startScreen) {
                    this.startScreen.style.display = 'none';
                    this.startScreen.classList.add('hidden');
                }
                this.startGame('2player');
            });
        }

        const playAgainBtn = document.getElementById('play-again');
        if (playAgainBtn) {
            playAgainBtn.addEventListener('click', () => {
                window.MinePoolApp?.rematch();
            });
        }

        const backToMenuBtn = document.getElementById('btn-back-to-menu');
        if (backToMenuBtn) {
            backToMenuBtn.addEventListener('click', () => {
                window.MinePoolApp?.showMenu();
            });
        }

        // Cue Selection (may not exist on game.html)
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
                // Remove active class from all
                document.querySelectorAll('.cue-card').forEach(c => c.classList.remove('active'));
                // Add to clicked
                card.classList.add('active');
                // Set current cue
                this.currentCue = card.dataset.cue;
            });
        });

        // Canvas interactions - Mouse events
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());

        // Canvas interactions - Touch events for mobile (IMPROVED)
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
            this.isDraggingBall = false;
            this.cancelCueInput();
        }, { passive: false });

        this.bindEquipmentControls();

        // Call Pocket buttons
        document.querySelectorAll('.pocket-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                this.calledPocket = parseInt(btn.dataset.pocket);
                this.callPocketModal.classList.add('hidden');
                this.needsCallPocket = false;
                // Resume game state
                this.gameState = 'aiming';
                this.startShotTimer();
            });
        });


    }

    startGame(mode) {
        try {
            this.gameMode = mode;
            this.isMultiplayer = mode === 'multiplayer';
            if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
            this.aiTurnTimeout = null;
            if ((mode === 'ai' || mode === 'tournament') && typeof AIPlayer !== 'undefined') {
                this.aiPlayer = new AIPlayer(this.aiDifficulty || 'medium');
            } else {
                this.aiPlayer = null;
            }
            // Hide start screen if it exists (may not exist on game.html)
            if (this.startScreen) {
                this.startScreen.style.display = 'none';
            }
            document.body.classList.add('game-active'); // Enable rotate overlay for mobile portrait
            this.initializeBalls();
            this.playerTypes = { 1: null, 2: null };
            this.tableState = 'open';
            this.calledPocket = null;
            this.needsCallPocket = false;
            this.gameState = 'aiming';
            this.currentPlayer = 1;
            this.gameStartTime = Date.now(); // Track game start for duration calculation

            // Enable ball placement in kitchen for break shot
            this.ballInHand = true;
            this.ballInHandKitchen = true;
            this.isBreakShot = true;

            this.updateTurnIndicator();
            this.showMessage('BREAK SHOT', 'Place the cue ball anywhere in the kitchen (behind the line)');
            this.startShotTimer(); // Start timer for first shot
            this.animate();
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error starting game: ' + error.message);
        }
    }

    // Called when multiplayer game starts from server
    onGameStart(data) {
        console.log('🎮 Multiplayer game starting!', data);

        try {
            // Store multiplayer info
            this.isMultiplayer = true;
            this.roomId = data.roomId;
            this.multiplayerData = data;

            // Determine if we're player 1 or 2
            const myId = window.networkManager?.getPlayerId();
            console.log(`🆔 ID Check: My ID: ${myId}, Host ID: ${data.host?.id}, Guest ID: ${data.guest?.id}`);

            this.myPlayerNumber = (data.host?.id === myId) ? 1 : 2;
            this.isMyTurn = (data.currentPlayer === this.myPlayerNumber);

            console.log(`I am Player ${this.myPlayerNumber} (ID: ${myId}), it's ${this.isMyTurn ? 'MY' : 'OPPONENT'} turn`);

            // Hide start screen
            if (this.startScreen) {
                this.startScreen.style.display = 'none';
                this.startScreen.classList.add('hidden');
            }
            document.body.classList.add('game-active'); // Enable rotate overlay for mobile portrait

            // Initialize the game
            this.gameMode = 'multiplayer';
            this.initializeBalls();
            this.gameState = 'aiming';
            this.currentPlayer = data.currentPlayer || 1;

            // Update player names and avatars in UI
            if (data.host && window.playerInfoManager) {
                window.playerInfoManager.updatePlayer1Info(data.host);
            }
            if (data.guest && window.playerInfoManager) {
                window.playerInfoManager.updatePlayer2Info(data.guest);
            }
            const hostName = data.host?.username || 'Player 1';
            const guestName = data.guest?.username || 'Player 2';
            const p1Name = document.getElementById('p1-name');
            const p2Name = document.getElementById('p2-name');
            const p1Avatar = document.querySelector('#p1-panel .avatar');
            const p2Avatar = document.querySelector('#p2-panel .avatar');
            if (p1Name) p1Name.textContent = hostName;
            if (p2Name) p2Name.textContent = guestName;
            if (p1Avatar) window.MinePoolAvatar?.render(p1Avatar, { displayName: hostName, avatarText: hostName.charAt(0).toUpperCase(), avatarUrl: data.host?.profilePicture });
            if (p2Avatar) window.MinePoolAvatar?.render(p2Avatar, { displayName: guestName, avatarText: guestName.charAt(0).toUpperCase(), avatarUrl: data.guest?.profilePicture });

            // Enable ball placement for break shot (only for player 1)
            if (this.myPlayerNumber === 1) {
                this.ballInHand = true;
                this.ballInHandKitchen = true;
            }
            this.isBreakShot = true;

            this.updateTurnIndicator();
            const currencyIcon = 'coin';
            const currencyName = 'Coins';
            this.showMessage(data.friendMatch ? 'FRIEND MATCH' : 'MULTIPLAYER GAME', `${this.isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN'} - Wager: ${data.wager ?? 50} ${currencyIcon}`);
            this.startShotTimer();
            this.animate();

        } catch (error) {
            console.error('Error starting multiplayer game:', error);
            alert('Error starting multiplayer game: ' + error.message);
        }
    }

    // Called when opponent is disconnecting (30s timer starts)
    onOpponentDisconnecting(data) {
        console.log('⏱️ Opponent disconnecting, waiting for reconnection...', data);
        this.showReconnectionTimer(data.disconnectedPlayer, data.timeout);
    }

    // Called when opponent reconnects
    onOpponentReconnected(data) {
        console.log('✅ Opponent reconnected!', data);
        this.hideReconnectionTimer();
        this.showMessage('RECONNECTED', `${data.reconnectedPlayer} has reconnected!`);
    }

    // Called when we rejoin a game after disconnecting
    onGameRejoin(data) {
        console.log('🔄 Rejoining game...', data);
        try {
            this.isMultiplayer = true;
            this.roomId = data.roomId;
            this.myPlayerNumber = data.myPlayerNumber;

            if (this.startScreen) {
                this.startScreen.style.display = 'none';
                this.startScreen.classList.add('hidden');
            }
            document.body.classList.add('game-active'); // Enable rotate overlay for mobile portrait

            this.gameMode = 'multiplayer';
            this.gameState = 'aiming';

            if (data.gameState && data.gameState.balls) {
                this.balls = data.gameState.balls;
            }

            this.currentPlayer = data.gameState?.currentPlayer || 1;
            this.isMyTurn = (this.currentPlayer === this.myPlayerNumber);
            this.tableState = data.gameState?.tableOpen ? 'open' : 'assigned';
            this.playerTypes = data.gameState?.playerTypes || { 1: null, 2: null };
            this.isBreakShot = data.gameState?.isBreakShot || false;
            this.ballInHand = data.gameState?.ballInHand || false;
            this.ballInHandKitchen = data.gameState?.ballInHandKitchen || false;

            this.updateTurnIndicator();
            this.showMessage('RECONNECTED', 'You have rejoined the game!');
            this.startShotTimer();
            this.animate();
        } catch (error) {
            console.error('Error rejoining game:', error);
        }
    }

    // Show reconnection timer overlay
    showReconnectionTimer(playerName, seconds) {
        let overlay = document.getElementById('reconnect-timer-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'reconnect-timer-overlay';
            overlay.innerHTML = `
                <div class="reconnect-content">
                    <div class="reconnect-icon">⏱️</div>
                    <h2>OPPONENT DISCONNECTED</h2>
                    <p class="reconnect-player"></p>
                    <div class="reconnect-timer">
                        <span class="timer-value">30</span>
                        <span class="timer-label">seconds remaining</span>
                    </div>
                    <p class="reconnect-message">Waiting for reconnection...</p>
                </div>
            `;
            overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0, 0, 0, 0.8); display: flex;
                align-items: center; justify-content: center; z-index: 10000;
            `;
            const content = overlay.querySelector('.reconnect-content');
            content.style.cssText = `
                text-align: center; color: white; padding: 40px;
                background: linear-gradient(135deg, rgba(255, 100, 100, 0.2), rgba(200, 50, 50, 0.3));
                border: 2px solid rgba(255, 100, 100, 0.5); border-radius: 20px;
                backdrop-filter: blur(10px);
            `;
            overlay.querySelector('.timer-value').style.cssText = `
                font-size: 64px; font-weight: bold; color: #ff6b6b; display: block;
            `;
            document.body.appendChild(overlay);
        }

        overlay.querySelector('.reconnect-player').textContent = `${playerName} has disconnected`;
        overlay.querySelector('.timer-value').textContent = seconds;
        overlay.style.display = 'flex';

        this.reconnectCountdown = seconds;
        this.reconnectTimerInterval = setInterval(() => {
            this.reconnectCountdown--;
            const timerEl = document.querySelector('#reconnect-timer-overlay .timer-value');
            if (timerEl) timerEl.textContent = this.reconnectCountdown;
            if (this.reconnectCountdown <= 0) clearInterval(this.reconnectTimerInterval);
        }, 1000);
    }

    // Hide reconnection timer overlay
    hideReconnectionTimer() {
        const overlay = document.getElementById('reconnect-timer-overlay');
        if (overlay) overlay.style.display = 'none';
        if (this.reconnectTimerInterval) {
            clearInterval(this.reconnectTimerInterval);
            this.reconnectTimerInterval = null;
        }
    }

    animate(timestamp) {
        if (this.platformPaused) return;

        // Run at 60 simulation steps per second on every refresh rate.
        if (timestamp === undefined) {
            this.lastPhysicsTime = performance.now();
            this.physicsAccumulator = 0;
            timestamp = this.lastPhysicsTime;
        }
        const elapsed = Math.min(0.1, Math.max(0, (timestamp - this.lastPhysicsTime) / 1000));
        this.lastPhysicsTime = timestamp;
        this.physicsAccumulator = this.gameState === 'shooting' ? this.physicsAccumulator + elapsed : 0;
        while (this.gameState === 'shooting' && this.physicsAccumulator + 1e-9 >= this.physics.dt) {
            this.physicsAccumulator -= this.physics.dt;
            const pocketed = this.physics.update(this.balls);

            // Handle pocketed balls
            if (pocketed && pocketed.length > 0) {
                this.shotPocketedBalls.push(...pocketed);
                pocketed.forEach(ball => { this.updateBallRack(ball); });
            }
        }

        // Render
        this.render();

        // Continue loop
        this.animationId = requestAnimationFrame((time) => this.animate(time));
    }

    pauseForPlatform() {
        if (this.platformPaused) return;
        this.platformPaused = true;
        document.documentElement.classList.add('platform-paused');
        if (this.animationId) cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.stopShotTimer();
        this.sound.audioContext?.suspend();
    }

    resumeFromPlatform() {
        if (!this.platformPaused) return;
        this.platformPaused = false;
        document.documentElement.classList.remove('platform-paused');
        if (window.MinePoolPlatform?.isAudioEnabled()) this.sound.audioContext?.resume();
        if (this.gameState !== 'gameover' && this.gameState !== 'start') {
            this.startShotTimer();
            this.animate();
        }
    }

    initializeBalls() {
        this.balls = [];
        // Cue ball
        this.balls.push({
            id: 0,
            x: this.tableWidth * 0.25,
            y: this.tableHeight / 2,
            vx: 0,
            vy: 0,
            spinX: 0,
            spinY: 0,
            rotation: 0,
            active: true,
            type: 'cue'
        });

        // Rack position
        const rackX = this.tableWidth * 0.75;
        const rackY = this.tableHeight / 2;
        const ballRadius = this.physics.BALL_RADIUS;
        const spacing = ballRadius * 2 + 1;

        // Standard 8-ball rack formation (synchronized with server):
        // Using same order as server: RoomManager.js
        const rackOrder = [1, 9, 2, 10, 8, 3, 11, 4, 12, 5, 13, 6, 14, 7, 15];
        let ballIndex = 0;
        for (let row = 0; row < 5; row++) {
            for (let col = 0; col <= row; col++) {
                const x = rackX + row * spacing * Math.sqrt(3) / 2;
                const y = rackY + (col - row / 2) * spacing;
                const ballNumber = rackOrder[ballIndex++];
                this.balls.push({
                    id: ballNumber,
                    x: x,
                    y: y,
                    vx: 0,
                    vy: 0,
                    spinX: 0,
                    spinY: 0,
                    rotation: 0,
                    active: true,
                    type: ballNumber === 8 ? 'eight' : (ballNumber < 8 ? 'solid' : 'stripe')
                });
            }
        }
    }

    touchToMouse(touch, type) {
        return {
            clientX: touch.clientX,
            clientY: touch.clientY,
            type: type,
            preventDefault: () => { },
            stopPropagation: () => { }
        };
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for canvas scaling (CSS size vs internal size)
        const scaleX = this.tableWidth / rect.width;
        const scaleY = this.tableHeight / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // MULTIPLAYER: Only allow interaction if it's your turn
        if (this.isMultiplayer && !this.isMyTurn) {
            return;
        }

        // BALL IN HAND - DRAG CUE BALL
        if (this.ballInHand && this.isDraggingBall) {
            const cueBall = this.balls[0];
            const r = this.physics.BALL_RADIUS;
            const c = this.cushionWidth;

            // Kitchen restriction for break shot (only left quarter of table)
            const kitchenLine = this.tableWidth * 0.25;

            if (this.ballInHandKitchen) {
                // Restrict to kitchen area (behind head string)
                cueBall.x = Math.max(c + r, Math.min(kitchenLine - r, mouseX));
            } else {
                // Full table placement
                cueBall.x = Math.max(c + r, Math.min(this.tableWidth - c - r, mouseX));
            }
            cueBall.y = Math.max(c + r, Math.min(this.tableHeight - c - r, mouseY));
            return;
        }

        // Set cursor for ball-in-hand (when not dragging)
        if (this.ballInHand) {
            this.canvas.style.cursor = 'grab';
            return;
        }

        if (this.gameState === 'aiming') {
            const cueBall = this.balls[0];
            if (!this.aimLocked) {
                this.aimAngle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
            }
            if (this.isDragging) {
                const dx = mouseX - this.dragStartX;
                const dy = mouseY - this.dragStartY;
                const pull = -(dx * Math.cos(this.aimAngle) + dy * Math.sin(this.aimAngle));
                this.power = Math.max(0, Math.min(100, pull / 1.6));
                this.updatePowerGauge();
            }
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for canvas scaling (CSS size vs internal size)
        const scaleX = this.tableWidth / rect.width;
        const scaleY = this.tableHeight / rect.height;
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        // CALL POCKET - CLICK ON POCKET
        if (this.gameState === 'calling-pocket') {
            // Check if click is near a pocket
            for (let i = 0; i < this.physics.pockets.length; i++) {
                const pocket = this.physics.pockets[i];
                const dist = Math.hypot(mouseX - pocket.x, mouseY - pocket.y);
                if (dist < this.physics.pocketRadius + 40) {
                    // Clicked on this pocket
                    this.calledPocket = i;
                    this.needsCallPocket = false;
                    this.gameState = 'aiming';
                    this.showMessage('POCKET CALLED', `You called pocket #${i + 1}`);
                    this.startShotTimer();
                    return;
                }
            }
            return;
        }

        if (this.gameState !== 'aiming') return;

        // MULTIPLAYER: Only allow interaction when it's my turn
        if (this.isMultiplayer && !this.isMyTurn) {
            console.log('⏳ Not your turn!');
            return;
        }

        // BALL IN HAND - START DRAGGING
        if (this.ballInHand) {
            this.isDraggingBall = true;
            this.canvas.style.cursor = 'grabbing';
            return;
        }

        if (!this.aimLocked) {
            this.aimLocked = true;
            const cueBall = this.balls[0];
            this.aimAngle = Math.atan2(mouseY - cueBall.y, mouseX - cueBall.x);
            this.canvas.style.cursor = 'grab';
        }
        this.dragStartX = mouseX;
        this.dragStartY = mouseY;
        this.isDragging = true;
    }

    handleMouseUp(e) {
        if (this.gameState !== 'aiming') return;

        // MULTIPLAYER: Only allow interaction if it's your turn
        if (this.isMultiplayer && !this.isMyTurn) {
            return;
        }

        // BALL IN HAND - RELEASE TO PLACE
        if (this.ballInHand && this.isDraggingBall) {
            this.isDraggingBall = false;

            // Check if placement is valid (not overlapping)
            const cueBall = this.balls[0];
            let valid = true;
            for (const ball of this.balls) {
                if (ball.id !== 0 && ball.active) {
                    const d = Math.hypot(cueBall.x - ball.x, cueBall.y - ball.y);
                    if (d < this.physics.BALL_RADIUS * 2) {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid) {
                this.ballInHand = false;
                this.ballInHandKitchen = false;
                this.isPlacingCueBall = false;
                this.canvas.style.cursor = 'crosshair';
                this.updateTurnIndicator();
                if (this.isBreakShot) {
                    // Ball placed - ready to break
                } else {
                    // Ball placed - ready to shoot
                }
            } else {
                this.showMessage('INVALID PLACEMENT', 'Cue ball overlaps - try again');
            }
            return;
        }

        if (!this.isDragging) return;
        this.isDragging = false;

        if (this.power >= 2) {
            this.shoot();
            this.aimLocked = false;
            this.canvas.style.cursor = 'default';
        } else {
            this.power = 0;
            this.aimLocked = false;
            this.updatePowerGauge();
        }
    }

    handleMouseLeave() {
        if (this.powerPointer == null) this.cancelCueInput();
    }

    // ==========================================
    // NEW MOBILE CONTROLS: DIRECT AIM + POWER SLIDER
    // ==========================================

    // --- CANVAS TOUCH: AIMING ---
    handleTouchStart(e) {
        if (this.powerPointer != null || this.mobileTouch.isAiming) return;
        if (e.touches.length === 0) return;
        const touch = e.touches[0];

        // Convert touch to canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.tableWidth / rect.width;
        const scaleY = this.tableHeight / rect.height;
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        // Store touch info
        this.mobileTouch.touchId = touch.identifier;
        this.mobileTouch.currentX = touchX;
        this.mobileTouch.currentY = touchY;

        // Visual feedback
        this.touchFeedback.visible = true;
        this.touchFeedback.x = touchX;
        this.touchFeedback.y = touchY;

        // MULTIPLAYER CHECK
        if (this.isMultiplayer && !this.isMyTurn) return;

        // CALL POCKET LOGIC
        if (this.gameState === 'calling-pocket') {
            for (let i = 0; i < this.physics.pockets.length; i++) {
                const pocket = this.physics.pockets[i];
                const dist = Math.hypot(touchX - pocket.x, touchY - pocket.y);
                if (dist < this.physics.pocketRadius + 50) {
                    this.calledPocket = i;
                    this.needsCallPocket = false;
                    this.gameState = 'aiming';
                    this.showMessage('POCKET CALLED', `You called pocket #${i + 1}`);
                    this.startShotTimer();
                    return;
                }
            }
            return;
        }

        if (this.gameState !== 'aiming') return;

        // BALL IN HAND LOGIC
        if (this.ballInHand) {
            this.isDraggingBall = true;
            return;
        }

        // DIRECT AIMING: Point cue at finger
        const cueBall = this.balls[0];
        const distance = Math.hypot(touchX - cueBall.x, touchY - cueBall.y);
        this.touchAimAngle = Math.atan2(touchY - cueBall.y, touchX - cueBall.x);
        if (distance > this.physics.BALL_RADIUS * 3) this.aimAngle = this.touchAimAngle;
        this.mobileTouch.isAiming = true;
    }

    handleTouchMove(e) {
        // Find the active touch
        let touch = null;
        for (let i = 0; i < e.touches.length; i++) {
            if (e.touches[i].identifier === this.mobileTouch.touchId) {
                touch = e.touches[i];
                break;
            }
        }
        if (!touch) return;

        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.tableWidth / rect.width;
        const scaleY = this.tableHeight / rect.height;
        const touchX = (touch.clientX - rect.left) * scaleX;
        const touchY = (touch.clientY - rect.top) * scaleY;

        this.mobileTouch.currentX = touchX;
        this.mobileTouch.currentY = touchY;
        this.touchFeedback.x = touchX;
        this.touchFeedback.y = touchY;

        if (this.isMultiplayer && !this.isMyTurn) return;

        // BALL IN HAND DRAG
        if (this.ballInHand && this.isDraggingBall) {
            const cueBall = this.balls[0];
            const r = this.physics.BALL_RADIUS;
            const c = this.cushionWidth;
            const kitchenLine = this.tableWidth * 0.25;

            if (this.ballInHandKitchen) {
                cueBall.x = Math.max(c + r, Math.min(kitchenLine - r, touchX));
            } else {
                cueBall.x = Math.max(c + r, Math.min(this.tableWidth - c - r, touchX));
            }
            cueBall.y = Math.max(c + r, Math.min(this.tableHeight - c - r, touchY));
            return;
        }

        // UPDATE AIM
        if (this.gameState === 'aiming' && this.mobileTouch.isAiming && this.powerPointer == null) {
            const cueBall = this.balls[0];
            const angle = Math.atan2(touchY - cueBall.y, touchX - cueBall.x);
            const delta = Math.atan2(Math.sin(angle - this.touchAimAngle), Math.cos(angle - this.touchAimAngle));
            const distance = Math.hypot(touchX - cueBall.x, touchY - cueBall.y);
            this.aimAngle += delta * Math.min(1, Math.max(.2, distance / 160));
            this.touchAimAngle = angle;
        }
    }

    handleTouchEnd(e) {
        if (e.touches && Array.from(e.touches).some(t => t.identifier === this.mobileTouch.touchId)) return;
        this.touchFeedback.visible = false;
        this.mobileTouch.isAiming = false;

        // BALL IN HAND PLACEMENT
        if (this.ballInHand && this.isDraggingBall) {
            this.isDraggingBall = false;
            const cueBall = this.balls[0];
            let valid = true;
            for (const ball of this.balls) {
                if (ball.id !== 0 && ball.active) {
                    const d = Math.hypot(cueBall.x - ball.x, cueBall.y - ball.y);
                    if (d < this.physics.BALL_RADIUS * 2) {
                        valid = false;
                        break;
                    }
                }
            }

            if (valid) {
                this.ballInHand = false;
                this.ballInHandKitchen = false;
                this.isPlacingCueBall = false;
                this.updateTurnIndicator();
                this.showMessage('READY', 'Drag the power slider up, release to shoot.');
            } else {
                this.showMessage('INVALID', 'Ball overlaps!');
            }
        }
    }

    canAdjustShot() {
        return this.gameState === 'aiming' && (!this.isMultiplayer || this.isMyTurn);
    }

    cancelCueInput() {
        this.powerPointer = null; this.spinPointer = null;
        this.isDraggingBall = false;
        this.isDragging = false; this.aimLocked = false; this.power = 0;
        this.mobileTouch.isAiming = false; this.touchFeedback.visible = false;
        this.updatePowerGauge();
    }

    bindEquipmentControls() {
        const gauge = this.powerGauge;
        const spin = document.querySelector('.spin-ball');
        if (gauge) {
            gauge.tabIndex = 0;
            gauge.setAttribute('role', 'slider');
            gauge.setAttribute('aria-label', 'Shot power. Drag up and release. Escape cancels.');
            gauge.setAttribute('aria-valuemin', '0'); gauge.setAttribute('aria-valuemax', '100');
            gauge.style.touchAction = 'none';
            gauge.addEventListener('pointerdown', e => {
                if (e.button !== 0 || !this.canAdjustShot() || this.ballInHand || this.powerPointer != null) return;
                e.preventDefault(); gauge.focus({ preventScroll: true }); gauge.setPointerCapture(e.pointerId);
                this.powerPointer = e.pointerId; this.aimLocked = true;
                this.mobileTouch.isAiming = false;
                this.powerStartY = e.clientY; this.power = 0; this.updatePowerGauge();
            });
            gauge.addEventListener('pointermove', e => {
                if (e.pointerId !== this.powerPointer) return;
                if (!this.canAdjustShot()) { this.cancelCueInput(); return; }
                const travel = gauge.getBoundingClientRect().height * .8;
                this.power = Math.max(0, Math.min(100, (this.powerStartY - e.clientY) / travel * 100));
                this.updatePowerGauge();
            });
            gauge.addEventListener('pointerup', e => {
                if (e.pointerId !== this.powerPointer) return;
                const fire = this.canAdjustShot() && !this.ballInHand && this.power >= 2;
                this.powerPointer = null; this.aimLocked = false;
                if (fire) this.shoot();
                this.power = 0; this.updatePowerGauge();
            });
            for (const name of ['pointercancel', 'lostpointercapture']) gauge.addEventListener(name, e => {
                if (e.pointerId === this.powerPointer) this.cancelCueInput();
            });
            gauge.addEventListener('keydown', e => {
                if (!this.canAdjustShot() || this.ballInHand) return;
                if (['ArrowUp', 'ArrowDown', ' ', 'Enter', 'Escape'].includes(e.key)) e.preventDefault();
                if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
                    this.power = Math.max(0, Math.min(100, this.power + (e.key === 'ArrowUp' ? 2 : -2)));
                    this.updatePowerGauge();
                } else if ((e.key === ' ' || e.key === 'Enter') && !e.repeat && this.power >= 2) this.shoot();
                else if (e.key === 'Escape') this.cancelCueInput();
            });
        }
        if (spin) {
            spin.style.touchAction = 'none';
            spin.addEventListener('pointerdown', e => {
                if (e.button !== 0 || !this.canAdjustShot() || this.spinPointer != null) return;
                e.preventDefault(); this.spinPointer = e.pointerId; spin.setPointerCapture(e.pointerId);
                this.handleSpinClick(e);
            });
            spin.addEventListener('pointermove', e => { if (e.pointerId === this.spinPointer) this.handleSpinClick(e); });
            for (const name of ['pointerup', 'pointercancel', 'lostpointercapture'])
                spin.addEventListener(name, e => { if (e.pointerId === this.spinPointer) this.spinPointer = null; });
            spin.addEventListener('keydown', e => {
                if (!this.canAdjustShot()) return;
                const keys = { ArrowLeft: [-.1, 0], ArrowRight: [.1, 0], ArrowUp: [0, -.1], ArrowDown: [0, .1] };
                if (keys[e.key]) { e.preventDefault(); this.setSpin(this.spinX + keys[e.key][0], this.spinY + keys[e.key][1]); }
                else if (e.key === 'Home' || e.key === ' ') { e.preventDefault(); this.resetSpin(); }
            });
        }
        document.getElementById('reset-spin')?.addEventListener('click', () => {
            if (this.canAdjustShot()) this.resetSpin();
        });
        window.addEventListener('blur', () => this.cancelCueInput());
        document.addEventListener('visibilitychange', () => { if (document.hidden) this.cancelCueInput(); });
    }

    setSpin(x, y) {
        const length = Math.max(1, Math.hypot(x, y));
        this.spinX = x / length; this.spinY = y / length;
        this.updateSpinIndicator();
    }

    handleSpinClick(e) {
        if (!this.canAdjustShot()) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const radius = Math.min(rect.width, rect.height) / 2;
        this.setSpin((e.clientX - rect.left - rect.width / 2) / radius,
            (e.clientY - rect.top - rect.height / 2) / radius);
    }

    resetSpin() {
        this.spinX = 0;
        this.spinY = 0;
        this.updateSpinIndicator();
    }

    updatePowerGauge() {
        this.powerFill.style.height = this.power + '%';
        this.powerValue.textContent = Math.round(this.power) + '%';
        if (this.powerHandle) this.powerHandle.style.top = `${100 - this.power}%`;
        this.powerGauge?.setAttribute('aria-valuenow', String(Math.round(this.power)));
    }

    updateSpinIndicator() {
        this.spinIndicator.style.left = `${50 + this.spinX * 36}%`;
        this.spinIndicator.style.top = `${50 + this.spinY * 36}%`;
        this.spinIndicator.style.transform = 'translate(-50%, -50%)';
        document.querySelector('.spin-ball')?.setAttribute('aria-label', `Cue spin: horizontal ${Math.round(this.spinX * 100)}%, vertical ${Math.round(-this.spinY * 100)}%. Arrow keys adjust, Home resets.`);
        const spinInfo = document.getElementById('spin-info');
        if (spinInfo) {
            let spinType = '';
            const absX = Math.abs(this.spinX);
            const absY = Math.abs(this.spinY);
            if (absX < 0.08 && absY < 0.08) {
                spinType = 'Center Hit';
                this.spinIndicator.style.background = 'var(--accent-green)';
            } else {
                if (this.spinY < -0.08) { spinType = 'Top Spin'; this.spinIndicator.style.background = '#48b8e8'; }
                else if (this.spinY > 0.08) { spinType = 'Draw'; this.spinIndicator.style.background = '#efbd56'; }
                if (this.spinX < -0.08) { spinType = spinType ? spinType + ' + Left' : 'Left English'; this.spinIndicator.style.background = '#e76557'; }
                else if (this.spinX > 0.08) { spinType = spinType ? spinType + ' + Right' : 'Right English'; this.spinIndicator.style.background = '#e76557'; }
                if (absX > 0.3 && absY > 0.3) { this.spinIndicator.style.background = '#ff00ff'; }
            }
            spinInfo.textContent = spinType || 'Center Hit';
        }
    }

    updateTurnIndicator() {
        const turnText = document.querySelector('.turn-text');
        let text = this.isMultiplayer
            ? (this.currentPlayer === this.myPlayerNumber ? 'YOUR TURN' : "OPPONENT'S TURN")
            : `PLAYER ${this.currentPlayer}'s TURN`;

        // Show Group
        const group = this.playerTypes[this.currentPlayer];
        if (group) {
            text += ` (${group.toUpperCase()})`;
        } else {
            text += ` (OPEN TABLE)`;
        }

        // Show Ball in Hand
        if (this.ballInHand) {
            text += " - BALL IN HAND";
        }

        turnText.textContent = text;

        // Update new turn bar (above table)
        const turnBarText = document.getElementById('turn-bar-text');
        if (turnBarText) turnBarText.textContent = text;

        document.querySelectorAll('.player').forEach(p => p.classList.remove('active'));
        document.querySelector(`.player-${this.currentPlayer}`).classList.add('active');

        // Update player panel active states (new bar above table)
        const p1Panel = document.getElementById('p1-panel');
        const p2Panel = document.getElementById('p2-panel');
        if (p1Panel) p1Panel.classList.toggle('active', this.currentPlayer === 1);
        if (p2Panel) p2Panel.classList.toggle('active', this.currentPlayer === 2);

        // Update rack headers to show who owns what
        const p1Group = this.playerTypes[1];
        const p2Group = this.playerTypes[2];

        // This assumes simple UI, might need more complex DOM manipulation if we want to color code names
    }

    // MINICLIP FEATURE: Shot Timer
    startShotTimer() {
        this.stopShotTimer(); // Clear any existing timer
        this.timeRemaining = this.shotTimeLimit;
        this.updateTimerDisplay();

        this.shotTimer = setInterval(() => {
            this.timeRemaining--;
            this.updateTimerDisplay();

            if (this.timeRemaining <= 0) {
                this.handleTimeout();
            }
        }, 1000);
    }

    stopShotTimer() {
        if (this.shotTimer) {
            clearInterval(this.shotTimer);
            this.shotTimer = null;
        }
        if (this.timerText) {
            this.timerText.textContent = '';
        }
    }

    updateTimerDisplay() {
        if (this.timerText) {
            const color = this.timeRemaining <= 10 ? '#ff4444' : '#00ff88';
            this.timerText.textContent = `⏱️ ${this.timeRemaining}s`;
            this.timerText.style.color = color;
        }
    }

    handleTimeout() {
        this.stopShotTimer();
        this.showMessage('TIME OUT!', 'Shot timer expired');
        // Timeout is a foul
        this.ballInHand = true;
        this.switchPlayer();
    }

    // MINICLIP FEATURE: Call Pocket for 8-Ball
    checkCallPocket() {
        // Check if player needs to call pocket (all their balls are cleared, only 8-ball left)
        const myGroup = this.playerTypes[this.currentPlayer];
        if (myGroup && this.isGroupCleared(myGroup)) {
            if (this.isLocalAITurn()) {
                const eightBall = this.balls.find((ball) => ball.id === 8);
                let bestPocket = 0;
                let bestDistance = Infinity;
                this.physics.pockets.forEach((pocket, index) => {
                    const distance = Math.hypot(pocket.x - eightBall.x, pocket.y - eightBall.y);
                    if (distance < bestDistance) { bestDistance = distance; bestPocket = index; }
                });
                this.calledPocket = bestPocket;
                this.needsCallPocket = false;
                this.gameState = 'waiting';
                this.showMessage('OPPONENT CALLS POCKET', `Pocket ${bestPocket + 1}`, 1200);
                this.scheduleAITurn();
                return;
            }
            // Player is on the 8-ball, must call pocket
            this.needsCallPocket = true;
            this.gameState = 'calling-pocket';
            this.stopShotTimer();

            // Use NetworkManager overlay for visual pocket selection
            if (window.networkManager && window.networkManager.showPocketCallOverlay) {
                console.log('🎱 Showing pocket call overlay for 8-ball shot');
                window.networkManager.showPocketCallOverlay();
            } else {
                // Fallback to message
                this.showMessage('CALL POCKET', 'Click on a pocket to call your 8-ball shot', 5000);
            }
        } else {
            if (this.isLocalAITurn()) this.scheduleAITurn();
            else this.startShotTimer();
        }
    }

    isLocalAITurn() {
        return !this.isMultiplayer && (this.gameMode === 'ai' || this.gameMode === 'tournament') && this.currentPlayer === 2;
    }

    scheduleAITurn() {
        if (!this.isLocalAITurn() || this.gameState === 'gameover') return;
        if (this.aiTurnTimeout) clearTimeout(this.aiTurnTimeout);
        this.stopShotTimer();
        this.gameState = 'waiting';
        this.canvas.style.cursor = 'default';
        const delay = Math.min(1800, Math.max(650, this.aiPlayer?.getThinkingTime?.() || 900));
        this.aiTurnTimeout = setTimeout(() => this.executeLocalAITurn(), delay);
    }

    executeLocalAITurn() {
        this.aiTurnTimeout = null;
        if (!this.isLocalAITurn() || this.gameState === 'gameover') return;
        const cueBall = this.balls.find((ball) => ball.id === 0);
        if (!cueBall) return;

        if (this.ballInHand || !cueBall.active) {
            cueBall.active = true;
            const candidates = [{ x: 250, y: 250 }, { x: 330, y: 180 }, { x: 330, y: 320 }, { x: 430, y: 250 }];
            const spot = candidates.find((point) => this.balls.every((ball) => ball === cueBall || !ball.active || Math.hypot(point.x - ball.x, point.y - ball.y) > 34)) || candidates[0];
            cueBall.x = spot.x; cueBall.y = spot.y; cueBall.vx = 0; cueBall.vy = 0;
            this.ballInHand = false; this.ballInHandKitchen = false;
        }

        let targetType = this.playerTypes[2];
        if (targetType === 'solid') targetType = 'solids';
        if (targetType === 'stripe') targetType = 'stripes';
        const shot = this.aiPlayer?.calculateShot(this.gameState, this.balls, cueBall, this.physics.pockets, targetType) || {
            angle: Math.atan2(this.balls.find((ball) => ball.active && ball.id !== 0)?.y - cueBall.y || 0, this.balls.find((ball) => ball.active && ball.id !== 0)?.x - cueBall.x || 1),
            power: 0.55, spinX: 0, spinY: 0
        };
        this.aimAngle = shot.angle;
        this.power = Math.max(28, Math.min(92, shot.power * 100));
        this.spinX = shot.spinX || 0;
        this.spinY = shot.spinY || 0;
        this.gameState = 'aiming';
        this.shoot();
    }

    shoot() {
        if (!this.canAdjustShot() || this.ballInHand || !this.balls[0]?.active || this.power < 2) return;
        this.cueStroke = { x: this.balls[0].x, y: this.balls[0].y,
            angle: this.aimAngle, started: performance.now() };
        this.aimLocked = false;
        this.stopShotTimer(); // Stop timer when shot is made
        this.shotPocketedBalls = []; // Reset pocketed balls tracker for this shot
        this.physicsAccumulator = 0; // Reset physics timing for consistent behavior
        this.shotSteps = 0; // Reset step counter for debug
        this.lastShotPower = Math.round(this.power); // Track power for debug
        this.gameState = 'shooting';

        // Clear ball-in-hand since we're taking a shot
        this.ballInHand = false;
        this.ballInHandKitchen = false;

        const cueBall = this.balls[0];

        // Mark that this was MY shot (for multiplayer result sending)
        this.wasMyShot = true;

        // In multiplayer mode, send the shot to the server
        if (this.isMultiplayer && window.networkManager) {
            console.log('🚀 Sending shot:', this.aimAngle, this.power);
            window.networkManager.sendShot(this.aimAngle, this.power, this.spinX, this.spinY);
        }

        this.physics.applyShot(cueBall, this.aimAngle, this.power, this.spinX, this.spinY);

        // Play EPIC break sound for break shot, normal cue hit otherwise
        if (this.isBreakShot) {
            this.sound.playBreakShot(this.power);
        } else {
            this.sound.playCueHit(this.power);
        }

        this.power = 0;
        this.updatePowerGauge();
        setTimeout(() => this.checkShotResult(), 100);
    }

    // Called when opponent takes a shot in multiplayer
    onShotTaken(data) {
        console.log(`📥 onShotTaken called: player=${data.player}, myPlayerNumber=${this.myPlayerNumber}`);

        // Only apply if it's not our shot
        if (data.player !== this.myPlayerNumber) {
            console.log('   ✅ Applying opponent shot');
            const shot = data.shot || data; // Handle both nested and flat structure

            this.stopShotTimer();
            this.shotPocketedBalls = [];
            this.physicsAccumulator = 0; // Reset physics timing for consistent behavior
            this.gameState = 'shooting';
            this.wasMyShot = false; // Mark this as NOT my shot
            const cueBall = this.balls[0];

            // Apply the opponent's shot
            console.log(`   🎯 Applying physics: angle=${shot.angle}, power=${shot.power}`);
            this.physics.applyShot(cueBall, shot.angle, shot.power, shot.spinX || 0, shot.spinY || 0);

            // Play sound
            if (this.isBreakShot) {
                this.sound.playBreakShot(shot.power);
            } else {
                this.sound.playCueHit(shot.power);
            }

            // Wait for balls to stop, but DON'T run full checkShotResult logic
            // Just wait and let the server's game_state_update handle the turn change
            this.waitForBallsToStop();
        } else {
            console.log('   ⏭️ Skipping (my own shot)');
        }
    }

    // Wait for balls to stop moving (for opponent's shot)
    waitForBallsToStop() {
        if (!this.physics.allBallsStopped(this.balls)) {
            setTimeout(() => this.waitForBallsToStop(), 100);
            return;
        }

        // Balls have stopped - just reset physics state
        this.balls.forEach(ball => {
            if (ball.active) {
                ball.vx = 0; ball.vy = 0;
                ball.spinX = 0; ball.spinY = 0;
                if (ball.w) ball.w = { x: 0, y: 0, z: 0 };
            }
        });

        console.log('⏸️ Opponent shot finished - waiting for server state update');
        // The server will send game_state_update with the new turn
        // That will set gameState to 'aiming' if it's our turn
    }

    // Called when server sends authoritative game state
    onGameStateUpdate(data) {
        console.log('🔄 Game state update received:', data);

        // 1. Sync Turn State (Authoritative)
        if (data.gameState && data.gameState.currentPlayer) {
            this.currentPlayer = data.gameState.currentPlayer;
            this.isMyTurn = (this.currentPlayer === this.myPlayerNumber);

            // Sync ball-in-hand state from server
            if (data.gameState.ballInHand !== undefined) {
                this.ballInHand = data.gameState.ballInHand && this.isMyTurn;
                this.ballInHandKitchen = data.gameState.ballInHandKitchen || false;
                console.log(`   - Ball-in-hand synced: ${this.ballInHand}`);
            }

            // Sync break shot state
            if (data.gameState.isBreakShot !== undefined) {
                this.isBreakShot = data.gameState.isBreakShot;
                console.log(`   - isBreakShot synced: ${this.isBreakShot}`);
            }

            // Sync table state and player types
            if (data.gameState.tableOpen !== undefined) {
                this.tableState = data.gameState.tableOpen ? 'open' : 'closed';
            }
            if (data.gameState.playerTypes) {
                this.playerTypes = data.gameState.playerTypes;
            }

            // Set game state to aiming if it's my turn and game is not over
            // Don't override 'calling-pocket' state as player is choosing a pocket
            if (this.isMyTurn && this.gameState !== 'gameover' && this.gameState !== 'calling-pocket') {
                this.gameState = 'aiming';
                this.aimLocked = false;
                this.canvas.style.cursor = this.ballInHand ? 'grab' : 'crosshair';

                // IMPORTANT: Ensure cue ball is active when it's my turn
                const cueBall = this.balls[0];
                if (cueBall && !cueBall.active) {
                    cueBall.active = true;
                    console.log('   - Cue ball reactivated for my turn');
                }

                // Check if player needs to call pocket for 8-ball, or start normal timer
                this.checkCallPocket();
            } else if (!this.isMyTurn) {
                // If it's not my turn, set to waiting
                this.gameState = 'waiting';
                this.aimLocked = false;
                this.isDragging = false;
                this.canvas.style.cursor = 'default';
                this.stopShotTimer();
            }

            this.updateTurnIndicator();
            console.log(`   - Turn synced: Player ${this.currentPlayer} (${this.isMyTurn ? 'ME' : 'OPPONENT'}), gameState: ${this.gameState}`);
        }

        // 2. Sync Ball Positions
        if (data.balls) {
            console.log(`   - Syncing ${data.balls.length} ball positions`);
            // Update local balls with server state to fix drift
            data.balls.forEach(serverBall => {
                const localBall = this.balls.find(b => b.id === serverBall.id);
                if (localBall) {
                    const oldX = localBall.x;
                    const oldY = localBall.y;
                    localBall.x = serverBall.x;
                    localBall.y = serverBall.y;

                    // Sync active state
                    // For cue ball (id 0): Always set to active if it's my turn (for ball-in-hand)
                    if (serverBall.id === 0) {
                        // If it's my turn, ensure cue ball is active
                        if (this.isMyTurn) {
                            localBall.active = true;
                        } else {
                            localBall.active = serverBall.active;
                        }
                    } else {
                        localBall.active = serverBall.active;
                    }

                    // Ensure they are stopped
                    localBall.vx = 0;
                    localBall.vy = 0;

                    // Log significant position changes
                    const distance = Math.sqrt((oldX - serverBall.x) ** 2 + (oldY - serverBall.y) ** 2);
                    if (distance > 5) {
                        console.log(`     Ball ${serverBall.id} moved ${distance.toFixed(1)}px`);
                    }
                }
            });
            console.log('   - Ball positions synced');
        } else {
            console.log('   - No ball data in update');
        }

        // 3. Sync Game Over State
        if (data.gameOver) {
            this.gameState = 'gameover';
            this.showWinner(data.winner, data.reason || 'Game Over');
            console.log(`   - Game Over: Player ${data.winner} wins`);
        }

        // 4. Sync Pocketed Balls (optional but good)
        if (data.pocketedBalls) {
            // We could sync this too
        }
    }

    // Called when game over event is received
    onGameOver(data) {
        console.log('🏆 Game Over Event:', data);
        this.gameState = 'gameover';
        this.showWinner(data.winner, data.reason, data.wager, data.currency);
    }

    showWinner(winnerNum, reason, wager = 0, currency = 'coins') {
        if (!this.winnerScreen) return;

        const isWinner = (winnerNum === this.myPlayerNumber);
        const resultTitle = this.winnerScreen.querySelector('.result-title');
        const resultMessage = this.winnerScreen.querySelector('.result-message');
        const prizeAmount = this.winnerScreen.querySelector('.prize-amount');
        const winnerAvatar = this.winnerScreen.querySelector('.winner-avatar');

        // Update title and message
        if (isWinner) {
            resultTitle.textContent = 'YOU WIN!';
            resultTitle.style.color = '#00ff88';
            resultMessage.textContent = reason || 'Great Match!';
            this.sound.playWinSound();
        } else {
            resultTitle.textContent = 'YOU LOSE';
            resultTitle.style.color = '#ff4444';
            resultMessage.textContent = reason || 'Better luck next time';
        }

        // Update prize display
        if (wager > 0) {
            const currencyIcon = 'coin';
            const amount = isWinner ? `+${wager * 2}` : `-${wager}`;
            const color = isWinner ? '#00ff88' : '#ff4444';

            prizeAmount.innerHTML = `<span style="color: ${color}">${amount} ${currencyIcon}</span>`;
            prizeAmount.style.display = 'block';
        } else {
            prizeAmount.style.display = 'none';
        }

        // Show screen
        this.winnerScreen.classList.remove('hidden');
        this.winnerScreen.style.display = 'flex';

        // Confetti effect if winner
        if (isWinner) {
            this.startConfetti();
        }
    }

    checkShotResult() {
        if (!this.physics.allBallsStopped(this.balls)) {
            setTimeout(() => this.checkShotResult(), 100);
            return;
        }

        // Reset ball physics
        this.balls.forEach(ball => {
            if (ball.active) {
                ball.vx = 0; ball.vy = 0;
                ball.spinX = 0; ball.spinY = 0;
                if (ball.w) ball.w = { x: 0, y: 0, z: 0 };
            }
        });

        const cueBall = this.balls[0];
        // Use the accumulated pocketed balls from the shot
        const pocketedBalls = this.shotPocketedBalls;

        console.log(`\n🎯 === SHOT RESULT CHECK ===`);
        console.log(`   - isBreakShot: ${this.isBreakShot}`);
        console.log(`   - tableState: ${this.tableState}`);
        console.log(`   - currentPlayer: ${this.currentPlayer}`);
        console.log(`   - Player types:`, this.playerTypes);

        // --- RULE ENFORCEMENT ---
        let foul = false;
        let turnChange = true;
        let win = false;
        let loss = false;
        let reason = "";

        const firstContactId = this.physics.shotFirstContact;
        const railContact = this.physics.railContactAfterHit;
        const cueBallPocketed = !cueBall.active;

        // 1. CHECK BREAK SHOT
        if (this.isBreakShot) {
            this.isBreakShot = false; // Next shot is normal

            // Check for 8-ball on break
            const eightBallPocketed = pocketedBalls.find(b => b.id === 8);

            if (eightBallPocketed) {
                if (cueBallPocketed) {
                    // Scratch with 8-ball pocketed on break
                    foul = true;
                    reason = "Scratch on break with 8-ball.";
                    this.spotBall(8);
                    turnChange = true;
                } else {
                    // 8-ball pocketed on break without scratch - spot it and continue
                    this.spotBall(8);
                    reason = "8-Ball pocketed on break. Spotted.";
                    // Player continues if other balls were also pocketed
                    const otherBallsPocketed = pocketedBalls.filter(b => b.id !== 8);

                    if (otherBallsPocketed.length > 0) {
                        // Assign groups based on what was pocketed (excluding 8-ball)
                        const solidsPotted = otherBallsPocketed.filter(b => b.type === 'solid').length;
                        const stripesPotted = otherBallsPocketed.filter(b => b.type === 'stripe').length;

                        if (solidsPotted > 0 || stripesPotted > 0) {
                            const assignedGroup = solidsPotted > 0 ? 'solid' : 'stripe';
                            this.playerTypes[this.currentPlayer] = assignedGroup;
                            const opponent = this.currentPlayer === 1 ? 2 : 1;
                            this.playerTypes[opponent] = assignedGroup === 'solid' ? 'stripe' : 'solid';
                            this.tableState = 'closed';
                            this.showMessage('GROUPS ASSIGNED', `YOU ARE ${assignedGroup.toUpperCase()}S!`, 4000);
                            this.updateTurnIndicator();
                        }
                        turnChange = false;
                    } else {
                        turnChange = true;
                    }
                }
            } else {
                // No 8-ball pocketed
                if (cueBallPocketed) {
                    // Scratch on break
                    foul = true;
                    turnChange = true;
                    reason = "Scratch on break.";
                } else {
                    // Legal break: any ball movement is acceptable (no foul for potting any ball)
                    // Check if any balls were pocketed
                    console.log(`🎱 BREAK SHOT - Checking pocketed balls:`, pocketedBalls.map(b => `${b.id} (${b.type})`));

                    if (pocketedBalls.length > 0) {
                        // Assign groups based on what was pocketed
                        const solidsPotted = pocketedBalls.filter(b => b.type === 'solid').length;
                        const stripesPotted = pocketedBalls.filter(b => b.type === 'stripe').length;

                        console.log(`   - Solids pocketed: ${solidsPotted}, Stripes pocketed: ${stripesPotted}`);

                        if (solidsPotted > 0 || stripesPotted > 0) {
                            // Assign group based on first ball type pocketed
                            const assignedGroup = solidsPotted > 0 ? 'solid' : 'stripe';
                            this.playerTypes[this.currentPlayer] = assignedGroup;
                            const opponent = this.currentPlayer === 1 ? 2 : 1;
                            this.playerTypes[opponent] = assignedGroup === 'solid' ? 'stripe' : 'solid';
                            this.tableState = 'closed';
                            this.showMessage('GROUPS ASSIGNED ON BREAK', `YOU ARE ${assignedGroup.toUpperCase()}S!`, 4000);
                            this.updateTurnIndicator();
                            turnChange = false; // Keep turn
                            reason = "Legal break - groups assigned.";
                            console.log(`   ✅ Groups assigned: Player ${this.currentPlayer} = ${assignedGroup}, turnChange = ${turnChange}`);
                        } else {
                            // Only cue ball moved or no valid balls pocketed
                            turnChange = false;
                            reason = "Legal break - continue.";
                            console.log(`   ✅ No groups assigned, player continues`);
                        }
                    } else {
                        // No balls pocketed - turn changes
                        turnChange = true;
                        reason = "No balls pocketed on break.";
                        console.log(`   ❌ No balls pocketed, turn changes`);
                    }
                }
            }
        }
        // 2. NORMAL SHOT
        else {
            const eightBallPocketed = pocketedBalls.find(b => b.id === 8);

            // A. Check Generic Fouls first
            if (cueBallPocketed) {
                foul = true;
                reason = "Scratch.";
            } else if (firstContactId === null) {
                foul = true;
                reason = "No ball hit.";
            } else {
                // Check "Legal Shot" (Hit own group first)
                const firstBall = this.balls.find(b => b.id === firstContactId);
                const isEightBall = firstContactId === 8;

                // Determine target group
                let targetGroup = this.playerTypes[this.currentPlayer];

                if (this.tableState === 'open') {
                    // Open table: Can hit anything except 8-ball first (unless 8 is the only thing left? No, 8 is never legal first on open table unless it's the only ball, but here we have groups)
                    // Actually, on open table, you can hit solids or stripes. You cannot hit 8-ball first.
                    if (isEightBall && this.hasOtherBalls()) {
                        foul = true;
                        reason = "Cannot hit 8-ball first on open table.";
                    }
                } else {
                    // Closed table: Must hit own group
                    if (targetGroup === 'solid' && (firstBall.type !== 'solid')) {
                        // Exception: If on 8-ball (all solids cleared)
                        if (!this.isGroupCleared('solid')) {
                            foul = true;
                            reason = "Must hit Solid first.";
                        } else if (!isEightBall) {
                            foul = true;
                            reason = "Must hit 8-ball.";
                        }
                    } else if (targetGroup === 'stripe' && (firstBall.type !== 'stripe')) {
                        if (!this.isGroupCleared('stripe')) {
                            foul = true;
                            reason = "Must hit Stripe first.";
                        } else if (!isEightBall) {
                            foul = true;
                            reason = "Must hit 8-ball.";
                        }
                    }
                }

                // Check Rail Contact (after impact)
                // Rule: After contact, ball must be pocketed OR hit rail
                if (!foul && pocketedBalls.length === 0 && !railContact) {
                    foul = true;
                    reason = "No rail hit after contact.";
                }
            }

            // B. Check 8-Ball Logic
            if (eightBallPocketed) {
                if (foul) {
                    loss = true;
                    reason += " 8-Ball pocketed with foul (Loss).";
                } else {
                    // Check if group is cleared
                    const myGroup = this.playerTypes[this.currentPlayer];
                    if (this.tableState === 'open' || !this.isGroupCleared(myGroup)) {
                        loss = true;
                        reason = "8-Ball pocketed early (Loss).";
                    } else {
                        // MINICLIP: Check if 8-ball went into called pocket
                        const eightBallPocket = eightBallPocketed.pocket;
                        if (this.calledPocket !== null && eightBallPocket !== this.calledPocket) {
                            loss = true;
                            reason = "8-Ball in wrong pocket (Loss).";
                        } else {
                            win = true;
                            reason = "8-Ball pocketed legally (Win).";
                        }
                    }
                }
            }

            // C. Turn Continuation & Group Assignment
            if (!foul && !loss && !win) {
                const nonCueBallsPotted = pocketedBalls.filter(b => b.id !== 0);
                const myGroup = this.playerTypes[this.currentPlayer];

                if (this.tableState === 'open') {
                    // OPEN TABLE: Any solid or stripe potted = continue
                    const solidsPotted = pocketedBalls.filter(b => b.type === 'solid').length;
                    const stripesPotted = pocketedBalls.filter(b => b.type === 'stripe').length;

                    if (solidsPotted > 0 || stripesPotted > 0) {
                        // Player potted at least one solid or stripe - they continue
                        turnChange = false;

                        this.stopShotTimer();

                        // Assign groups based on first ball type potted
                        const firstBallType = solidsPotted > 0 ? 'solid' : 'stripe';
                        this.playerTypes[this.currentPlayer] = firstBallType;
                        const opponent = this.currentPlayer === 1 ? 2 : 1;
                        this.playerTypes[opponent] = firstBallType === 'solid' ? 'stripe' : 'solid';
                        this.tableState = 'closed';

                        // Flag that we just assigned groups (to send to server)
                        this.justAssignedGroups = true;
                        this.assignedGroup = firstBallType;

                        this.showMessage('GROUPS ASSIGNED', `YOU ARE ${firstBallType.toUpperCase()}S!`, 4000);
                        this.updateTurnIndicator();
                        this.startShotTimer();
                    } else {
                        // No balls potted on open table - turn changes
                        turnChange = true;
                    }
                } else {
                    // CLOSED TABLE: Only continue if player potted their assigned group ball
                    const myGroupBallsPotted = pocketedBalls.filter(b => b.type === myGroup);
                    const nonCueBallsPotted = pocketedBalls.filter(b => b.id !== 0);

                    console.log(`🎯 Turn continuation check:`);
                    console.log(`   - Player ${this.currentPlayer}'s group: ${myGroup}`);
                    console.log(`   - Balls pocketed:`, pocketedBalls.map(b => `${b.id} (${b.type})`));
                    console.log(`   - My group balls pocketed: ${myGroupBallsPotted.length}`);
                    console.log(`   - Total non-cue balls pocketed: ${nonCueBallsPotted.length}`);

                    if (myGroupBallsPotted.length > 0) {
                        // Player potted at least one of their own balls - they continue
                        turnChange = false;
                        console.log(`   ✅ Player continues (potted own ball)`);
                    } else if (nonCueBallsPotted.length > 0) {
                        // Player potted ball(s) but NONE were their own type - just turn change (not a foul)
                        // This happens when player hits own ball correctly but pockets opponent's ball
                        turnChange = true;
                        console.log(`   ❌ Turn changes (potted opponent's ball only, no foul)`);
                    } else {
                        // Player didn't pot any balls - turn changes
                        turnChange = true;
                        console.log(`   ❌ Turn changes (no balls pocketed)`);
                    }
                }
            }
        }

        // --- APPLY RESULTS ---
        // --- APPLY RESULTS ---

        // NOTE: Turn continuation logic above applies to BOTH human and AI players
        if (loss) {
            this.gameState = 'gameover';

            // MULTIPLAYER: Send game over to server
            if (this.isMultiplayer && window.networkManager && this.wasMyShot) {
                window.networkManager.sendShotResult({
                    balls: this.balls.map(b => ({
                        id: b.id,
                        x: b.x,
                        y: b.y,
                        active: b.active
                    })),
                    pocketedBalls: this.shotPocketedBalls,
                    winner: this.currentPlayer === 1 ? 2 : 1,
                    reason: reason,
                    foul: true
                });
                this.wasMyShot = false;
            }

            this.showWinner(this.currentPlayer === 1 ? 2 : 1, reason); // Opponent wins
        } else if (win) {
            this.gameState = 'gameover';

            // MULTIPLAYER: Send game over to server
            if (this.isMultiplayer && window.networkManager && this.wasMyShot) {
                window.networkManager.sendShotResult({
                    balls: this.balls.map(b => ({
                        id: b.id,
                        x: b.x,
                        y: b.y,
                        active: b.active
                    })),
                    pocketedBalls: this.shotPocketedBalls,
                    winner: this.currentPlayer,
                    reason: reason
                });
                this.wasMyShot = false;
            }

            this.showWinner(this.currentPlayer, reason);
        } else {
            if (foul) {
                this.showMessage('FOUL', reason);
                this.ballInHand = true;
                turnChange = true;
            } else if (turnChange) {
                // Just a miss
            }

            if (pocketedBalls.length > 0) {
                pocketedBalls.forEach(ball => {
                    this.updateBallRack(ball);
                });
            }

            if (cueBallPocketed) {
                // Restore cue ball
                cueBall.active = true;

                // MINICLIP RULE: Ball-in-hand is ALWAYS anywhere on table (no kitchen restriction)
                cueBall.x = this.tableWidth * 0.25;
                cueBall.y = this.tableHeight / 2;

                cueBall.vx = 0; cueBall.vy = 0;
                this.ballInHand = true; // Ball-in-hand anywhere
            }

            // MULTIPLAYER: Send shot result with turn information to server
            // IMPORTANT: Only send if this was MY shot (I was the shooter)
            if (this.isMultiplayer && window.networkManager && this.wasMyShot) {
                const shotResultData = {
                    balls: this.balls.map(b => ({
                        id: b.id,
                        x: b.x,
                        y: b.y,
                        active: b.active
                    })),
                    pocketedBalls: this.shotPocketedBalls,
                    foul: foul,
                    continueTurn: !turnChange,
                    reason: reason,
                    // Send group assignment info
                    tableOpen: this.tableState === 'open',
                    playerTypes: this.playerTypes,
                    assignGroup: this.justAssignedGroups ? this.assignedGroup : null
                };

                window.networkManager.sendShotResult(shotResultData);
                console.log(`🎱 Shot result sent: foul=${foul}, continueTurn=${!turnChange}, tableOpen=${shotResultData.tableOpen}`);

                // Reset flags
                this.wasMyShot = false;
                this.justAssignedGroups = false;
                this.assignedGroup = null;
            }

            if (turnChange) {
                this.switchPlayer();
            } else {
                // Same player continues
                this.updateTurnIndicator();
                this.aimLocked = false;

                // Only set to aiming if it's my turn (or not multiplayer)
                if (!this.isMultiplayer || this.isMyTurn) {
                    this.canvas.style.cursor = 'crosshair';
                    this.gameState = 'aiming';
                } else {
                    this.canvas.style.cursor = 'default';
                    this.gameState = 'waiting';
                }

                this.checkCallPocket(); // Check if need to call pocket for 8-ball
            }
        }
    }

    switchPlayer() {
        this.currentPlayer = this.currentPlayer === 1 ? 2 : 1;

        // Update multiplayer turn tracking
        if (this.isMultiplayer) {
            this.isMyTurn = (this.currentPlayer === this.myPlayerNumber);
            console.log(`🔄 Turn switched to Player ${this.currentPlayer}. ${this.isMyTurn ? 'YOUR TURN!' : "Opponent's turn"}`);

            // Set game state based on whose turn it is
            if (this.isMyTurn) {
                this.gameState = 'aiming';
                this.canvas.style.cursor = 'crosshair';
            } else {
                this.gameState = 'waiting';
                this.canvas.style.cursor = 'default';
                this.isDragging = false;
            }
        } else {
            const aiTurn = this.isLocalAITurn();
            this.gameState = aiTurn ? 'waiting' : 'aiming';
            this.canvas.style.cursor = aiTurn ? 'default' : 'crosshair';
        }

        this.updateTurnIndicator();
        this.aimLocked = false;
        this.checkCallPocket(); // Check if need to call pocket for 8-ball
    }



    showMessage(title, text, duration = 3000) {
        document.getElementById('message-title').textContent = title;
        document.getElementById('message-text').textContent = text;
        this.gameMessage.classList.remove('hidden');
        if (this.messageTimeout) clearTimeout(this.messageTimeout);
        this.messageTimeout = setTimeout(() => { this.gameMessage.classList.add('hidden'); }, duration);
    }

    checkWinner() {
        const eightBall = this.balls.find(b => b.id === 8);
        if (!eightBall.active) {
            this.gameState = 'gameover';
            this.showWinner(this.currentPlayer);
        }
    }

    showWinner(player, reason) {
        let winnerText;
        let isWin = false;

        if (this.isMultiplayer) {
            // Show personalized message for multiplayer
            if (player === this.myPlayerNumber) {
                winnerText = 'YOU WON!';
                isWin = true;
            } else {
                winnerText = 'YOU LOSE';
            }
        } else {
            // Single player/AI mode
            // Player 1 is always the human
            if (player === 1) {
                winnerText = 'YOU WIN!';
                isWin = true;
            } else {
                winnerText = 'YOU LOSE';
            }

            // Report AI game result to server
            this.reportAIGameResult(isWin);
        }

        document.getElementById('winner-text').textContent = winnerText;
        const sub = document.createElement('div');
        sub.style.fontSize = '20px';
        sub.style.marginTop = '10px';
        sub.style.color = '#aaa';
        sub.textContent = reason || "";

        const existingSub = document.getElementById('winner-reason');
        if (existingSub) existingSub.remove();
        sub.id = 'winner-reason';
        document.getElementById('winner-text').appendChild(sub);

        this.winnerScreen.classList.remove('hidden');
    }

    // Save the result through the mobile platform adapter.
    async reportAIGameResult(won) {
        try {
            const pocketed = this.balls.filter((ball) => !ball.active && ball.id !== 0).length;
            if (this.gameMode === 'tournament' && window.MinePoolApp?.recordTournamentResult) {
                await window.MinePoolApp.recordTournamentResult(won, pocketed);
                return;
            }
            const result = await window.MinePoolPlatform.recordGame(won, pocketed);
            window.currentUser = { ...result.player, username: window.MinePoolPlatform.getIdentity().displayName };
            if (result.reward > 0) this.showMessage('MATCH REWARD', `+${result.reward} COINS`, 2000);
        } catch (error) {
            console.error('Failed to save game result:', error);
            window.ytgame?.health?.logError?.();
        }
    }
    resetGame() {
        this.stopShotTimer();
        this.winnerScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
        this.startScreen.style.display = 'flex';
        document.body.classList.remove('game-active');
        this.gameState = 'start';
        this.currentPlayer = 1;
        this.playerTypes = { 1: null, 2: null };
        this.tableState = 'open';
        this.isBreakShot = true;
        this.ballInHand = false;
        this.ballInHandKitchen = false;
        this.foulReason = null;
        this.power = 0;
        this.spinX = 0;
        this.spinY = 0;
        this.calledPocket = null;
        this.needsCallPocket = false;
        this.updatePowerGauge();
        this.updateSpinIndicator();
        this.updateTurnIndicator(); // Refresh UI
    }

    // NOTE: The main animate() function with frame-rate independent physics is defined earlier in this class.

    assignGroups(player, group) {
        this.tableState = 'closed';
        this.playerTypes[player] = group;
        this.playerTypes[player === 1 ? 2 : 1] = group === 'solid' ? 'stripe' : 'solid';
        this.showMessage('GROUPS ASSIGNED', `Player ${player} is ${group.toUpperCase()}S`);
        this.updateTurnIndicator();
    }

    isGroupCleared(group) {
        if (!group) return false;
        // Check if any active balls of this type exist
        return !this.balls.some(b => b.active && b.type === group);
    }

    hasOtherBalls() {
        // Check if any balls other than cue and 8-ball are active
        return this.balls.some(b => b.active && b.id !== 0 && b.id !== 8);
    }

    spotBall(id) {
        const ball = this.balls.find(b => b.id === id);
        if (ball) {
            ball.active = true;
            ball.vx = 0; ball.vy = 0;
            ball.w = { x: 0, y: 0, z: 0 };
            ball.topspin = 0; ball.sidespin = 0;
            // Spot at foot spot (approx rack position)
            ball.x = this.tableWidth * 0.75;
            ball.y = this.tableHeight / 2;

            // Check for overlap and move if needed
            let safe = false;
            while (!safe) {
                safe = true;
                for (const other of this.balls) {
                    if (other.id !== id && other.active) {
                        const d = Math.hypot(ball.x - other.x, ball.y - other.y);
                        if (d < this.physics.BALL_RADIUS * 2) {
                            ball.x += this.physics.BALL_RADIUS * 2 + 1; // Move down table
                            safe = false;
                            break;
                        }
                    }
                }
            }
        }
    }

    updateBallRack(ball) {
        if (ball.id === 0 || ball.id === 8) return;
        const rack = ball.type === 'solid' ? this.solidsRack : this.stripesRack;
        const rackBall = rack.querySelector(`[data-number="${ball.id}"]`);
        if (rackBall) {
            rackBall.classList.remove('empty');
            rackBall.style.background = this.getBallColor(ball.id);
            rackBall.textContent = ball.id;
        }
    }



    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.tableWidth, this.tableHeight);
        this.drawTable(ctx);
        if (this.gameState === 'calling-pocket') this.drawPocketHighlights(ctx);

        // Only show aim line and cue if it's the player's turn (or not in multiplayer)
        const canAim = this.gameState === 'aiming' && (!this.isMultiplayer || this.isMyTurn);

        // Debug: Log why cue might not be showing (only occasionally to avoid spam)
        if (this.isMultiplayer && this.debugCounter === undefined) this.debugCounter = 0;
        if (this.isMultiplayer && ++this.debugCounter % 300 === 0) {
            const cueBall = this.balls[0];
            console.log(`🎨 Render Debug: gameState=${this.gameState}, isMyTurn=${this.isMyTurn}, cueBall.active=${cueBall?.active}, canAim=${canAim}`);
        }

        if (canAim) this.drawAimLine(ctx);
        this.drawBalls(ctx);
        if (canAim || this.cueStroke) this.drawCue(ctx);

        // Draw mobile touch feedback
        if (this.isMobile) {
            this.drawMobileTouchFeedback(ctx);
        }
    }

    // Visual feedback for mobile touch controls
    drawMobileTouchFeedback(ctx) {
        if (!this.touchFeedback.visible) return;

        ctx.save();

        // Draw touch point indicator
        const x = this.touchFeedback.x;
        const y = this.touchFeedback.y;

        // Outer ring (pulsing)
        const time = Date.now() / 200;
        const pulse = 0.5 + Math.sin(time) * 0.3;

        ctx.beginPath();
        ctx.arc(x, y, this.touchFeedback.radius + 5, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0, 212, 255, ${pulse})`;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner circle
        ctx.beginPath();
        ctx.arc(x, y, this.touchFeedback.radius, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 212, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)';
        ctx.lineWidth = 2;
        ctx.stroke();

        // Draw pull indicator line (from start to current)
        if (this.mobileTouch.isAiming && this.mobileTouch.isPullingBack) {
            const startX = this.mobileTouch.startX;
            const startY = this.mobileTouch.startY;

            // Draw line from start to current touch
            ctx.beginPath();
            ctx.moveTo(startX, startY);
            ctx.lineTo(x, y);

            // Gradient based on power
            const powerRatio = this.power / 100;
            let color;
            if (powerRatio < 0.33) {
                color = `rgba(0, 255, 136, ${0.5 + powerRatio})`; // Green
            } else if (powerRatio < 0.66) {
                color = `rgba(255, 215, 0, ${0.5 + powerRatio})`; // Gold
            } else {
                color = `rgba(255, 71, 87, ${0.5 + powerRatio})`; // Red
            }

            ctx.strokeStyle = color;
            ctx.lineWidth = 4;
            ctx.lineCap = 'round';
            ctx.setLineDash([8, 4]);
            ctx.stroke();
            ctx.setLineDash([]);

            // Draw start point marker
            ctx.beginPath();
            ctx.arc(startX, startY, 8, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
            ctx.fill();
            ctx.strokeStyle = color;
            ctx.lineWidth = 3;
            ctx.stroke();

            // Power text near touch point
            ctx.font = 'bold 14px Orbitron, sans-serif';
            ctx.fillStyle = color;
            ctx.textAlign = 'center';
            ctx.fillText(`${Math.round(this.power)}%`, x, y - 40);
        }

        ctx.restore();
    }

    drawDebugInfo(ctx) {
        // Show current physics values on screen
        ctx.save();
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(5, 5, 180, 100);
        ctx.fillStyle = '#00ff88';
        ctx.font = '11px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(`MU_SLIDE: ${this.physics.MU_SLIDE.toFixed(3)}`, 10, 20);
        ctx.fillText(`MU_ROLL:  ${this.physics.MU_ROLL.toFixed(3)}`, 10, 35);
        ctx.fillText(`MU_SPIN:  ${this.physics.MU_SPIN.toFixed(3)}`, 10, 50);
        ctx.fillText(`E_BALL:   ${this.physics.E_BALL.toFixed(2)}`, 10, 65);
        ctx.fillText(`E_CUSHION:${this.physics.E_CUSHION.toFixed(2)}`, 10, 80);
        ctx.fillText(`MAX_SPEED:${this.physics.MAX_CUE_SPEED}`, 10, 95);
        ctx.restore();
    }

    drawPocketHighlights(ctx) {
        // Draw glowing highlights on all pockets when calling pocket
        for (let i = 0; i < this.physics.pockets.length; i++) {
            const pocket = this.physics.pockets[i];

            ctx.save();

            // Pulsing glow effect
            const time = Date.now() / 1000;
            const pulse = 0.7 + Math.sin(time * 3) * 0.3;

            // Outer glow
            ctx.shadowColor = `rgba(255, 215, 0, ${pulse})`;
            ctx.shadowBlur = 30;
            ctx.strokeStyle = `rgba(255, 215, 0, ${pulse * 0.8})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, this.physics.pocketRadius + 15, 0, Math.PI * 2);
            ctx.stroke();

            // Inner ring
            ctx.shadowBlur = 15;
            ctx.strokeStyle = `rgba(255, 255, 100, ${pulse})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, this.physics.pocketRadius + 10, 0, Math.PI * 2);
            ctx.stroke();

            // Pocket number
            ctx.shadowBlur = 5;
            ctx.fillStyle = `rgba(255, 255, 255, ${pulse})`;
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${i + 1}`, pocket.x, pocket.y);

            ctx.restore();
        }
    }

    drawTable(ctx) {
        // Keep the felt/grain still and avoid repainting the static high-DPI
        // table on every animation frame. Rebuild for density or kitchen changes.
        const key = `${this.canvas.width}:${this.canvas.height}:${!!this.ballInHandKitchen}`;
        if (this.tableArtworkKey !== key) {
            const surface = this.tableArtwork || document.createElement('canvas');
            surface.width = this.canvas.width;
            surface.height = this.canvas.height;
            const surfaceCtx = surface.getContext('2d');
            surfaceCtx.setTransform(surface.width / this.tableWidth, 0, 0, surface.height / this.tableHeight, 0, 0);
            this.paintTable(surfaceCtx);
            this.tableArtwork = surface;
            this.tableArtworkKey = key;
        }
        ctx.drawImage(this.tableArtwork, 0, 0, this.tableWidth, this.tableHeight);
    }

    paintTable(ctx) {
        const c = this.cushionWidth;
        const w = this.tableWidth;
        const h = this.tableHeight;

        // === OUTER FRAME (Dark wood with grain) ===
        const frameGradient = ctx.createLinearGradient(0, 0, 0, h);
        frameGradient.addColorStop(0, '#2d1810');
        frameGradient.addColorStop(0.3, '#4a2c1a');
        frameGradient.addColorStop(0.5, '#3d2315');
        frameGradient.addColorStop(0.7, '#4a2c1a');
        frameGradient.addColorStop(1, '#2d1810');
        ctx.fillStyle = frameGradient;
        ctx.fillRect(0, 0, w, h);

        // === FELT (Rich green with enhanced texture) ===
        const feltGradient = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
        feltGradient.addColorStop(0, '#1d8050');
        feltGradient.addColorStop(0.5, '#0f6b3d');
        feltGradient.addColorStop(0.85, '#0a5c32');
        feltGradient.addColorStop(1, '#085028');
        ctx.fillStyle = feltGradient;
        ctx.fillRect(c, c, w - 2 * c, h - 2 * c);

        // Directional nap (felt has direction from head to foot)
        ctx.save();
        ctx.globalAlpha = 0.1;
        const napGrad = ctx.createLinearGradient(c, c, w - c, h - c);
        napGrad.addColorStop(0, 'rgba(255, 255, 255, 0.12)');
        napGrad.addColorStop(0.4, 'rgba(0, 0, 0, 0.08)');
        napGrad.addColorStop(0.6, 'rgba(0, 0, 0, 0.08)');
        napGrad.addColorStop(1, 'rgba(255, 255, 255, 0.12)');
        ctx.fillStyle = napGrad;
        ctx.fillRect(c, c, w - 2 * c, h - 2 * c);
        ctx.restore();

        // Felt micro-texture (subtle noise) - Optimized
        ctx.save();
        ctx.globalAlpha = 0.08;
        for (let i = 0; i < 150; i++) {
            const x = c + Math.random() * (w - 2 * c);
            const y = c + Math.random() * (h - 2 * c);
            const size = Math.random() * 2 + 0.5;
            ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#2a9d5c';
            ctx.fillRect(x, y, size, size);
        }
        ctx.restore();

        // === HEAD STRING LINE (Kitchen line for break shot) ===
        const headStringX = w * 0.25;

        // If ball-in-hand with kitchen restriction, highlight the kitchen area
        if (this.ballInHandKitchen) {
            // Highlight kitchen area with subtle glow
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = '#00aaff';
            ctx.fillRect(c, c, headStringX - c, h - 2 * c);
            ctx.restore();

            // Draw more prominent head string line
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
            ctx.lineWidth = 2;
            ctx.setLineDash([10, 5]);
            ctx.beginPath();
            ctx.moveTo(headStringX, c);
            ctx.lineTo(headStringX, h - c);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        } else {
            // Subtle head string line always visible
            ctx.save();
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
            ctx.lineWidth = 1;
            ctx.setLineDash([8, 4]);
            ctx.beginPath();
            ctx.moveTo(headStringX, c);
            ctx.lineTo(headStringX, h - c);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.restore();
        }

        // === INNER RAIL CUSHIONS (Green rubber with enhanced 3D effect) ===
        const railDepth = 10;

        // Top rail with enhanced gradient
        const topRailGrad = ctx.createLinearGradient(0, c - railDepth, 0, c);
        topRailGrad.addColorStop(0, '#0a5028');
        topRailGrad.addColorStop(0.3, '#1a7a48');
        topRailGrad.addColorStop(0.5, '#1a8a50');
        topRailGrad.addColorStop(0.7, '#1a7a48');
        topRailGrad.addColorStop(1, '#0d5c30');
        ctx.fillStyle = topRailGrad;
        ctx.fillRect(c + 30, c - railDepth, w - 2 * c - 60, railDepth);

        // Rubber specular highlight on top rail
        ctx.save();
        ctx.globalAlpha = 0.2;
        const topSpecGrad = ctx.createLinearGradient(0, c - railDepth, 0, c - railDepth / 2);
        topSpecGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
        topSpecGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
        topSpecGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = topSpecGrad;
        ctx.fillRect(c + 30, c - railDepth, w - 2 * c - 60, railDepth / 2);
        ctx.restore();

        // Bottom rail
        const botRailGrad = ctx.createLinearGradient(0, h - c, 0, h - c + railDepth);
        botRailGrad.addColorStop(0, '#0d5c30');
        botRailGrad.addColorStop(0.3, '#1a7a48');
        botRailGrad.addColorStop(0.5, '#1a8a50');
        botRailGrad.addColorStop(0.7, '#1a7a48');
        botRailGrad.addColorStop(1, '#0a5028');
        ctx.fillStyle = botRailGrad;
        ctx.fillRect(c + 30, h - c, w - 2 * c - 60, railDepth);

        // Left rail
        const leftRailGrad = ctx.createLinearGradient(c - railDepth, 0, c, 0);
        leftRailGrad.addColorStop(0, '#0a5028');
        leftRailGrad.addColorStop(0.3, '#1a7a48');
        leftRailGrad.addColorStop(0.5, '#1a8a50');
        leftRailGrad.addColorStop(0.7, '#1a7a48');
        leftRailGrad.addColorStop(1, '#0d5c30');
        ctx.fillStyle = leftRailGrad;
        ctx.fillRect(c - railDepth, c + 30, railDepth, h - 2 * c - 60);

        // Right rail
        const rightRailGrad = ctx.createLinearGradient(w - c, 0, w - c + railDepth, 0);
        rightRailGrad.addColorStop(0, '#0d5c30');
        rightRailGrad.addColorStop(0.3, '#1a7a48');
        rightRailGrad.addColorStop(0.5, '#1a8a50');
        rightRailGrad.addColorStop(0.7, '#1a7a48');
        rightRailGrad.addColorStop(1, '#0a5028');
        ctx.fillStyle = rightRailGrad;
        ctx.fillRect(w - c, c + 30, railDepth, h - 2 * c - 60);

        // === ENHANCED WOOD RAILS (3D with realistic grain) - Optimized ===
        ctx.save();
        ctx.globalAlpha = 0.15;
        ctx.strokeStyle = '#1a0f08';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < 25; i++) {
            // Horizontal grain on top/bottom
            const y1 = Math.random() * c;
            ctx.beginPath();
            ctx.moveTo(0, y1);
            ctx.lineTo(w, y1 + Math.sin(i) * 2);
            ctx.stroke();
            const y2 = h - c + Math.random() * c;
            ctx.beginPath();
            ctx.moveTo(0, y2);
            ctx.lineTo(w, y2 + Math.sin(i) * 2);
            ctx.stroke();
        }
        ctx.restore();

        // Rail highlight line
        ctx.strokeStyle = '#654321';
        ctx.lineWidth = 2;
        ctx.strokeRect(c - 2, c - 2, w - 2 * c + 4, h - 2 * c + 4);

        // Inner shadow on felt (more dramatic)
        ctx.save();
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.strokeStyle = 'rgba(0,0,0,0)';
        ctx.lineWidth = 25;
        ctx.strokeRect(c + 12, c + 12, w - 2 * c - 24, h - 2 * c - 24);
        ctx.restore();

        // === DIRECTIONAL OVERHEAD LIGHTING ===
        ctx.save();
        const lightGrad = ctx.createRadialGradient(
            w / 2, h / 2, 0,
            w / 2, h / 2, Math.max(w, h) / 1.8
        );
        lightGrad.addColorStop(0, 'rgba(255, 255, 255, 0.1)');
        lightGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
        lightGrad.addColorStop(0.8, 'rgba(0, 0, 0, 0.05)');
        lightGrad.addColorStop(1, 'rgba(0, 0, 0, 0.18)');
        ctx.fillStyle = lightGrad;
        ctx.fillRect(c, c, w - 2 * c, h - 2 * c);
        ctx.restore();

        // === DIAMOND MARKERS (Metallic inlays) ===
        const diamondSize = 6;
        const playableWidth = w - 2 * c;
        const playableHeight = h - 2 * c;

        for (let i = 1; i <= 6; i++) {
            const x = c + (playableWidth / 7) * i;
            this.drawDiamond(ctx, x, c / 2, diamondSize);
            this.drawDiamond(ctx, x, h - c / 2, diamondSize);
        }
        for (let i = 1; i <= 3; i++) {
            const y = c + (playableHeight / 4) * i;
            this.drawDiamond(ctx, c / 2, y, diamondSize);
            this.drawDiamond(ctx, w - c / 2, y, diamondSize);
        }

        // === ENHANCED POCKETS (Optimized) ===
        for (const pocket of this.physics.pockets) {
            // Use different radius for center pockets (smaller, more recessed)
            const pr = pocket.isCenter ? this.physics.centerPocketRadius : this.physics.pocketRadius;

            if (pocket.isCenter) {
                // Recessed opening cuts through the rail, not a circle floating
                // over the cloth. The throat and sensor share the same centre.
                const top = pocket.y < h / 2;
                const half = this.physics.centerPocketMouthHalfWidth;
                ctx.fillStyle = '#090e0c';
                ctx.fillRect(pocket.x - half, top ? pocket.y : h - c, half * 2,
                    this.physics.centerPocketInset);
                ctx.strokeStyle = '#254637'; ctx.lineWidth = 1.5;
                for (const side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(pocket.x + side * half, top ? c : h - c);
                    ctx.lineTo(pocket.x + side * half, pocket.y);
                    ctx.stroke();
                }
            }

            // Pocket shadow (optimized - single layer)
            ctx.save();
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 12;
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, pr + 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Deep pocket interior with gradient
            const pocketGrad = ctx.createRadialGradient(
                pocket.x, pocket.y, 0,
                pocket.x, pocket.y, pr
            );
            pocketGrad.addColorStop(0, '#000000');
            pocketGrad.addColorStop(0.6, '#0a0a0a');
            pocketGrad.addColorStop(1, '#1a1a1a');
            ctx.fillStyle = pocketGrad;
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, pr, 0, Math.PI * 2);
            ctx.fill();

            // Enhanced metallic rim
            const rimWidth = pocket.isCenter ? 3 : 4;
            const rimGrad = ctx.createRadialGradient(
                pocket.x - 3, pocket.y - 3, pr - rimWidth,
                pocket.x, pocket.y, pr + 2
            );
            rimGrad.addColorStop(0, '#8a8a8a');
            rimGrad.addColorStop(0.3, '#c0c0c0');
            rimGrad.addColorStop(0.6, '#d0d0d0');
            rimGrad.addColorStop(1, '#5a5a5a');

            ctx.strokeStyle = rimGrad;
            ctx.lineWidth = rimWidth;
            ctx.beginPath();
            ctx.arc(pocket.x, pocket.y, pr - rimWidth / 2, 0, Math.PI * 2);
            ctx.stroke();

            // Bright rim specular highlight
            ctx.save();
            ctx.globalAlpha = 0.6;
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(pocket.x - 3, pocket.y - 3, pr - rimWidth, -Math.PI * 0.7, -Math.PI * 0.3);
            ctx.stroke();
            ctx.restore();
        }

        // === CORNER BRACKETS (Metallic silver) ===
        this.drawCornerBracket(ctx, 0, 0, 1, 1);
        this.drawCornerBracket(ctx, w, 0, -1, 1);
        this.drawCornerBracket(ctx, 0, h, 1, -1);
        this.drawCornerBracket(ctx, w, h, -1, -1);

        // === BREAK LINE ===
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.18)';
        ctx.lineWidth = 1.2;
        ctx.setLineDash([10, 8]);
        ctx.beginPath();
        ctx.moveTo(w * 0.25, c + 5);
        ctx.lineTo(w * 0.25, h - c - 5);
        ctx.stroke();
        ctx.setLineDash([]);

        // Break spot with glow
        ctx.save();
        ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
        ctx.shadowBlur = 6;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.beginPath();
        ctx.arc(w * 0.25, h / 2, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    drawDiamond(ctx, x, y, size) {
        const grad = ctx.createLinearGradient(x - size, y - size, x + size, y + size);
        grad.addColorStop(0, '#ffd700');
        grad.addColorStop(0.3, '#ffec8b');
        grad.addColorStop(0.5, '#ffd700');
        grad.addColorStop(0.7, '#daa520');
        grad.addColorStop(1, '#b8860b');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size, y);
        ctx.closePath();
        ctx.fill();

        // Diamond highlight
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 0.5;
        ctx.stroke();
    }

    drawCornerBracket(ctx, x, y, dirX, dirY) {
        const size = 35;
        ctx.save();

        const grad = ctx.createLinearGradient(x, y, x + dirX * size, y + dirY * size);
        grad.addColorStop(0, '#a0a0a0');
        grad.addColorStop(0.3, '#d0d0d0');
        grad.addColorStop(0.5, '#c0c0c0');
        grad.addColorStop(0.7, '#909090');
        grad.addColorStop(1, '#606060');

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + dirX * size, y);
        ctx.lineTo(x + dirX * size * 0.7, y + dirY * size * 0.3);
        ctx.lineTo(x + dirX * size * 0.3, y + dirY * size * 0.7);
        ctx.lineTo(x, y + dirY * size);
        ctx.closePath();
        ctx.fill();

        // Bracket border
        ctx.strokeStyle = '#404040';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.restore();
    }

    drawBalls(ctx) {
        // Keep the cue ball above object balls during ball-in-hand placement.
        for (const ball of this.balls) {
            if (ball.active && ball.id !== 0) PoolArt.drawBall(ctx, ball, this.physics.BALL_RADIUS);
        }
        const cueBall = this.balls.find(ball => ball.id === 0);
        if (cueBall?.active) PoolArt.drawBall(ctx, cueBall, this.physics.BALL_RADIUS);
    }

    drawAimLine(ctx) {
        const cueBall = this.balls[0];
        if (!cueBall.active) return;
        const aimData = this.physics.calculateAimLine(cueBall, this.aimAngle, this.balls, this.power);
        const { points, segments } = aimData;
        // Draw solid aim line (Miniclip style)
        if (segments.length > 0) {
            const segment = segments[0];
            ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.lineWidth = 2;
            ctx.setLineDash([]); // Solid line, not dashed
            ctx.beginPath();
            ctx.moveTo(segment.start.x, segment.start.y);
            for (const point of segment.points) {
                ctx.lineTo(point.x, point.y);
            }
            ctx.stroke();
        }
        for (const point of points) {
            // Cushion reflection point - small indicator
            if (point.type === 'reflection') {
                ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                ctx.beginPath();
                ctx.arc(point.x, point.y, 4, 0, Math.PI * 2);
                ctx.fill();
            }
            // Ghost ball - circle showing where cue ball will be at impact (Miniclip style)
            if (point.type === 'contact') {
                ctx.save();
                // Ghost ball outline only (no fill)
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(point.ghostX, point.ghostY, this.physics.BALL_RADIUS, 0, Math.PI * 2);
                ctx.stroke();
                ctx.restore();
            }
            // Target ball trajectory - solid line showing where target ball goes
            if (point.type === 'target') {
                const willPocket = point.nearPocket !== null && point.nearPocket !== undefined;
                const lineColor = willPocket ? 'rgba(0, 255, 100, 0.9)' : 'rgba(255, 255, 255, 0.7)';
                ctx.strokeStyle = lineColor;
                ctx.lineWidth = willPocket ? 3 : 2;
                ctx.setLineDash([]); // Solid line
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(point.tx, point.ty);
                ctx.stroke();
                // Arrow head
                const angle = Math.atan2(point.ty - point.y, point.tx - point.x);
                const arrowSize = 8;
                ctx.fillStyle = lineColor;
                ctx.beginPath();
                ctx.moveTo(point.tx, point.ty);
                ctx.lineTo(point.tx - arrowSize * Math.cos(angle - Math.PI / 6), point.ty - arrowSize * Math.sin(angle - Math.PI / 6));
                ctx.lineTo(point.tx - arrowSize * Math.cos(angle + Math.PI / 6), point.ty - arrowSize * Math.sin(angle + Math.PI / 6));
                ctx.closePath();
                ctx.fill();
                // Highlight pocket if ball will go in
                if (willPocket) {
                    ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
                    ctx.lineWidth = 3;
                    ctx.beginPath();
                    ctx.arc(point.nearPocket.x, point.nearPocket.y, 25, 0, Math.PI * 2);
                    ctx.stroke();
                }
            }
            // Cue ball deflection path - thin solid line showing where cue ball goes after impact
            if (point.type === 'deflection') {
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1.5;
                ctx.setLineDash([]); // Solid line
                ctx.beginPath();
                ctx.moveTo(point.x, point.y);
                ctx.lineTo(point.tx, point.ty);
                ctx.stroke();
            }
        }
    }

    drawCue(ctx) {
        if (this.cueStroke) {
            const stroke = this.cueStroke;
            const progress = (performance.now() - stroke.started) / 150;
            if (progress >= 1) { this.cueStroke = null; }
            else {
                ctx.save();
                ctx.translate(stroke.x, stroke.y); ctx.rotate(stroke.angle);
                ctx.translate(-this.physics.BALL_RADIUS - 2 - 12 * progress * progress, 0);
                ctx.globalAlpha = 1 - progress;
                PoolArt.drawCue(ctx, this.selectedCue);
                ctx.restore();
                return;
            }
        }
        if (this.gameState !== 'aiming') return;
        const cueBall = this.balls[0];
        if (!cueBall.active) return;
        const cueDistance = 25 + (this.power / 100) * 40;
        ctx.save();
        ctx.translate(cueBall.x - Math.cos(this.aimAngle) * cueDistance,
            cueBall.y - Math.sin(this.aimAngle) * cueDistance);
        ctx.rotate(this.aimAngle);
        PoolArt.drawCue(ctx, this.selectedCue);
        ctx.restore();
    }

    drawCueRing(ctx, x, height, color = '#c0c0c0') {
        const ringGrad = ctx.createLinearGradient(0, -height / 2, 0, height / 2);
        if (color === '#ffffff') {
            ringGrad.addColorStop(0, '#d0d0d0');
            ringGrad.addColorStop(0.5, '#ffffff');
            ringGrad.addColorStop(1, '#c0c0c0');
        } else if (color === '#c0a040') {
            ringGrad.addColorStop(0, '#a08030');
            ringGrad.addColorStop(0.5, '#d4b050');
            ringGrad.addColorStop(1, '#a08030');
        } else {
            ringGrad.addColorStop(0, '#909090');
            ringGrad.addColorStop(0.5, '#d0d0d0');
            ringGrad.addColorStop(1, '#808080');
        }
        ctx.fillStyle = ringGrad;
        ctx.fillRect(x, -height / 2, 3, height);
    }

    getBallColor(id) {
        const colors = {
            0: '#ffffff',
            1: '#ffd700',
            2: '#0066cc',
            3: '#ff0000',
            4: '#800080',
            5: '#ff6600',
            6: '#006400',
            7: '#8b0000',
            8: '#000000',
            9: '#ffd700',
            10: '#0066cc',
            11: '#ff0000',
            12: '#800080',
            13: '#ff6600',
            14: '#006400',
            15: '#8b0000'
        };
        return colors[id] || '#ffffff';
    }

    lightenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.min(255, (num >> 16) + amt);
        const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
        const B = Math.min(255, (num & 0x0000FF) + amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }

    darkenColor(color, percent) {
        const num = parseInt(color.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = Math.max(0, (num >> 16) - amt);
        const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
        const B = Math.max(0, (num & 0x0000FF) - amt);
        return '#' + (0x1000000 + R * 0x10000 + G * 0x100 + B).toString(16).slice(1);
    }
}

// Initialize game when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Only initialize if the pool-table canvas exists (skip on test pages)
    const canvas = document.getElementById('pool-table');
    if (!canvas) {
        console.log('Pool table canvas not found - skipping game initialization (this is expected on test pages)');
        return;
    }

    try {
        console.log('Initializing 8-Ball Pool Game...');
        window.gameInstance = new PoolGame();
        console.log('Game initialized successfully!');

        // Initialize chat system
        window.chatManager = new ChatManager(window.gameInstance);
        console.log('Chat system initialized!');

        window.requestedGameMode = new URLSearchParams(window.location.search).get('mode') || 'ai';
    } catch (error) {
        console.error('FATAL ERROR: Failed to initialize game:', error);
        console.error('Error stack:', error.stack);
        alert('Failed to load game: ' + error.message + '\n\nCheck browser console for details.');
    }
});

// Chat Manager Class
class ChatManager {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.isOpen = false;
        this.messages = [];
        this.unreadCount = 0;

        // Player names (will be updated with real usernames if logged in)
        this.playerNames = {
            1: 'Player 1',
            2: 'Player 2'
        };

        this.initElements();
        this.bindEvents();
        this.loadPlayerNames();
    }

    loadPlayerNames() {
        // Try to get player 1 name from header or logged-in user
        const p1NameEl = document.querySelector('.player-1 .player-name');
        if (p1NameEl && p1NameEl.textContent && p1NameEl.textContent !== 'Player 1') {
            this.playerNames[1] = p1NameEl.textContent;
        }

        // Check if there's a logged-in user (for player 1)
        if (window.currentUser && window.currentUser.username) {
            this.playerNames[1] = window.currentUser.username;
        }

        // Try to get player 2 name from header
        const p2NameEl = document.querySelector('.player-2 .player-name');
        if (p2NameEl && p2NameEl.textContent && p2NameEl.textContent !== 'Player 2') {
            this.playerNames[2] = p2NameEl.textContent;
        }


        console.log('Chat player names:', this.playerNames);
    }

    getPlayerName(playerNum) {
        return this.playerNames[playerNum] || `Player ${playerNum}`;
    }

    setPlayerName(playerNum, name) {
        this.playerNames[playerNum] = name;
    }

    initElements() {
        this.chatPanel = document.getElementById('chat-panel');
        this.chatToggle = document.getElementById('chat-toggle');
        this.chatContainer = document.getElementById('chat-container');
        this.chatClose = document.getElementById('chat-close');
        this.chatMessages = document.getElementById('chat-messages');
        this.chatInput = document.getElementById('chat-input');
        this.chatSend = document.getElementById('chat-send');
        this.chatBadge = document.getElementById('chat-badge');
        this.quickBtns = document.querySelectorAll('.quick-btn');
    }

    bindEvents() {
        // Toggle chat panel
        if (this.chatToggle) {
            this.chatToggle.addEventListener('click', () => this.toggleChat());
        }

        // Close chat
        if (this.chatClose) {
            this.chatClose.addEventListener('click', () => this.closeChat());
        }

        // NOTE: Send message and quick chat buttons are handled by network chat in game.html
        // Do NOT add event listeners here to prevent duplicate messages
    }

    toggleChat() {
        this.isOpen = !this.isOpen;
        if (this.chatContainer) {
            this.chatContainer.classList.toggle('open', this.isOpen);
        }
        if (this.isOpen) {
            this.clearUnread();
            if (this.chatInput) {
                this.chatInput.focus();
            }
        }
    }

    openChat() {
        this.isOpen = true;
        if (this.chatContainer) {
            this.chatContainer.classList.add('open');
        }
        this.clearUnread();
    }

    closeChat() {
        this.isOpen = false;
        if (this.chatContainer) {
            this.chatContainer.classList.remove('open');
        }
    }

    getCurrentPlayer() {
        // Get current player from game instance
        if (this.game && this.game.currentPlayer !== undefined) {
            return this.game.currentPlayer;
        }
        return 1; // Default to player 1
    }

    sendMessage() {
        if (!this.chatInput) return;

        const text = this.chatInput.value.trim();
        if (text === '') return;

        const player = this.getCurrentPlayer();
        this.addMessage(player, text);
        this.chatInput.value = '';
    }

    sendQuickMessage(text) {
        const player = this.getCurrentPlayer();
        this.addMessage(player, text);
    }

    addMessage(player, text) {
        const message = {
            player: player,
            text: text,
            time: new Date()
        };
        this.messages.push(message);

        // Remove welcome message if exists
        const welcome = this.chatMessages?.querySelector('.chat-welcome');
        if (welcome) {
            welcome.remove();
        }

        // Add message to chat
        this.renderMessage(message);

        // If chat is closed, show notification
        if (!this.isOpen) {
            this.showNotification(player, text);
            this.incrementUnread();
        }

        // Scroll to bottom
        if (this.chatMessages) {
            this.chatMessages.scrollTop = this.chatMessages.scrollHeight;
        }
    }

    renderMessage(message) {
        if (!this.chatMessages) return;

        const msgDiv = document.createElement('div');
        msgDiv.className = `chat-message player-${message.player}`;

        const senderSpan = document.createElement('span');
        senderSpan.className = 'chat-sender';
        senderSpan.textContent = this.getPlayerName(message.player);

        const bubbleDiv = document.createElement('div');
        bubbleDiv.className = 'chat-bubble';
        bubbleDiv.textContent = message.text;

        msgDiv.appendChild(senderSpan);
        msgDiv.appendChild(bubbleDiv);
        this.chatMessages.appendChild(msgDiv);
    }

    showNotification(player, text) {
        // Remove any existing notifications
        const existing = document.querySelectorAll('.chat-notification');
        existing.forEach(el => el.remove());

        // Create notification
        const notification = document.createElement('div');
        notification.className = 'chat-notification';

        const sender = document.createElement('div');
        sender.className = 'sender';
        sender.textContent = this.getPlayerName(player);

        const message = document.createElement('div');
        message.className = 'message';
        message.textContent = text.length > 50 ? text.substring(0, 47) + '...' : text;

        notification.appendChild(sender);
        notification.appendChild(message);
        document.body.appendChild(notification);

        // Remove after animation
        setTimeout(() => {
            notification.remove();
        }, 3000);

        // Click to open chat
        notification.addEventListener('click', () => {
            notification.remove();
            this.openChat();
        });
    }

    incrementUnread() {
        this.unreadCount++;
        this.updateBadge();
    }

    clearUnread() {
        this.unreadCount = 0;
        this.updateBadge();
    }

    updateBadge() {
        if (!this.chatBadge) return;

        if (this.unreadCount > 0) {
            this.chatBadge.textContent = this.unreadCount > 9 ? '9+' : this.unreadCount;
            this.chatBadge.classList.add('active');
        } else {
            this.chatBadge.classList.remove('active');
        }
    }
}



