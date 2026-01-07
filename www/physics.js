/**
 * Mine Pool Physics Engine - Miniclip Arcade Style
 * Exaggerated spin mechanics: topspin = strong follow, backspin = strong draw, english = rail effect only
 */

class PhysicsEngine {
    constructor() {
        // Table scale
        this.SCALE = 100;
        this.BALL_RADIUS = 14;
        this.MAX_CUE_SPEED = 750;      // Increased for more powerful shots

        // Detect mobile device (for UI purposes, not physics)
        this.isMobile = ('ontouchstart' in window) ||
            (navigator.maxTouchPoints > 0) ||
            (window.matchMedia && window.matchMedia('(pointer: coarse)').matches);

        // NOTE: We use fixed timesteps (1/60) for physics simulation, which handles
        // frame rate differences automatically. No friction multiplier needed - this
        // was causing desync between mobile and PC players!

        // Friction - tuned for realistic pool physics
        this.GRAVITY = 980;
        this.MU_ROLL = 0.014;      // Increased friction for faster ball stop
        this.MU_SLIDE = 0.05;      // Sliding friction
        this.MU_SPIN = 0.04;       // Spin friction

        // Elasticity - realistic values for pool balls
        this.E_BALL = 0.92;        // More realistic elasticity (real pool balls ~0.92-0.95)
        this.E_CUSHION = 0.75;     // Cushions absorb more energy for realistic rebounds

        // Time step - fixed for deterministic simulation
        this.dt = 1 / 60;

        // Table
        this.tableWidth = 0;
        this.tableHeight = 0;
        this.cushionWidth = 25;
        this.pockets = [];
        this.pocketRadius = 22;          // Corner pocket radius
        this.centerPocketRadius = 18;    // Center pocket radius (smaller, more recessed)

        if (this.isMobile) {
            console.log('📱 Mobile device detected (using consistent physics)');
        }
    }

    initTable(width, height, cushion) {
        this.tableWidth = width;
        this.tableHeight = height;
        this.cushionWidth = cushion;

        const pw = this.pocketRadius;
        const c = cushion;

        this.pockets = [
            // Corner pockets (indices 0, 2, 3, 5) - normal size
            { x: c + pw / 2, y: c + pw / 2, isCenter: false },
            // Center top pocket (index 1) - flush with cushion edge
            { x: width / 2, y: c, isCenter: true },
            { x: width - c - pw / 2, y: c + pw / 2, isCenter: false },
            { x: c + pw / 2, y: height - c - pw / 2, isCenter: false },
            // Center bottom pocket (index 4) - flush with cushion edge
            { x: width / 2, y: height - c, isCenter: true },
            { x: width - c - pw / 2, y: height - c - pw / 2, isCenter: false }
        ];
    }

    update(balls) {
        balls.forEach(ball => {
            if (!ball.w) ball.w = { x: 0, y: 0, z: 0 };
            if (ball.topspin === undefined) ball.topspin = 0;
            if (ball.sidespin === undefined) ball.sidespin = 0;
        });

        // FIXED TIMESTEP PHYSICS
        // Same physics on all devices - 4 sub-steps per frame at 1/60 second
        // Frame rate differences handled by visual smoothness, not physics
        const steps = 4;
        const dt = this.dt / steps;

        for (let s = 0; s < steps; s++) {
            this.handleBallCollisions(balls);
            this.handleCushionCollisions(balls);

            for (const ball of balls) {
                if (!ball.active) continue;
                this.updateBallPhysics(ball, dt);
            }
        }

        return this.checkPockets(balls);
    }

    updateBallPhysics(ball, dt) {
        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);

        // STOP if very slow - lower threshold so balls roll longer
        if (speed < 0.5) {
            ball.vx = 0;
            ball.vy = 0;
            ball.topspin = 0;
            ball.sidespin = 0;
            if (ball.w) ball.w = { x: 0, y: 0, z: 0 };
            return;
        }

        // === REALISTIC FRICTION ===
        // Use velocity-dependent friction for more natural deceleration
        // Fast balls have less relative friction (they roll nicely)
        // Slow balls have more relative friction (they stop naturally)

        // Base rolling friction
        let effectiveFriction = this.MU_ROLL;

        // Add slight extra friction at low speeds for natural stop (reduced effect)
        if (speed < 20) {
            effectiveFriction += 0.002 * (1 - speed / 20);
        }

        const deceleration = effectiveFriction * this.GRAVITY;
        const speedLoss = deceleration * dt;

        if (speed > speedLoss) {
            const newSpeed = speed - speedLoss;
            const factor = newSpeed / speed;
            ball.vx *= factor;
            ball.vy *= factor;
        } else {
            ball.vx = 0;
            ball.vy = 0;
        }

        // === MINICLIP ARCADE PHYSICS ===
        // Sidespin does NOT curve mid-table in Miniclip physics
        // It ONLY affects cushion rebounds (handled in handleCushionCollisions)

        // === SPIN PERSISTENCE (ARCADE STYLE) ===
        // In Miniclip physics, spin does NOT decay gradually
        // It remains fully active until collision with ball or cushion
        // (No spin decay here - handled on collision instead)

        // === MOVEMENT ===
        ball.x += ball.vx * dt;
        ball.y += ball.vy * dt;

        // Visual rotation
        ball.rotation = (ball.rotation || 0) + (speed * dt) / this.BALL_RADIUS;
    }

    handleBallCollisions(balls) {
        for (let i = 0; i < balls.length; i++) {
            if (!balls[i].active) continue;

            for (let j = i + 1; j < balls.length; j++) {
                if (!balls[j].active) continue;

                const b1 = balls[i];
                const b2 = balls[j];
                const dx = b2.x - b1.x;
                const dy = b2.y - b1.y;
                const distSq = dx * dx + dy * dy;
                const minDist = this.BALL_RADIUS * 2;

                if (distSq < minDist * minDist) {
                    const dist = Math.sqrt(distSq);
                    const nx = dx / dist;
                    const ny = dy / dist;

                    // === RULE TRACKING: First Contact ===
                    if (this.shotFirstContact === null) {
                        if (b1.id === 0) this.shotFirstContact = b2.id;
                        else if (b2.id === 0) this.shotFirstContact = b1.id;
                    }

                    // Separate balls
                    const overlap = minDist - dist;
                    b1.x -= nx * overlap * 0.5;
                    b1.y -= ny * overlap * 0.5;
                    b2.x += nx * overlap * 0.5;
                    b2.y += ny * overlap * 0.5;

                    // Collision velocity
                    const dvx = b1.vx - b2.vx;
                    const dvy = b1.vy - b2.vy;
                    const vn = dvx * nx + dvy * ny;

                    if (vn > 0) {
                        // Elastic collision
                        const impulse = vn * this.E_BALL;

                        b1.vx -= impulse * nx;
                        b1.vy -= impulse * ny;
                        b2.vx += impulse * nx;
                        b2.vy += impulse * ny;

                        // === SPIN EFFECTS AFTER COLLISION ===
                        // Apply spin effects AFTER the collision impulse
                        if (b1.id === 0 && Math.abs(b1.topspin) > 0.15) {
                            // Get current speed after collision
                            const currentSpeed = Math.sqrt(b1.vx * b1.vx + b1.vy * b1.vy);

                            // BACKSPIN (positive): Cue ball DRAWS BACK
                            if (b1.topspin > 0.15) {
                                const drawForce = b1.topspin * 150;  // Balanced force
                                // Subtract velocity (go backwards)
                                b1.vx -= nx * drawForce;
                                b1.vy -= ny * drawForce;
                            }
                            // TOPSPIN (negative): Cue ball FOLLOWS through
                            else if (b1.topspin < -0.15) {
                                const followForce = Math.abs(b1.topspin) * 150;  // Balanced force
                                // Add velocity in the direction of the collision
                                b1.vx += nx * followForce;
                                b1.vy += ny * followForce;
                            }

                            // Consume spin on impact
                            b1.topspin *= 0.15;
                        }

                        this.playCollisionSound(Math.min(1, vn / 15));
                    }
                }
            }
        }
    }

    handleCushionCollisions(balls) {
        const c = this.cushionWidth;
        const r = this.BALL_RADIUS;
        const englishStrength = 100;

        for (const ball of balls) {
            if (!ball.active) continue;

            let hitCushion = false;

            // LEFT cushion
            if (ball.x - r < c) {
                ball.x = c + r;
                ball.vx = -ball.vx * this.E_CUSHION;
                // Right english → ball goes more down, Left english → ball goes more up
                ball.vy += ball.sidespin * englishStrength;
                ball.sidespin *= 0.7;
                hitCushion = true;
            }
            // RIGHT cushion
            else if (ball.x + r > this.tableWidth - c) {
                ball.x = this.tableWidth - c - r;
                ball.vx = -ball.vx * this.E_CUSHION;
                // Right english → ball goes more up, Left english → ball goes more down
                ball.vy -= ball.sidespin * englishStrength;
                ball.sidespin *= 0.7;
                hitCushion = true;
            }

            // TOP cushion
            if (ball.y - r < c) {
                ball.y = c + r;
                ball.vy = -ball.vy * this.E_CUSHION;
                // Right english → ball goes more right, Left english → ball goes more left
                ball.vx += ball.sidespin * englishStrength;
                ball.sidespin *= 0.7;
                hitCushion = true;
            }
            // BOTTOM cushion
            else if (ball.y + r > this.tableHeight - c) {
                ball.y = this.tableHeight - c - r;
                ball.vy = -ball.vy * this.E_CUSHION;
                // Right english → ball goes more left, Left english → ball goes more right
                ball.vx -= ball.sidespin * englishStrength;
                ball.sidespin *= 0.7;
                hitCushion = true;
            }

            if (hitCushion) {
                // === RULE TRACKING ===
                // 1. Check if this is a rail hit AFTER the first contact
                if (this.shotFirstContact !== null) {
                    this.railContactAfterHit = true;
                }

                // 2. Track unique balls hitting rails (for Break Shot rule)
                if (this.ballsHitRailSet && !this.ballsHitRailSet.has(ball.id)) {
                    this.ballsHitRailSet.add(ball.id);
                    this.railsHitOnBreak++;
                }

                this.playCushionSound(Math.min(1, Math.abs(ball.vx + ball.vy) / 12));
            }
        }
    }

    applyShot(cueBall, angle, power, spinX, spinY) {
        // Reset shot tracking variables
        this.shotFirstContact = null; // ID of the first ball hit by cue ball
        this.railContactAfterHit = false; // True if ANY ball hits rail AFTER first contact
        this.railsHitOnBreak = 0; // Count distinct balls hitting rails (for break rule)
        this.ballsHitRailSet = new Set(); // Helper to track unique balls hitting rail

        const speed = (power / 100) * this.MAX_CUE_SPEED;

        const cos = Math.cos(angle);
        const sin = Math.sin(angle);

        cueBall.vx = cos * speed;
        cueBall.vy = sin * speed;

        // === SPIN SYSTEM ===
        // spinY: negative = top spin (follow), positive = backspin (draw)
        // spinX: left/right english

        cueBall.topspin = spinY;  // Negative = top (follow), Positive = back (draw)
        cueBall.sidespin = spinX;   // Left/right

        const R = this.BALL_RADIUS;
        cueBall.w = {
            x: -sin * spinY * speed / R * 0.5,
            y: cos * spinY * speed / R * 0.5,
            z: spinX * speed / R * 0.3
        };
    }

    checkPockets(balls) {
        const pocketed = [];
        for (const ball of balls) {
            if (!ball.active) continue;
            for (let i = 0; i < this.pockets.length; i++) {
                const pocket = this.pockets[i];
                const dx = ball.x - pocket.x;
                const dy = ball.y - pocket.y;
                const distSq = dx * dx + dy * dy;

                // Use smaller radius for center pockets
                const effectiveRadius = pocket.isCenter ? this.centerPocketRadius : this.pocketRadius;

                if (distSq < effectiveRadius * effectiveRadius) {
                    // For center pockets, check if ball is moving TOWARD the pocket (from playing surface)
                    // This prevents balls rolling along the rail from falling in
                    if (pocket.isCenter) {
                        const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                        if (speed > 1) { // Ball must be moving
                            // For top center pocket (y near cushion), ball must be moving UP (negative vy)
                            // For bottom center pocket, ball must be moving DOWN (positive vy)
                            const isTopPocket = pocket.y < this.tableHeight / 2;
                            const movingTowardPocket = isTopPocket ? ball.vy < -speed * 0.15 : ball.vy > speed * 0.15;

                            // Also check that ball isn't too close to the cushion (running along rail)
                            const distFromCenter = Math.abs(ball.x - pocket.x);
                            const isApproachingFromCenter = distFromCenter < effectiveRadius * 1.5;

                            if (!movingTowardPocket && !isApproachingFromCenter) {
                                continue; // Ball is running along rail, don't pocket
                            }
                        }
                    }

                    ball.active = false;
                    ball.pocket = i; // Track which pocket (0-5)
                    pocketed.push(ball);
                    this.playPocketSound();
                    break;
                }
            }
        }
        return pocketed;
    }

    allBallsStopped(balls) {
        for (const ball of balls) {
            if (!ball.active) continue;
            const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
            if (speed > 3) return false;
        }
        return true;
    }

    calculateAimLine(cueBall, angle, balls, power) {
        const points = [];
        const segments = [];
        const step = 2;
        const maxSteps = 500;

        let x = cueBall.x;
        let y = cueBall.y;
        let dx = Math.cos(angle);
        let dy = Math.sin(angle);

        let currentSegment = { start: { x, y }, points: [] };
        let reflectionNum = 0;

        for (let i = 0; i < maxSteps; i++) {
            x += dx * step;
            y += dy * step;

            let hitWall = false;
            if (x < this.cushionWidth + this.BALL_RADIUS) { dx = Math.abs(dx); hitWall = true; }
            else if (x > this.tableWidth - this.cushionWidth - this.BALL_RADIUS) { dx = -Math.abs(dx); hitWall = true; }
            if (y < this.cushionWidth + this.BALL_RADIUS) { dy = Math.abs(dy); hitWall = true; }
            else if (y > this.tableHeight - this.cushionWidth - this.BALL_RADIUS) { dy = -Math.abs(dy); hitWall = true; }

            if (hitWall) {
                reflectionNum++;
                currentSegment.points.push({ x, y });
                segments.push(currentSegment);
                currentSegment = { start: { x, y }, points: [] };
                points.push({ x, y, type: 'reflection', num: reflectionNum });
            }

            let hitBall = null;
            for (const ball of balls) {
                if (!ball.active || ball.id === 0) continue;
                const d = Math.sqrt((x - ball.x) ** 2 + (y - ball.y) ** 2);
                if (d < this.BALL_RADIUS * 2) {
                    hitBall = ball;
                    break;
                }
            }

            if (hitBall) {
                currentSegment.points.push({ x, y });
                segments.push(currentSegment);

                points.push({
                    x, y,
                    type: 'contact',
                    ghostX: x, ghostY: y,
                    ball: hitBall
                });

                const impactAngle = Math.atan2(hitBall.y - y, hitBall.x - x);
                points.push({
                    x: hitBall.x, y: hitBall.y,
                    tx: hitBall.x + Math.cos(impactAngle) * 100,
                    ty: hitBall.y + Math.sin(impactAngle) * 100,
                    type: 'target'
                });

                break;
            }

            currentSegment.points.push({ x, y });
        }

        if (currentSegment.points.length > 0) segments.push(currentSegment);

        return { points, segments };
    }

    setSoundManager(soundManager) {
        this.soundManager = soundManager;
    }

    playCollisionSound(vol) {
        if (this.soundManager) this.soundManager.playBallHit(vol);
    }

    playCushionSound(vol) {
        if (this.soundManager) this.soundManager.playCushionHit(vol);
    }

    playPocketSound() {
        if (this.soundManager) this.soundManager.playPocket();
    }
}

class SoundManager {
    constructor() {
        this.audioContext = null;
        this.initialized = false;
        this.masterGain = null;
        this.buffers = {};

        // Auto-initialize on creation
        this.init();
    }

    async init() {
        if (this.initialized) return;
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();

            // Master gain
            this.masterGain = this.audioContext.createGain();
            this.masterGain.gain.value = 1.0;
            this.masterGain.connect(this.audioContext.destination);

            // Create room reverb for ambience
            this.convolver = this.audioContext.createConvolver();
            this.convolver.buffer = this.createReverbImpulse(0.25, 1.2);

            // Wet/dry mix for reverb
            this.dryGain = this.audioContext.createGain();
            this.wetGain = this.audioContext.createGain();
            this.dryGain.gain.value = 0.9;
            this.wetGain.gain.value = 0.1;

            this.dryGain.connect(this.masterGain);
            this.convolver.connect(this.wetGain);
            this.wetGain.connect(this.masterGain);

            // Pre-generate noise buffer for synthesis
            this.buffers.noise = this.createNoiseBuffer(1.0);

            // Load custom sounds from files
            await this.loadBreakSound();
            await this.loadBallHitSound();
            await this.loadPocketSound();
            await this.loadCueHitSound();
            await this.loadCushionHitSound();

            this.initialized = true;
            console.log('🎵 Sound system initialized successfully');
        } catch (e) {
            console.warn('Web Audio API not supported:', e);
        }
    }

    // Generate room reverb impulse response
    createReverbImpulse(decay, duration) {
        const sampleRate = this.audioContext.sampleRate;
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(2, length, sampleRate);

        for (let channel = 0; channel < 2; channel++) {
            const data = buffer.getChannelData(channel);
            for (let i = 0; i < length; i++) {
                const t = i / sampleRate;
                data[i] = (Math.random() * 2 - 1) * Math.exp(-t / decay);
            }
        }
        return buffer;
    }

    // Load custom break sound from MP3 file
    async loadBreakSound() {
        try {
            const response = await fetch('Sounds/breaking.mp3');
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.breakShot = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Break sound loaded successfully from Sounds/breaking.mp3');
        } catch (error) {
            console.warn('⚠️ Failed to load break sound, using fallback:', error);
            // Fallback to procedurally generated sound if file fails to load
            this.buffers.breakShot = this.createBreakShotBuffer();
        }
    }

    // Load custom ball hit sound from WAV file
    async loadBallHitSound() {
        try {
            const response = await fetch('Sounds/single_hit.wav');
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.ballHit = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Ball hit sound loaded successfully from Sounds/single_hit.wav');
        } catch (error) {
            console.warn('⚠️ Failed to load ball hit sound, using fallback:', error);
            // Fallback to procedurally generated sound if file fails to load
            this.buffers.ballHit = this.createBallHitBuffer();
        }
    }

    // Load custom pocket drop sound from WAV file
    async loadPocketSound() {
        try {
            const response = await fetch('Sounds/pot.wav');
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.pocket = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Pocket sound loaded successfully from Sounds/pot.wav');
        } catch (error) {
            console.warn('⚠️ Failed to load pocket sound, using fallback:', error);
            // Fallback to procedurally generated sound if file fails to load
            this.buffers.pocket = this.createPocketBuffer();
        }
    }

    // Load custom cue hit sound from WAV file
    async loadCueHitSound() {
        try {
            const response = await fetch('Sounds/shot.wav');
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.cueHit = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Cue hit sound loaded successfully from Sounds/shot.wav');
        } catch (error) {
            console.warn('⚠️ Failed to load cue hit sound, using fallback:', error);
            // Fallback to procedurally generated sound if file fails to load
            this.buffers.cueHit = this.createCueHitBuffer();
        }
    }

    // Load custom cushion hit sound from WAV file
    async loadCushionHitSound() {
        try {
            const response = await fetch('Sounds/cushion.wav');
            const arrayBuffer = await response.arrayBuffer();
            this.buffers.cushionHit = await this.audioContext.decodeAudioData(arrayBuffer);
            console.log('✅ Cushion hit sound loaded successfully from Sounds/cushion.wav');
        } catch (error) {
            console.warn('⚠️ Failed to load cushion hit sound, using fallback:', error);
            // Fallback to procedurally generated sound if file fails to load
            this.buffers.cushionHit = this.createCushionHitBuffer();
        }
    }


    createNoiseBuffer(duration) {
        const sampleRate = this.audioContext.sampleRate;
        const length = sampleRate * duration;
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    }

    // Create authentic billiard ball collision sound - sharp 'clack'
    // Real phenolic resin balls produce a distinctive high-frequency click
    createBallHitBuffer() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.045; // Slightly longer for more realistic tail
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // Sharp attack with very fast rise
            const attackTime = 0.0002;
            const attack = 1 - Math.exp(-t / attackTime);
            const decay = Math.exp(-t / 0.006); // Slightly longer decay
            const envelope = attack * decay;

            // Authentic billiard ball frequencies - sharper, more 'clacky'
            // Primary resonance at 5kHz for that distinctive click
            const f1 = Math.sin(2 * Math.PI * 5000 * t) * 0.9;
            // Secondary harmonic for richness
            const f2 = Math.sin(2 * Math.PI * 8500 * t) * 0.4;
            // High harmonic for brightness
            const f3 = Math.sin(2 * Math.PI * 12000 * t) * 0.15;

            // Sharp transient noise for impact 'crack'
            const crackNoise = (Math.random() * 2 - 1) * Math.exp(-t / 0.0008) * 0.6;

            // Mid-frequency body for fullness
            const body = Math.sin(2 * Math.PI * 2200 * t) * Math.exp(-t / 0.005) * 0.3;

            // Low frequency 'thunk' - more pronounced
            const thunk = Math.sin(2 * Math.PI * 180 * t) * Math.exp(-t / 0.012) * 0.35;

            data[i] = (f1 + f2 + f3 + crackNoise + body + thunk) * envelope;
        }

        // Normalize
        let max = 0;
        for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
        if (max > 0) for (let i = 0; i < length; i++) data[i] /= max;

        return buffer;
    }

    // Create authentic cushion/rail hit sound - deep rubber thump
    createCushionHitBuffer() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.12; // Longer for more realistic tail
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // Rubber has softer attack but more body
            const envelope = (1 - Math.exp(-t / 0.003)) * Math.exp(-t / 0.035);

            // Deep rubber thump - more pronounced
            const deepThump = Math.sin(2 * Math.PI * 60 * t) * 0.8;
            // Mid-low frequency for body
            const body = Math.sin(2 * Math.PI * 140 * t) * Math.exp(-t / 0.02) * 0.5;
            // Rubber 'slap' sound
            const slap = Math.sin(2 * Math.PI * 320 * t) * Math.exp(-t / 0.008) * 0.4;
            // High frequency component (muffled by rubber)
            const highEnd = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t / 0.004) * 0.15;
            // Textured noise for realism
            const texture = (Math.random() * 2 - 1) * Math.exp(-t / 0.018) * 0.3;

            data[i] = (deepThump + body + slap + highEnd + texture) * envelope;
        }

        // Heavy low-pass filtering (rubber absorbs highs)
        for (let pass = 0; pass < 4; pass++) {
            for (let i = 2; i < length - 2; i++) {
                data[i] = (data[i - 2] + data[i - 1] * 2 + data[i] * 3 + data[i + 1] * 2 + data[i + 2]) / 9;
            }
        }

        // Normalize
        let max = 0;
        for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
        if (max > 0) for (let i = 0; i < length; i++) data[i] /= max;

        return buffer;
    }

    // Create satisfying pocket drop sound - ball falling and settling
    createPocketBuffer() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.5; // Slightly longer for complete sound
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // Initial impact - ball hitting pocket edge (more pronounced)
            const impactEnv = Math.exp(-t / 0.015) * (t < 0.06 ? 1 : 0);
            const impact = Math.sin(2 * Math.PI * 280 * t) * impactEnv * 0.6;
            const impactClick = Math.sin(2 * Math.PI * 1800 * t) * impactEnv * 0.3;

            // Ball dropping - whoosh sound
            const dropStart = 0.04;
            const dropT = Math.max(0, t - dropStart);
            const dropEnv = Math.exp(-dropT / 0.08) * (dropT < 0.15 ? 1 : 0);
            const drop = (Math.random() * 2 - 1) * dropEnv * 0.25;

            // Ball rolling in pocket - textured rumble
            const rollStart = 0.08;
            const rollT = Math.max(0, t - rollStart);
            const rollEnv = Math.sin(Math.PI * rollT / (duration - rollStart)) * 0.7;
            const roll = (Math.random() * 2 - 1) * rollEnv * 0.35;
            const rollTone = Math.sin(2 * Math.PI * 90 * rollT) * rollEnv * 0.2;

            // Distinct bumps as ball bounces
            const bump1T = t - 0.15;
            const bump1 = bump1T > 0 ? Math.sin(2 * Math.PI * 200 * bump1T) * Math.exp(-bump1T / 0.012) * 0.3 : 0;
            const bump2T = t - 0.26;
            const bump2 = bump2T > 0 ? Math.sin(2 * Math.PI * 170 * bump2T) * Math.exp(-bump2T / 0.015) * 0.25 : 0;

            // Final settling thud - satisfying end
            const settleT = t - 0.38;
            const settle = settleT > 0 ? Math.sin(2 * Math.PI * 110 * settleT) * Math.exp(-settleT / 0.04) * 0.35 : 0;

            data[i] = impact + impactClick + drop + roll + rollTone + bump1 + bump2 + settle;
        }

        // Moderate low-pass for natural sound
        for (let i = 3; i < length - 3; i++) {
            data[i] = (data[i - 3] + data[i - 2] + data[i - 1] + data[i] + data[i + 1] + data[i + 2] + data[i + 3]) / 7;
        }

        return buffer;
    }

    // Create crisp cue strike sound - leather tip on phenolic resin
    createCueHitBuffer() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.06; // Slightly longer for more character
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // Leather tip creates unique attack - quick but not instant
            const envelope = (1 - Math.exp(-t / 0.0006)) * Math.exp(-t / 0.01);

            // Sharp 'crack' from ball - higher and crisper
            const crack = Math.sin(2 * Math.PI * 4200 * t) * Math.exp(-t / 0.005) * 0.5;
            // Secondary harmonic for richness
            const harmonic = Math.sin(2 * Math.PI * 7500 * t) * Math.exp(-t / 0.003) * 0.25;
            // Mid frequency body - fuller sound
            const body = Math.sin(2 * Math.PI * 1200 * t) * Math.exp(-t / 0.008) * 0.4;
            // Low thump from cue shaft and ball mass
            const thump = Math.sin(2 * Math.PI * 220 * t) * Math.exp(-t / 0.012) * 0.4;
            // Sharp transient for leather contact
            const leatherSnap = (Math.random() * 2 - 1) * Math.exp(-t / 0.0015) * 0.45;
            // Subtle wood resonance from cue
            const wood = Math.sin(2 * Math.PI * 450 * t) * Math.exp(-t / 0.015) * 0.2;

            data[i] = (crack + harmonic + body + thump + leatherSnap + wood) * envelope;
        }

        // Normalize
        let max = 0;
        for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
        if (max > 0) for (let i = 0; i < length; i++) data[i] /= max;

        return buffer;
    }

    // Create ARCADE-STYLE BREAK SHOT sound - Bass-boosted, punchy, LOUD crack
    // This is the most satisfying sound in the game!
    createBreakShotBuffer() {
        const sampleRate = this.audioContext.sampleRate;
        const duration = 0.35; // Longer for that epic break feel
        const length = Math.floor(sampleRate * duration);
        const buffer = this.audioContext.createBuffer(1, length, sampleRate);
        const data = buffer.getChannelData(0);

        for (let i = 0; i < length; i++) {
            const t = i / sampleRate;

            // ULTRA-SHARP attack - instant impact
            const attackTime = 0.0001;
            const attack = 1 - Math.exp(-t / attackTime);
            const decay = Math.exp(-t / 0.08); // Long tail for epic feel
            const envelope = attack * decay;

            // === BASS LAYER - MASSIVE LOW END ===
            // Sub-bass rumble for that chest-thumping impact
            const subBass = Math.sin(2 * Math.PI * 40 * t) * Math.exp(-t / 0.15) * 1.2;
            // Deep bass punch
            const deepBass = Math.sin(2 * Math.PI * 80 * t) * Math.exp(-t / 0.12) * 0.9;
            // Mid-bass body
            const midBass = Math.sin(2 * Math.PI * 150 * t) * Math.exp(-t / 0.08) * 0.7;

            // === CRACK LAYER - SHARP HIGH-FREQUENCY IMPACT ===
            // Primary crack - super bright and sharp
            const crack1 = Math.sin(2 * Math.PI * 6000 * t) * Math.exp(-t / 0.003) * 1.0;
            // Secondary crack harmonic
            const crack2 = Math.sin(2 * Math.PI * 9500 * t) * Math.exp(-t / 0.002) * 0.6;
            // Ultra-high shimmer
            const shimmer = Math.sin(2 * Math.PI * 13000 * t) * Math.exp(-t / 0.0015) * 0.3;

            // === MID-RANGE BODY - FULLNESS ===
            const body1 = Math.sin(2 * Math.PI * 800 * t) * Math.exp(-t / 0.025) * 0.6;
            const body2 = Math.sin(2 * Math.PI * 1800 * t) * Math.exp(-t / 0.015) * 0.5;
            const body3 = Math.sin(2 * Math.PI * 3200 * t) * Math.exp(-t / 0.008) * 0.4;

            // === EXPLOSIVE TRANSIENT - THE "CRACK" ===
            // White noise burst for realistic impact
            const explosionNoise = (Math.random() * 2 - 1) * Math.exp(-t / 0.0005) * 1.5;
            // Filtered noise for texture
            const textureNoise = (Math.random() * 2 - 1) * Math.exp(-t / 0.012) * 0.4;

            // === WOOD RESONANCE - Cue shaft vibration ===
            const woodResonance = Math.sin(2 * Math.PI * 280 * t) * Math.exp(-t / 0.05) * 0.35;

            // === BALL SCATTER - Multiple balls hitting ===
            // Simulate the sound of balls scattering
            const scatter1T = t - 0.02;
            const scatter1 = scatter1T > 0 ? Math.sin(2 * Math.PI * 5200 * scatter1T) * Math.exp(-scatter1T / 0.004) * 0.4 : 0;
            const scatter2T = t - 0.035;
            const scatter2 = scatter2T > 0 ? Math.sin(2 * Math.PI * 4800 * scatter2T) * Math.exp(-scatter2T / 0.005) * 0.35 : 0;
            const scatter3T = t - 0.05;
            const scatter3 = scatter3T > 0 ? Math.sin(2 * Math.PI * 5500 * scatter3T) * Math.exp(-scatter3T / 0.004) * 0.3 : 0;

            // Combine all layers
            data[i] = (
                // Bass (boosted!)
                subBass + deepBass + midBass +
                // Crack
                crack1 + crack2 + shimmer +
                // Body
                body1 + body2 + body3 +
                // Transients
                explosionNoise + textureNoise +
                // Resonance
                woodResonance +
                // Scatter
                scatter1 + scatter2 + scatter3
            ) * envelope;
        }

        // Bass boost filter - emphasize low frequencies
        // Apply a simple bass shelf boost
        for (let i = 1; i < length; i++) {
            data[i] = data[i] + data[i - 1] * 0.3; // Accumulate bass
        }

        // Normalize with headroom for bass
        let max = 0;
        for (let i = 0; i < length; i++) max = Math.max(max, Math.abs(data[i]));
        if (max > 0) for (let i = 0; i < length; i++) data[i] /= max * 0.85; // Leave headroom

        return buffer;
    }


    // Play a pre-generated buffer with pitch and volume variation
    playBuffer(buffer, volume = 1.0, pitchVariation = 0) {
        if (!buffer) return;

        const source = this.audioContext.createBufferSource();
        source.buffer = buffer;
        source.playbackRate.value = 1.0 + pitchVariation;

        const gain = this.audioContext.createGain();
        gain.gain.value = volume;

        source.connect(gain);
        gain.connect(this.dryGain);
        gain.connect(this.convolver);

        source.start();
    }

    // Realistic ball-to-ball collision
    playBallHit(intensity = 0.5) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const vol = Math.pow(Math.min(1, intensity), 1.5) * 0.9;
        if (vol < 0.05) return;
        // Slight pitch variation to prevent identical sounds
        const pitch = (Math.random() - 0.5) * 0.08;
        this.playBuffer(this.buffers.ballHit, vol, pitch);
    }

    // Realistic cushion hit
    playCushionHit(intensity = 0.5) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;
        if (!this.buffers.cushionHit) {
            console.warn('Cushion hit buffer not loaded');
            return;
        }

        const vol = Math.min(1, intensity) * 0.8; // Increased from 0.7
        if (vol < 0.02) return; // Lower threshold
        const pitch = (Math.random() - 0.5) * 0.12;
        this.playBuffer(this.buffers.cushionHit, vol, pitch);
    }

    // Ball dropping into pocket
    playPocket() {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const pitch = (Math.random() - 0.5) * 0.1;
        this.playBuffer(this.buffers.pocket, 0.8, pitch);
    }

    // Cue hitting ball
    playCueHit(power) {
        if (!this.initialized) this.init();
        if (!this.audioContext) return;

        const intensity = power / 100;
        const vol = 0.5 + intensity * 0.5;
        const pitch = intensity * 0.1; // Harder hits slightly higher pitch
        this.playBuffer(this.buffers.cueHit, vol, pitch);
    }

    // BREAK SHOT - Custom MP3 sound!
    async playBreakShot(power) {
        if (!this.initialized) await this.init();
        if (!this.audioContext) return;

        // If break sound not loaded yet, wait a bit and retry once
        if (!this.buffers.breakShot) {
            console.log('⏳ Waiting for break sound to load...');
            await new Promise(resolve => setTimeout(resolve, 100));

            // Still not loaded? Use fallback
            if (!this.buffers.breakShot) {
                console.warn('⚠️ Break sound not loaded yet, using cue hit sound');
                this.playCueHit(power);
                return;
            }
        }

        const intensity = power / 100;
        const vol = 0.9 + intensity * 0.1; // Always loud!
        const pitch = (Math.random() - 0.5) * 0.05; // Slight variation
        this.playBuffer(this.buffers.breakShot, vol, pitch);
        console.log('🎵 Playing custom break sound from Sounds/breaking.mp3');
    }


}

window.PhysicsEngine = PhysicsEngine;
window.SoundManager = SoundManager;
