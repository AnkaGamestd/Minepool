/**
 * Mine Pool - Game Input
 * Mouse and touch input handling
 */

/**
 * Convert touch event to mouse-like object
 */
PoolGame.prototype.touchToMouse = function (touch, type) {
    return {
        clientX: touch.clientX,
        clientY: touch.clientY,
        type: type,
        preventDefault: () => { },
        stopPropagation: () => { }
    };
};

/**
 * Handle mouse move event
 */
PoolGame.prototype.handleMouseMove = function (e) {
    const rect = this.canvas.getBoundingClientRect();
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
        const kitchenLine = this.tableWidth * 0.25;

        if (this.ballInHandKitchen) {
            cueBall.x = Math.max(c + r, Math.min(kitchenLine - r, mouseX));
        } else {
            cueBall.x = Math.max(c + r, Math.min(this.tableWidth - c - r, mouseX));
        }
        cueBall.y = Math.max(c + r, Math.min(this.tableHeight - c - r, mouseY));
        return;
    }

    // Set cursor for ball-in-hand
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
};

/**
 * Handle mouse down event
 */
PoolGame.prototype.handleMouseDown = function (e) {
    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const mouseX = (e.clientX - rect.left) * scaleX;
    const mouseY = (e.clientY - rect.top) * scaleY;

    // CALL POCKET - CLICK ON POCKET
    if (this.gameState === 'calling-pocket') {
        for (let i = 0; i < this.physics.pockets.length; i++) {
            const pocket = this.physics.pockets[i];
            const dist = Math.hypot(mouseX - pocket.x, mouseY - pocket.y);
            if (dist < this.physics.pocketRadius + 40) {
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

    // MULTIPLAYER: Only allow when it's my turn
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
};

/**
 * Handle mouse up event
 */
PoolGame.prototype.handleMouseUp = function (e) {
    if (this.gameState !== 'aiming') return;

    // MULTIPLAYER CHECK
    if (this.isMultiplayer && !this.isMyTurn) {
        return;
    }

    // BALL IN HAND - RELEASE TO PLACE
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
            this.canvas.style.cursor = 'crosshair';
            this.updateTurnIndicator();
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
};

/**
 * Handle mouse leave event
 */
PoolGame.prototype.handleMouseLeave = function () {
    this.isDragging = false;
};

// ==========================================
// MOBILE TOUCH CONTROLS
// ==========================================

/**
 * Handle touch start event
 */
PoolGame.prototype.handleTouchStart = function (e) {
    if (e.touches.length === 0) return;
    const touch = e.touches[0];

    const rect = this.canvas.getBoundingClientRect();
    const scaleX = this.canvas.width / rect.width;
    const scaleY = this.canvas.height / rect.height;
    const touchX = (touch.clientX - rect.left) * scaleX;
    const touchY = (touch.clientY - rect.top) * scaleY;

    this.mobileTouch.touchId = touch.identifier;
    this.mobileTouch.currentX = touchX;
    this.mobileTouch.currentY = touchY;

    this.touchFeedback.visible = true;
    this.touchFeedback.x = touchX;
    this.touchFeedback.y = touchY;

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

    // BALL IN HAND
    if (this.ballInHand) {
        this.isDraggingBall = true;
        return;
    }

    // DIRECT AIMING
    const cueBall = this.balls[0];
    this.aimAngle = Math.atan2(touchY - cueBall.y, touchX - cueBall.x);
    this.mobileTouch.isAiming = true;
};

/**
 * Handle touch move event
 */
PoolGame.prototype.handleTouchMove = function (e) {
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
};

/**
 * Handle touch end event
 */
PoolGame.prototype.handleTouchEnd = function (e) {
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
};

// ==========================================
// POWER SLIDER CONTROLS
// ==========================================

/**
 * Handle power touch start
 */
PoolGame.prototype.handlePowerTouchStart = function (e) {
    if (this.gameState !== 'aiming') return;
    if (this.isMultiplayer && !this.isMyTurn) return;
    this.updatePowerFromTouch(e.touches[0]);
};

/**
 * Handle power touch move
 */
PoolGame.prototype.handlePowerTouchMove = function (e) {
    if (this.gameState !== 'aiming') return;
    this.updatePowerFromTouch(e.touches[0]);
};

/**
 * Handle power touch end - shoot if power is sufficient
 */
PoolGame.prototype.handlePowerTouchEnd = function (e) {
    if (this.gameState !== 'aiming') return;

    if (this.power > 5) {
        this.shoot();
    }

    this.power = 0;
    this.updatePowerGauge();

    if (this.powerHandle) {
        this.powerHandle.style.top = '0%';
    }
};

/**
 * Update power from touch position on power gauge
 */
PoolGame.prototype.updatePowerFromTouch = function (touch) {
    const rect = this.powerGauge.getBoundingClientRect();
    let relativeY = (touch.clientY - rect.top) / rect.height;
    relativeY = Math.max(0, Math.min(1, relativeY));
    this.power = relativeY * 100;
    this.updatePowerGauge();

    if (this.powerHandle) {
        this.powerHandle.style.top = `${relativeY * 100}%`;
    }
};
