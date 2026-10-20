// client.mjs — the whole wave-light mod.
//
// A lyric animation *mode* modelled on QQ Music's 「动感波光」: the page is a
// dark wash tinted by the current cover's dominant colour, with two large
// slowly-moving concentric ripple clusters on the left and right (canvas,
// additive blending). The active lyric line sits dead centre, enlarged; one
// keyword character from the line floats behind it as a huge dark watermark;
// a translation (foreign songs) is tucked into the bottom-left corner.
//
// It is a normal visualizer entry, so it only draws when the user selects this
// mode: every other mode is completely unaffected.
//
// Everything is public Folium surface:
//   - `folium.registries.visualizers` registers the mode and its settings.
//     `hostLayers.background: false` tells the host we paint the whole
//     background ourselves; `subtitles: false` because we draw the lyrics.
//   - The stage context provides lines, the lyric clock, the cover URL, theme
//     and display settings. The host remounts the mode when the song changes.
//
// Nothing here queries or mutates host DOM outside its own container.

export default function activate(folium) {
    const label = (zh, en) => ({ 'zh-CN': zh, en });

    const SETTINGS = [
        {
            key: 'waveSource', type: 'select', defaultValue: 'cover',
            label: label('波光配色', 'Wave colour'),
            description: label('背景与波纹、歌词的颜色来源；跟随封面会提取当前封面的主色', 'Where the background, ripples and lyrics take their colour; “cover” extracts the dominant colour of the artwork'),
            options: [
                { value: 'cover', label: label('跟随封面', 'Cover colour') },
                { value: 'theme', label: label('主题色', 'Theme colour') },
            ],
        },
        {
            key: 'brightness', type: 'number', defaultValue: 1, min: 0.3, max: 2, step: 0.05,
            label: label('波光亮度', 'Wave brightness'),
            description: label('波纹与光晕的整体强度', 'Overall intensity of the ripples and glow'),
        },
        {
            key: 'speed', type: 'number', defaultValue: 1, min: 0.2, max: 3, step: 0.1,
            label: label('流动速度', 'Flow speed'),
            description: label('波纹移动的整体快慢', 'How fast the ripples move'),
        },
        {
            key: 'keyword', type: 'boolean', defaultValue: true,
            label: label('关键字水印', 'Keyword watermark'),
            description: label('歌词背后的大字号关键字', 'A huge keyword from the current line behind the lyrics'),
        },
        {
            key: 'textScale', type: 'number', defaultValue: 1, min: 0.6, max: 1.8, step: 0.05,
            label: label('歌词字号', 'Lyric size'),
        },
    ];

    folium.registries.visualizers.register({
        id: 'wave-light',
        label: label('动感波光', 'Wave Light'),
        order: 431,
        // We paint the whole page (background + lyrics), so the host keeps
        // neither its background nor its subtitle layer.
        hostLayers: { background: false, subtitles: false },
        settings: SETTINGS,
        mount: (container, ctx) => mountWaveLight(folium, container, ctx),
    });
}

// ---------------------------------------------------------------------------
// The mode. Background is a DOM gradient tinted by the cover colour; the two
// ripple clusters are one canvas animated with requestAnimationFrame (additive
// blending, cheap); lyrics, keyword watermark and translation are DOM.
// ---------------------------------------------------------------------------

function mountWaveLight(folium, container, ctx) {
    container.style.cssText = 'position:absolute;inset:0;overflow:hidden;';

    const style = document.createElement('style');
    style.textContent = [
        '.wave-line-in { animation: wave-line-in 0.38s cubic-bezier(0.2, 0.8, 0.3, 1) both; }',
        '@keyframes wave-line-in {',
        '  from { opacity: 0; transform: scale(0.985); filter: blur(3px); }',
        '  to { opacity: 1; transform: none; filter: blur(0); }',
        '}',
        '.wave-keyword-in { animation: wave-keyword-in 0.7s cubic-bezier(0.2, 0.8, 0.3, 1) both; }',
        '@keyframes wave-keyword-in {',
        '  from { opacity: 0; transform: translate(-50%, -50%) scale(1.06); }',
        '  to { opacity: 1; transform: translate(-50%, -50%) scale(1); }',
        '}',
    ].join('\n');
    container.appendChild(style);

    // ---- background --------------------------------------------------------
    // A deep radial wash in the artwork's colour; the canvas above it adds the
    // moving ripples. Both are re-tinted when the cover colour arrives.
    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    container.appendChild(bg);

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.appendChild(cv);
    const g = cv.getContext('2d');

    // ---- keyword watermark -------------------------------------------------
    // One keyword (a CJK char, or the first word of a latin line) from the
    // active line, huge and dark, floating behind the lyric text.
    const keywordEl = document.createElement('div');
    keywordEl.style.cssText = [
        'position:absolute;left:50%;top:47%;transform:translate(-50%,-50%);',
        'font-weight:800;line-height:1;pointer-events:none;user-select:none;',
        'opacity:0.92;letter-spacing:0.02em;white-space:nowrap;',
    ].join('');
    container.appendChild(keywordEl);

    // ---- current line ------------------------------------------------------
    const centerWrap = document.createElement('div');
    centerWrap.style.cssText = [
        'position:absolute;inset:0;display:flex;align-items:center;justify-content:center;',
        'box-sizing:border-box;padding:0 7%;pointer-events:none;',
    ].join('');
    container.appendChild(centerWrap);

    const lineEl = document.createElement('div');
    lineEl.style.cssText = 'line-height:1.3;font-weight:700;text-wrap:balance;text-align:center;';
    centerWrap.appendChild(lineEl);

    // ---- translation -------------------------------------------------------
    // Foreign songs: pinned to the bottom-left, never centred.
    const translationEl = document.createElement('div');
    translationEl.style.cssText = [
        'position:absolute;left:5%;bottom:6.5%;max-width:62%;',
        'text-align:left;line-height:1.45;font-weight:400;pointer-events:none;',
        'text-shadow:0 1px 8px rgba(0,0,0,0.35);',
    ].join('');
    container.appendChild(translationEl);

    // ---- state -------------------------------------------------------------
    let disposed = false;
    let width = 1;
    let height = 1;
    let dpr = Math.min(window.devicePixelRatio || 1, 1.75);
    let lastLineIndex = null;
    let lastTextKey = '';
    let raf = 0;
    // The cover's dominant colour drives everything; null until extracted
    // (or when the artwork cannot be read), then the theme accent is used.
    let coverColor = null;
    let coverUrlForColor = null;

    const settings = () => {
        const v = ctx.getSettings() || {};
        return {
            waveSource: v.waveSource === 'theme' ? 'theme' : 'cover',
            brightness: clampNum(v.brightness, 0.3, 2, 1),
            speed: clampNum(v.speed, 0.2, 3, 1),
            keyword: v.keyword !== false,
            textScale: clampNum(v.textScale, 0.6, 1.8, 1),
        };
    };

    // ---- palette -----------------------------------------------------------
    // One base colour (cover or theme) is expanded into: the dark background
    // wash, the ripple colour, a bright low-saturation tint for the lyric, and
    // a dark shade for the keyword watermark.
    let palette = null;

    const baseColor = () => {
        const s = settings();
        if (s.waveSource === 'cover' && coverColor) return coverColor;
        return hexOr(ctx.getTheme()?.accentColor, '#5f7cff');
    };

    const computePalette = (hex) => {
        const rgb = hexToRgb(hex);
        if (!rgb) return null;
        const [h, sat, li] = rgbToHsl(rgb.r, rgb.g, rgb.b);
        const wave = hslToRgb(h, Math.min(0.9, Math.max(0.45, sat * 1.15 + 0.06)), 0.58);
        const tint = hslToRgb(h, Math.min(0.45, sat * 0.35 + 0.06), 0.92);
        return {
            h,
            sat,
            base: rgb,
            wave: { r: wave[0], g: wave[1], b: wave[2] },
            tint: { r: tint[0], g: tint[1], b: tint[2] },
            keyword: scaleRgb(rgb, 0.35),
            bgMid: scaleRgb(rgb, 0.24),
            bgEdge: scaleRgb(rgb, 0.07),
            bgDeep: scaleRgb(rgb, 0.04),
        };
    };

    const applyPalette = () => {
        palette = computePalette(baseColor()) || palette;
        if (!palette) return;
        const { wave, tint } = palette;
        bg.style.background = 'radial-gradient(135% 100% at 50% 44%, '
            + `${cssRgb(palette.bgMid)} 0%, ${cssRgb(palette.bgEdge)} 58%, ${cssRgb(palette.bgDeep)} 100%)`;
        keywordEl.style.color = cssRgba(palette.keyword, 0.92);
        keywordEl.style.textShadow = `0 0 ${Math.max(8, height * 0.02)}px ${cssRgba(palette.keyword, 0.35)}`;
        lineEl.style.color = cssRgba(tint, 0.97);
        lineEl.style.textShadow = `0 1px ${Math.max(10, height * 0.03)}px ${cssRgba(palette.keyword, 0.5)}`;
        translationEl.style.color = cssRgba(tint, 0.68);
        void wave;
    };

    // ---- canvas: two moving ripple clusters --------------------------------
    const resizeCanvas = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const w = Math.max(1, Math.round(width * dpr));
        const h = Math.max(1, Math.round(height * dpr));
        if (cv.width !== w || cv.height !== h) {
            cv.width = w;
            cv.height = h;
        }
    };

    // Deterministic pseudo-random per index, so the composition is stable
    // across frames instead of re-rolled every tick.
    const frac = (v) => v - Math.floor(v);
    const rand = (i, salt) => frac(Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453);

    // One cluster: a soft core glow plus concentric rings whose brightness is
    // banded vertically (bright at the middle, fading up/down — light on
    // water), and a few brighter arcs slowly rotating. cx sits at (or just
    // inside) the screen edge, so half of each ring is off-screen.
    const drawCluster = (cx, cy, baseR, t, seed, alphaScale) => {
        const w = cv.width;
        const h = cv.height;
        const { wave } = palette;

        // core glow
        const coreR = baseR * 0.9;
        const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, coreR));
        rg.addColorStop(0, cssRgba(wave, (0.15 * alphaScale).toFixed(3)));
        rg.addColorStop(0.55, cssRgba(wave, (0.06 * alphaScale).toFixed(3)));
        rg.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = rg;
        g.fillRect(cx - coreR, cy - coreR, coreR * 2, coreR * 2);

        // concentric rings
        const n = 9;
        for (let i = 1; i <= n; i++) {
            const r1 = rand(i + seed * 13, 1);
            const r2 = rand(i + seed * 13, 2);
            const rr = baseR * (0.16 + 0.92 * (i / n))
                * (1 + 0.028 * Math.sin(t * (0.22 + 0.1 * r1) + seed * 2.1 + i * 0.8));
            const breathe = 0.65 + 0.35 * Math.sin(t * (0.14 + 0.08 * r2) + i * 1.3 + seed);
            const alpha = Math.max(0.008, alphaScale * (0.035 + 0.1 * (1 - i / n)) * breathe);

            // vertical banding: fade the ring out toward its top and bottom
            const grad = g.createLinearGradient(0, cy - rr, 0, cy + rr);
            grad.addColorStop(0, `rgba(${wave.r},${wave.g},${wave.b},0)`);
            grad.addColorStop(0.3, `rgba(${wave.r},${wave.g},${wave.b},${(alpha * 0.6).toFixed(3)})`);
            grad.addColorStop(0.5, `rgba(${wave.r},${wave.g},${wave.b},${alpha.toFixed(3)})`);
            grad.addColorStop(0.7, `rgba(${wave.r},${wave.g},${wave.b},${(alpha * 0.6).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${wave.r},${wave.g},${wave.b},0)`);
            g.strokeStyle = grad;
            g.lineWidth = Math.max(0.8, h * (0.0012 + 0.005 * r2));
            g.shadowColor = cssRgba(wave, Math.min(0.55, alpha * 1.3));
            g.shadowBlur = h * 0.018;
            g.beginPath();
            g.arc(cx, cy, rr, 0, Math.PI * 2);
            g.stroke();
        }

        // slowly rotating bright arcs — the "动" in 动感波光
        for (let k = 0; k < 3; k++) {
            const r1 = rand(k + seed * 31, 4);
            const r2 = rand(k + seed * 31, 6);
            const rr = baseR * (0.28 + 0.72 * r1) * (1 + 0.02 * Math.sin(t * 0.2 + k));
            const a0 = t * (0.05 + 0.07 * r1) * (k % 2 ? -1 : 1) + k * 2.4 + seed * 1.7;
            const span = 0.9 + 1.5 * r2;
            const alpha = Math.max(0.01, alphaScale * (0.09 + 0.08 * rand(k + seed * 31, 5))
                * (0.7 + 0.3 * Math.sin(t * 0.3 + k * 2.2)));

            const grad = g.createLinearGradient(0, cy - rr, 0, cy + rr);
            grad.addColorStop(0, `rgba(${wave.r},${wave.g},${wave.b},0)`);
            grad.addColorStop(0.5, `rgba(${wave.r},${wave.g},${wave.b},${alpha.toFixed(3)})`);
            grad.addColorStop(1, `rgba(${wave.r},${wave.g},${wave.b},0)`);
            g.strokeStyle = grad;
            g.lineWidth = Math.max(1, h * (0.0018 + 0.0035 * r1));
            g.shadowColor = cssRgba(wave, Math.min(0.6, alpha * 1.5));
            g.shadowBlur = h * 0.02;
            g.beginPath();
            g.arc(cx, cy, rr, a0, a0 + span);
            g.stroke();
        }
        void w;
    };

    const draw = (now) => {
        const w = cv.width;
        const h = cv.height;
        if (!w || !h || !palette) return;
        const s = settings();
        const t = (now / 1000) * s.speed;
        const { wave } = palette;

        g.clearRect(0, 0, w, h);
        g.globalCompositeOperation = 'lighter';

        // two ripple clusters hugging the left and right edges
        const baseR = Math.min(w, h) * 0.62;
        const cy = h * (0.45 + 0.02 * Math.sin(t * 0.09));
        const cxL = w * 0.015 + w * 0.012 * Math.sin(t * 0.06 + 1.2);
        const cxR = w * 0.985 + w * 0.012 * Math.sin(t * 0.055 + 3.9);
        drawCluster(cxL, cy, baseR, t, 1, 1);
        drawCluster(cxR, cy * 0.98, baseR * 1.04, t * 1.06, 2, 0.92);

        // a faint drifting glow between them, for depth
        const px = w * (0.5 + 0.18 * Math.sin(t * 0.08 + 0.7));
        const py = h * (0.42 + 0.08 * Math.cos(t * 0.06 + 2.1));
        const pr = h * 0.4;
        const pga = g.createRadialGradient(px, py, 0, px, py, pr);
        pga.addColorStop(0, cssRgba(wave, (0.05 * s.brightness).toFixed(3)));
        pga.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = pga;
        g.fillRect(px - pr, py - pr, pr * 2, pr * 2);

        g.shadowBlur = 0;
        g.globalCompositeOperation = 'source-over';
    };

    const frame = (now) => {
        if (disposed) return;
        draw(now);
        raf = requestAnimationFrame(frame);
    };

    const startAnimation = () => {
        if (disposed || raf) return;
        // In static mode (settings preview) one frozen frame is enough.
        if (ctx.staticMode) {
            draw(12000);
            return;
        }
        raf = requestAnimationFrame(frame);
    };

    const stopAnimation = () => {
        if (raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    };

    // ---- typography --------------------------------------------------------
    const applyTypography = () => {
        const theme = ctx.getTheme();
        const s = settings();
        const display = ctx.getDisplay();
        const stack = safeFontStack(folium, theme);
        const weight = safeWeight(folium, theme, 700);
        // The active line is the centrepiece: noticeably larger than a normal
        // lyric layout (the reference runs it at roughly a tenth of the page).
        const base = Math.round(Math.min(Math.max(height * 0.085, 18), 110) * s.textScale * display.lyricsFontScale);

        container.style.fontFamily = stack;
        lineEl.style.fontSize = `${base}px`;
        lineEl.style.fontWeight = String(weight);
        keywordEl.style.fontSize = `${Math.round(Math.min(Math.max(height * 0.42, 40), 620) * (0.55 + 0.45 * s.textScale))}px`;
        translationEl.style.fontSize = `${Math.round(base * 0.4)}px`;
    };

    // ---- text --------------------------------------------------------------
    const keywordOf = (text) => {
        const t = text.trim();
        if (!t) return '';
        // CJK line: its first han character reads best as a watermark.
        const han = t.match(/[\u3400-\u9fff\uf900-\ufaff]/);
        if (han) return han[0];
        // kana line: first kana run.
        const kana = t.match(/[\u3040-\u30ff]+/);
        if (kana) return kana[0].slice(0, 2);
        // latin line: the first word, capped so it still fits.
        const word = t.split(/[\s,，.。!！?？;；:：'"、·—-]+/).filter(Boolean)[0];
        return word ? word.slice(0, 10) : '';
    };

    const renderText = (animate) => {
        const display = ctx.getDisplay();
        const s = settings();
        const showText = display.showText !== false;
        centerWrap.style.display = showText ? '' : 'none';
        keywordEl.style.display = showText && s.keyword ? '' : 'none';
        translationEl.style.display = showText ? '' : 'none';
        if (!showText) {
            // Keep the line index in sync so `onLyricTime` does not keep
            // re-entering here on every clock tick while the text is hidden.
            lastLineIndex = ctx.getLineIndex();
            return;
        }

        const song = ctx.song;
        const index = ctx.staticMode && ctx.staticLineIndex !== null
            ? ctx.staticLineIndex
            : ctx.getLineIndex();
        const line = index >= 0 ? ctx.lines[index] : null;

        // Active lyric; before the first line (intro) show "title - artist"
        // the way the reference does.
        let text = line?.fullText?.trim() || '';
        if (!text) text = [song?.title, song?.artist].filter(Boolean).join(' - ') || '♪';
        const translation = line?.translation?.trim() || '';
        const keyword = s.keyword ? keywordOf(text) : '';

        // Re-animate only when the line really changed (the clock ticks far
        // more often than lines change).
        const key = `${index}|${text}|${translation}|${keyword}`;
        const changed = key !== lastTextKey;
        lastTextKey = key;

        lineEl.textContent = text;
        keywordEl.textContent = keyword;
        keywordEl.style.display = keyword && showText && s.keyword ? '' : 'none';
        translationEl.textContent = translation;
        translationEl.style.display = translation ? '' : 'none';

        if (changed && animate && !ctx.staticMode) {
            for (const el of [keywordEl, lineEl, translationEl]) {
                el.classList.remove('wave-line-in', 'wave-keyword-in');
                void el.offsetWidth;
                el.classList.add(el === keywordEl ? 'wave-keyword-in' : 'wave-line-in');
            }
        }
        lastLineIndex = index;
    };

    // ---- cover -------------------------------------------------------------
    const applyCover = () => {
        if (disposed) return;
        const s = settings();
        const cover = ctx.getCoverUrl();
        if (s.waveSource === 'cover' && cover) {
            if (coverUrlForColor !== cover) {
                coverUrlForColor = cover;
                coverColor = null;
                void dominantColor(cover).then((color) => {
                    if (disposed || coverUrlForColor !== cover) return;
                    coverColor = color;
                    applyPalette();
                });
            }
        } else {
            coverUrlForColor = null;
            coverColor = null;
        }
        applyPalette();
    };

    const refreshAll = (animate) => {
        resizeCanvas();
        applyCover();
        applyTypography();
        renderText(animate);
    };

    resizeCanvas();
    applyCover();
    applyTypography();
    renderText(false);
    startAnimation();

    // ---- subscriptions -----------------------------------------------------
    const offResize = ctx.onResize((size) => {
        width = Math.max(1, size.width);
        height = Math.max(1, size.height);
        refreshAll(false);
        if (ctx.staticMode) draw(12000);
    });

    const offChange = ctx.onChange(() => {
        refreshAll(false);
    });

    // Line changes come with the lyric clock; only redraw the text when the
    // active line actually moved. The ripples keep flowing regardless of
    // pause — the surface stays alive, as in the reference.
    const offTime = ctx.onLyricTime(() => {
        const index = ctx.staticMode && ctx.staticLineIndex !== null
            ? ctx.staticLineIndex
            : ctx.getLineIndex();
        if (index === lastLineIndex) return;
        renderText(true);
    });

    return () => {
        disposed = true;
        stopAnimation();
        offResize();
        offChange();
        offTime();
    };
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

const clampNum = (value, min, max, fallback) => {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(max, Math.max(min, n));
};

const hexOr = (value, fallback) =>
    (typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback);

const hexToRgb = (hex) => {
    if (typeof hex !== 'string') return null;
    const m = /^#([0-9a-fA-F]{6})$/.exec(hex.trim());
    if (!m) return null;
    const value = parseInt(m[1], 16);
    return { r: (value >> 16) & 255, g: (value >> 8) & 255, b: value & 255 };
};

const rgbToHsl = (r, g, b) => {
    const rn = r / 255;
    const gn = g / 255;
    const bn = b / 255;
    const max = Math.max(rn, gn, bn);
    const min = Math.min(rn, gn, bn);
    const l = (max + min) / 2;
    if (max === min) return [0, 0, l];
    const d = max - min;
    const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    let h;
    if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
    else if (max === gn) h = ((bn - rn) / d + 2) / 6;
    else h = ((rn - gn) / d + 4) / 6;
    return [h, s, l];
};

const hueToRgb = (p, q, t) => {
    let tn = t;
    if (tn < 0) tn += 1;
    if (tn > 1) tn -= 1;
    if (tn < 1 / 6) return p + (q - p) * 6 * tn;
    if (tn < 1 / 2) return q;
    if (tn < 2 / 3) return p + (q - p) * (2 / 3 - tn) * 6;
    return p;
};

const hslToRgb = (h, s, l) => {
    if (s === 0) {
        const v = Math.round(l * 255);
        return [v, v, v];
    }
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    return [hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)]
        .map((v) => Math.round(v * 255));
};

const scaleRgb = (rgb, k) => ({
    r: Math.round(rgb.r * k),
    g: Math.round(rgb.g * k),
    b: Math.round(rgb.b * k),
});

const cssRgb = (rgb) => `rgb(${rgb.r},${rgb.g},${rgb.b})`;
const cssRgba = (rgb, a) => `rgba(${rgb.r},${rgb.g},${rgb.b},${a})`;

// One entry per cover URL, so switching back and forth costs nothing.
const COLOR_CACHE = new Map();

/**
 * Dominant colour of an image, as a `#rrggbb` string (or null).
 * A 24×24 downscale is sampled, each pixel weighted by saturation and by how
 * close its lightness is to mid-grey (a big white border or a black sleeve
 * should not wash the result out), then the average is pushed back into a
 * usable saturation/lightness.
 *
 * Reading the canvas can throw on a tainted canvas (a cross-origin cover
 * without CORS headers); that is expected and simply means "no colour".
 */
const dominantColor = (url) => new Promise((resolve) => {
    if (COLOR_CACHE.has(url)) {
        resolve(COLOR_CACHE.get(url));
        return;
    }
    let settled = false;
    const finish = (color) => {
        if (settled) return;
        settled = true;
        if (color) COLOR_CACHE.set(url, color);
        resolve(color);
    };

    const img = document.createElement('img');
    img.crossOrigin = 'anonymous';
    img.onload = () => {
        try {
            const size = 24;
            const canvas = document.createElement('canvas');
            canvas.width = size;
            canvas.height = size;
            const g2 = canvas.getContext('2d', { willReadFrequently: true });
            g2.drawImage(img, 0, 0, size, size);
            const { data } = g2.getImageData(0, 0, size, size);

            let sum = 0;
            let r = 0;
            let gr = 0;
            let b = 0;
            for (let i = 0; i < data.length; i += 4) {
                if (data[i + 3] < 160) continue;
                const [, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
                const weight = (0.08 + s * s) * Math.max(0, 1 - Math.abs(l - 0.5) * 1.3);
                if (weight <= 0) continue;
                r += data[i] * weight;
                gr += data[i + 1] * weight;
                b += data[i + 2] * weight;
                sum += weight;
            }
            if (sum <= 0) {
                finish(null);
                return;
            }
            const [h, s, l] = rgbToHsl(r / sum, gr / sum, b / sum);
            const [rr, gg, bb] = hslToRgb(h, Math.min(0.85, Math.max(0.42, s * 1.2 + 0.08)), Math.min(0.62, Math.max(0.46, l)));
            finish(`#${[rr, gg, bb].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')}`);
        } catch {
            finish(null);
        }
    };
    img.onerror = () => finish(null);
    // A cover that never loads must not leave the palette waiting forever.
    setTimeout(() => finish(null), 4000);
    img.src = url;
});

// Theme helpers are Folium 1.3+; fall back to the theme's own family fields.
const safeFontStack = (folium, theme) => {
    try {
        const stack = folium.theme?.resolveFontStack?.(theme);
        if (typeof stack === 'string' && stack) return stack;
    } catch { /* older host */ }
    return theme?.fontFamily || 'system-ui, -apple-system, "PingFang SC", sans-serif';
};

const safeWeight = (folium, theme, fallback) => {
    try {
        const weight = folium.theme?.resolveFontWeight?.(theme, fallback);
        if (Number.isFinite(weight)) return weight;
    } catch { /* older host */ }
    return fallback;
};
