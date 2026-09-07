/* Shared, resolution-independent equipment artwork. Physics stays in table units. */
(() => {
    'use strict';
    const TAU = Math.PI * 2;
    const SIZE = 160;
    const colors = ['#fff9e9', '#f4be12', '#1951d0', '#d92232', '#7135a5',
        '#ee6815', '#138653', '#8f2435', '#101722'];
    const balls = new Map();
    const cues = new Map();
    const makeCanvas = (w, h) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    const disc = (ctx, x, y, r, color) => {
        ctx.fillStyle = color;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    };

    // A sphere-normal lighting map: shadows and overhead softbox reflections stay
    // anchored to the room while the markings rotate underneath them.
    let lighting;
    function getLighting() {
        if (lighting) return lighting;
        lighting = makeCanvas(SIZE, SIZE);
        const ctx = lighting.getContext('2d');
        const pixels = ctx.createImageData(SIZE, SIZE);
        for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
            const nx = (x + .5 - SIZE / 2) / (SIZE / 2);
            const ny = (y + .5 - SIZE / 2) / (SIZE / 2);
            const d = nx * nx + ny * ny;
            if (d >= 1) continue;
            const nz = Math.sqrt(1 - d);
            const diffuse = Math.max(0, -.38 * nx - .48 * ny + .79 * nz);
            const shade = .12 + .57 * (1 - diffuse) + .14 * Math.pow(1 - nz, 3);
            const i = (y * SIZE + x) * 4;
            pixels.data[i] = 3; pixels.data[i + 1] = 10; pixels.data[i + 2] = 18;
            pixels.data[i + 3] = 255 * shade * Math.min(1, (1 - Math.sqrt(d)) * SIZE / 2);
        }
        ctx.putImageData(pixels, 0, 0);
        ctx.translate(SIZE / 2, SIZE / 2); ctx.scale(SIZE / 2, SIZE / 2);
        const sheen = ctx.createRadialGradient(-.32, -.42, 0, -.32, -.42, .64);
        sheen.addColorStop(0, '#ffffff65'); sheen.addColorStop(.5, '#ffffff14'); sheen.addColorStop(1, '#ffffff00');
        disc(ctx, 0, 0, 1, sheen);
        ctx.save(); ctx.rotate(-.42);
        ctx.fillStyle = '#ffffffde'; ctx.beginPath(); ctx.ellipse(-.12, -.62, .24, .085, 0, 0, TAU); ctx.fill();
        ctx.fillStyle = '#ffffff70'; ctx.beginPath(); ctx.ellipse(.18, -.64, .045, .065, 0, 0, TAU); ctx.fill();
        ctx.restore();
        ctx.strokeStyle = '#d2fff538'; ctx.lineWidth = .024;
        ctx.beginPath(); ctx.arc(0, 0, .966, .12, 1.12); ctx.stroke();
        return lighting;
    }

    function getBall(id) {
        if (balls.has(id)) return balls.get(id);
        const canvas = makeCanvas(SIZE, SIZE);
        const ctx = canvas.getContext('2d');
        ctx.translate(SIZE / 2, SIZE / 2); ctx.scale(SIZE / 2, SIZE / 2);
        const color = colors[id > 8 ? id - 8 : id] || colors[0];
        disc(ctx, 0, 0, 1, id > 8 ? '#fff9eb' : color);
        if (id > 8) {
            ctx.save(); ctx.beginPath(); ctx.arc(0, 0, 1, 0, TAU); ctx.clip();
            ctx.fillStyle = color;
            ctx.beginPath(); ctx.moveTo(-1.1, -.32);
            ctx.bezierCurveTo(-.48, -.72, .48, -.72, 1.1, -.32);
            ctx.lineTo(1.1, .32); ctx.bezierCurveTo(.48, .72, -.48, .72, -1.1, .32);
            ctx.closePath(); ctx.fill(); ctx.restore();
        }
        if (id !== 0) {
            disc(ctx, 0, .035, .49, '#fffbed');
            ctx.fillStyle = '#0d1624';
            ctx.font = `800 ${id > 9 ? .64 : .75}px Arial, sans-serif`;
            ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(String(id), 0, .075);
        }
        balls.set(id, canvas);
        return canvas;
    }

    let contactShadow;
    function getContactShadow() {
        if (contactShadow) return contactShadow;
        contactShadow = makeCanvas(SIZE, SIZE);
        const ctx = contactShadow.getContext('2d');
        const shadow = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * .12, SIZE / 2, SIZE / 2, SIZE / 2);
        shadow.addColorStop(0, '#00000080'); shadow.addColorStop(.6, '#00000042'); shadow.addColorStop(1, '#00000000');
        ctx.fillStyle = shadow; ctx.fillRect(0, 0, SIZE, SIZE);
        return contactShadow;
    }

    function drawBall(ctx, ball, radius) {
        ctx.save(); ctx.translate(ball.x, ball.y);
        ctx.drawImage(getContactShadow(), -radius * 1.1, -radius * .55, radius * 2.44, radius * 1.8);
        ctx.save(); ctx.rotate(ball.rotation || 0);
        ctx.drawImage(getBall(ball.id), -radius, -radius, radius * 2, radius * 2); ctx.restore();
        ctx.drawImage(getLighting(), -radius, -radius, radius * 2, radius * 2);
        ctx.restore();
    }

    const finishes = {
        standard: ['#492919', '#ad7442', '#cba873'], classic_oak: ['#492919', '#ad7442', '#cba873'],
        premium: ['#10191e', '#4c626a', '#b9c8cd'], legendary: ['#08332e', '#216d60', '#d9b66a'],
        dragon: ['#3c1218', '#873e31', '#d7a258'], dragons_breath: ['#3c1218', '#873e31', '#d7a258'],
        ice: ['#193b4c', '#5792a3', '#cedfe5'], frost_bite: ['#193b4c', '#5792a3', '#cedfe5'],
        viper: ['#152e20', '#44784a', '#b3bb7a'], phoenix: ['#572e16', '#a56637', '#dcb567'],
        shadow: ['#241f31', '#534664', '#b5a0c6'], shadow_master: ['#241f31', '#534664', '#b5a0c6'],
        neon_striker: ['#282235', '#605479', '#97c6d1']
    };
    const LENGTH = 540;
    const CUE_HEIGHT = 18;
    function getCue(style = 'standard') {
        if (!finishes[style]) style = 'standard';
        if (cues.has(style)) return cues.get(style);
        // Four-times artwork keeps fine rings, grain and linen clean when rotated.
        const canvas = makeCanvas(LENGTH * 4, CUE_HEIGHT * 4);
        const ctx = canvas.getContext('2d'); ctx.scale(4, 4); ctx.translate(0, CUE_HEIGHT / 2);
        const [dark, mid, metal] = finishes[style];
        const width = x => 4.5 - 2.8 * x / LENGTH;
        const taper = (start, end) => {
            ctx.beginPath(); ctx.moveTo(start, -width(start)); ctx.lineTo(end, -width(end));
            ctx.lineTo(end, width(end)); ctx.lineTo(start, width(start)); ctx.closePath();
        };
        const section = (start, end, palette) => {
            const gradient = ctx.createLinearGradient(0, -width(start), 0, width(start));
            palette.forEach((c, i) => gradient.addColorStop(i / (palette.length - 1), c));
            ctx.fillStyle = gradient; taper(start, end); ctx.fill();
        };
        section(0, 536, [dark, mid, dark]);
        // Short butt sleeve, long linen wrap, spliced forearm, then maple shaft.
        section(0, 6, ['#0a0c0d', '#4a4c4c', '#0a0c0d']);
        section(7, 61, [dark, mid, dark, '#090f13']);
        section(64, 180, ['#10171a', '#414a4b', '#202729', '#080c0e']);
        ctx.save(); taper(64, 180); ctx.clip();
        ctx.lineWidth = .36;
        for (let x = 63; x < 182; x += 1.35) {
            ctx.strokeStyle = '#c7d1c33b'; ctx.beginPath(); ctx.moveTo(x, -5); ctx.lineTo(x + 3.5, 5); ctx.stroke();
            ctx.strokeStyle = '#00000050'; ctx.beginPath(); ctx.moveTo(x + .6, -5); ctx.lineTo(x + 4.1, 5); ctx.stroke();
        }
        ctx.restore();
        section(183, 272, [dark, mid, dark, '#0b1518']);
        // Inlaid points follow the forearm rather than floating above it.
        for (const sign of [-1, 1]) {
            ctx.fillStyle = metal; ctx.beginPath(); ctx.moveTo(186, sign * 2.8);
            ctx.lineTo(258, sign * 1.5); ctx.lineTo(196, sign * .2); ctx.closePath(); ctx.fill();
            ctx.fillStyle = '#f1e4bd'; ctx.beginPath(); ctx.moveTo(194, sign * 2.3);
            ctx.lineTo(244, sign * 1.5); ctx.lineTo(200, sign * .8); ctx.closePath(); ctx.fill();
        }
        const carbon = style === 'premium';
        section(276, 526, carbon ? ['#20282d', '#8a999e', '#414e54', '#151f25'] :
            ['#a8844e', '#efdab0', '#fff1d2', '#d5b37c', '#917049']);
        ctx.save(); taper(279, 526); ctx.clip(); ctx.lineWidth = .25;
        for (let i = 0; i < 8; i++) {
            ctx.strokeStyle = carbon ? '#e7f0ee24' : '#7853253a';
            const y = -3 + i * .78;
            ctx.beginPath(); ctx.moveTo(278, y);
            ctx.bezierCurveTo(340, y - .4, 422, y * .72 + .3, 526, y * .5); ctx.stroke();
        }
        ctx.restore();
        for (const [start, end] of [[8,10],[55,57],[60,63],[180,183],[269,272],[273,276]])
            section(start, end, ['#564f3c', metal, '#ffeed0', metal, '#443c30']);
        section(526, 536.5, ['#a9aaa0', '#fffdf0', '#dfdecc', '#8a948c']);
        section(536.5, 540, ['#284c60', '#82b6c6', '#426e85', '#1c3546']);
        // A narrow lacquer reflection defines curvature without a neon outline.
        ctx.save(); taper(10, 526); ctx.clip(); ctx.strokeStyle = '#ffffff36'; ctx.lineWidth = .32;
        ctx.beginPath(); ctx.moveTo(10, -1.8); ctx.lineTo(526, -.7); ctx.stroke(); ctx.restore();
        cues.set(style, canvas);
        return canvas;
    }

    function drawCue(ctx, style) {
        ctx.save(); ctx.shadowColor = '#00000065'; ctx.shadowBlur = 2;
        ctx.shadowOffsetX = 1; ctx.shadowOffsetY = 3;
        ctx.drawImage(getCue(style), -LENGTH, -CUE_HEIGHT / 2, LENGTH, CUE_HEIGHT);
        ctx.restore();
    }

    function installPreviews() {
        const names = { standard: 'standard', premium: 'premium', legendary: 'legendary' };
        for (const [name, style] of Object.entries(names)) {
            document.documentElement.style.setProperty(`--cue-art-${name}`, `url("${getCue(style).toDataURL()}")`);
        }
    }
    window.PoolArt = { drawBall, drawCue, getBall, getCue, installPreviews, cueLength: LENGTH };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installPreviews, { once: true });
    else installPreviews();
})();
