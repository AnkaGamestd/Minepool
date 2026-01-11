/**
 * AI Player for Mine Pool - Enhanced Version
 * Smart shot selection with position play, combo detection, and strategic thinking
 */

class AIPlayer {
    constructor(difficulty = 'hard') {
        this.difficulty = difficulty;

        // Difficulty settings - enhanced for smarter play
        this.settings = {
            'easy': {
                accuracy: 0.55,
                angleError: 20,
                powerError: 0.2,
                thinkingTime: [2000, 4000],
                preferEasyShots: true,
                useSpin: false,
                considerPosition: false
            },
            'medium': {
                accuracy: 0.72,
                angleError: 12,
                powerError: 0.12,
                thinkingTime: [1500, 3000],
                preferEasyShots: true,
                useSpin: true,
                considerPosition: false
            },
            'medium-hard': {
                accuracy: 0.85,
                angleError: 6,
                powerError: 0.08,
                thinkingTime: [1200, 2500],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true
            },
            'hard': {
                accuracy: 0.94,
                angleError: 2.5,
                powerError: 0.04,
                thinkingTime: [800, 2000],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true
            },
            'expert': {
                accuracy: 0.98,
                angleError: 1,
                powerError: 0.02,
                thinkingTime: [600, 1500],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true
            }
        };

        this.config = this.settings[difficulty] || this.settings['hard'];
        this.BALL_RADIUS = 14;
        this.TABLE_WIDTH = 800;
        this.TABLE_HEIGHT = 400;
    }

    /**
     * Calculate the best shot for the AI
     */
    calculateShot(gameState, balls, cueBall, pockets, targetType) {
        const potentialShots = [];

        // Determine which balls to target
        let targetBalls = balls.filter(b => b.active !== false && !b.pocketed && b.id !== 0);

        if (targetType === 'solids') {
            targetBalls = targetBalls.filter(b => b.id >= 1 && b.id <= 7);
        } else if (targetType === 'stripes') {
            targetBalls = targetBalls.filter(b => b.id >= 9 && b.id <= 15);
        }

        // Check for 8-ball scenario
        if (targetType === 'solids' || targetType === 'stripes') {
            const remainingTargets = targetBalls.filter(b => b.id !== 8 && b.active !== false && !b.pocketed);
            if (remainingTargets.length === 0) {
                targetBalls = balls.filter(b => b.id === 8 && b.active !== false && !b.pocketed);
            }
        }

        // Evaluate direct shots
        for (const ball of targetBalls) {
            for (const pocket of pockets) {
                const shot = this.evaluateShot(cueBall, ball, pocket, balls, targetBalls);
                if (shot) {
                    potentialShots.push(shot);
                }
            }
        }

        // Look for combo shots (hit one ball into another)
        if (this.config.considerPosition) {
            const comboShots = this.findComboShots(cueBall, targetBalls, pockets, balls);
            potentialShots.push(...comboShots);
        }

        // Sort by score (best first)
        potentialShots.sort((a, b) => b.score - a.score);

        // Select shot
        let selectedShot;
        if (potentialShots.length > 0) {
            // On hard difficulty, almost always pick the best shot
            if (this.difficulty === 'hard' || this.difficulty === 'expert') {
                selectedShot = potentialShots[0];
            } else if (this.config.preferEasyShots || Math.random() < 0.8) {
                selectedShot = potentialShots[0];
            } else {
                const index = Math.min(Math.floor(Math.random() * 2), potentialShots.length - 1);
                selectedShot = potentialShots[index];
            }

            // Add smart spin for position play
            if (this.config.useSpin && selectedShot) {
                selectedShot = this.addPositionSpin(selectedShot, cueBall, balls, pockets, targetBalls);
            }
        }

        // Apply difficulty-based errors
        if (selectedShot) {
            return this.applyDifficultyNoise(selectedShot);
        }

        // Fallback: smart defensive shot
        return this.calculateDefensiveShot(cueBall, balls, targetBalls, pockets);
    }

    /**
     * Evaluate a potential shot with enhanced scoring
     */
    evaluateShot(cueBall, targetBall, pocket, allBalls, targetBalls) {
        // Calculate angle from target ball to pocket
        const ballToPocket = {
            x: pocket.x - targetBall.x,
            y: pocket.y - targetBall.y
        };
        const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);

        // Skip if ball is too far from pocket (unlikely shot)
        if (distToPocket > 500) return null;

        // Calculate ghost ball position
        const ghostBall = {
            x: targetBall.x - (ballToPocket.x / distToPocket) * (this.BALL_RADIUS * 2),
            y: targetBall.y - (ballToPocket.y / distToPocket) * (this.BALL_RADIUS * 2)
        };

        // Calculate angle from cue ball to ghost ball
        const cueToGhost = {
            x: ghostBall.x - cueBall.x,
            y: ghostBall.y - cueBall.y
        };
        const distToGhost = Math.sqrt(cueToGhost.x ** 2 + cueToGhost.y ** 2);

        // Check if path to ghost ball is blocked
        if (this.isPathBlocked(cueBall, ghostBall, allBalls, targetBall)) return null;

        // Check if path from target ball to pocket is blocked
        if (this.isPathBlocked(targetBall, pocket, allBalls, null)) return null;

        // Calculate cut angle
        const cutAngle = Math.abs(Math.atan2(
            cueToGhost.x * ballToPocket.y - cueToGhost.y * ballToPocket.x,
            cueToGhost.x * ballToPocket.x + cueToGhost.y * ballToPocket.y
        ));

        // Skip very sharp cuts (>75 degrees) - too difficult
        if (cutAngle > Math.PI * 0.42) return null;

        // Enhanced scoring
        let score = 100;

        // Distance penalties (less harsh for AI)
        score -= distToGhost / 15;
        score -= distToPocket / 8;

        // Cut angle penalty (exponential - sharp cuts are much harder)
        score -= Math.pow(cutAngle, 1.5) * 25;

        // Bonus for straight shots
        if (cutAngle < 0.15) score += 15;

        // Bonus for short distance shots
        if (distToGhost < 150) score += 10;
        if (distToPocket < 200) score += 8;

        // Bonus for corner pockets (easier than side pockets)
        if (!pocket.isCenter) score += 5;

        // Position play bonus - is there another good shot after this?
        if (this.config.considerPosition) {
            const positionBonus = this.evaluatePositionPlay(ghostBall, allBalls, targetBalls, pockets, targetBall);
            score += positionBonus * 0.3;
        }

        const angle = Math.atan2(cueToGhost.y, cueToGhost.x);
        const totalDist = distToGhost + distToPocket;

        // Smart power calculation based on distance and cut angle
        let power = Math.min(0.95, Math.max(0.4, totalDist / 550));
        // More power for sharp cuts
        if (cutAngle > 0.4) power = Math.min(1, power * 1.15);

        return {
            angle,
            power,
            spinX: 0,
            spinY: 0,
            targetBall: targetBall.id,
            pocket: pocket,
            score,
            cutAngle,
            distToGhost,
            distToPocket,
            ghostBall
        };
    }

    /**
     * Find combo shot opportunities
     */
    findComboShots(cueBall, targetBalls, pockets, allBalls) {
        const comboShots = [];

        for (const firstBall of targetBalls) {
            // Check if we can hit this ball into another ball that goes into a pocket
            for (const secondBall of targetBalls) {
                if (firstBall.id === secondBall.id) continue;

                for (const pocket of pockets) {
                    // Check if secondBall can go into pocket
                    const ballToPocket = {
                        x: pocket.x - secondBall.x,
                        y: pocket.y - secondBall.y
                    };
                    const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);
                    if (distToPocket > 300) continue;

                    // Ghost position for secondBall
                    const secondGhost = {
                        x: secondBall.x - (ballToPocket.x / distToPocket) * (this.BALL_RADIUS * 2),
                        y: secondBall.y - (ballToPocket.y / distToPocket) * (this.BALL_RADIUS * 2)
                    };

                    // Check if firstBall can hit secondBall at right angle
                    const firstToSecond = {
                        x: secondGhost.x - firstBall.x,
                        y: secondGhost.y - firstBall.y
                    };
                    const distFirstToSecond = Math.sqrt(firstToSecond.x ** 2 + firstToSecond.y ** 2);
                    if (distFirstToSecond > 200) continue;

                    // Ghost for firstBall
                    const firstGhost = {
                        x: firstBall.x - (firstToSecond.x / distFirstToSecond) * (this.BALL_RADIUS * 2),
                        y: firstBall.y - (firstToSecond.y / distFirstToSecond) * (this.BALL_RADIUS * 2)
                    };

                    // Check paths
                    if (this.isPathBlocked(cueBall, firstGhost, allBalls, firstBall)) continue;
                    if (this.isPathBlocked(firstBall, secondGhost, allBalls, secondBall)) continue;
                    if (this.isPathBlocked(secondBall, pocket, allBalls, null)) continue;

                    const cueToFirst = {
                        x: firstGhost.x - cueBall.x,
                        y: firstGhost.y - cueBall.y
                    };
                    const distCueToFirst = Math.sqrt(cueToFirst.x ** 2 + cueToFirst.y ** 2);

                    const angle = Math.atan2(cueToFirst.y, cueToFirst.x);

                    comboShots.push({
                        angle,
                        power: 0.75,
                        spinX: 0,
                        spinY: 0,
                        targetBall: firstBall.id,
                        pocket: pocket,
                        score: 60, // Combos are risky but impressive
                        isCombo: true,
                        comboBall: secondBall.id
                    });
                }
            }
        }

        return comboShots;
    }

    /**
     * Evaluate position for next shot after this one
     */
    evaluatePositionPlay(predictedCueBallPos, allBalls, targetBalls, pockets, excludeBall) {
        let positionScore = 0;

        const remainingTargets = targetBalls.filter(b => b.id !== excludeBall.id);

        for (const ball of remainingTargets) {
            for (const pocket of pockets) {
                const ballToPocket = {
                    x: pocket.x - ball.x,
                    y: pocket.y - ball.y
                };
                const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);

                const ghostBall = {
                    x: ball.x - (ballToPocket.x / distToPocket) * (this.BALL_RADIUS * 2),
                    y: ball.y - (ballToPocket.y / distToPocket) * (this.BALL_RADIUS * 2)
                };

                const distToGhost = Math.sqrt(
                    (ghostBall.x - predictedCueBallPos.x) ** 2 +
                    (ghostBall.y - predictedCueBallPos.y) ** 2
                );

                // Closer predicted position = better
                if (distToGhost < 200) positionScore += 15;
                else if (distToGhost < 350) positionScore += 8;
            }
        }

        return Math.min(30, positionScore);
    }

    /**
     * Add spin for position play
     */
    addPositionSpin(shot, cueBall, allBalls, pockets, targetBalls) {
        // After making the shot, where will the cue ball go?
        // Add spin to position for next shot

        const remainingTargets = targetBalls.filter(b => b.id !== shot.targetBall);
        if (remainingTargets.length === 0) return shot;

        // Find the closest remaining target
        let closestTarget = null;
        let closestDist = Infinity;

        for (const ball of remainingTargets) {
            for (const pocket of pockets) {
                const dist = Math.sqrt(
                    (ball.x - shot.ghostBall?.x || cueBall.x) ** 2 +
                    (ball.y - shot.ghostBall?.y || cueBall.y) ** 2
                );
                if (dist < closestDist) {
                    closestDist = dist;
                    closestTarget = ball;
                }
            }
        }

        if (closestTarget && shot.cutAngle) {
            // Use draw (backspin) for position on sharp cuts
            if (shot.cutAngle > 0.3) {
                shot.spinY = 0.4; // Draw
            } else if (shot.cutAngle < 0.15) {
                shot.spinY = -0.3; // Follow through on straight shots
            }

            // Add english based on cut direction
            if (Math.abs(shot.cutAngle) > 0.2) {
                shot.spinX = shot.cutAngle > 0 ? -0.2 : 0.2;
            }
        }

        return shot;
    }

    /**
     * Check if path is blocked by other balls
     */
    isPathBlocked(from, to, allBalls, excludeBall) {
        for (const ball of allBalls) {
            if (ball.active === false || ball.pocketed || ball.id === 0) continue;
            if (excludeBall && ball.id === excludeBall.id) continue;

            const dx = to.x - from.x;
            const dy = to.y - from.y;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

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

            if (dist < this.BALL_RADIUS * 2.2) return true;
        }
        return false;
    }

    /**
     * Apply difficulty-based noise to shot
     */
    applyDifficultyNoise(shot) {
        // Accuracy check - higher difficulty = more consistent
        if (Math.random() > this.config.accuracy) {
            const angleDiff = (Math.random() - 0.5) * 2 * this.config.angleError * (Math.PI / 180);
            shot.angle += angleDiff;
        }

        // Power variation
        const powerVar = (Math.random() - 0.5) * 2 * this.config.powerError;
        shot.power = Math.max(0.25, Math.min(1, shot.power * (1 + powerVar)));

        return shot;
    }

    /**
     * Calculate a smart defensive shot
     */
    calculateDefensiveShot(cueBall, allBalls, targetBalls, pockets) {
        // Strategy: Hit a ball and leave cue ball in difficult position for opponent

        let bestDefensive = null;
        let bestScore = -Infinity;

        for (const ball of targetBalls) {
            if (ball.active === false || ball.pocketed) continue;

            const angle = Math.atan2(ball.y - cueBall.y, ball.x - cueBall.x);
            const dist = Math.sqrt((ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2);

            // Check if path is clear
            if (this.isPathBlocked(cueBall, ball, allBalls, ball)) continue;

            let score = 50;
            score -= dist / 20; // Prefer closer balls

            // Prefer leaving cue ball behind other balls (snookering opponent)

            if (score > bestScore) {
                bestScore = score;
                bestDefensive = {
                    angle,
                    power: Math.min(0.65, Math.max(0.35, dist / 500)),
                    spinX: 0,
                    spinY: 0.3, // Draw back
                    targetBall: ball.id,
                    isDefensive: true
                };
            }
        }

        if (bestDefensive) return bestDefensive;

        // Last resort: hit nearest ball
        let nearest = null;
        let nearestDist = Infinity;
        for (const ball of allBalls) {
            if (ball.active === false || ball.pocketed || ball.id === 0) continue;
            const dist = Math.sqrt((ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2);
            if (dist < nearestDist) {
                nearestDist = dist;
                nearest = ball;
            }
        }

        if (nearest) {
            return {
                angle: Math.atan2(nearest.y - cueBall.y, nearest.x - cueBall.x),
                power: 0.5,
                spinX: 0,
                spinY: 0,
                targetBall: nearest.id,
                isDefensive: true
            };
        }

        return {
            angle: Math.random() * Math.PI * 2,
            power: 0.45,
            spinX: 0,
            spinY: 0
        };
    }

    /**
     * Get thinking time
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
