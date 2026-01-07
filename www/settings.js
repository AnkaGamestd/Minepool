/**
 * Physics Settings Manager
 * Creates a UI to tweak physics parameters in real-time
 */

class PhysicsSettings {
    constructor(physicsEngine) {
        this.physics = physicsEngine;
        this.isVisible = false;
        this.createUI();
        this.bindEvents();
    }

    createUI() {
        // Create container
        this.container = document.createElement('div');
        this.container.id = 'physics-settings-panel';
        this.container.style.cssText = `
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: rgba(10, 15, 30, 0.95);
            border: 2px solid #00d4ff;
            border-radius: 12px;
            padding: 20px;
            width: 350px;
            color: #fff;
            font-family: 'Rajdhani', sans-serif;
            z-index: 9999;
            display: none;
            box-shadow: 0 0 20px rgba(0, 212, 255, 0.3);
        `;

        // Header
        const header = document.createElement('div');
        header.innerHTML = `
            <h2 style="margin: 0 0 15px 0; color: #00d4ff; text-align: center;">PHYSICS SETTINGS</h2>
            <div style="text-align: center; font-size: 11px; color: #ff9900; margin-bottom: 10px;" id="lock-status">⚠️ Settings locked during gameplay</div>
            <div style="position: absolute; top: 10px; right: 10px; cursor: pointer; font-size: 20px;" id="close-settings">✕</div>
        `;
        this.container.appendChild(header);

        // Settings list
        this.settingsList = document.createElement('div');
        this.settingsList.style.cssText = `
            max-height: 400px;
            overflow-y: auto;
        `;

        // Define settings to expose
        const settings = [
            { key: 'MU_SLIDE', label: 'Sliding Friction', min: 0.01, max: 1.0, step: 0.01 },
            { key: 'MU_ROLL', label: 'Rolling Resistance', min: 0.001, max: 0.1, step: 0.001 },
            { key: 'MU_SPIN', label: 'Spin Friction', min: 0.001, max: 0.2, step: 0.001 },
            { key: 'E_BALL', label: 'Ball Restitution', min: 0.1, max: 1.0, step: 0.01 },
            { key: 'E_CUSHION', label: 'Cushion Restitution', min: 0.1, max: 1.0, step: 0.01 },
            { key: 'GRAVITY', label: 'Gravity (Scaled)', min: 100, max: 2000, step: 10 },
            { key: 'MAX_CUE_SPEED', label: 'Max Cue Speed', min: 500, max: 5000, step: 100 }
        ];

        settings.forEach(setting => {
            const row = document.createElement('div');
            row.style.cssText = `
                margin-bottom: 12px;
                display: flex;
                flex-direction: column;
            `;

            const labelRow = document.createElement('div');
            labelRow.style.cssText = `display: flex; justify-content: space-between; margin-bottom: 4px;`;

            const label = document.createElement('label');
            label.textContent = setting.label;
            label.style.fontSize = '14px';
            label.style.color = '#aaa';

            const valueDisplay = document.createElement('span');
            valueDisplay.id = `val-${setting.key}`;
            valueDisplay.style.color = '#00d4ff';
            valueDisplay.style.fontWeight = 'bold';

            // Get current value
            let currentVal = this.physics[setting.key];
            if (currentVal === undefined && setting.key === 'MAX_CUE_SPEED') {
                currentVal = 1800; // Default fallback
            }
            const decimals = setting.step < 0.01 ? 3 : (setting.step < 0.1 ? 2 : 0);
            valueDisplay.textContent = currentVal !== undefined ? currentVal.toFixed(decimals) : 'N/A';

            labelRow.appendChild(label);
            labelRow.appendChild(valueDisplay);

            const input = document.createElement('input');
            input.type = 'range';
            input.min = setting.min;
            input.max = setting.max;
            input.step = setting.step;
            input.value = currentVal;
            input.style.width = '100%';
            input.style.cursor = 'pointer';

            // Store reference for direct physics updates
            const physicsRef = this.physics;
            const settingKey = setting.key;

            // Update immediately on input (while dragging)
            input.addEventListener('input', function (e) {
                // Lock physics during active gameplay
                if (window.gameInstance && (window.gameInstance.gameState === 'aiming' || window.gameInstance.gameState === 'shooting')) {
                    // Show warning
                    valueDisplay.style.color = '#ff4444';
                    valueDisplay.textContent = 'LOCKED';
                    setTimeout(() => {
                        const currentVal = physicsRef[settingKey];
                        const dec = setting.step < 0.01 ? 3 : (setting.step < 0.1 ? 2 : 0);
                        valueDisplay.textContent = currentVal.toFixed(dec);
                        valueDisplay.style.color = '#00d4ff';
                    }, 500);
                    // Reset slider to current value
                    e.target.value = physicsRef[settingKey];
                    return;
                }

                const val = parseFloat(e.target.value);
                physicsRef[settingKey] = val;
                const dec = setting.step < 0.01 ? 3 : (setting.step < 0.1 ? 2 : 0);
                valueDisplay.textContent = val.toFixed(dec);

                // Visual feedback - flash green
                valueDisplay.style.color = '#00ff88';
                setTimeout(() => {
                    valueDisplay.style.color = '#00d4ff';
                }, 200);
            });

            row.appendChild(labelRow);
            row.appendChild(input);
            this.settingsList.appendChild(row);
        });

        this.container.appendChild(this.settingsList);

        // Reset Button
        const resetBtn = document.createElement('button');
        resetBtn.textContent = 'RESET TO DEFAULTS';
        resetBtn.style.cssText = `
            width: 100%;
            padding: 10px;
            margin-top: 15px;
            background: rgba(255, 0, 0, 0.2);
            border: 1px solid #ff0000;
            color: #ff0000;
            border-radius: 4px;
            cursor: pointer;
            font-family: 'Orbitron', sans-serif;
        `;
        resetBtn.addEventListener('click', () => this.resetDefaults());
        this.container.appendChild(resetBtn);

        document.body.appendChild(this.container);

        // Toggle Button (Floating)
        this.toggleBtn = document.createElement('button');
        this.toggleBtn.textContent = '⚙️ PHYSICS';
        this.toggleBtn.style.cssText = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: rgba(0, 0, 0, 0.8);
            border: 1px solid #00d4ff;
            color: #00d4ff;
            padding: 10px 15px;
            border-radius: 20px;
            cursor: pointer;
            z-index: 9998;
            font-family: 'Rajdhani', sans-serif;
            font-weight: bold;
            transition: all 0.3s ease;
        `;
        this.toggleBtn.addEventListener('mouseover', () => {
            this.toggleBtn.style.background = '#00d4ff';
            this.toggleBtn.style.color = '#000';
        });
        this.toggleBtn.addEventListener('mouseout', () => {
            this.toggleBtn.style.background = 'rgba(0, 0, 0, 0.8)';
            this.toggleBtn.style.color = '#00d4ff';
        });
        this.toggleBtn.addEventListener('click', () => this.toggle());
        document.body.appendChild(this.toggleBtn);
    }

    bindEvents() {
        document.getElementById('close-settings').addEventListener('click', () => this.toggle());
    }

    toggle() {
        this.isVisible = !this.isVisible;
        this.container.style.display = this.isVisible ? 'block' : 'none';
    }

    resetDefaults() {
        // Realistic pool physics settings
        const defaults = {
            MU_SLIDE: 0.05,
            MU_ROLL: 0.007,     // Lower friction for longer ball rolls
            MU_SPIN: 0.04,
            E_BALL: 0.92,       // Realistic ball elasticity
            E_CUSHION: 0.75,    // Cushions absorb more energy
            GRAVITY: 980,
            MAX_CUE_SPEED: 550  // Reduced for more realistic ball speed
        };

        for (const [key, val] of Object.entries(defaults)) {
            this.physics[key] = val;
            const display = document.getElementById(`val-${key}`);
            if (display) display.textContent = val;
        }
        // Force reload UI values
        this.container.remove();
        this.toggleBtn.remove();
        this.createUI();
        this.bindEvents();
        this.toggle(); // Re-open
    }
}

// Auto-initialize when game is ready
document.addEventListener('DOMContentLoaded', () => {
    // Wait for gameInstance to be ready
    setTimeout(() => {
        if (window.gameInstance && window.gameInstance.physics) {
            const physics = window.gameInstance.physics;
            window.physicsSettings = new PhysicsSettings(physics);

            // Make physics globally accessible for testing
            window.physics = physics;

            console.log('Physics Settings initialized');
            console.log('Current physics values:', {
                MU_ROLL: physics.MU_ROLL,
                MU_SLIDE: physics.MU_SLIDE,
                MU_SPIN: physics.MU_SPIN
            });

            // Global test function - type testPhysics() in browser console
            window.testPhysics = function () {
                console.log('=== PHYSICS TEST ===');
                console.log('MU_ROLL:', window.physics.MU_ROLL);
                console.log('Setting MU_ROLL to 0.5...');
                window.physics.MU_ROLL = 0.5;
                console.log('MU_ROLL is now:', window.physics.MU_ROLL);
                console.log('Check the debug panel on the table!');
            };

            console.log('Tip: Type testPhysics() in browser console to test settings');
        } else {
            console.error('Game instance or physics engine not available');
        }
    }, 1000);
});
