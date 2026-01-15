const fs = require('fs');

let content = fs.readFileSync('www/network.js', 'utf8');

// Find the section to replace - from "// Determine AI's target group" to just before "// Get spin for this shot"
const startMarker = "            // Determine AI's target group (AI is typically player 2)";
const endMarker = "            // Get spin for this shot";

const startIndex = content.indexOf(startMarker);
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.log('Markers not found!');
    console.log('Start found:', startIndex !== -1);
    console.log('End found:', endIndex !== -1);
    process.exit(1);
}

// New code using AIPlayer class
const newCode = `            // USE AIIPLAYER CLASS FOR SMART AI
            const aiPlayerNum = this.myPlayerNumber === 1 ? 2 : 1;
            const aiGroup = this.game.playerTypes ? this.game.playerTypes[aiPlayerNum] : null;
            console.log(\`🤖 AI is Player \${aiPlayerNum}, Group: \${aiGroup || 'OPEN'}\`);

            // Get pockets from physics
            const pockets = this.game.physics?.pockets || [
                { x: 40, y: 40 }, { x: 460, y: 40 }, { x: 880, y: 40 },
                { x: 40, y: 460 }, { x: 460, y: 460 }, { x: 880, y: 460 }
            ];

            // Use the AIPlayer class for intelligent shot selection
            if (typeof AIPlayer === 'undefined') {
                console.error('🤖 AIPlayer class not loaded!');
                this.aiShotPending = false;
                return;
            }

            // Create AI player instance if not exists
            if (!this.aiPlayerInstance) {
                this.aiPlayerInstance = new AIPlayer('expert');
            }

            // Determine target type for AI
            let targetType = null;
            if (aiGroup === 'solid') targetType = 'solids';
            else if (aiGroup === 'stripe') targetType = 'stripes';

            // Calculate the best shot using AIPlayer
            const aiShot = this.aiPlayerInstance.calculateShot(
                this.game.gameState || {},
                freshBalls,
                freshCueBall,
                pockets,
                targetType
            );

            if (!aiShot) {
                console.log('🤖 AIPlayer returned no shot, using fallback');
                this.aiShotPending = false;
                return;
            }

            // Convert AIPlayer shot format to our format
            const bestShot = {
                ball: freshBalls.find(b => b.id === aiShot.targetBall) || freshBalls.find(b => b.id > 0 && b.active),
                pocket: aiShot.pocket || pockets[0],
                angle: aiShot.angle,
                power: aiShot.power * 100, // Convert 0-1 to 0-100
                cutAngle: (aiShot.cutAngle || 0) * 180 / Math.PI,
                isSafety: aiShot.type === 'safety' || aiShot.isSafety,
                ghostBall: aiShot.ghostBall
            };

            // Get spin from AI shot
            const spin = {
                spinX: aiShot.spinX || 0,
                spinY: aiShot.spinY || 0
            };

            console.log(\`🤖 AIPlayer shot: \${aiShot.type || 'direct'} on ball \${aiShot.targetBall}, power=\${(aiShot.power * 100).toFixed(0)}%\`);

            `;

content = content.substring(0, startIndex) + newCode + content.substring(endIndex);

fs.writeFileSync('www/network.js', content);
console.log('Refactored network.js to use AIPlayer class!');
