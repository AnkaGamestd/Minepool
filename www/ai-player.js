/**
 * AI Player for Mine Pool - Pro Edition
 * Features: Bank shots, kick shots, safety play, run-out planning, cue ball control
 */

class AIPlayer {
    constructor(difficulty = 'expert') {
        this.difficulty = difficulty;

        // Difficulty settings
        this.settings = {
            'easy': {
                accuracy: 0.55,
                angleError: 20,
                powerError: 0.2,
                thinkingTime: [2000, 4000],
                preferEasyShots: true,
                useSpin: false,
                considerPosition: false,
                useBankShots: false,
                useKickShots: false,
                safetyIntelligence: 0.3
            },
            'medium': {
                accuracy: 0.72,
                angleError: 12,
                powerError: 0.12,
                thinkingTime: [1500, 3000],
                preferEasyShots: true,
                useSpin: true,
                considerPosition: false,
                useBankShots: false,
                useKickShots: false,
                safetyIntelligence: 0.5
            },
            'medium-hard': {
                accuracy: 0.85,
                angleError: 6,
                powerError: 0.08,
                thinkingTime: [1200, 2500],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true,
                useBankShots: true,
                useKickShots: false,
                safetyIntelligence: 0.7
            },
            'hard': {
                accuracy: 0.94,
                angleError: 2.5,
                powerError: 0.04,
                thinkingTime: [800, 2000],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true,
                useBankShots: true,
                useKickShots: true,
                safetyIntelligence: 0.85
            },
            'expert': {
                accuracy: 0.98,
                angleError: 0.8,
                powerError: 0.015,
                thinkingTime: [500, 1200],
                preferEasyShots: false,
                useSpin: true,
                considerPosition: true,
                useBankShots: true,
                useKickShots: true,
                safetyIntelligence: 0.95
            }
        };

        this.config = this.settings[difficulty] || this.settings['expert'];
        this.BALL_RADIUS = 14;
        this.TABLE_WIDTH = 1000;  // Match actual table dimensions
        this.TABLE_HEIGHT = 500;  // Match actual table dimensions
        this.CUSHION = 25;
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
        const is8BallTime = (targetType === 'solids' || targetType === 'stripes') &&
            targetBalls.filter(b => b.id !== 8 && b.active !== false && !b.pocketed).length === 0;

        if (is8BallTime) {
            targetBalls = balls.filter(b => b.id === 8 && b.active !== false && !b.pocketed);
        }

        // 1. Evaluate direct shots
        for (const ball of targetBalls) {
            for (const pocket of pockets) {
                const shot = this.evaluateShot(cueBall, ball, pocket, balls, targetBalls);
                if (shot) {
                    potentialShots.push(shot);
                }
            }
        }

        // 2. Look for combo shots
        if (this.config.considerPosition) {
            const comboShots = this.findComboShots(cueBall, targetBalls, pockets, balls);
            potentialShots.push(...comboShots);
        }

        // 3. Try bank shots (ball off cushion into pocket)
        if (this.config.useBankShots && potentialShots.length < 3) {
            const bankShots = this.findBankShots(cueBall, targetBalls, pockets, balls);
            potentialShots.push(...bankShots);
        }

        // 4. Try kick shots (cue ball off cushion to hit ball)
        if (this.config.useKickShots && potentialShots.length === 0) {
            const kickShots = this.findKickShots(cueBall, targetBalls, pockets, balls);
            potentialShots.push(...kickShots);
        }

        // Sort by score (best first)
        potentialShots.sort((a, b) => b.score - a.score);

        // Select shot
        let selectedShot = null;
        if (potentialShots.length > 0) {
            // Expert: evaluate run-out (multiple shots ahead)
            if (this.difficulty === 'expert' && potentialShots.length > 1) {
                selectedShot = this.evaluateRunOut(potentialShots.slice(0, 5), cueBall, balls, targetBalls, pockets);
            } else if (this.difficulty === 'hard' || this.difficulty === 'expert') {
                selectedShot = potentialShots[0];
            } else if (this.config.preferEasyShots || Math.random() < 0.8) {
                selectedShot = potentialShots[0];
            } else {
                const index = Math.min(Math.floor(Math.random() * 2), potentialShots.length - 1);
                selectedShot = potentialShots[index];
            }

            // Add smart spin for position play
            if (this.config.useSpin && selectedShot) {
                selectedShot = this.addSmartSpin(selectedShot, cueBall, balls, pockets, targetBalls, is8BallTime);
            }
        }

        // Apply difficulty-based errors
        if (selectedShot) {
            return this.applyDifficultyNoise(selectedShot);
        }

        // Fallback: intelligent safety shot
        return this.calculateSafetyShot(cueBall, balls, targetBalls, pockets, targetType);
    }

    /**
     * Evaluate a potential shot with enhanced scoring
     */
    evaluateShot(cueBall, targetBall, pocket, allBalls, targetBalls) {
        const ballToPocket = {
            x: pocket.x - targetBall.x,
            y: pocket.y - targetBall.y
        };
        const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);

        if (distToPocket > 500) return null;

        // Calculate ghost ball position
        const ghostBall = {
            x: targetBall.x - (ballToPocket.x / distToPocket) * (this.BALL_RADIUS * 2),
            y: targetBall.y - (ballToPocket.y / distToPocket) * (this.BALL_RADIUS * 2)
        };

        const cueToGhost = {
            x: ghostBall.x - cueBall.x,
            y: ghostBall.y - cueBall.y
        };
        const distToGhost = Math.sqrt(cueToGhost.x ** 2 + cueToGhost.y ** 2);

        // Check paths
        if (this.isPathBlocked(cueBall, ghostBall, allBalls, targetBall)) return null;
        if (this.isPathBlocked(targetBall, pocket, allBalls, null)) return null;

        // Calculate cut angle
        const cutAngle = Math.abs(Math.atan2(
            cueToGhost.x * ballToPocket.y - cueToGhost.y * ballToPocket.x,
            cueToGhost.x * ballToPocket.x + cueToGhost.y * ballToPocket.y
        ));

        // Skip very sharp cuts
        if (cutAngle > Math.PI * 0.45) return null;

        // Enhanced scoring
        let score = 100;

        // Distance penalties
        score -= distToGhost / 12;
        score -= distToPocket / 10;

        // Cut angle penalty (exponential)
        score -= Math.pow(cutAngle, 1.8) * 30;

        // Bonuses
        if (cutAngle < 0.12) score += 20; // Straight shot
        if (distToGhost < 120) score += 15; // Short cue ball travel
        if (distToPocket < 150) score += 12; // Short pocket distance
        if (!pocket.isCenter) score += 6; // Corner pocket

        // Position play bonus
        if (this.config.considerPosition) {
            const positionBonus = this.evaluatePositionPlay(ghostBall, allBalls, targetBalls, cutAngle, distToPocket);
            score += positionBonus;
        }

        const angle = Math.atan2(cueToGhost.y, cueToGhost.x);

        // Smart power calculation
        let power = this.calculateOptimalPower(distToGhost, distToPocket, cutAngle);

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
            ghostBall,
            type: 'direct'
        };
    }

    /**
     * Find bank shot opportunities (ball off cushion into pocket)
     */
    findBankShots(cueBall, targetBalls, pockets, allBalls) {
        const bankShots = [];
        const cushions = [
            { axis: 'x', value: this.CUSHION, dir: 1 },  // Left
            { axis: 'x', value: this.TABLE_WIDTH - this.CUSHION, dir: -1 }, // Right
            { axis: 'y', value: this.CUSHION, dir: 1 },  // Top
            { axis: 'y', value: this.TABLE_HEIGHT - this.CUSHION, dir: -1 } // Bottom
        ];

        for (const ball of targetBalls) {
            for (const pocket of pockets) {
                for (const cushion of cushions) {
                    // Mirror pocket across cushion
                    let mirrorPocket;
                    if (cushion.axis === 'x') {
                        mirrorPocket = { x: 2 * cushion.value - pocket.x, y: pocket.y };
                    } else {
                        mirrorPocket = { x: pocket.x, y: 2 * cushion.value - pocket.y };
                    }

                    // Calculate bank point
                    const dx = mirrorPocket.x - ball.x;
                    const dy = mirrorPocket.y - ball.y;
                    let bankPoint = null;

                    if (cushion.axis === 'x') {
                        const t = (cushion.value - ball.x) / dx;
                        if (t > 0.1 && t < 0.9) {
                            bankPoint = { x: cushion.value, y: ball.y + t * dy };
                        }
                    } else {
                        const t = (cushion.value - ball.y) / dy;
                        if (t > 0.1 && t < 0.9) {
                            bankPoint = { x: ball.x + t * dx, y: cushion.value };
                        }
                    }

                    if (!bankPoint) continue;
                    if (bankPoint.x < this.CUSHION * 2 || bankPoint.x > this.TABLE_WIDTH - this.CUSHION * 2) continue;
                    if (bankPoint.y < this.CUSHION * 2 || bankPoint.y > this.TABLE_HEIGHT - this.CUSHION * 2) continue;

                    // Ghost ball for hitting ball toward bank point
                    const ballToBank = { x: bankPoint.x - ball.x, y: bankPoint.y - ball.y };
                    const distToBank = Math.sqrt(ballToBank.x ** 2 + ballToBank.y ** 2);

                    const ghostBall = {
                        x: ball.x - (ballToBank.x / distToBank) * (this.BALL_RADIUS * 2),
                        y: ball.y - (ballToBank.y / distToBank) * (this.BALL_RADIUS * 2)
                    };

                    // Check paths
                    if (this.isPathBlocked(cueBall, ghostBall, allBalls, ball)) continue;
                    if (this.isPathBlocked(ball, bankPoint, allBalls, null)) continue;

                    const cueToGhost = { x: ghostBall.x - cueBall.x, y: ghostBall.y - cueBall.y };
                    const distCueToGhost = Math.sqrt(cueToGhost.x ** 2 + cueToGhost.y ** 2);
                    const distBankToPocket = Math.sqrt((pocket.x - bankPoint.x) ** 2 + (pocket.y - bankPoint.y) ** 2);

                    const totalDist = distCueToGhost + distToBank + distBankToPocket;

                    // Bank shots are harder, lower base score
                    let score = 55 - totalDist / 30;
                    if (distToBank < 150) score += 10;

                    bankShots.push({
                        angle: Math.atan2(cueToGhost.y, cueToGhost.x),
                        power: Math.min(0.9, Math.max(0.5, totalDist / 600)),
                        spinX: 0,
                        spinY: 0,
                        targetBall: ball.id,
                        pocket: pocket,
                        score,
                        type: 'bank',
                        bankPoint
                    });
                }
            }
        }

        return bankShots;
    }

    /**
     * Find kick shot opportunities (cue ball off cushion to hit ball)
     */
    findKickShots(cueBall, targetBalls, pockets, allBalls) {
        const kickShots = [];
        const cushions = [
            { axis: 'x', value: this.CUSHION },
            { axis: 'x', value: this.TABLE_WIDTH - this.CUSHION },
            { axis: 'y', value: this.CUSHION },
            { axis: 'y', value: this.TABLE_HEIGHT - this.CUSHION }
        ];

        for (const ball of targetBalls) {
            for (const cushion of cushions) {
                // Mirror cue ball across cushion
                let mirrorCue;
                if (cushion.axis === 'x') {
                    mirrorCue = { x: 2 * cushion.value - cueBall.x, y: cueBall.y };
                } else {
                    mirrorCue = { x: cueBall.x, y: 2 * cushion.value - cueBall.y };
                }

                // Calculate kick point
                const dx = ball.x - mirrorCue.x;
                const dy = ball.y - mirrorCue.y;
                let kickPoint = null;

                if (cushion.axis === 'x') {
                    const t = (cushion.value - mirrorCue.x) / dx;
                    if (t > 0 && t < 1) {
                        kickPoint = { x: cushion.value, y: mirrorCue.y + t * dy };
                    }
                } else {
                    const t = (cushion.value - mirrorCue.y) / dy;
                    if (t > 0 && t < 1) {
                        kickPoint = { x: mirrorCue.x + t * dx, y: cushion.value };
                    }
                }

                if (!kickPoint) continue;

                // Validate kick point is on table
                if (kickPoint.x < this.CUSHION || kickPoint.x > this.TABLE_WIDTH - this.CUSHION) continue;
                if (kickPoint.y < this.CUSHION || kickPoint.y > this.TABLE_HEIGHT - this.CUSHION) continue;

                // Check if path to kick point is clear
                if (this.isPathBlocked(cueBall, kickPoint, allBalls, null)) continue;

                const cueToKick = { x: kickPoint.x - cueBall.x, y: kickPoint.y - cueBall.y };
                const distCueToKick = Math.sqrt(cueToKick.x ** 2 + cueToKick.y ** 2);
                const distKickToBall = Math.sqrt((ball.x - kickPoint.x) ** 2 + (ball.y - kickPoint.y) ** 2);

                // Kick shots are emergency moves, low score
                const score = 30 - (distCueToKick + distKickToBall) / 40;

                kickShots.push({
                    angle: Math.atan2(cueToKick.y, cueToKick.x),
                    power: Math.min(0.85, Math.max(0.5, (distCueToKick + distKickToBall) / 500)),
                    spinX: 0,
                    spinY: 0,
                    targetBall: ball.id,
                    score,
                    type: 'kick',
                    kickPoint
                });
            }
        }

        return kickShots;
    }

    /**
     * Evaluate run-out (plan multiple shots ahead)
     */
    evaluateRunOut(topShots, cueBall, balls, targetBalls, pockets) {
        let bestShot = topShots[0];
        let bestRunOutScore = bestShot.score;

        for (const shot of topShots) {
            // Simulate where cue ball might end up
            const predictedPos = this.predictCueBallPosition(shot, cueBall);

            // Count how many additional shots are possible from there
            let runOutScore = shot.score;
            const remainingBalls = targetBalls.filter(b => b.id !== shot.targetBall);

            for (const nextBall of remainingBalls) {
                for (const pocket of pockets) {
                    const nextShot = this.evaluateShot(predictedPos, nextBall, pocket, balls, remainingBalls);
                    if (nextShot && nextShot.score > 50) {
                        runOutScore += nextShot.score * 0.3;
                    }
                }
            }

            if (runOutScore > bestRunOutScore) {
                bestRunOutScore = runOutScore;
                bestShot = shot;
            }
        }

        return bestShot;
    }

    /**
     * Predict cue ball position after shot
     */
    predictCueBallPosition(shot, cueBall) {
        if (!shot.ghostBall) return cueBall;

        const dirX = Math.cos(shot.angle);
        const dirY = Math.sin(shot.angle);

        // Simplified prediction based on cut angle and spin
        let rebound = 0.3 + shot.cutAngle * 0.5;
        if (shot.spinY > 0) rebound *= 0.5; // Draw reduces travel
        if (shot.spinY < 0) rebound *= 1.5; // Follow increases travel

        const travelDist = shot.distToGhost * rebound;

        return {
            x: Math.max(this.CUSHION + 20, Math.min(this.TABLE_WIDTH - this.CUSHION - 20,
                shot.ghostBall.x + dirX * travelDist * 0.5)),
            y: Math.max(this.CUSHION + 20, Math.min(this.TABLE_HEIGHT - this.CUSHION - 20,
                shot.ghostBall.y + dirY * travelDist * 0.5))
        };
    }

    /**
     * Calculate optimal power for shot
     */
    calculateOptimalPower(distToGhost, distToPocket, cutAngle) {
        let basePower = 0.4 + (distToGhost + distToPocket) / 800;

        // More power for cut shots
        if (cutAngle > 0.4) basePower *= 1.15;
        if (cutAngle > 0.6) basePower *= 1.1;

        // Less power for very close shots
        if (distToGhost < 80) basePower *= 0.85;

        return Math.max(0.35, Math.min(0.95, basePower));
    }

    /**
     * Evaluate position for next shot
     */
    evaluatePositionPlay(ghostBall, allBalls, targetBalls, cutAngle, distToPocket) {
        let bonus = 0;

        // Reward positions that leave good angles for remaining balls
        const remainingBalls = targetBalls.filter(b => b.id !== 0);

        for (const ball of remainingBalls) {
            const dist = Math.sqrt((ball.x - ghostBall.x) ** 2 + (ball.y - ghostBall.y) ** 2);
            if (dist < 200) bonus += 10;
            else if (dist < 350) bonus += 5;
        }

        // Penalize positions near cushions (limits next shot options)
        if (ghostBall.x < 60 || ghostBall.x > this.TABLE_WIDTH - 60) bonus -= 8;
        if (ghostBall.y < 50 || ghostBall.y > this.TABLE_HEIGHT - 50) bonus -= 8;

        // Reward center table positions
        const centerX = this.TABLE_WIDTH / 2;
        const centerY = this.TABLE_HEIGHT / 2;
        const distToCenter = Math.sqrt((ghostBall.x - centerX) ** 2 + (ghostBall.y - centerY) ** 2);
        if (distToCenter < 150) bonus += 8;

        return Math.min(25, bonus);
    }

    /**
     * Add smart spin based on shot and position needs
     */
    addSmartSpin(shot, cueBall, allBalls, pockets, targetBalls, is8BallTime) {
        const remainingBalls = targetBalls.filter(b => b.id !== shot.targetBall);

        // For 8-ball, use minimal spin for control
        if (is8BallTime) {
            shot.spinY = 0.15; // Slight draw for control
            return shot;
        }

        // No spin needed for very straight shots
        if (shot.cutAngle < 0.1) {
            shot.spinY = -0.25; // Follow through
            return shot;
        }

        // Draw for sharp cuts
        if (shot.cutAngle > 0.35) {
            shot.spinY = 0.5; // Draw back
        } else if (shot.cutAngle > 0.2) {
            shot.spinY = 0.25; // Moderate draw
        } else {
            shot.spinY = -0.2; // Follow
        }

        // Add english for position
        if (remainingBalls.length > 0 && shot.cutAngle > 0.15) {
            // Determine which way to send cue ball
            const avgNextBallX = remainingBalls.reduce((sum, b) => sum + b.x, 0) / remainingBalls.length;
            const ghostX = shot.ghostBall?.x || cueBall.x;

            if (avgNextBallX > ghostX) {
                shot.spinX = 0.25; // Right english
            } else {
                shot.spinX = -0.25; // Left english
            }
        }

        return shot;
    }

    /**
     * Calculate intelligent safety shot
     */
    calculateSafetyShot(cueBall, allBalls, targetBalls, pockets, targetType) {
        // Determine opponent's balls
        let opponentBalls = [];
        if (targetType === 'solids') {
            opponentBalls = allBalls.filter(b => b.id >= 9 && b.id <= 15 && b.active !== false && !b.pocketed);
        } else if (targetType === 'stripes') {
            opponentBalls = allBalls.filter(b => b.id >= 1 && b.id <= 7 && b.active !== false && !b.pocketed);
        }

        let bestSafety = null;
        let bestScore = -Infinity;

        for (const ball of targetBalls) {
            if (ball.active === false || ball.pocketed) continue;

            const angle = Math.atan2(ball.y - cueBall.y, ball.x - cueBall.x);
            const dist = Math.sqrt((ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2);

            if (this.isPathBlocked(cueBall, ball, allBalls, ball)) continue;

            let score = 50;
            score -= dist / 15;

            // Bonus for hitting ball toward cushion (harder for opponent)
            const endX = ball.x + Math.cos(angle) * 100;
            const endY = ball.y + Math.sin(angle) * 100;
            if (endX < 80 || endX > this.TABLE_WIDTH - 80) score += 15;
            if (endY < 60 || endY > this.TABLE_HEIGHT - 60) score += 15;

            // Bonus for leaving cue ball behind other balls (snooker)
            for (const obs of opponentBalls) {
                const obsDist = Math.sqrt((obs.x - ball.x) ** 2 + (obs.y - ball.y) ** 2);
                if (obsDist < 150) score += 10;
            }

            // Penalty for leaving easy shots for opponent
            for (const pocket of pockets) {
                const pocketDist = Math.sqrt((pocket.x - ball.x) ** 2 + (pocket.y - ball.y) ** 2);
                if (pocketDist < 150) score -= 20;
            }

            if (score > bestScore) {
                bestScore = score;
                bestSafety = {
                    angle,
                    power: Math.min(0.55, Math.max(0.3, dist / 600)),
                    spinX: 0,
                    spinY: 0.4, // Draw back
                    targetBall: ball.id,
                    type: 'safety',
                    isSafety: true
                };
            }
        }

        if (bestSafety && Math.random() < this.config.safetyIntelligence) {
            return bestSafety;
        }

        // Last resort: hit any legal ball softly
        return this.hitNearestBall(cueBall, targetBalls, allBalls);
    }

    /**
     * Hit the nearest legal ball
     */
    hitNearestBall(cueBall, targetBalls, allBalls) {
        let nearest = null;
        let nearestDist = Infinity;

        for (const ball of targetBalls) {
            if (ball.active === false || ball.pocketed) continue;
            const dist = Math.sqrt((ball.x - cueBall.x) ** 2 + (ball.y - cueBall.y) ** 2);
            if (dist < nearestDist && !this.isPathBlocked(cueBall, ball, allBalls, ball)) {
                nearestDist = dist;
                nearest = ball;
            }
        }

        if (nearest) {
            return {
                angle: Math.atan2(nearest.y - cueBall.y, nearest.x - cueBall.x),
                power: 0.4,
                spinX: 0,
                spinY: 0.2,
                targetBall: nearest.id,
                type: 'emergency'
            };
        }

        // Absolute last resort
        return {
            angle: Math.random() * Math.PI * 2,
            power: 0.35,
            spinX: 0,
            spinY: 0,
            type: 'random'
        };
    }

    /**
     * Find combo shot opportunities
     */
    findComboShots(cueBall, targetBalls, pockets, allBalls) {
        const comboShots = [];

        for (const firstBall of targetBalls) {
            for (const secondBall of targetBalls) {
                if (firstBall.id === secondBall.id) continue;

                for (const pocket of pockets) {
                    const ballToPocket = {
                        x: pocket.x - secondBall.x,
                        y: pocket.y - secondBall.y
                    };
                    const distToPocket = Math.sqrt(ballToPocket.x ** 2 + ballToPocket.y ** 2);
                    if (distToPocket > 250) continue;

                    const secondGhost = {
                        x: secondBall.x - (ballToPocket.x / distToPocket) * (this.BALL_RADIUS * 2),
                        y: secondBall.y - (ballToPocket.y / distToPocket) * (this.BALL_RADIUS * 2)
                    };

                    const firstToSecond = {
                        x: secondGhost.x - firstBall.x,
                        y: secondGhost.y - firstBall.y
                    };
                    const distFirstToSecond = Math.sqrt(firstToSecond.x ** 2 + firstToSecond.y ** 2);
                    if (distFirstToSecond > 180) continue;

                    const firstGhost = {
                        x: firstBall.x - (firstToSecond.x / distFirstToSecond) * (this.BALL_RADIUS * 2),
                        y: firstBall.y - (firstToSecond.y / distFirstToSecond) * (this.BALL_RADIUS * 2)
                    };

                    if (this.isPathBlocked(cueBall, firstGhost, allBalls, firstBall)) continue;
                    if (this.isPathBlocked(firstBall, secondGhost, allBalls, secondBall)) continue;
                    if (this.isPathBlocked(secondBall, pocket, allBalls, null)) continue;

                    const cueToFirst = {
                        x: firstGhost.x - cueBall.x,
                        y: firstGhost.y - cueBall.y
                    };
                    const distCueToFirst = Math.sqrt(cueToFirst.x ** 2 + cueToFirst.y ** 2);

                    comboShots.push({
                        angle: Math.atan2(cueToFirst.y, cueToFirst.x),
                        power: 0.7,
                        spinX: 0,
                        spinY: 0,
                        targetBall: firstBall.id,
                        pocket: pocket,
                        score: 65,
                        type: 'combo',
                        comboBall: secondBall.id
                    });
                }
            }
        }

        return comboShots;
    }

    /**
     * Check if path is blocked
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

            const dist = Math.sqrt((ball.x - closest.x) ** 2 + (ball.y - closest.y) ** 2);

            if (dist < this.BALL_RADIUS * 2.2) return true;
        }
        return false;
    }

    /**
     * Apply difficulty-based noise
     */
    applyDifficultyNoise(shot) {
        if (Math.random() > this.config.accuracy) {
            const angleDiff = (Math.random() - 0.5) * 2 * this.config.angleError * (Math.PI / 180);
            shot.angle += angleDiff;
        }

        const powerVar = (Math.random() - 0.5) * 2 * this.config.powerError;
        shot.power = Math.max(0.25, Math.min(1, shot.power * (1 + powerVar)));

        return shot;
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
