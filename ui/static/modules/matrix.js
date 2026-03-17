/**
 * ============================================================
 *  AutoResearch — Matrix Rain Background
 * ============================================================
 *
 *  Individual floating characters (not column-based).
 *  Physics from original: 300 chars, speed 0.1-0.4%/frame,
 *  3-6 random glows every 50ms, 1.8rem font.
 * ============================================================
 */

;(function () {
    'use strict';

    const ALL_CHARS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=[]{}|;:,.<>?';
    const CHAR_COUNT = 300;
    const FONT_SIZE = 32; // px

    // Synthwave palette
    const DIM_COLOR = 'rgba(180,74,255,0.45)';
    const GLOW_COLORS = ['#b44aff', '#00e5ff', '#39ff14', '#ff00aa'];

    let canvas = null;
    let ctx = null;
    let chars = [];
    let animId = null;
    let flickerTimer = null;
    let activeSet = new Set();
    let paused = false;

    function createCanvas() {
        canvas = document.createElement('canvas');
        canvas.id = 'matrix-rain';
        canvas.style.cssText = 'position:fixed;inset:0;z-index:0;pointer-events:none;';
        document.body.prepend(canvas);
        ctx = canvas.getContext('2d');
        resize();
    }

    function resize() {
        if (!canvas) return;
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }

    function randomChar() {
        return ALL_CHARS[Math.floor(Math.random() * ALL_CHARS.length)];
    }

    function initChars() {
        chars = [];
        for (let i = 0; i < CHAR_COUNT; i++) {
            chars.push({
                char: randomChar(),
                x: Math.random(),  // 0..1 fraction of width
                y: Math.random(),  // 0..1 fraction of height
                speed: 0.00008 + Math.random() * 0.0003, // very slow fall
            });
        }
    }

    function updateActive() {
        activeSet = new Set();
        const num = 3 + Math.floor(Math.random() * 4); // 3-6 active
        for (let i = 0; i < num; i++) {
            activeSet.add(Math.floor(Math.random() * chars.length));
        }
    }

    function draw() {
        if (paused) {
            animId = requestAnimationFrame(draw);
            return;
        }

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        for (let i = 0; i < chars.length; i++) {
            const c = chars[i];
            const px = c.x * canvas.width;
            const py = c.y * canvas.height;
            const isActive = activeSet.has(i);

            ctx.font = isActive ? `bold ${FONT_SIZE}px 'VT323', monospace` : `${FONT_SIZE}px 'VT323', monospace`;

            if (isActive) {
                const color = GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)];
                ctx.fillStyle = color;
                ctx.shadowColor = color;
                ctx.shadowBlur = 12;
            } else {
                ctx.fillStyle = DIM_COLOR;
                ctx.shadowColor = 'transparent';
                ctx.shadowBlur = 0;
            }

            ctx.fillText(c.char, px, py);

            // reset shadow
            ctx.shadowColor = 'transparent';
            ctx.shadowBlur = 0;

            // move down
            c.y += c.speed;

            // wrap around
            if (c.y > 1.02) {
                c.y = -0.02;
                c.x = Math.random();
                c.char = randomChar();
            }
        }

        animId = requestAnimationFrame(draw);
    }

    window.MatrixRain = {
        init() {
            if (canvas) return;
            createCanvas();
            initChars();
            window.addEventListener('resize', resize);
            flickerTimer = setInterval(updateActive, 50);
            animId = requestAnimationFrame(draw);
        },
        destroy() {
            if (animId) { cancelAnimationFrame(animId); animId = null; }
            if (flickerTimer) { clearInterval(flickerTimer); flickerTimer = null; }
            window.removeEventListener('resize', resize);
            if (canvas && canvas.parentNode) canvas.parentNode.removeChild(canvas);
            canvas = null;
            ctx = null;
            chars = [];
        },
        pause() { paused = true; },
        resume() { paused = false; },
        isPaused() { return paused; },
        toggle() { paused = !paused; return paused; },
    };
})();
