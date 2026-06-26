(function () {
    'use strict';

    // ─── DOM refs ────────────────────────────────────────────────
    const $ = (id) => document.getElementById(id);
    const welcomeScreen = $('welcome-screen');
    const mainScreen = $('main-screen');
    const enterBtn = $('enter-btn');
    const canvas = $('canvas');
    const ctx = canvas.getContext('2d');

    const playBtn = $('btn-play');
    const prevBtn = $('btn-prev');
    const nextBtn = $('btn-next');
    const rewindBtn = $('btn-rewind');
    const forwardBtn = $('btn-forward');
    const volumeSlider = $('volume-slider');
    const musicSelect = $('music-select');
    const fileUpload = $('file-upload');
    const trackName = $('current-track');
    const flowerCount = $('flower-count');
    const beatIndicator = $('beat-indicator');
    const flowerToggle = $('flower-toggle');
    const flowerIcon = $('flower-icon');
    const flowerColorInput = $('flower-color');
    const colorPickerBtn = $('btn-color-picker');
    const colorDot = $('color-dot');
    const logoutBtn = $('btn-logout');
    const resetBtn = $('btn-reset');
    const nameInput = $('name-input');
    const loginError = $('login-error');
    const urlInput = $('url-input');
    const btnLoadUrl = $('btn-load-url');
    const fileSource = $('file-source');
    const urlSource = $('url-source');
    const progressBar = $('progress-bar');
    const progressFill = $('progress-fill');
    const progressThumb = $('progress-thumb');
    const timeCurrent = $('time-current');
    const timeTotal = $('time-total');
    const msgOverlay = $('message-overlay');
    const petalsContainer = $('petals-container');

    // ─── Audio state ─────────────────────────────────────────────
    let audioCtx = null;
    let analyser = null;
    let sourceNode = null;
    let gainNode = null;
    let audioElement = null;
    let isPlaying = false;
    let currentBlobUrl = null;
    let audioData = null;
    let beatDetected = false;
    let beatTimer = 0;
    let energy = null;
    let isDemoMode = false;
    let demoInterval = null;

    // ─── YouTube state ───────────────────────────────────────────
    let ytPlayer = null;
    let ytBeatInterval = null;
    let ytProgressInterval = null;
    let isYouTube = false;

    // ─── Playlist ────────────────────────────────────────────────
    let playlist = [];
    let currentTrackIndex = -1;
    let isUserSeeking = false;
    let heartSpawnTimer = 0;

    // ─── Flower state ────────────────────────────────────────────
    let flowerType = 'tulip';
    let flowerColor = '#ff7cbc';
    let mainFlowers = [];
    let bgFlowers = [];
    let particles = [];
    let stars = [];
    const MAX_BG_FLOWERS = 40;
    let frameId = null;
    let lastTime = 0;

    // ─── Audio config ────────────────────────────────────────────
    const FFT_SIZE = 256;
    const BEAT_THRESHOLD = 0.55;
    const BEAT_MIN_ENERGY = 0.25;

    // ─── Welcome screen ──────────────────────────────────────────
    function createPetals() {
        if (!petalsContainer) return;
        petalsContainer.innerHTML = '';
        const chars = ['🌸', '💮', '🌺', '❤', '🌷', '💗', '✨'];
        for (let i = 0; i < 30; i++) {
            const el = document.createElement('div');
            el.className = 'petal';
            el.textContent = chars[i % chars.length];
            el.style.left = Math.random() * 100 + '%';
            el.style.fontSize = (0.6 + Math.random() * 1.4) + 'rem';
            el.style.animationDuration = (10 + Math.random() * 15) + 's';
            el.style.animationDelay = (Math.random() * 20) + 's';
            petalsContainer.appendChild(el);
        }
    }
    createPetals();

    function validateName(name) {
        const n = name.trim().toLowerCase();
        return n === 'yadhira' || n === 'yadhi';
    }

    nameInput.addEventListener('input', () => {
        const valid = validateName(nameInput.value);
        enterBtn.disabled = !valid;
        nameInput.classList.toggle('correct', valid);
        if (valid && nameInput.value.trim()) {
            loginError.textContent = '💗 Bienvenida, mi amor';
            loginError.style.color = 'rgba(255, 124, 188, 0.7)';
        } else if (nameInput.value.trim()) {
            loginError.textContent = '💭 Escribe tu nombre correcto...';
            loginError.style.color = 'rgba(255, 80, 80, 0.5)';
        } else {
            loginError.textContent = '';
        }
    });

    nameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !enterBtn.disabled) enterBtn.click();
    });

    enterBtn.addEventListener('click', () => {
        if (enterBtn.disabled) return;
        welcomeScreen.classList.add('fade-out');
        setTimeout(() => {
            welcomeScreen.style.display = 'none';
            mainScreen.style.display = 'block';
            initMain();
            setTimeout(() => msgOverlay.classList.add('visible'), 500);
            setTimeout(() => msgOverlay.classList.remove('visible'), 8000);
        }, 800);
    });

    // ─── Canvas sizing ───────────────────────────────────────────
    function resizeCanvas() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        if (mainFlowers.length) repositionMainFlowers();
    }
    window.addEventListener('resize', () => { resizeCanvas(); initStars(); });
    window.addEventListener('orientationchange', () => {
        setTimeout(() => { resizeCanvas(); initStars(); }, 300);
    });

    // ─── Main init ───────────────────────────────────────────────
    function initMain() {
        resizeCanvas();
        initStars();
        createMainFlowers();
        animate();
    }

    function repositionMainFlowers() {
        if (mainFlowers.length >= 2) {
            const h = canvas.height;
            const w = canvas.width;
            mainFlowers[0].baseX = w * 0.3;
            mainFlowers[0].baseY = h + 20;
            mainFlowers[1].baseX = w * 0.7;
            mainFlowers[1].baseY = h + 20;
            // Stalk reaches up so bloom is at ~42% from top
            mainFlowers[0].stalkHeight = h * 0.58;
            mainFlowers[1].stalkHeight = h * 0.58;
            mainFlowers[0].bloomSize = Math.max(100, Math.min(220, h * 0.2));
            mainFlowers[1].bloomSize = Math.max(100, Math.min(220, h * 0.2));
            mainFlowers[0].stalkWidth = Math.max(4, Math.min(8, h * 0.006));
            mainFlowers[1].stalkWidth = Math.max(4, Math.min(8, h * 0.006));
        }
    }

    function createMainFlowers() {
        const h = canvas.height;
        const w = canvas.width;
        mainFlowers = [
            new MainFlower(w * 0.3, h + 20, flowerType, flowerColor),
            new MainFlower(w * 0.7, h + 20, flowerType, flowerColor)
        ];
        mainFlowers.forEach((f, i) => {
            f.stalkHeight = h * 0.58;
            f.bloomSize = Math.max(100, Math.min(220, h * 0.2));
            f.stalkWidth = Math.max(4, Math.min(8, h * 0.006));
            f.swayOffset = i * Math.PI;
            f.bobOffset = i * 0.7;
        });
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── MAIN FLOWER CLASS (hiperrealista) ────────────────────────
    // ═══════════════════════════════════════════════════════════════

    class MainFlower {
        constructor(x, y, type, color) {
            this.baseX = x;
            this.baseY = y;
            this.type = type;
            this.color = color;

            this.stalkHeight = 220;
            this.stalkWidth = 5;
            this.bloomSize = 100;

            this.bloomOpenness = 0.6;
            this.targetOpenness = 0.6;
            this.swayOffset = Math.random() * Math.PI * 2;
            this.bobOffset = Math.random() * Math.PI * 2;
            this.swayAngle = 0;
            this.bobY = 0;
            this.phase = 0;
            this.slowPhase = 0;
            this.birthAnim = 1;
            this.petalFlutter = 0;

            // Color variations for depth
            this.baseColor = color;
            this.lightColor = this.lighten(color, 35);
            this.darkColor = this.darken(color, 25);
            this.deepColor = this.darken(color, 40);

            // Leaf positions
            this.leftLeafAngle = -0.4 + Math.random() * 0.2;
            this.rightLeafAngle = 0.4 + Math.random() * 0.2;
            this.leftLeafSize = 0.8 + Math.random() * 0.2;
            this.rightLeafSize = 0.8 + Math.random() * 0.2;
        }

        update(energy, dt) {
            const t = Date.now();

            // ── Fase rápida (ritmo de la música) ──
            if (energy) {
                const bass = energy.bass || 0;
                const mid = energy.mid || 0;
                const treble = energy.treble || 0;
                const beat = energy.beat || false;

                this.phase += 0.02 * (1 + bass * 3);

                const swayTarget = Math.sin(this.phase + this.swayOffset) * (0.03 + bass * 0.12);
                this.swayAngle += (swayTarget - this.swayAngle) * 0.08;

                const bobTarget = Math.sin(this.phase * 0.5 + this.bobOffset) * (2 + bass * 10) + (beat ? -8 : 0);
                this.bobY += (bobTarget - this.bobY) * 0.1;

                this.targetOpenness = 0.4 + bass * 0.5 + mid * 0.3;
                if (beat) this.targetOpenness = 1;
                this.bloomOpenness += (this.targetOpenness - this.bloomOpenness) * 0.06;

                this.petalFlutter = Math.sin(t * 0.005) * treble * 0.05;
            }

            // ── Fase lenta (movimiento base, elegante) ──
            this.slowPhase += 0.005;

            const slowSway = Math.sin(this.slowPhase * 0.3 + this.swayOffset * 0.7) * 0.04
                + Math.sin(this.slowPhase * 0.15 + this.swayOffset * 1.5) * 0.025;
            this.swayAngle += slowSway * 0.06;

            const slowBob = Math.sin(this.slowPhase * 0.2 + this.bobOffset * 0.8) * 4
                + Math.sin(this.slowPhase * 0.1 + this.bobOffset * 1.8) * 2;
            this.bobY += (slowBob - this.bobY * 0.5) * 0.03;

            // En reposo (sin música), el movimiento lento es el principal
            if (!energy) {
                this.targetOpenness = 0.45 + Math.sin(t * 0.0005 + this.bobOffset) * 0.2;
                this.swayAngle += (Math.sin(t * 0.0005 + this.swayOffset) * 0.05
                    + Math.sin(t * 0.0003 + this.swayOffset * 1.3) * 0.035) * 0.1;
                this.bobY += (Math.sin(t * 0.0004 + this.bobOffset) * 6
                    + Math.sin(t * 0.0002 + this.bobOffset * 2) * 3) * 0.05;
                this.bloomOpenness += (this.targetOpenness - this.bloomOpenness) * 0.03;
                this.petalFlutter = Math.sin(t * 0.003 + this.swayOffset) * 0.025
                    + Math.sin(t * 0.005 + this.swayOffset * 1.7) * 0.015;
            }
        }

        draw(ctx, time) {
            const x = this.baseX;
            const y = this.baseY + this.bobY;
            const sway = this.swayAngle;

            // Stem end point (top of stem, accounting for sway)
            const stemEndX = x + Math.sin(sway) * this.stalkHeight * 0.15;
            const stemEndY = y - this.stalkHeight;

            // Rotate whole flower based on sway
            ctx.save();
            ctx.translate(x, y);

            // ── Stem ──
            this.drawStem(ctx, 0, 0, stemEndX - x, stemEndY - y);

            // ── Leaves ──
            this.drawLeaves(ctx, 0, y - stemEndY);

            // ── Bloom ──
            ctx.save();
            ctx.translate(stemEndX - x, stemEndY - y);
            const rotAngle = -sway * 0.3;
            ctx.rotate(rotAngle);

            if (this.type === 'tulip') {
                this.drawTulip(ctx);
            } else {
                this.drawOrchid(ctx);
            }

            ctx.restore();
            ctx.restore();
        }

        drawStem(ctx, sx, sy, dx, dy) {
            const len = Math.sqrt(dx * dx + dy * dy);
            const midX = sx + dx * 0.5 + Math.sin(this.phase * 0.5 + this.swayOffset) * 8;
            const midY = sy + dy * 0.5 - Math.abs(Math.cos(this.phase * 0.3)) * 5;

            // Stem shadow
            ctx.beginPath();
            ctx.moveTo(sx + 2, sy);
            ctx.quadraticCurveTo(midX + 3, midY, sx + dx + 2, sy + dy);
            ctx.strokeStyle = 'rgba(0,0,0,0.3)';
            ctx.lineWidth = this.stalkWidth + 4;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Main stem
            ctx.beginPath();
            ctx.moveTo(sx, sy);
            ctx.quadraticCurveTo(midX, midY, sx + dx, sy + dy);
            const grad = ctx.createLinearGradient(sx, sy, sx + dx * 0.5, sy + dy * 0.5);
            grad.addColorStop(0, '#2d8a1e');
            grad.addColorStop(0.3, '#3ba52a');
            grad.addColorStop(0.7, '#2d8a1e');
            grad.addColorStop(1, '#1e5c14');
            ctx.strokeStyle = grad;
            ctx.lineWidth = this.stalkWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Stem highlight
            ctx.beginPath();
            ctx.moveTo(sx - 1, sy);
            ctx.quadraticCurveTo(midX - 1, midY, sx + dx - 1, sy + dy);
            ctx.strokeStyle = 'rgba(255,255,255,0.08)';
            ctx.lineWidth = this.stalkWidth * 0.3;
            ctx.stroke();
        }

        drawLeaves(ctx, sx, stemLen) {
            if (stemLen < 50) return;

            const drawLeaf = (side, angle, size) => {
                const leafLen = stemLen * 0.35 * size;
                const leafWid = leafLen * 0.22;
                const leafY = stemLen * 0.4;

                ctx.save();
                ctx.translate(sx, -leafY);
                ctx.rotate(angle + Math.sin(this.phase * 0.7 + side) * 0.05);

                // Leaf shadow
                ctx.beginPath();
                ctx.ellipse(3, 2, leafLen * 0.5, leafWid * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(0,0,0,0.2)';
                ctx.fill();

                // Leaf body
                const lg = ctx.createLinearGradient(0, 0, leafLen * 0.5, 0);
                lg.addColorStop(0, '#3ba52a');
                lg.addColorStop(0.4, '#4cbf35');
                lg.addColorStop(0.8, '#2d8a1e');
                lg.addColorStop(1, '#1e5c14');
                ctx.beginPath();
                ctx.ellipse(0, 0, leafLen * 0.5, leafWid * 0.5, 0, 0, Math.PI * 2);
                ctx.fillStyle = lg;
                ctx.fill();

                // Leaf vein
                ctx.beginPath();
                ctx.moveTo(-leafLen * 0.4, 0);
                ctx.lineTo(leafLen * 0.4, 0);
                ctx.strokeStyle = 'rgba(255,255,255,0.12)';
                ctx.lineWidth = 0.8;
                ctx.stroke();

                // Leaf highlight
                ctx.beginPath();
                ctx.ellipse(-leafLen * 0.1, -leafWid * 0.15, leafLen * 0.3, leafWid * 0.2, -0.2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255,255,255,0.06)';
                ctx.fill();

                ctx.restore();
            };

            drawLeaf(-1, -0.6 + this.leftLeafAngle, this.leftLeafSize);
            drawLeaf(1, 0.6 + this.rightLeafAngle, this.rightLeafSize);
            drawLeaf(-1, -0.3 + this.leftLeafAngle * 0.5, this.leftLeafSize * 0.7);
            drawLeaf(1, 0.3 + this.rightLeafAngle * 0.5, this.rightLeafSize * 0.7);
        }

        // ─── TULIP REALISTA ──────────────────────────────────────
        drawTulip(ctx) {
            const s = this.bloomSize;
            const open = this.bloomOpenness;
            const fl = this.petalFlutter;

            // ── Cáliz (base donde nacen los pétalos) ──
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(0, s * 0.02, s * 0.09, s * 0.07, 0, 0, Math.PI * 2);
            const calGrad = ctx.createRadialGradient(0, s * 0.02, 0, 0, s * 0.02, s * 0.09);
            calGrad.addColorStop(0, '#5cc43a');
            calGrad.addColorStop(0.5, '#2d8a1e');
            calGrad.addColorStop(1, '#14520a');
            ctx.fillStyle = calGrad;
            ctx.fill();
            // pequeña línea de unión
            ctx.beginPath();
            ctx.moveTo(0, s * 0.06);
            ctx.lineTo(0, s * 0.13);
            ctx.strokeStyle = '#2d8a1e';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // 3 outer petals (detrás)
            const outerColors = [
                this.darken(this.baseColor, 15),
                this.darken(this.baseColor, 18),
                this.darken(this.baseColor, 20),
            ];

            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2 + fl * (i - 1) * 0.5;
                const spread = 0.5 + open * 0.5;
                const pw = s * 0.35 * spread;
                const ph = s * 0.75;

                ctx.save();
                ctx.rotate(angle - Math.PI / 2);
                ctx.translate(0, -s * 0.1);

                this.drawTulipPetal(ctx, pw, ph, outerColors[i], true);

                ctx.restore();
            }

            // Green sepals at base (con detalles)
            ctx.save();
            for (let i = 0; i < 3; i++) {
                const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
                ctx.save();
                ctx.rotate(a);

                // Sépalo más largo y puntiagudo
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.02);
                ctx.bezierCurveTo(-s * 0.08, -s * 0.06, -s * 0.05, -s * 0.15, -s * 0.025, -s * 0.28);
                ctx.bezierCurveTo(-s * 0.015, -s * 0.3, 0, -s * 0.3, 0, -s * 0.3);
                ctx.bezierCurveTo(0, -s * 0.3, s * 0.015, -s * 0.3, s * 0.025, -s * 0.28);
                ctx.bezierCurveTo(s * 0.05, -s * 0.15, s * 0.08, -s * 0.06, 0, -s * 0.02);

                // Gradiente con 3 tonos para más profundidad
                const sg = ctx.createLinearGradient(0, -s * 0.02, 0, -s * 0.3);
                sg.addColorStop(0, '#4aaf2e');
                sg.addColorStop(0.4, '#2d8a1e');
                sg.addColorStop(1, '#14520a');
                ctx.fillStyle = sg;
                ctx.fill();

                // Vena central (línea más clara)
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.04);
                ctx.lineTo(0, -s * 0.26);
                ctx.strokeStyle = 'rgba(120, 220, 80, 0.35)';
                ctx.lineWidth = 1.2;
                ctx.stroke();

                // Brillo lateral izquierdo
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.04);
                ctx.bezierCurveTo(-s * 0.04, -s * 0.08, -s * 0.03, -s * 0.15, -s * 0.01, -s * 0.25);
                ctx.strokeStyle = 'rgba(180, 255, 140, 0.15)';
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.restore();
            }
            ctx.restore();

            // 3 inner petals (delante)
            const innerColors = [
                this.baseColor,
                this.lighten(this.baseColor, 12),
                this.lighten(this.baseColor, 8),
            ];

            for (let i = 0; i < 3; i++) {
                const angle = (i / 3) * Math.PI * 2 - Math.PI / 2 + fl * (i - 1) * 0.3;
                const spread = 0.5 + open * 0.5;
                const pw = s * 0.3 * spread;
                const ph = s * 0.7;

                ctx.save();
                ctx.rotate(angle - Math.PI / 2);
                ctx.translate(0, -s * 0.05);

                this.drawTulipPetal(ctx, pw, ph, innerColors[i], false);

                ctx.restore();
            }

            // Center glow
            const cg = ctx.createRadialGradient(0, -s * 0.05, 0, 0, -s * 0.05, s * 0.25);
            cg.addColorStop(0, 'rgba(255, 240, 180, 0.7)');
            cg.addColorStop(0.5, 'rgba(255, 220, 100, 0.3)');
            cg.addColorStop(1, 'rgba(255, 220, 100, 0)');
            ctx.fillStyle = cg;
            ctx.beginPath();
            ctx.arc(0, -s * 0.05, s * 0.25, 0, Math.PI * 2);
            ctx.fill();

            // Stamens
            for (let i = 0; i < 6; i++) {
                const a = (i / 6) * Math.PI * 2;
                const len = s * 0.12;
                ctx.save();
                ctx.rotate(a);
                ctx.beginPath();
                ctx.moveTo(0, -s * 0.05);
                ctx.lineTo(0, -s * 0.05 - len);
                ctx.strokeStyle = 'rgba(255, 220, 100, 0.5)';
                ctx.lineWidth = 1.2;
                ctx.stroke();
                // Anther
                ctx.beginPath();
                ctx.arc(0, -s * 0.05 - len, 2, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(200, 150, 50, 0.6)';
                ctx.fill();
                ctx.restore();
            }
        }

        drawTulipPetal(ctx, w, h, color, isOuter) {
            const tipPoint = 0.85 + Math.random() * 0.05;

            // Petal shadow
            if (isOuter) {
                ctx.beginPath();
                ctx.moveTo(-2, 2);
                ctx.quadraticCurveTo(-w * 0.7 + 2, -h * 0.3 + 2, -w * 0.2 + 2, -h * tipPoint + 2);
                ctx.quadraticCurveTo(0 + 2, -h + 2, w * 0.2 + 2, -h * tipPoint + 2);
                ctx.quadraticCurveTo(w * 0.7 + 2, -h * 0.3 + 2, 2, 2);
                ctx.fillStyle = 'rgba(0,0,0,0.15)';
                ctx.fill();
            }

            // Petal body
            ctx.beginPath();
            ctx.moveTo(0, 0);
            // Left side
            ctx.bezierCurveTo(
                -w * 0.4, -h * 0.15,
                -w * 0.85, -h * 0.4,
                -w * 0.55, -h * 0.7
            );
            ctx.bezierCurveTo(
                -w * 0.4, -h * 0.82,
                -w * 0.2, -h * 0.92,
                0, -h * tipPoint
            );
            // Right side
            ctx.bezierCurveTo(
                w * 0.2, -h * 0.92,
                w * 0.4, -h * 0.82,
                w * 0.55, -h * 0.7
            );
            ctx.bezierCurveTo(
                w * 0.85, -h * 0.4,
                w * 0.4, -h * 0.15,
                0, 0
            );

            // Gradient fill
            const pg = ctx.createLinearGradient(0, 0, 0, -h);
            pg.addColorStop(0, this.lighten(color, 15));
            pg.addColorStop(0.3, color);
            pg.addColorStop(0.7, this.darken(color, 10));
            pg.addColorStop(1, this.darken(color, 20));
            ctx.fillStyle = pg;
            ctx.fill();

            // Subtle stroke
            ctx.strokeStyle = `rgba(255,255,255,${isOuter ? 0.05 : 0.08})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();

            // Veins (thin lines)
            ctx.save();
            ctx.globalAlpha = 0.08;
            ctx.strokeStyle = this.darken(color, 30);
            ctx.lineWidth = 0.4;
            for (let i = -3; i <= 3; i++) {
                if (i === 0) continue;
                const vx = i * w * 0.08;
                ctx.beginPath();
                ctx.moveTo(vx * 0.1, -h * 0.05);
                ctx.quadraticCurveTo(vx * 0.5, -h * 0.4, vx * 0.8, -h * 0.7);
                ctx.stroke();
            }
            ctx.restore();

            // Highlight
            const hl = ctx.createRadialGradient(
                -w * 0.1, -h * 0.4, 0,
                -w * 0.1, -h * 0.4, w * 0.5
            );
            hl.addColorStop(0, 'rgba(255,255,255,0.12)');
            hl.addColorStop(1, 'rgba(255,255,255,0)');
            ctx.fillStyle = hl;
            ctx.beginPath();
            ctx.arc(-w * 0.1, -h * 0.4, w * 0.5, 0, Math.PI * 2);
            ctx.fill();

            ctx.closePath();
        }

        // ─── ORQUÍDEA (estilo Cattleya - compacta y natural) ─────
        drawOrchid(ctx) {
            const s = this.bloomSize;
            const open = this.bloomOpenness;
            const fl = this.petalFlutter;

            // ── Cáliz (base donde nacen los pétalos) ──
            ctx.save();
            ctx.beginPath();
            ctx.ellipse(0, s * 0.02, s * 0.08, s * 0.06, 0, 0, Math.PI * 2);
            const calGrad = ctx.createRadialGradient(0, s * 0.02, 0, 0, s * 0.02, s * 0.08);
            calGrad.addColorStop(0, '#5cc43a');
            calGrad.addColorStop(0.5, '#2d8a1e');
            calGrad.addColorStop(1, '#14520a');
            ctx.fillStyle = calGrad;
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, s * 0.05);
            ctx.lineTo(0, s * 0.11);
            ctx.strokeStyle = '#2d8a1e';
            ctx.lineWidth = 3;
            ctx.stroke();
            ctx.restore();

            // ── 3 sépalos: 1 arriba, 2 laterales ──
            // Sépalo dorsal (arriba)
            ctx.save();
            ctx.translate(0, -s * 0.2);
            ctx.rotate(-Math.PI / 2 + fl * 0.1);
            this.drawOrchidSepal(ctx, s * 0.38 * open, s * 0.5, this.darken(this.baseColor, 5));
            ctx.restore();

            // Sépalos laterales (apuntando a los lados, no abajo)
            for (let side = -1; side <= 1; side += 2) {
                ctx.save();
                ctx.translate(side * s * 0.35 * open, s * 0.1);
                ctx.rotate(side * 0.7 + fl * side * 0.05);
                this.drawOrchidSepal(ctx, s * 0.35 * open, s * 0.45, this.darken(this.baseColor, 10));
                ctx.restore();
            }

            // ── 2 pétalos anchos y redondeados ──
            for (let side = -1; side <= 1; side += 2) {
                ctx.save();
                ctx.translate(side * s * 0.32 * open, -s * 0.05);
                ctx.rotate(side * 0.15 + fl * side * 0.08);
                this.drawOrchidPetal(ctx, s * 0.48 * open, s * 0.38, this.lighten(this.baseColor, 25));
                ctx.restore();
            }

            // ── Centro (labelo pequeño + columna) ──
            ctx.save();

            // Labelo pequeño y compacto (no colgante)
            ctx.beginPath();
            ctx.ellipse(0, s * 0.08, s * 0.12 * open, s * 0.1, 0, 0, Math.PI * 2);
            const lipGrad = ctx.createRadialGradient(0, s * 0.06, 0, 0, s * 0.08, s * 0.12);
            lipGrad.addColorStop(0, this.lighten(this.baseColor, 40));
            lipGrad.addColorStop(0.6, this.baseColor);
            lipGrad.addColorStop(1, this.darken(this.baseColor, 15));
            ctx.fillStyle = lipGrad;
            ctx.shadowColor = this.baseColor;
            ctx.shadowBlur = 6;
            ctx.fill();
            ctx.shadowBlur = 0;

            // Cresta amarilla en el labelo
            ctx.beginPath();
            ctx.ellipse(0, s * 0.06, s * 0.05, s * 0.04, 0, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(255, 220, 80, 0.6)';
            ctx.fill();

            // Columna central
            ctx.beginPath();
            ctx.ellipse(0, -s * 0.03, s * 0.05, s * 0.07, 0, 0, Math.PI * 2);
            const colGrad = ctx.createRadialGradient(0, -s * 0.02, 0, 0, 0, s * 0.07);
            colGrad.addColorStop(0, '#fffbe6');
            colGrad.addColorStop(0.5, '#f5e6b8');
            colGrad.addColorStop(1, '#d4c490');
            ctx.fillStyle = colGrad;
            ctx.fill();

            // Polinia (puntos amarillos)
            ctx.fillStyle = '#ffd700';
            ctx.beginPath();
            ctx.arc(0, -s * 0.04, s * 0.018, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffaa00';
            ctx.beginPath();
            ctx.arc(-s * 0.018, -s * 0.035, s * 0.012, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(s * 0.018, -s * 0.035, s * 0.012, 0, Math.PI * 2);
            ctx.fill();

            ctx.restore();

            // ── Spots ──
            this.drawOrchidSpots(ctx, s, open);
        }

        drawOrchidSepal(ctx, w, h, color) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-w * 0.3, -h * 0.2, -w * 0.6, -h * 0.5, -w * 0.4, -h * 0.85);
            ctx.bezierCurveTo(-w * 0.25, -h * 0.95, -w * 0.1, -h, 0, -h);
            ctx.bezierCurveTo(w * 0.1, -h, w * 0.25, -h * 0.95, w * 0.4, -h * 0.85);
            ctx.bezierCurveTo(w * 0.6, -h * 0.5, w * 0.3, -h * 0.2, 0, 0);

            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            const sg = ctx.createLinearGradient(0, 0, 0, -h);
            sg.addColorStop(0, this.lighten(color, 20));
            sg.addColorStop(0.5, color);
            sg.addColorStop(1, this.darken(color, 20));
            ctx.fillStyle = sg;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(255,255,255,0.06)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        drawOrchidPetal(ctx, w, h, color) {
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(-w * 0.2, -h * 0.15, -w * 0.7, -h * 0.35, -w * 0.75, -h * 0.5);
            ctx.bezierCurveTo(-w * 0.7, -h * 0.7, -w * 0.45, -h * 0.9, 0, -h);
            ctx.bezierCurveTo(w * 0.45, -h * 0.9, w * 0.7, -h * 0.7, w * 0.75, -h * 0.5);
            ctx.bezierCurveTo(w * 0.7, -h * 0.35, w * 0.2, -h * 0.15, 0, 0);

            ctx.shadowColor = color;
            ctx.shadowBlur = 10;
            const pg = ctx.createRadialGradient(0, -h * 0.3, 0, 0, -h * 0.3, w * 0.8);
            pg.addColorStop(0, this.lighten(color, 25));
            pg.addColorStop(0.4, color);
            pg.addColorStop(1, this.darken(color, 15));
            ctx.fillStyle = pg;
            ctx.fill();
            ctx.shadowBlur = 0;
            ctx.strokeStyle = `rgba(255,255,255,0.05)`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
        }

        // (drawOrchidLip removed - replaced by compact center in drawOrchid)

        drawOrchidSpots(ctx, s, open) {
            // Characteristic spots on orchid petals
            const spots = [
                { x: -s * 0.2, y: -s * 0.35, r: 3 },
                { x: s * 0.15, y: -s * 0.4, r: 2.5 },
                { x: -s * 0.1, y: -s * 0.5, r: 2 },
                { x: s * 0.25, y: -s * 0.25, r: 2 },
                { x: -s * 0.25, y: -s * 0.2, r: 1.5 },
            ];
            ctx.save();
            ctx.globalAlpha = 0.15;
            ctx.fillStyle = this.darken(this.baseColor, 40);
            for (const spot of spots) {
                ctx.beginPath();
                ctx.arc(spot.x, spot.y - s * 0.05, spot.r, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }

        // ─── Color helpers ────────────────────────────────────────
        lighten(color, percent) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = Math.min(255, (num >> 16) + amt);
            const G = Math.min(255, ((num >> 8) & 0x00FF) + amt);
            const B = Math.min(255, (num & 0x0000FF) + amt);
            return `rgb(${R},${G},${B})`;
        }

        darken(color, percent) {
            const num = parseInt(color.replace('#', ''), 16);
            const amt = Math.round(2.55 * percent);
            const R = Math.max(0, (num >> 16) - amt);
            const G = Math.max(0, ((num >> 8) & 0x00FF) - amt);
            const B = Math.max(0, (num & 0x0000FF) - amt);
            return `rgb(${R},${G},${B})`;
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── BACKGROUND FLOWERS (small) ───────────────────────────────
    // ═══════════════════════════════════════════════════════════════

    class BgFlower {
        constructor(x, y, opts = {}) {
            this.x = x;
            this.y = y;
            this.stemHeight = opts.stemHeight || 60 + Math.random() * 100;
            this.stemWidth = 2 + Math.random() * 2;
            this.bloomSize = opts.bloomSize || 18 + Math.random() * 20;
            this.color = opts.color || '#2d8a1e';
            this.petalColor = opts.petalColor || this.randomPetalColor();
            this.phase = Math.random() * Math.PI * 2;
            this.speed = 0.3 + Math.random() * 0.5;
            this.swayAmplitude = 2 + Math.random() * 3;
            this.bloomOpenness = 0.5 + Math.random() * 0.5;
            this.targetOpenness = 0.8;
            this.leafSize = 0.4 + Math.random() * 0.4;
            this.alive = true;
            this.age = 0;
            this.maxAge = 5000 + Math.random() * 5000;
            this.birthAnim = 1;
            this.type = flowerType;
        }

        randomPetalColor() {
            const hues = [330, 340, 350, 300, 320, 310];
            const h = hues[Math.floor(Math.random() * hues.length)];
            return `hsl(${h}, 80%, ${60 + Math.random() * 20}%)`;
        }

        update(energy, dt) {
            this.age += dt;
            if (this.age > this.maxAge) { this.alive = false; return; }

            const bass = energy ? energy.bass : 0;
            const mid = energy ? energy.mid : 0;

            this.phase += this.speed * dt * 0.001 * (1 + bass * 2);
            this.swayAmplitude = 2 + bass * 8;
            this.targetOpenness = 0.4 + bass * 0.5 + mid * 0.3;
            if (energy && energy.beat) this.targetOpenness = 1;
            this.bloomOpenness += (this.targetOpenness - this.bloomOpenness) * 0.05;
        }

        draw(ctx) {
            if (!this.alive) return;

            const sway = Math.sin(this.phase) * this.swayAmplitude;
            const stemEndX = this.x + sway;
            const stemEndY = this.y - this.stemHeight;

            ctx.save();

            // Stem
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.quadraticCurveTo(this.x + sway * 0.5, this.y - this.stemHeight * 0.5, stemEndX, stemEndY);
            ctx.strokeStyle = this.color;
            ctx.lineWidth = this.stemWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Small leaves
            for (let side = -1; side <= 1; side += 2) {
                const lx = this.x + sway * 0.3 + side * 5;
                const ly = this.y - this.stemHeight * 0.55;
                ctx.beginPath();
                ctx.ellipse(lx + side * 8, ly, 8, 3, side * 0.3, 0, Math.PI * 2);
                ctx.fillStyle = this.color;
                ctx.globalAlpha = 0.5;
                ctx.fill();
                ctx.globalAlpha = 1;
            }

            // Simple bloom
            const size = this.bloomSize * (0.6 + this.bloomOpenness * 0.4);
            ctx.translate(stemEndX, stemEndY);

            if (this.type === 'tulip') {
                for (let i = 0; i < 3; i++) {
                    const a = (i / 3) * Math.PI * 2 - Math.PI / 2;
                    ctx.save();
                    ctx.rotate(a);
                    ctx.beginPath();
                    ctx.ellipse(0, -size * 0.3, size * 0.2, size * 0.4, 0, 0, Math.PI * 2);
                    ctx.fillStyle = this.petalColor;
                    ctx.globalAlpha = 0.7;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.restore();
                }
            } else {
                for (let i = 0; i < 5; i++) {
                    const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
                    ctx.save();
                    ctx.rotate(a);
                    ctx.beginPath();
                    ctx.ellipse(0, -size * 0.2, size * 0.2, size * 0.35, 0, 0, Math.PI * 2);
                    ctx.fillStyle = this.petalColor;
                    ctx.globalAlpha = 0.7;
                    ctx.fill();
                    ctx.globalAlpha = 1;
                    ctx.restore();
                }
            }

            ctx.restore();
        }
    }

    // ─── Particles ────────────────────────────────────────────────
    class Particle {
        constructor(x, y, color) {
            this.x = x;
            this.y = y;
            this.vx = (Math.random() - 0.5) * 6;
            this.vy = -Math.random() * 6 - 2;
            this.life = 1;
            this.decay = 0.006 + Math.random() * 0.012;
            this.size = 2 + Math.random() * 4;
            this.color = color || '#ff7cbc';
            this.type = ['circle', 'heart', 'sparkle'][Math.floor(Math.random() * 3)];
            this.rot = Math.random() * Math.PI * 2;
            this.rotSpeed = (Math.random() - 0.5) * 0.15;
        }

        update() {
            this.x += this.vx;
            this.y += this.vy;
            this.vy += this.type === 'heart' ? 0.015 : 0.05;
            this.vx *= 0.98;
            this.life -= this.decay;
            this.rot += this.rotSpeed;
            this.size *= this.type === 'heart' ? 0.9995 : 0.998;
        }

        draw(ctx) {
            if (this.life <= 0) return;
            ctx.save();
            ctx.globalAlpha = this.life;
            ctx.translate(this.x, this.y);
            ctx.rotate(this.rot);

            if (this.type === 'heart') {
                const s = this.size;
                ctx.fillStyle = this.color || '#ff7cbc';
                ctx.shadowColor = ctx.fillStyle;
                ctx.shadowBlur = 20;
                ctx.beginPath();
                ctx.moveTo(0, s * 0.4);
                ctx.bezierCurveTo(-s * 0.6, -s * 0.2, -s * 0.8, s * 0.4, 0, s * 0.9);
                ctx.bezierCurveTo(s * 0.8, s * 0.4, s * 0.6, -s * 0.2, 0, s * 0.4);
                ctx.fill();
            } else if (this.type === 'sparkle') {
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 10;
                for (let i = 0; i < 4; i++) {
                    const a = (i / 4) * Math.PI * 2;
                    ctx.beginPath();
                    ctx.arc(Math.cos(a) * this.size * 1.5, Math.sin(a) * this.size * 1.5, this.size * 0.4, 0, Math.PI * 2);
                    ctx.fill();
                }
                ctx.beginPath();
                ctx.arc(0, 0, this.size * 0.5, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillStyle = this.color;
                ctx.shadowColor = this.color;
                ctx.shadowBlur = 8;
                ctx.beginPath();
                ctx.arc(0, 0, this.size * this.life, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.restore();
        }
    }

    function spawnBeatParticles(x, y) {
        const colors = [flowerColor, '#ff9ec4', '#ffb8d8', '#fff', '#ffd700'];
        for (let i = 0; i < 12; i++) {
            const c = colors[Math.floor(Math.random() * colors.length)];
            particles.push(new Particle(
                x + (Math.random() - 0.5) * 40,
                y - 20 + (Math.random() - 0.5) * 20,
                c
            ));
        }
    }

    function spawnAmbientParticles() {
        if (particles.length > 40) return;
        if (Math.random() > 0.03) return;
        const x = Math.random() * canvas.width;
        const y = canvas.height - 30 - Math.random() * 80;
        particles.push(new Particle(x, y, flowerColor));
    }

    // ─── Background ───────────────────────────────────────────────
    function initStars() {
        stars = [];
        for (let i = 0; i < 100; i++) {
            stars.push({
                x: Math.random() * canvas.width,
                y: Math.random() * canvas.height * 0.65,
                r: 0.3 + Math.random() * 1.5,
                a: 0.2 + Math.random() * 0.6,
                speed: 0.1 + Math.random() * 0.4,
                phase: Math.random() * Math.PI * 2,
            });
        }
    }

    function drawBackground(time) {
        const en = energy || { bass: 0, mid: 0, beat: false };
        const bass = en.bass || 0;
        const mid = en.mid || 0;
        const beat = en.beat || false;

        // ── Cielo nocturno profundo ──
        const grad = ctx.createLinearGradient(0, 0, 0, canvas.height);
        grad.addColorStop(0, '#050510');
        grad.addColorStop(0.3, '#080818');
        grad.addColorStop(0.7, '#0a0a1a');
        grad.addColorStop(1, '#0a0a0a');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ── AURORA BOREAL (brisa de luz con gradiente horizontal) ──
        // Columnas verticales superpuestas con gradiente radial que se desvanecen
        // en los bordes izquierdo y derecho para parecer una brisa
        const layers = [
            { r: 37, g: 141, b: 25, y: 0.10, amp: 75, freq: 0.0018, spd: 0.00018, h: 140, w: 50, a: 0.12 },
            { r: 60, g: 180, b: 40, y: 0.22, amp: 60, freq: 0.0025, spd: 0.00025, h: 110, w: 40, a: 0.09 },
            { r: 255, g: 124, b: 188, y: 0.33, amp: 70, freq: 0.0022, spd: 0.00022, h: 130, w: 45, a: 0.11 },
            { r: 255, g: 150, b: 200, y: 0.47, amp: 50, freq: 0.003, spd: 0.0003, h: 95, w: 35, a: 0.07 },
            { r: 37, g: 141, b: 25, y: 0.55, amp: 45, freq: 0.002, spd: 0.00015, h: 80, w: 30, a: 0.06 },
        ];

        for (const layer of layers) {
            const amp = layer.amp + bass * 55;
            const h = layer.h + bass * 35;
            const w = layer.w + bass * 15;
            const baseY = canvas.height * layer.y;
            const baseAlpha = Math.min(layer.a + bass * 0.06 + (beat ? 0.04 : 0), 0.22);
            const driftX = time * layer.spd;

            ctx.save();
            const step = Math.max(8, Math.round(w * 0.5));

            if (!isFinite(canvas.width) || !isFinite(canvas.height)) continue;
            for (let x = -step; x <= canvas.width + step; x += step) {
                // Horizontal fade: edges fade out
                const edgeDist = Math.min(x, canvas.width - x);
                const fadeEdge = Math.min(1, edgeDist / (Math.max(canvas.width, 1) * 0.15));
                if (fadeEdge <= 0) continue;

                const wave = Math.sin(x * layer.freq + driftX) * amp
                    + Math.sin(x * layer.freq * 2.5 + driftX * 0.5) * amp * 0.15;
                const cy = baseY + wave;
                const alpha = baseAlpha * fadeEdge;

                if (!isFinite(cy) || !isFinite(w) || !isFinite(h)) continue;

                // Each column is a vertical glow with radial gradient
                const grad = ctx.createRadialGradient(x, cy, 0, x, cy, w);
                grad.addColorStop(0, `rgba(${layer.r}, ${layer.g}, ${layer.b}, ${alpha * 0.5})`);
                grad.addColorStop(0.3, `rgba(${layer.r}, ${layer.g}, ${layer.b}, ${alpha * 0.3})`);
                grad.addColorStop(0.6, `rgba(${layer.r}, ${layer.g}, ${layer.b}, ${alpha * 0.12})`);
                grad.addColorStop(1, `rgba(${layer.r}, ${layer.g}, ${layer.b}, 0)`);

                ctx.fillStyle = grad;
                ctx.shadowColor = `rgba(${layer.r}, ${layer.g}, ${layer.b}, ${alpha * 0.3})`;
                ctx.shadowBlur = 30 + bass * 15;
                ctx.beginPath();
                ctx.ellipse(x, cy, w * 0.8, h * 0.4, 0, 0, Math.PI * 2);
                ctx.fill();
            }

            ctx.restore();
        }

        // ── Brillo desde abajo ──
        const groundGlow = ctx.createRadialGradient(
            canvas.width / 2, canvas.height, 0,
            canvas.width / 2, canvas.height,
            canvas.height * 0.5 + bass * 60
        );
        groundGlow.addColorStop(0, `rgba(37, 141, 25, ${0.04 + bass * 0.1})`);
        groundGlow.addColorStop(0.4, `rgba(255, 124, 188, ${bass * 0.04})`);
        groundGlow.addColorStop(1, 'rgba(0, 0, 0, 0)');
        ctx.fillStyle = groundGlow;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // ── Estrellas ──
        for (const star of stars) {
            const beatPulse = beat ? 0.2 : 0;
            const twinkle = 0.3 + Math.sin(time * star.speed + star.phase) * 0.3 + beatPulse;
            ctx.fillStyle = `rgba(255, 255, 255, ${star.a * twinkle})`;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.r + (beat ? 0.2 : 0), 0, Math.PI * 2);
            ctx.fill();
        }

        // ── Luna (esquina superior derecha) ──
        const moonX = canvas.width * 0.85;
        const moonY = canvas.height * 0.12;
        const moonR = Math.min(canvas.width, canvas.height) * 0.035;

        // Halos exteriores de luz (3 capas para un resplandor más visible)
        for (let i = 0; i < 3; i++) {
            const radius = moonR * (2 + i * 1.5);
            const alpha = 0.08 - i * 0.025;
            const glow = ctx.createRadialGradient(moonX, moonY, moonR * 0.5, moonX, moonY, radius);
            glow.addColorStop(0, `rgba(255, 245, 220, ${alpha})`);
            glow.addColorStop(0.5, `rgba(255, 245, 220, ${alpha * 0.5})`);
            glow.addColorStop(1, 'rgba(255, 245, 220, 0)');
            ctx.fillStyle = glow;
            ctx.beginPath();
            ctx.arc(moonX, moonY, radius, 0, Math.PI * 2);
            ctx.fill();
        }

        // Rayo de luz hacia abajo (iluminación suave sobre el paisaje)
        const lightRay = ctx.createRadialGradient(moonX, moonY, 0, moonX, moonY, moonR * 8);
        lightRay.addColorStop(0, 'rgba(255, 245, 220, 0.04)');
        lightRay.addColorStop(0.3, 'rgba(255, 245, 220, 0.02)');
        lightRay.addColorStop(1, 'rgba(255, 245, 220, 0)');
        ctx.fillStyle = lightRay;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR * 8, 0, Math.PI * 2);
        ctx.fill();

        // Cuerpo de la luna (llena)
        ctx.save();
        ctx.shadowColor = 'rgba(255, 245, 220, 0.5)';
        ctx.shadowBlur = moonR * 0.8;
        ctx.beginPath();
        ctx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
        const moonBody = ctx.createRadialGradient(moonX - moonR * 0.2, moonY - moonR * 0.2, 0, moonX, moonY, moonR);
        moonBody.addColorStop(0, 'rgba(255, 250, 240, 0.7)');
        moonBody.addColorStop(0.6, 'rgba(255, 245, 220, 0.5)');
        moonBody.addColorStop(1, 'rgba(240, 230, 200, 0.35)');
        ctx.fillStyle = moonBody;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.restore();

        // ── Línea del suelo ──
        ctx.beginPath();
        ctx.moveTo(0, canvas.height);
        for (let x = 0; x <= canvas.width; x += 3) {
            const sway = Math.sin(x * 0.03 + time * 0.001) * (1 + bass * 6)
                + Math.sin(x * 0.05 + time * 0.002) * bass * 3;
            ctx.lineTo(x, canvas.height - sway);
        }
        ctx.strokeStyle = `rgba(37, 141, 25, ${0.05 + bass * 0.1 + (beat ? 0.08 : 0)})`;
        ctx.lineWidth = 2 + bass * 1.5;
        ctx.stroke();

        // ── Pasto ──
        ctx.strokeStyle = `rgba(37, 141, 25, ${0.02 + bass * 0.06})`;
        ctx.lineWidth = 1.5;
        for (let i = 0; i < 50; i++) {
            const gx = (i / 50) * canvas.width + Math.sin(i * 3 + time * 0.0005) * 12;
            const gh = 6 + Math.sin(i * 2 + time * 0.001) * 3 + bass * 10;
            const swayX = Math.sin(time * 0.002 + i) * (3 + bass * 6);
            ctx.beginPath();
            ctx.moveTo(gx, canvas.height);
            ctx.quadraticCurveTo(gx + swayX * 0.5, canvas.height - gh * 0.6, gx + swayX, canvas.height - gh);
            ctx.stroke();
        }
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── AUDIO SYSTEM ─────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════

    function initAudio() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        analyser = audioCtx.createAnalyser();
        analyser.fftSize = FFT_SIZE;
        gainNode = audioCtx.createGain();
        gainNode.gain.value = volumeSlider.value;
    }

    function connectAudio(src) {
        initAudio();
        if (sourceNode) { sourceNode.disconnect(); }
        sourceNode = audioCtx.createMediaElementSource(src);
        sourceNode.connect(analyser);
        analyser.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        audioElement = src;
    }

    function getAudioEnergy() {
        if (!analyser) return null;
        const data = new Uint8Array(analyser.frequencyBinCount);
        analyser.getByteFrequencyData(data);
        const len = data.length;
        const bassRange = Math.floor(len * 0.1);
        const midRange = Math.floor(len * 0.4);
        let bassSum = 0, midSum = 0, trebleSum = 0;
        for (let i = 1; i < bassRange; i++) bassSum += data[i];
        for (let i = bassRange; i < midRange; i++) midSum += data[i];
        for (let i = midRange; i < len; i++) trebleSum += data[i];
        const bass = bassSum / (bassRange * 255);
        const mid = midSum / ((midRange - bassRange) * 255);
        const treble = trebleSum / ((len - midRange) * 255);

        // Beat detection
        if (audioData === null) audioData = new Float32Array(43);
        let avg = 0;
        for (let i = 0; i < audioData.length - 1; i++) {
            audioData[i] = audioData[i + 1];
            avg += audioData[i];
        }
        audioData[audioData.length - 1] = bass;
        avg /= audioData.length;
        const instantEnergy = bass - avg;
        beatDetected = (instantEnergy > BEAT_THRESHOLD * (1 - avg + BEAT_MIN_ENERGY));
        if (beatDetected) beatTimer = 12;

        return { bass, mid, treble, beat: beatDetected };
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── MUSIC PLAYER ─────────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════

    function createAudioElement(src) {
        const audio = new Audio(src);
        audio.crossOrigin = 'anonymous';
        audio.loop = false;
        audio.addEventListener('ended', onTrackEnd);
        audio.addEventListener('play', () => {
            isPlaying = true;
            playBtn.textContent = '⏸';
            playBtn.classList.add('playing');
        });
        audio.addEventListener('pause', () => {
            isPlaying = false;
            playBtn.textContent = '▶';
            playBtn.classList.remove('playing');
        });
        audio.addEventListener('error', () => { beatIndicator.textContent = '❌ Error al cargar audio'; });
        audio.addEventListener('timeupdate', updateProgress);
        audio.addEventListener('loadedmetadata', () => {
            timeTotal.textContent = formatTime(audio.duration);
        });
        return audio;
    }

    function loadTrack(src, label) {
        stopAll();
        const audio = createAudioElement(src);
        trackName.textContent = label || src.split('/').pop() || 'Canción';
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        connectAudio(audio);
        audio.play().catch(() => {});
        musicSelect.value = '';
        isYouTube = false;
    }

    function onTrackEnd() {
        isPlaying = false;
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        beatIndicator.textContent = '🎵 Canción terminada';
        playNext();
    }

    function playNext() {
        if (currentTrackIndex < playlist.length - 1) {
            currentTrackIndex++;
            playPlaylistItem(currentTrackIndex);
        }
    }

    function playPrev() {
        if (currentTrackIndex > 0) {
            currentTrackIndex--;
            playPlaylistItem(currentTrackIndex);
        }
    }

    function playPlaylistItem(idx) {
        if (idx < 0 || idx >= playlist.length) return;
        currentTrackIndex = idx;
        const item = playlist[idx];
        if (item.type === 'youtube') {
            playYouTube(item.videoId, item.name);
        } else if (item.type === 'file') {
            loadAudioFromDB(item.key).then(blob => {
                if (blob) {
                    if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
                    currentBlobUrl = URL.createObjectURL(blob);
                    loadTrack(currentBlobUrl, item.name);
                }
            });
        } else if (item.type === 'url') {
            loadTrack(item.src, item.name);
        }
    }

    function formatTime(secs) {
        if (!secs || isNaN(secs)) return '0:00';
        const m = Math.floor(secs / 60);
        const s = Math.floor(secs % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function updateProgress() {
        if (!audioElement || isNaN(audioElement.duration)) return;
        const pct = (audioElement.currentTime / audioElement.duration) * 100;
        progressFill.style.width = pct + '%';
        progressThumb.style.left = pct + '%';
        timeCurrent.textContent = formatTime(audioElement.currentTime);
    }

    function seekAudio(pct) {
        if (!audioElement || isNaN(audioElement.duration)) return;
        audioElement.currentTime = (pct / 100) * audioElement.duration;
    }

    // Music library (IndexedDB)
    function openDB() {
        return new Promise((resolve, reject) => {
            const req = indexedDB.open('FloresMusicDB', 1);
            req.onerror = () => reject(req.error);
            req.onsuccess = () => resolve(req.result);
            req.onupgradeneeded = (e) => {
                const db = e.target.result;
                if (!db.objectStoreNames.contains('audio')) db.createObjectStore('audio');
            };
        });
    }

    function saveAudioToDB(key, blob) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('audio', 'readwrite');
            const store = tx.objectStore('audio');
            store.put(blob, key);
            tx.oncomplete = () => resolve();
            tx.onerror = () => reject(tx.error);
        }));
    }

    function loadAudioFromDB(key) {
        return openDB().then(db => new Promise((resolve, reject) => {
            const tx = db.transaction('audio', 'readonly');
            const store = tx.objectStore('audio');
            const req = store.get(key);
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        }));
    }

    // ─── YouTube ──────────────────────────────────────────────────
    function extractYouTubeId(url) {
        const p = [
            /(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})/,
            /music\.youtube\.com\/watch\?v=([a-zA-Z0-9_-]{11})/,
            /youtube\.com\/watch\?.*v=([a-zA-Z0-9_-]{11})/,
        ];
        for (const r of p) { const m = url.match(r); if (m) return m[1]; }
        return null;
    }

    function ensureYouTubeAPI(cb) {
        if (window.YT && window.YT.Player) { cb(); return; }
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () { if (prev) prev(); cb(); };
        if (!document.querySelector('script[src*="youtube.com/iframe_api"]')) {
            const s = document.createElement('script');
            s.src = 'https://www.youtube.com/iframe_api';
            document.head.appendChild(s);
        }
    }

    function createYTPlayer(videoId, onReady) {
        let c = document.getElementById('yt-player-container');
        if (!c) {
            c = document.createElement('div');
            c.id = 'yt-player-container';
            c.style.cssText = 'width:0;height:0;overflow:hidden;position:absolute';
            document.body.appendChild(c);
        }
        c.innerHTML = '<div id="yt-player"></div>';

        ensureYouTubeAPI(function () {
            if (ytPlayer) try { ytPlayer.destroy(); } catch (e) {}
            ytPlayer = new YT.Player('yt-player', {
                height: 0, width: 0,
                videoId: videoId,
                playerVars: {
                    autoplay: 0,
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    modestbranding: 1,
                    rel: 0,
                    origin: window.location.origin,
                    widget_referrer: window.location.origin
                },
                events: {
                    onReady: onReady,
                    onStateChange: function (e) {
                        if (e.data === YT.PlayerState.PLAYING) {
                            isPlaying = true;
                            isYouTube = true;
                            playBtn.textContent = '⏸';
                            playBtn.classList.add('playing');
                            startYTBeatSim();
                            startYTProgress();
                            const dur = ytPlayer.getDuration();
                            timeTotal.textContent = formatTime(dur);
                        } else if (e.data === YT.PlayerState.PAUSED) {
                            isPlaying = false;
                            playBtn.textContent = '▶';
                            playBtn.classList.remove('playing');
                            stopYTBeatSim();
                            stopYTProgress();
                        } else if (e.data === YT.PlayerState.ENDED) {
                            isPlaying = false;
                            playBtn.textContent = '▶';
                            playBtn.classList.remove('playing');
                            beatIndicator.textContent = '🎵 Canción terminada';
                            stopYTBeatSim();
                            stopYTProgress();
                            onTrackEnd();
                        } else if (e.data === YT.PlayerState.CUED) {
                            const dur = ytPlayer.getDuration();
                            timeTotal.textContent = formatTime(dur);
                        }
                    }
                }
            });
        });
    }

    function startYTBeatSim() {
        stopYTBeatSim();
        let counter = 0;
        ytBeatInterval = setInterval(function () {
            counter++;
            const vol = ytPlayer ? ytPlayer.getVolume() : 50;
            const isBeat = counter % 2 === 0 || (counter % 3 === 0 && Math.random() > 0.5);
            if (isBeat) {
                const fakeEnergy = { bass: 0.3 + Math.random() * 0.4, mid: 0.2 + Math.random() * 0.3, treble: 0.1 + Math.random() * 0.2, beat: true };
                energy = fakeEnergy;
                beatDetected = true;
                beatTimer = 10;
                if (mainFlowers.length >= 2) {
                    const i = counter % 2;
                    // spawnBeatParticles removed (lag)
                }
            }
        }, 200);
    }

    function stopYTBeatSim() {
        if (ytBeatInterval) { clearInterval(ytBeatInterval); ytBeatInterval = null; }
    }

    function startYTProgress() {
        stopYTProgress();
        ytProgressInterval = setInterval(function () {
            if (ytPlayer && ytPlayer.getCurrentTime) {
                try {
                    const ct = ytPlayer.getCurrentTime();
                    const dur = ytPlayer.getDuration();
                    if (dur > 0) {
                        const pct = (ct / dur) * 100;
                        progressFill.style.width = pct + '%';
                        progressThumb.style.left = pct + '%';
                        timeCurrent.textContent = formatTime(ct);
                    }
                } catch (e) {}
            }
        }, 200);
    }

    function stopYTProgress() {
        if (ytProgressInterval) { clearInterval(ytProgressInterval); ytProgressInterval = null; }
    }

    function playYouTube(videoId, name) {
        stopAll();
        trackName.textContent = '🎬 ' + name;
        beatIndicator.textContent = '⏳ Cargando YouTube...';
        isYouTube = true;
        createYTPlayer(videoId, function () {
            try {
                const data = ytPlayer.getVideoData();
                if (data && data.title) trackName.textContent = '🎬 ' + data.title;
            } catch (e) {}
            ytPlayer.playVideo();
            beatIndicator.textContent = '💓 Reproduciendo YouTube';
        });
    }

    function seekYT(pct) {
        if (ytPlayer && ytPlayer.seekTo) {
            const dur = ytPlayer.getDuration();
            ytPlayer.seekTo((pct / 100) * dur);
        }
    }

    // ─── Demo mode ────────────────────────────────────────────────
    function startDemoMode() {
        stopAll();
        initAudio();
        if (audioCtx.state === 'suspended') audioCtx.resume();
        isDemoMode = true;
        let beatCount = 0;
        trackName.textContent = '🎵 Modo demostración';
        beatIndicator.textContent = '💓 Demostración activa';

        // Generate synthetic beat energy
        demoInterval = setInterval(() => {
            beatCount++;
            const bass = 0.3 + Math.sin(beatCount * 0.5) * 0.3 + Math.random() * 0.2;
            const mid = 0.2 + Math.cos(beatCount * 0.3) * 0.2 + Math.random() * 0.15;
            const treble = 0.1 + Math.sin(beatCount * 0.7) * 0.15 + Math.random() * 0.1;
            const beat = beatCount % 4 === 0 || beatCount % 8 === 6;
            energy = { bass, mid, treble, beat };
            beatDetected = beat;
            if (beat) {
                beatTimer = 10;
                if (mainFlowers.length >= 2) {
                    const i = beatCount % 2;
                    // spawnBeatParticles removed (lag)
                }
            }
        }, 150);

        isPlaying = true;
        playBtn.textContent = '⏸';
        playBtn.classList.add('playing');
        musicSelect.value = '';
        isYouTube = false;
    }

    function stopDemoMode() {
        isDemoMode = false;
        if (demoInterval) { clearInterval(demoInterval); demoInterval = null; }
    }

    function destroyYTPlayer() {
        stopYTBeatSim();
        stopYTProgress();
        if (ytPlayer) { try { ytPlayer.destroy(); } catch (e) {} ytPlayer = null; }
        isYouTube = false;
    }

    function stopAll() {
        stopDemoMode();
        destroyYTPlayer();
        if (audioElement) { audioElement.pause(); audioElement.src = ''; audioElement = null; }
    }

    // ═══════════════════════════════════════════════════════════════
    // ─── EVENT HANDLERS ───────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════

    // Play / Pause
    playBtn.addEventListener('click', () => {
        if (ytPlayer && isYouTube) {
            if (isPlaying) { try { ytPlayer.pauseVideo(); } catch (e) {} }
            else { try { ytPlayer.playVideo(); } catch (e) {} }
            return;
        }
        if (isDemoMode) {
            if (isPlaying) { isPlaying = false; playBtn.textContent = '▶'; playBtn.classList.remove('playing');
                if (demoInterval) clearInterval(demoInterval); }
            else { startDemoMode(); }
            return;
        }
        if (!audioElement) { beatIndicator.textContent = '🎵 Selecciona o sube una canción primero'; return; }
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if (isPlaying) audioElement.pause();
        else audioElement.play().catch(() => {});
    });

    // Previous / Next
    prevBtn.addEventListener('click', playPrev);
    nextBtn.addEventListener('click', playNext);

    // Rewind / Forward (10s)
    rewindBtn.addEventListener('click', () => {
        if (ytPlayer && isYouTube) {
            const ct = Math.max(0, ytPlayer.getCurrentTime() - 10);
            ytPlayer.seekTo(ct);
        } else if (audioElement) {
            audioElement.currentTime = Math.max(0, audioElement.currentTime - 10);
        }
    });

    forwardBtn.addEventListener('click', () => {
        if (ytPlayer && isYouTube) {
            const dur = ytPlayer.getDuration();
            const ct = Math.min(dur, ytPlayer.getCurrentTime() + 10);
            ytPlayer.seekTo(ct);
        } else if (audioElement) {
            audioElement.currentTime = Math.min(audioElement.duration, audioElement.currentTime + 10);
        }
    });

    // Progress bar seek
    progressBar.addEventListener('mousedown', (e) => {
        isUserSeeking = true;
        const rect = progressBar.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, pct));
        progressFill.style.width = clamped + '%';
        progressThumb.style.left = clamped + '%';
    });

    document.addEventListener('mousemove', (e) => {
        if (!isUserSeeking) return;
        const rect = progressBar.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, pct));
        progressFill.style.width = clamped + '%';
        progressThumb.style.left = clamped + '%';
    });

    document.addEventListener('mouseup', (e) => {
        if (!isUserSeeking) return;
        isUserSeeking = false;
        const rect = progressBar.getBoundingClientRect();
        const pct = ((e.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, pct));
        if (ytPlayer && isYouTube) seekYT(clamped);
        else seekAudio(clamped);
    });

    // Touch support for progress bar
    progressBar.addEventListener('touchstart', (e) => {
        e.preventDefault();
        const touch = e.touches[0];
        const rect = progressBar.getBoundingClientRect();
        const pct = ((touch.clientX - rect.left) / rect.width) * 100;
        const clamped = Math.max(0, Math.min(100, pct));
        if (ytPlayer && isYouTube) seekYT(clamped);
        else seekAudio(clamped);
    });

    // Volume
    volumeSlider.addEventListener('input', () => {
        if (gainNode) gainNode.gain.value = volumeSlider.value;
    });

    // Music select
    musicSelect.addEventListener('change', () => {
        const val = musicSelect.value;
        if (!val) return;
        if (val === 'demo') { stopAll(); startDemoMode(); musicSelect.value = ''; return; }
        const entry = musicLibrary[val];
        if (!entry) return;
        playlist = Object.keys(musicLibrary).map(k => ({ key: k, ...musicLibrary[k] }));
        currentTrackIndex = playlist.findIndex(p => p.key === val);
        if (entry.type === 'youtube') playYouTube(entry.videoId, entry.name);
        else if (entry.type === 'file') playPlaylistItem(currentTrackIndex);
        else if (entry.type === 'url') loadTrack(entry.src, entry.name);
        musicSelect.value = '';
    });

    // File upload
    fileUpload.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const key = 'audio_' + Date.now();
        const reader = new FileReader();
        reader.onload = function (ev) {
            const blob = new Blob([ev.target.result], { type: file.type });
            saveAudioToDB(key, blob).then(() => {
                musicLibrary[key] = { name: file.name, type: 'file' };
                saveMusicLibrary();
                addMusicOption(key, file.name);
                playlist = Object.keys(musicLibrary).map(k => ({ key: k, ...musicLibrary[k] }));
                currentTrackIndex = playlist.findIndex(p => p.key === key);
                if (currentBlobUrl) URL.revokeObjectURL(currentBlobUrl);
                currentBlobUrl = URL.createObjectURL(blob);
                loadTrack(currentBlobUrl, file.name);
            });
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    });

    // URL/YouTube load
    btnLoadUrl.addEventListener('click', () => {
        const url = urlInput.value.trim();
        if (!url) return;
        const videoId = extractYouTubeId(url);
        if (videoId) {
            const key = 'yt_' + Date.now();
            const name = 'YouTube - ' + videoId;
            musicLibrary[key] = { name, type: 'youtube', videoId };
            saveMusicLibrary();
            addMusicOption(key, name);
            playlist = Object.keys(musicLibrary).map(k => ({ key: k, ...musicLibrary[k] }));
            currentTrackIndex = playlist.findIndex(p => p.key === key);
            playYouTube(videoId, name);
        } else {
            // Try as direct audio URL
            const key = 'url_' + Date.now();
            const name = url.split('/').pop() || 'Enlace';
            musicLibrary[key] = { name, type: 'url', src: url };
            saveMusicLibrary();
            addMusicOption(key, name);
            playlist = Object.keys(musicLibrary).map(k => ({ key: k, ...musicLibrary[k] }));
            currentTrackIndex = playlist.findIndex(p => p.key === key);
            loadTrack(url, name);
        }
        urlInput.value = '';
    });

    urlInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') btnLoadUrl.click();
    });

    // Source tabs
    document.querySelectorAll('.source-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.source-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            fileSource.style.display = tab.dataset.source === 'file' ? '' : 'none';
            urlSource.style.display = tab.dataset.source === 'url' ? '' : 'none';
        });
    });

    // Flower toggle
    flowerToggle.addEventListener('click', () => {
        flowerType = flowerType === 'tulip' ? 'orchid' : 'tulip';
        flowerIcon.textContent = flowerType === 'tulip' ? '🌷' : '🌺';
        mainFlowers.forEach(f => f.type = flowerType);
        bgFlowers.forEach(f => f.type = flowerType);
    });

    // Color picker
    colorPickerBtn.addEventListener('click', () => flowerColorInput.click());
    flowerColorInput.addEventListener('input', () => {
        flowerColor = flowerColorInput.value;
        colorDot.style.background = flowerColor;
        mainFlowers.forEach(f => {
            f.color = flowerColor;
            f.baseColor = flowerColor;
            f.lightColor = f.lighten(flowerColor, 35);
            f.darkColor = f.darken(flowerColor, 25);
            f.deepColor = f.darken(flowerColor, 40);
        });
    });

    // Logout (exit to welcome)
    function goToWelcome() {
        stopAll();
        if (audioElement) { audioElement.pause(); audioElement.src = ''; audioElement = null; }
        if (currentBlobUrl) { URL.revokeObjectURL(currentBlobUrl); currentBlobUrl = null; }
        if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
        if (frameId) { cancelAnimationFrame(frameId); frameId = null; }
        mainScreen.style.display = 'none';
        welcomeScreen.style.display = 'flex';
        welcomeScreen.classList.remove('fade-out');
        mainFlowers = [];
        bgFlowers = [];
        particles = [];
        stars = [];
        isPlaying = false;
        energy = null;
        playBtn.textContent = '▶';
        playBtn.classList.remove('playing');
        trackName.textContent = 'Sin música';
        beatIndicator.textContent = '🎵 Esperando música...';
        flowerCount.textContent = '0';
        musicSelect.value = '';
        progressFill.style.width = '0%';
        progressThumb.style.left = '0%';
        timeCurrent.textContent = '0:00';
        timeTotal.textContent = '0:00';
        playlist = [];
        currentTrackIndex = -1;
        // Reset login
        nameInput.value = '';
        nameInput.classList.remove('correct');
        enterBtn.disabled = true;
        loginError.textContent = '';
    }

    logoutBtn.addEventListener('click', goToWelcome);

    // Reset
    resetBtn.addEventListener('click', () => {
        bgFlowers = [];
        particles = [];
        if (mainFlowers.length) {
            createMainFlowers();
            mainFlowers.forEach(f => {
                f.color = flowerColor;
                f.baseColor = flowerColor;
                f.lightColor = f.lighten(flowerColor, 35);
                f.darkColor = f.darken(flowerColor, 25);
                f.deepColor = f.darken(flowerColor, 40);
            });
        }
        initStars();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ') { e.preventDefault(); playBtn.click(); }
        if (e.key === 'ArrowLeft') rewindBtn.click();
        if (e.key === 'ArrowRight') forwardBtn.click();
        if (e.key === 'ArrowUp') { volumeSlider.value = Math.min(1, parseFloat(volumeSlider.value) + 0.05); volumeSlider.dispatchEvent(new Event('input')); }
        if (e.key === 'ArrowDown') { volumeSlider.value = Math.max(0, parseFloat(volumeSlider.value) - 0.05); volumeSlider.dispatchEvent(new Event('input')); }
    });

    // ─── Music library (localStorage) ─────────────────────────────
    let musicLibrary = {};

    function loadMusicLibrary() {
        try {
            const stored = localStorage.getItem('floresMusicLib');
            if (stored) Object.assign(musicLibrary, JSON.parse(stored));
        } catch (e) {}
    }

    function saveMusicLibrary() {
        try { localStorage.setItem('floresMusicLib', JSON.stringify(musicLibrary)); } catch (e) {}
    }

    function addMusicOption(key, name) {
        const opt = document.createElement('option');
        opt.value = key;
        opt.dataset.lib = '1';
        opt.textContent = '🎵 ' + name;
        musicSelect.appendChild(opt);
    }

    function populateMusicSelect() {
        const opts = musicSelect.querySelectorAll('option');
        for (let i = opts.length - 1; i >= 0; i--) {
            if (opts[i].dataset.lib !== undefined) opts[i].remove();
        }
        for (const key in musicLibrary) addMusicOption(key, musicLibrary[key].name);
    }

    loadMusicLibrary();
    populateMusicSelect();

    // ═══════════════════════════════════════════════════════════════
    // ─── ANIMATION LOOP ───────────────────────────────────────────
    // ═══════════════════════════════════════════════════════════════

    function animate(time) {
        const dt = lastTime ? time - lastTime : 16;
        lastTime = time;

        // Get audio energy
        if (audioElement && !isYouTube && !isDemoMode) {
            energy = getAudioEnergy();
        } else if (!isDemoMode && !isYouTube) {
            energy = null;
        }

        // Beat indicator
        if (energy) {
            if (beatTimer > 0) beatTimer--;
            if (energy.beat || beatTimer > 8) {
                beatIndicator.textContent = '💓 ¡Al compás!';
                beatIndicator.classList.add('beat');
                if (energy.beat && mainFlowers.length >= 2) {
                    const i = Math.floor(Math.random() * 2);
                    // spawnBeatParticles removed (lag)
                }
            } else {
                beatIndicator.textContent = isYouTube ? '🎬 Reproduciendo YouTube...' : '🎵 Reproduciendo...';
                beatIndicator.classList.remove('beat');
            }
        } else if (!isDemoMode) {
            beatIndicator.textContent = '🎵 Esperando música...';
            beatIndicator.classList.remove('beat');
        }

        // Draw background
        drawBackground(time);

        // Update & draw main flowers
        for (const f of mainFlowers) {
            f.update(energy, dt);
            f.draw(ctx, time);
        }

        // Update bg flowers
        for (let i = bgFlowers.length - 1; i >= 0; i--) {
            const f = bgFlowers[i];
            f.update(energy, dt);
            f.draw(ctx);
            if (!f.alive) bgFlowers.splice(i, 1);
        }

        // Spawn new bg flowers
        if (bgFlowers.length < 5 && Math.random() < 0.01) {
            const x = Math.random() * canvas.width * 1.1 - canvas.width * 0.05;
            const y = canvas.height - 30 + Math.random() * 50;
            const bf = new BgFlower(x, y);
            bf.type = flowerType;
            bgFlowers.push(bf);
        }

        // Update & draw particles
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.update();
            p.draw(ctx);
            if (p.life <= 0) particles.splice(i, 1);
        }

        // Ambient particles
        spawnAmbientParticles();

        // ── Corazones 💚💗 desde abajo hacia arriba ──
        if (energy && (isPlaying || isDemoMode || isYouTube)) {
            heartSpawnTimer += dt;
            const interval = energy.beat ? 200 : 500;
            if (heartSpawnTimer > interval && particles.filter(p => p.type === 'heart').length < 25) {
                heartSpawnTimer = 0;
                const count = energy.beat ? 3 : 2;
                for (let h = 0; h < count; h++) {
                    const p = new Particle(
                        Math.random() * canvas.width * 0.8 + canvas.width * 0.1,
                        canvas.height + 10 + Math.random() * 40,
                        Math.random() > 0.5 ? '#258d19' : '#ff7cbc'
                    );
                    p.type = 'heart';
                    p.vx = (Math.random() - 0.5) * 1.5;
                    p.vy = -(2.5 + Math.random() * 3 + (energy ? (energy.bass || 0) * 3 : 0));
                    p.decay = 0.0015 + Math.random() * 0.002;
                    p.size = 8 + Math.random() * 6;
                    particles.push(p);
                }
            }

            // Detectar colisiones entre corazones
            const hearts = particles.filter(p => p.type === 'heart' && p.life > 0.3);
            for (let i = 0; i < hearts.length; i++) {
                for (let j = i + 1; j < hearts.length; j++) {
                    const a = hearts[i];
                    const b = hearts[j];
                    const dx = a.x - b.x;
                    const dy = a.y - b.y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < 28) {
                        // Chocar: ambos explotan
                        a.life = 0;
                        b.life = 0;
                        // Crear destello de partículas
                        for (let k = 0; k < 6; k++) {
                            const spark = new Particle(
                                (a.x + b.x) / 2 + (Math.random() - 0.5) * 15,
                                (a.y + b.y) / 2 + (Math.random() - 0.5) * 15,
                                Math.random() > 0.5 ? '#ffd700' : '#fff'
                            );
                            spark.type = 'sparkle';
                            spark.size = 2 + Math.random() * 3;
                            spark.vx = (Math.random() - 0.5) * 5;
                            spark.vy = (Math.random() - 0.5) * 5;
                            spark.decay = 0.015 + Math.random() * 0.02;
                            particles.push(spark);
                        }
                    }
                }
            }
        } else {
            heartSpawnTimer = 0;
        }

        // Update count
        flowerCount.textContent = bgFlowers.length + mainFlowers.length;

        frameId = requestAnimationFrame(animate);
    }

    // ─── Early audio context (needs user gesture) ─────────────────
    document.addEventListener('click', () => {
        if (!audioCtx) {
            try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) {}
        }
    }, { once: true });

    // ─── Start canvas ─────────────────────────────────────────────
    resizeCanvas();
    initStars();

})();
