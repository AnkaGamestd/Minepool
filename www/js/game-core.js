/**
 * Mine Pool - Game Core
 * Main PoolGame class with constructor and state management
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

        // Table dimensions - HORIZONTAL LAYOUT
        this.tableWidth = 1000;
        this.tableHeight = 500;
        this.cushionWidth = 25;

        // Set canvas size
        this.canvas.width = this.tableWidth;
        this.canvas.height = this.tableHeight;
        console.log('Canvas sized');

        // Initialize physics engine
        if (typeof PhysicsEngine === 'undefined') {
            alert('PhysicsEngine not loaded! Check console for errors.');
            throw new Error('PhysicsEngine not loaded');
        }
        console.log('Creating PhysicsEngine...');
        this.physics = new PhysicsEngine();
        this.physics.initTable(this.tableWidth, this.tableHeight, this.cushionWidth);
        console.log('PhysicsEngine initialized');

        // Initialize sound
        console.log('Creating SoundManager...');
        this.sound = new SoundManager();
        this.physics.setSoundManager(this.sound);
        console.log('SoundManager initialized');

        // Load selected cue
        this.selectedCue = localStorage.getItem('selectedCue') || window.selectedCue || 'standard';
        console.log('Selected cue loaded:', this.selectedCue);

        // Initialize game state
        this.initGameState();

        // Initialize mobile settings
        this.initMobileSettings();

        // UI Elements
        console.log('Setting up UI...');
        this.setupUI();
        console.log('UI setup complete');

        console.log('Setting up event listeners...');
        this.setupEventListeners();
        console.log('Event listeners setup complete');

        console.log('PoolGame constructor finished successfully');
    }

    /**
     * Initialize all game state variables
     */
    initGameState() {
        // Game state
        this.balls = [];
        this.currentPlayer = 1;
        this.playerTypes = { 1: null, 2: null }; // 'solid' or 'stripe'
        this.gameMode = null;
        this.gameState = 'start';
        this.ballInHand = false;
        this.ballInHandKitchen = false;
        this.tableState = 'open';
        this.isBreakShot = true;
        this.foulReason = null;
        this.winner = null;

        // Shot timer (30 seconds per shot)
        this.shotTimer = null;
        this.shotTimeLimit = 30;
        this.timeRemaining = 30;
        this.calledPocket = null;
        this.needsCallPocket = false;
        this.shotPocketedBalls = [];

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

        // Multiplayer defaults
        this.isMultiplayer = false;
        this.isMyTurn = true;
        this.roomId = null;
        this.playerId = null;
        this.opponentId = null;
    }

    /**
     * Initialize mobile-specific settings
     */
    initMobileSettings() {
        // Detect mobile/touch device
        this.isMobile = ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        // Mobile control settings
        this.mobileSettings = {
            aimSensitivity: 0.003,
            powerSensitivity: 0.8,
            minSwipeDistance: 20,
            maxPower: 100,
            tapThreshold: 200,
            deadZone: 10,
        };

        // Mobile touch state tracking
        this.mobileTouch = {
            startX: 0,
            startY: 0,
            startTime: 0,
            currentX: 0,
            currentY: 0,
            lastX: 0,
            lastY: 0,
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
    }

    /**
     * Start a new game with the specified mode
     */
    startGame(mode) {
        try {
            if (!this.startScreen) {
                console.error('Start screen element not found!');
                alert('Error: Start screen element not found!');
                return;
            }
            this.gameMode = mode;
            this.startScreen.style.display = 'none';
            this.startScreen.classList.add('hidden');
            this.initializeBalls();
            this.gameState = 'aiming';
            this.currentPlayer = 1;

            // Enable ball placement in kitchen for break shot
            this.ballInHand = true;
            this.ballInHandKitchen = true;
            this.isBreakShot = true;

            this.updateTurnIndicator();
            this.showMessage('BREAK SHOT', 'Place the cue ball anywhere in the kitchen (behind the line)');
            this.startShotTimer();
            this.animate();
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Error starting game: ' + error.message);
        }
    }

    /**
     * Reset the game to initial state
     */
    resetGame() {
        this.initGameState();
        this.winnerScreen.classList.add('hidden');
        this.startScreen.style.display = 'flex';
        this.startScreen.classList.remove('hidden');

        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }

        // Clear the ball rack UI
        const solidsRack = document.getElementById('solids-rack');
        const stripesRack = document.getElementById('stripes-rack');
        if (solidsRack) solidsRack.innerHTML = '';
        if (stripesRack) stripesRack.innerHTML = '';

        // Reset player ball types display
        const p1Type = document.getElementById('p1-ball-type');
        const p2Type = document.getElementById('p2-ball-type');
        if (p1Type) p1Type.textContent = '--';
        if (p2Type) p2Type.textContent = '--';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PoolGame;
}
