/**
 * AI Player for Mine Pool
 * Handles shot calculation and execution for AI opponents
 * Difficulty: Medium-Hard (75-85% accuracy)
 */

class AIPlayer {
    constructor(difficulty = 'medium-hard') {
        this.difficulty = difficulty;

        // Difficulty settings
        this.settings = {
            'easy': {
                accuracy: 0.5,        // 50% accuracy
                angleError: 25,       // ±25° error
                powerError: 0.25,     // ±25% power error
                thinkingTime: [2000, 4000], // 2-4 seconds
                preferEasyShots: true
            },
            'medium': {
                accuracy: 0.65,
                angleError: 15,
                powerError: 0.15,
                thinkingTime: [1500, 3000],
                preferEasyShots: true
            },
            'medium-hard': {
                accuracy: 0.8,        // 80% accuracy
                angleError: 8,        // ±8° error
                powerError: 0.1,      // ±10% power error
                thinkingTime: [1500, 3500],
                preferEasyShots: false
            },
            'hard': {
                accuracy: 0.92,
                angleError: 3,
                powerError: 0.05,
                thinkingTime: [1000, 2500],
                preferEasyShots: false
            }
        };

        this.config = this.settings[difficulty] || this.settings['medium-hard'];
    }

    /**
     * Calculate the best shot for the AI
     * @param {Object} gameState - Current game state
     * @param {Array} balls - All balls on table
     * @param {Object} cueBall - Cue ball position
     * @param {Array} pockets - Pocket positions
     * @param {string} targetType - 'solids' or 'stripes' or null
     * @returns {Object} - Shot parameters { angle, power, spinX, spinY, targetBall }
     */
    calculateShot(gameState, balls, cueBall, pockets, targetType) {
        const potentialShots = [];

        // Determine which balls to target
        let targetBalls = balls.filter(b => !b.pocketed && b.id !== 0);
        if (targetType === 'solids') {
            targetBalls = targetBalls.filter(b => b.id >= 1 && b.id <= 7);
        } else if (targetType === 'stripes') {
            targetBalls = targetBalls.filter(b => b.id >= 9 && b.id <= 15);
        }
        // If 8-ball is the only target
        if (targetType === 'solids' || targetType === 'stripes') {
            const remainingTargets = targetBalls.filter(b => b.id !== 8 && !b.pocketed);
            if (remainingTargets.length === 0) {
                targetBalls = balls.filter(b => b.id === 8 && !b.pocketed);
            }
        }

        // Evaluate each potential shot
        for (const ball of targetBalls) {
            for (const pocket of pockets) {
                const shot = this.evaluateShot(cueBall, ball, pocket, balls);
                if (shot) {
                    potentialShots.push(shot);
                }
            }
        }

        // Sort by score (best first)
        potentialShots.sort((a, b) => b.score - a.score);

        // Select shot based on difficulty
        let selectedShot;
        if (potentialShots.length > 0) {
            if (this.config.preferEasyShots || Math.random() < 0.7) {
                selectedShot = potentialShots[0]; // Best shot
            } else {
                // Sometimes pick a slightly suboptimal shot
                const index = Math.min(
                    Math.floor(Math.random() * 3),
                    potentialShots.length - 1
                );
                selectedShot = potentialShots[index];
            }
        }

        // Apply difficulty-based errors
        if (selectedShot) {
            return this.applyDifficultyNoise(selectedShot);
        }

        // Fallback: defensive shot towards center
        return this.calculateDefensiveShot(cueBall, balls);
    }

    /**
     * Evaluate a potential shot
     */
    evaluateShot(cueBall, targetBall, pocket, allBalls) {
        // Calculate angle from target ball to pocket
        const ballToPocket = {
            x: pocket.x - targetBall.x,
            y: pocket.y - targetBall.y
        };
        const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);

        // Calculate ghost ball position (where cue ball needs to hit)
        const ghostBall = {
            x: targetBall.x - (ballToPocket.x / distToPocket) * 28, // Ball diameter
            y: targetBall.y - (ballToPocket.y / distToPocket) * 28
        };

        // Calculate angle from cue ball to ghost ball
        const cueToGhost = {
            x: ghostBall.x - cueBall.x,
            y: ghostBall.y - cueBall.y
        };
        const distToGhost = Math.sqrt(cueToGhost.x ** 2 + cueToGhost.y ** 2);

        // Check if path is blocked
        const isBlocked = this.isPathBlocked(cueBall, ghostBall, allBalls, targetBall);
        if (isBlocked) return null;

        // Calculate cut angle (angle between cue direction and pocket direction)
        const cutAngle = Math.abs(Math.atan2(
            cueToGhost.x * ballToPocket.y - cueToGhost.y * ballToPocket.x,
            cueToGhost.x * ballToPocket.x + cueToGhost.y * ballToPocket.y
        ));

        // Score the shot (higher is better)
        let score = 100;
        score -= distToGhost / 10;           // Penalize distance
        score -= distToPocket / 5;           // Penalize pocket distance
        score -= Math.abs(cutAngle) * 30;    // Penalize sharp cut angles

        // Calculate shot angle (in radians)
        const angle = Math.atan2(cueToGhost.y, cueToGhost.x);

        // Calculate power based on distance
        const totalDist = distToGhost + distToPocket;
        const power = Math.min(0.85, Math.max(0.3, totalDist / 800));

        return {
            angle,
            power,
            spinX: 0,
            spinY: 0,
            targetBall: targetBall.id,
            pocket: pocket,
            score,
            cutAngle
        };
    }

    /**
     * Check if path is blocked by other balls
     */
    isPathBlocked(from, to, allBalls, excludeBall) {
        const BALL_RADIUS = 14;
        for (const ball of allBalls) {
            if (ball.pocketed || ball.id === 0 || ball.id === excludeBall?.id) continue;

            // Point-to-line distance
            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);

            const t = Math.max(0, Math.min(1,
                ((ball.x - from.x) * dx + (ball.y - from.y) * dy) / (len * len)
            ));

            const closest = {
                x: from.x + t * dx,
                y: from.y + t * dy
            };

            const dist = Math.sqrt(
                (ball.x - closest.x) ** 2 + (ball.y - closest.y) ** 2
            );

            if (dist < BALL_RADIUS * 2) return true;
        }
        return false;
    }

    /**
     * Apply difficulty-based noise to shot
     */
    applyDifficultyNoise(shot) {
        // Random accuracy check
        if (Math.random() > this.config.accuracy) {
            // Miss slightly
            const angleDiff = (Math.random() - 0.5) * 2 * this.config.angleError * (Math.PI / 180);
            shot.angle += angleDiff;
        }

        // Power variation
        const powerVar = (Math.random() - 0.5) * 2 * this.config.powerError;
        shot.power = Math.max(0.2, Math.min(1, shot.power * (1 + powerVar)));

        // Sometimes add spin
        if (Math.random() < 0.3) {
            shot.spinX = (Math.random() - 0.5) * 0.6;
            shot.spinY = (Math.random() - 0.5) * 0.6;
        }

        return shot;
    }

    /**
     * Calculate a defensive shot when no good pockets available
     */
    calculateDefensiveShot(cueBall, balls) {
        // Hit the nearest ball softly
        let nearestBall = null;
        let nearestDist = Infinity;

        for (const ball of balls) {
            if (ball.pocketed || ball.id === 0) continue;
            const dist = Math.sqrt(
                (ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2
            );
            if (dist < nearestDist) {
                nearestDist = dist;
                nearestBall = ball;
            }
        }

        if (nearestBall) {
            const angle = Math.atan2(
                nearestBall.y - cueBall.y,
                nearestBall.x - cueBall.x
            );
            return {
                angle,
                power: 0.3, // Soft safety shot
                spinX: 0,
                spinY: -0.3, // Draw for position
                targetBall: nearestBall.id,
                isDefensive: true
            };
        }

        // Last resort: random direction
        return {
            angle: Math.random() * Math.PI * 2,
            power: 0.4,
            spinX: 0,
            spinY: 0
        };
    }

    /**
     * Get random thinking time based on difficulty
     */
    getThinkingTime() {
        const [min, max] = this.config.thinkingTime;
        return min + Math.random() * (max - min);
    }
}

// Export for both Node.js and browser
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { AIPlayer };
}
