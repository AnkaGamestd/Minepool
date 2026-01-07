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

        // Set canvas size
        this.canvas.width = this.tableWidth;
        this.canvas.height = this.tableHeight;
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

        // Load selected cue (from localStorage or window.selectedCue)
        this.selectedCue = localStorage.getItem('selectedCue') || window.selectedCue || 'standard';
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
        // Start screen buttons
        document.getElementById('btn-2player').addEventListener('click', () => {
            if (this.startScreen) {
                this.startScreen.style.display = 'none';
                this.startScreen.classList.add('hidden');
            }
            this.startGame('2player');
        });
        document.getElementById('play-again').addEventListener('click', () => this.resetGame());

        // Cue Selection
        const cueModal = document.getElementById('cue-selection-modal');
        document.getElementById('btn-cues').addEventListener('click', () => {
            cueModal.classList.remove('hidden');
        });
        document.getElementById('close-cues').addEventListener('click', () => {
            cueModal.classList.add('hidden');
        });

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
        spinBall.addEventListener('click', (e) => this.handleSpinClick(e));
        document.getElementById('reset-spin').addEventListener('click', () => this.resetSpin());

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
            if (!this.startScreen) {
                console.error('Start screen element not found!');
                alert('Error: Start screen element not found!');
                return;
            }
            this.gameMode = mode;
            this.startScreen.style.display = 'none';
            this.initializeBalls();
            this.gameState = 'aiming';
            this.currentPlayer = 1;

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

            // Initialize the game
            this.gameMode = 'multiplayer';
            this.initializeBalls();
            this.gameState = 'aiming';
            this.currentPlayer = data.currentPlayer || 1;

            // Update player names in UI
            if (data.host) {
                const p1Name = document.getElementById('p1-name');
                const p1NameTop = document.getElementById('p1-name-top');
                const p1Avatar = document.getElementById('p1-avatar-top');
                if (p1Name) p1Name.textContent = data.host.username;
                if (p1NameTop) p1NameTop.textContent = data.host.username;
                if (p1Avatar) p1Avatar.textContent = data.host.username.charAt(0).toUpperCase();
            }
            if (data.guest) {
                const p2Name = document.getElementById('p2-name');
                const p2NameTop = document.getElementById('p2-name-top');
                const p2Avatar = document.getElementById('p2-avatar-top');
                if (p2Name) p2Name.textContent = data.guest.username;
                if (p2NameTop) p2NameTop.textContent = data.guest.username;
                if (p2Avatar) p2Avatar.textContent = data.guest.username.charAt(0).toUpperCase();
            }

            // Enable ball placement for break shot (only for player 1)
            if (this.myPlayerNumber === 1) {
                this.ballInHand = true;
                this.ballInHandKitchen = true;
            }
            this.isBreakShot = true;

            this.updateTurnIndicator();
            this.showMessage('MULTIPLAYER GAME', `${this.isMyTurn ? 'YOUR TURN' : 'OPPONENT\'S TURN'} - Wager: ${data.wager || 50} 💰`);
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

    animate() {
        // Simple physics: one update per frame
        if (this.gameState === 'shooting') {
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
        this.animationId = requestAnimationFrame(() => this.animate());
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

        // Standard 8-ball rack formation:
        // Row 0: [1] - Apex
        // Row 1: [9, 2] - stripe, solid
        // Row 2: [3, 8, 10] - solid, 8-BALL (center), stripe
        // Row 3: [11, 4, 5, 12] - stripe, solid, solid, stripe
        // Row 4: [6, 13, 7, 14, 15] - solid (back left), stripe, solid, stripe, stripe (back right)
        const rackOrder = [1, 9, 2, 3, 8, 10, 11, 4, 5, 12, 6, 13, 7, 14, 15];
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
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
                const distance = Math.sqrt(dx * dx + dy * dy);
                const dragAngle = Math.atan2(dy, dx);
                const angleDiff = Math.abs(dragAngle - this.aimAngle);
                if (angleDiff > Math.PI / 2) {
                    this.power = Math.min(100, distance / 2);
                } else {
                    this.power = Math.max(0, this.power - 1);
                }
                this.updatePowerGauge();
            }
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        // Account for canvas scaling (CSS size vs internal size)
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
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

        if (this.power > 5) {
            this.shoot();
            this.aimLocked = false;
            this.canvas.style.cursor = 'default';
        } else {
            this.power = 0;
            this.updatePowerGauge();
        }
    }

    handleMouseLeave() {
        this.isDragging = false;
    }

    // ==========================================
    // NEW MOBILE CONTROLS: DIRECT AIM + POWER SLIDER
    // ==========================================

    // --- CANVAS TOUCH: AIMING ---
    handleTouchStart(e) {
        if (e.touches.length === 0) return;
        const touch = e.touches[0];

        // Convert touch to canvas coordinates
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
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
        this.aimAngle = Math.atan2(touchY - cueBall.y, touchX - cueBall.x);
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
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
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
        if (this.gameState === 'aiming' && this.mobileTouch.isAiming) {
            const cueBall = this.balls[0];
            this.aimAngle = Math.atan2(touchY - cueBall.y, touchX - cueBall.x);
        }
    }

    handleTouchEnd(e) {
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
                this.showMessage('READY', 'Use the slider on left to shoot!');
            } else {
                this.showMessage('INVALID', 'Ball overlaps!');
            }
        }
    }

    // --- POWER SLIDER CONTROLS ---
    handlePowerTouchStart(e) {
        if (this.gameState !== 'aiming') return;
        if (this.isMultiplayer && !this.isMyTurn) return;

        this.updatePowerFromTouch(e.touches[0]);
    }

    handlePowerTouchMove(e) {
        if (this.gameState !== 'aiming') return;
        this.updatePowerFromTouch(e.touches[0]);
    }

    handlePowerTouchEnd(e) {
        if (this.gameState !== 'aiming') return;

        // Shoot if power is sufficient
        if (this.power > 5) {
            this.shoot();
        }

        // Reset power visual
        this.power = 0;
        this.updatePowerGauge();

        // Reset handle position visually
        if (this.powerHandle) {
            this.powerHandle.style.top = '0%';
        }
    }

    updatePowerFromTouch(touch) {
        const rect = this.powerGauge.getBoundingClientRect();
        // Calculate relative Y position (0 at top, 1 at bottom)
        // We want 0 at top (0% power) and 1 at bottom (100% power)

        let relativeY = (touch.clientY - rect.top) / rect.height;

        // Clamp between 0 and 1
        relativeY = Math.max(0, Math.min(1, relativeY));

        // Set power (0 to 100)
        this.power = relativeY * 100;

        // Update UI
        this.updatePowerGauge();

        // Update handle position
        if (this.powerHandle) {
            this.powerHandle.style.top = `${relativeY * 100}%`;
        }
    }

    handleSpinClick(e) {
        if (this.gameState !== 'aiming') return;
        const spinBall = e.currentTarget;
        const rect = spinBall.getBoundingClientRect();
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;
        this.spinX = (clickX - centerX) / centerX;
        this.spinY = (clickY - centerY) / centerY;
        this.updateSpinIndicator();
    }

    resetSpin() {
        this.spinX = 0;
        this.spinY = 0;
        this.updateSpinIndicator();
    }

    updatePowerGauge() {
        this.powerFill.style.height = this.power + '%';
        this.powerValue.textContent = Math.round(this.power) + '%';
    }

    updateSpinIndicator() {
        const offsetX = this.spinX * 29;
        const offsetY = this.spinY * 29;
        this.spinIndicator.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
        const spinInfo = document.getElementById('spin-info');
        if (spinInfo) {
            let spinType = '';
            const absX = Math.abs(this.spinX);
            const absY = Math.abs(this.spinY);
            if (absX < 0.2 && absY < 0.2) {
                spinType = 'Center Hit';
                this.spinIndicator.style.background = 'var(--accent-green)';
            } else {
                if (this.spinY < -0.3) { spinType = 'Top Spin'; this.spinIndicator.style.background = 'var(--accent-blue)'; }
                else if (this.spinY > 0.3) { spinType = 'Draw'; this.spinIndicator.style.background = 'var(--accent-gold)'; }
                if (this.spinX < -0.3) { spinType = spinType ? spinType + ' + Left' : 'Left English'; this.spinIndicator.style.background = 'var(--accent-red)'; }
                else if (this.spinX > 0.3) { spinType = spinType ? spinType + ' + Right' : 'Right English'; this.spinIndicator.style.background = 'var(--accent-red)'; }
                if (absX > 0.3 && absY > 0.3) { this.spinIndicator.style.background = '#ff00ff'; }
            }
            spinInfo.textContent = spinType || 'Center Hit';
        }
    }

    updateTurnIndicator() {
        const turnText = document.querySelector('.turn-text');
        let text = `PLAYER ${this.currentPlayer}'s TURN`;

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
            // Player is on the 8-ball, must call pocket
            this.needsCallPocket = true;
            this.gameState = 'calling-pocket';
            this.stopShotTimer();
            this.showMessage('CALL POCKET', 'Click on a pocket to call your 8-ball shot', 5000);
        } else {
            // Normal shot, start timer
            this.startShotTimer();
        }
    }

    shoot() {
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

                // Start shot timer for my turn
                this.startShotTimer();
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
            // Single player mode - always set to aiming
            this.gameState = 'aiming';
            this.canvas.style.cursor = 'crosshair';
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

        if (this.isMultiplayer) {
            // Show personalized message for multiplayer
            if (player === this.myPlayerNumber) {
                winnerText = '🎉 YOU WON! 🎉';
            } else {
                winnerText = '😞 YOU LOSE 😞';
            }
        } else {
            // Show generic message for single player
            winnerText = `PLAYER ${player} WINS!`;
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

    resetGame() {
        this.stopShotTimer();
        this.winnerScreen.classList.add('hidden');
        this.startScreen.classList.remove('hidden');
        this.startScreen.style.display = 'flex';
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
        if (canAim) this.drawCue(ctx);

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
        // Sort balls so cue ball is drawn last (on top when ball-in-hand)
        const sortedBalls = [...this.balls].sort((a, b) => {
            if (a.id === 0) return 1;
            if (b.id === 0) return -1;
            return 0;
        });

        for (const ball of sortedBalls) {
            if (!ball.active) continue;

            const r = this.physics.BALL_RADIUS;
            const color = this.getBallColor(ball.id);

            ctx.save();
            ctx.translate(ball.x, ball.y);

            // === DROP SHADOW ===
            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
            ctx.shadowBlur = r * 0.8;
            ctx.shadowOffsetX = r * 0.3;
            ctx.shadowOffsetY = r * 0.4;
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.beginPath();
            ctx.ellipse(r * 0.3, r * 0.4, r * 0.7, r * 0.35, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            const lightOffsetX = -r * 0.38;
            const lightOffsetY = -r * 0.38;

            // Ambient occlusion
            ctx.save();
            ctx.globalAlpha = 0.4;
            const aoGrad = ctx.createRadialGradient(0, r * 0.7, 0, 0, r * 0.7, r * 0.5);
            aoGrad.addColorStop(0, 'rgba(0, 0, 0, 0.5)');
            aoGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.2)');
            aoGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
            ctx.fillStyle = aoGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();

            // Main sphere gradient
            const mainGrad = ctx.createRadialGradient(lightOffsetX, lightOffsetY, r * 0.05, 0, 0, r * 1.05);
            mainGrad.addColorStop(0, this.lightenColor(color, 90));
            mainGrad.addColorStop(0.15, this.lightenColor(color, 60));
            mainGrad.addColorStop(0.35, this.lightenColor(color, 30));
            mainGrad.addColorStop(0.55, color);
            mainGrad.addColorStop(0.75, this.darkenColor(color, 30));
            mainGrad.addColorStop(0.9, this.darkenColor(color, 55));
            mainGrad.addColorStop(1, this.darkenColor(color, 70));

            ctx.fillStyle = mainGrad;
            ctx.beginPath();
            ctx.arc(0, 0, r, 0, Math.PI * 2);
            ctx.fill();

            // Stripe for striped balls (9-15)
            if (ball.id > 8 && ball.id !== 0) {
                ctx.save();
                ctx.rotate(ball.rotation || 0);

                // White stripe
                const stripeGrad = ctx.createRadialGradient(lightOffsetX, lightOffsetY, r * 0.05, 0, 0, r);
                stripeGrad.addColorStop(0, '#ffffff');
                stripeGrad.addColorStop(0.3, '#f8f8f8');
                stripeGrad.addColorStop(0.7, '#e8e8e8');
                stripeGrad.addColorStop(1, '#c8c8c8');

                ctx.fillStyle = stripeGrad;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.85, -0.55, 0.55, false);
                ctx.arc(0, 0, r * 0.85, Math.PI - 0.55, Math.PI + 0.55, false);
                ctx.closePath();
                ctx.fill();

                ctx.restore();
            }

            // Number circle for non-cue balls
            if (ball.id !== 0) {
                // Shadow
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
                ctx.beginPath();
                ctx.arc(0.5, 0.5, r * 0.38, 0, Math.PI * 2);
                ctx.fill();

                // White circle
                const circleGrad = ctx.createRadialGradient(-r * 0.1, -r * 0.1, r * 0.02, 0, 0, r * 0.38);
                circleGrad.addColorStop(0, '#ffffff');
                circleGrad.addColorStop(0.5, '#fafafa');
                circleGrad.addColorStop(1, '#e0e0e0');

                ctx.fillStyle = circleGrad;
                ctx.beginPath();
                ctx.arc(0, 0, r * 0.36, 0, Math.PI * 2);
                ctx.fill();

                // Number
                ctx.fillStyle = '#1a1a1a';
                ctx.font = 'bold 9px Arial, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(ball.id.toString(), 0, 0.5);
            }

            // Specular highlight
            const specX = -r * 0.42;
            const specY = -r * 0.42;
            const specGrad = ctx.createRadialGradient(specX, specY, 0, specX, specY, r * 0.45);
            specGrad.addColorStop(0, 'rgba(255, 255, 255, 0.9)');
            specGrad.addColorStop(0.25, 'rgba(255, 255, 255, 0.6)');
            specGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.3)');
            specGrad.addColorStop(0.75, 'rgba(255, 255, 255, 0.1)');
            specGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');

            ctx.fillStyle = specGrad;
            ctx.beginPath();
            ctx.ellipse(specX, specY, r * 0.4, r * 0.3, -Math.PI / 4.5, 0, Math.PI * 2);
            ctx.fill();

            // Catchlight
            ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
            ctx.beginPath();
            ctx.arc(specX + r * 0.02, specY + r * 0.02, r * 0.12, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();
        }
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
        const cueBall = this.balls[0];
        if (!cueBall.active) return;

        const cueLength = 280;
        const cueDistance = 25 + (this.power / 100) * 40;
        const cueX = cueBall.x - Math.cos(this.aimAngle) * cueDistance;
        const cueY = cueBall.y - Math.sin(this.aimAngle) * cueDistance;

        ctx.save();
        ctx.translate(cueX, cueY);
        ctx.rotate(this.aimAngle);

        // Get cue style (default to standard if not set)
        const cueStyle = this.selectedCue || 'standard';

        // Define color schemes for each cue type
        const cueStyles = {
            standard: {
                butt: ['#2d1810', '#4a2c1a', '#5c3a28', '#4a2c1a', '#2d1810'],
                shaft: ['#d4a559', '#e8c078', '#f5d89a', '#f8e4b8', '#f5d89a', '#e8c078', '#d4a559'],
                wrap: ['#2c2c2c', '#3d3d3d', '#454545', '#3d3d3d', '#2c2c2c'],
                rings: '#c0a040',
                tip: ['#2a4a7a', '#3a6090', '#3a6090', '#1a3a5a']
            },
            premium: {
                butt: ['#1a1a2e', '#2d2d4a', '#3a3a5c', '#2d2d4a', '#1a1a2e'],
                shaft: ['#2c3e50', '#34495e', '#5d6d7e', '#85929e', '#5d6d7e', '#34495e', '#2c3e50'],
                wrap: ['#c0392b', '#e74c3c', '#ec7063', '#e74c3c', '#c0392b'],
                rings: '#f39c12',
                tip: ['#8e44ad', '#9b59b6', '#9b59b6', '#7d3c98']
            },
            legendary: {
                butt: ['#0a0a0a', '#1a1a1a', '#2a2a2a', '#1a1a1a', '#0a0a0a'],
                shaft: ['#ffd700', '#ffed4e', '#fff9a3', '#fffdd0', '#fff9a3', '#ffed4e', '#ffd700'],
                wrap: ['#8b0000', '#a52a2a', '#cd5c5c', '#a52a2a', '#8b0000'],
                rings: '#ff6b6b',
                tip: ['#ff0000', '#ff4444', '#ff4444', '#cc0000']
            },
            dragon: {
                butt: ['#8b0000', '#a52a2a', '#b22222', '#a52a2a', '#8b0000'],
                shaft: ['#ff4500', '#ff6347', '#ff7f50', '#ffa07a', '#ff7f50', '#ff6347', '#ff4500'],
                wrap: ['#000000', '#1a1a1a', '#2a2a2a', '#1a1a1a', '#000000'],
                rings: '#ff8c00',
                tip: ['#ff0000', '#ff4500', '#ff4500', '#dc143c']
            },
            ice: {
                butt: ['#e0f7fa', '#b2ebf2', '#80deea', '#b2ebf2', '#e0f7fa'],
                shaft: ['#00bcd4', '#26c6da', '#4dd0e1', '#80deea', '#4dd0e1', '#26c6da', '#00bcd4'],
                wrap: ['#006064', '#00838f', '#0097a7', '#00838f', '#006064'],
                rings: '#00e5ff',
                tip: ['#0288d1', '#03a9f4', '#03a9f4', '#0277bd']
            },
            viper: {
                butt: ['#1b5e20', '#2e7d32', '#388e3c', '#2e7d32', '#1b5e20'],
                shaft: ['#00ff00', '#32cd32', '#7fff00', '#adff2f', '#7fff00', '#32cd32', '#00ff00'],
                wrap: ['#000000', '#0d0d0d', '#1a1a1a', '#0d0d0d', '#000000'],
                rings: '#76ff03',
                tip: ['#00e676', '#00ff00', '#00ff00', '#00c853']
            },
            phoenix: {
                butt: ['#ff6f00', '#ff8f00', '#ffa726', '#ff8f00', '#ff6f00'],
                shaft: ['#ffab00', '#ffc107', '#ffd54f', '#ffecb3', '#ffd54f', '#ffc107', '#ffab00'],
                wrap: ['#bf360c', '#d84315', '#e64a19', '#d84315', '#bf360c'],
                rings: '#ff9100',
                tip: ['#ff6d00', '#ff9100', '#ff9100', '#ff3d00']
            },
            shadow: {
                butt: ['#1a1a1a', '#2d2d2d', '#404040', '#2d2d2d', '#1a1a1a'],
                shaft: ['#4a148c', '#6a1b9a', '#7b1fa2', '#8e24aa', '#7b1fa2', '#6a1b9a', '#4a148c'],
                wrap: ['#000000', '#0a0a0a', '#141414', '#0a0a0a', '#000000'],
                rings: '#9c27b0',
                tip: ['#311b92', '#4527a0', '#4527a0', '#283593']
            }
        };

        const colors = cueStyles[cueStyle];

        // === CUE SHADOW ===
        ctx.save();
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 8;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 4;
        ctx.fillStyle = 'rgba(0,0,0,0.01)';
        ctx.fillRect(-cueLength, -4, cueLength, 8);
        ctx.restore();

        // === BUTT (Back of cue) ===
        const buttLength = cueLength * 0.45;
        const buttGrad = ctx.createLinearGradient(0, -5, 0, 5);
        colors.butt.forEach((color, i) => {
            buttGrad.addColorStop(i / (colors.butt.length - 1), color);
        });
        ctx.fillStyle = buttGrad;
        ctx.fillRect(-cueLength, -4.5, buttLength, 9);

        // Butt cap (rubber)
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(-cueLength, -4, 8, 8);

        // === WRAP (Grip area) ===
        const wrapStart = -cueLength + buttLength;
        const wrapLength = 45;
        const wrapGrad = ctx.createLinearGradient(0, -4, 0, 4);
        colors.wrap.forEach((color, i) => {
            wrapGrad.addColorStop(i / (colors.wrap.length - 1), color);
        });
        ctx.fillStyle = wrapGrad;
        ctx.fillRect(wrapStart, -4, wrapLength, 8);

        // Wrap texture lines
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.lineWidth = 0.5;
        for (let i = 0; i < wrapLength; i += 3) {
            ctx.beginPath();
            ctx.moveTo(wrapStart + i, -4);
            ctx.lineTo(wrapStart + i + 1, 4);
            ctx.stroke();
        }

        // === SHAFT ===
        const shaftStart = wrapStart + wrapLength;
        const shaftLength = cueLength - buttLength - wrapLength - 15;
        const shaftGrad = ctx.createLinearGradient(0, -4, 0, 4);
        colors.shaft.forEach((color, i) => {
            shaftGrad.addColorStop(i / (colors.shaft.length - 1), color);
        });
        ctx.fillStyle = shaftGrad;

        // Tapered shaft (thinner at tip)
        ctx.beginPath();
        ctx.moveTo(shaftStart, -3.5);
        ctx.lineTo(-8, -2.5);
        ctx.lineTo(-8, 2.5);
        ctx.lineTo(shaftStart, 3.5);
        ctx.closePath();
        ctx.fill();

        // Wood grain on shaft (only for standard cue)
        if (cueStyle === 'standard') {
            ctx.save();
            ctx.globalAlpha = 0.08;
            ctx.strokeStyle = '#8b6914';
            ctx.lineWidth = 0.3;
            for (let i = 0; i < 8; i++) {
                const y = -3 + i * 0.8;
                ctx.beginPath();
                ctx.moveTo(shaftStart, y);
                ctx.lineTo(-8, y * 0.7);
                ctx.stroke();
            }
            ctx.restore();
        }

        // === DECORATIVE RINGS ===
        this.drawCueRing(ctx, wrapStart, 4.5, colors.rings);
        this.drawCueRing(ctx, shaftStart, 4, colors.rings);
        this.drawCueRing(ctx, -cueLength + 20, 5, colors.rings);
        this.drawCueRing(ctx, -cueLength + 25, 5, '#ffffff');
        this.drawCueRing(ctx, -cueLength + buttLength - 10, 5, colors.rings);

        // === FERRULE (White plastic collar) ===
        const ferruleGrad = ctx.createLinearGradient(0, -3, 0, 3);
        ferruleGrad.addColorStop(0, '#e8e8e8');
        ferruleGrad.addColorStop(0.3, '#ffffff');
        ferruleGrad.addColorStop(0.7, '#ffffff');
        ferruleGrad.addColorStop(1, '#d0d0d0');
        ctx.fillStyle = ferruleGrad;
        ctx.fillRect(-8, -2.5, 5, 5);

        // === TIP ===
        const tipGrad = ctx.createLinearGradient(0, -2.5, 0, 2.5);
        colors.tip.forEach((color, i) => {
            tipGrad.addColorStop(i / (colors.tip.length - 1), color);
        });
        ctx.fillStyle = tipGrad;

        // Rounded tip shape
        ctx.beginPath();
        ctx.arc(-3, 0, 2.5, -Math.PI / 2, Math.PI / 2);
        ctx.lineTo(-3, -2.5);
        ctx.closePath();
        ctx.fill();

        // Add special effects for legendary cue
        if (cueStyle === 'legendary') {
            ctx.save();
            ctx.globalAlpha = 0.3;
            ctx.shadowColor = '#ffd700';
            ctx.shadowBlur = 10;
            ctx.strokeStyle = '#ffd700';
            ctx.lineWidth = 1;
            ctx.strokeRect(-cueLength, -5, cueLength - 3, 10);
            ctx.restore();
        }

        // Dragon cue - fire effect
        if (cueStyle === 'dragon') {
            ctx.save();
            ctx.globalAlpha = 0.4;
            ctx.shadowColor = '#ff4500';
            ctx.shadowBlur = 15;
            ctx.strokeStyle = '#ff6347';
            ctx.lineWidth = 1.5;
            ctx.strokeRect(-cueLength, -5, cueLength - 3, 10);
            ctx.restore();
        }

        // Ice cue - frost glow
        if (cueStyle === 'ice') {
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.shadowColor = '#00e5ff';
            ctx.shadowBlur = 12;
            ctx.strokeStyle = '#4dd0e1';
            ctx.lineWidth = 1;
            for (let i = 0; i < 3; i++) {
                ctx.strokeRect(-cueLength + i * 2, -5 - i, cueLength - 3, 10 + i * 2);
            }
            ctx.restore();
        }

        // Viper cue - toxic pulse
        if (cueStyle === 'viper') {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.shadowColor = '#00ff00';
            ctx.shadowBlur = 14;
            ctx.strokeStyle = '#76ff03';
            ctx.lineWidth = 1.2;
            ctx.setLineDash([5, 3]);
            ctx.strokeRect(-cueLength, -5, cueLength - 3, 10);
            ctx.restore();
        }

        // Phoenix cue - flame aura
        if (cueStyle === 'phoenix') {
            ctx.save();
            ctx.globalAlpha = 0.45;
            const gradient = ctx.createLinearGradient(-cueLength, 0, -3, 0);
            gradient.addColorStop(0, '#ff6d00');
            gradient.addColorStop(0.5, '#ffab00');
            gradient.addColorStop(1, '#ffd54f');
            ctx.shadowColor = '#ff9100';
            ctx.shadowBlur = 16;
            ctx.strokeStyle = gradient;
            ctx.lineWidth = 2;
            ctx.strokeRect(-cueLength, -6, cueLength - 3, 12);
            ctx.restore();
        }

        // Shadow cue - dark mist
        if (cueStyle === 'shadow') {
            ctx.save();
            ctx.globalAlpha = 0.25;
            ctx.shadowColor = '#9c27b0';
            ctx.shadowBlur = 20;
            ctx.fillStyle = 'rgba(156, 39, 176, 0.1)';
            ctx.fillRect(-cueLength - 5, -8, cueLength + 2, 16);
            ctx.restore();
        }

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
    try {
        console.log('Initializing 8-Ball Pool Game...');
        window.gameInstance = new PoolGame();
        console.log('Game initialized successfully!');

        // Initialize chat system
        window.chatManager = new ChatManager(window.gameInstance);
        console.log('Chat system initialized!');
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

        // Check localStorage for user data
        try {
            const userData = localStorage.getItem('user');
            if (userData) {
                const user = JSON.parse(userData);
                if (user && user.username) {
                    this.playerNames[1] = user.username;
                }
            }
        } catch (e) {
            console.log('Could not load user from localStorage');
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



