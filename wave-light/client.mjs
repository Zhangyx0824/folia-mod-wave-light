// client.mjs — the whole wave-light mod.
//
// A lyric animation *mode* in the spirit of QQ Music's 「动感波光」: the player
// page becomes a dark, water-like surface whose colour is pulled from the
// current song's cover art. Luminous wave bands and slow drifting light
// patches flow across it (canvas, additive blending), and the lyrics sit
// centred on top — the active line tinted with a bright shade of the same
// cover colour, the surrounding lines dimmed.
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
            description: label('背景与光波、歌词的颜色来源；跟随封面会提取当前封面的主色', 'Where the background, waves and lyrics take their colour; “cover” extracts the dominant colour of the artwork'),
            options: [
                { value: 'cover', label: label('跟随封面', 'Cover colour') },
                { value: 'theme', label: label('主题色', 'Theme colour') },
            ],
        },
        {
            key: 'brightness', type: 'number', defaultValue: 1, min: 0.3, max: 2, step: 0.05,
            label: label('波光亮度', 'Wave brightness'),
            description: label('光带与光斑的整体强度', 'Overall intensity of the light bands and patches'),
        },
        {
            key: 'speed', type: 'number', defaultValue: 1, min: 0.2, max: 3, step: 0.1,
            label: label('流动速度', 'Flow speed'),
            description: label('波光流动的整体快慢', 'How fast the waves drift'),
        },
        {
            key: 'density', type: 'number', defaultValue: 8, min: 4, max: 14, step: 1,
            label: label('光带数量', 'Band count'),
            description: label('水面上光带的条数', 'How many wave bands cross the surface'),
        },
        {
            key: 'textScale', type: 'number', defaultValue: 1, min: 0.6, max: 1.8, step: 0.05,
            label: label('歌词字号', 'Lyric size'),
        },
        {
            key: 'showNext', type: 'boolean', defaultValue: true,
            label: label('显示下一句', 'Show next line'),
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
// The mode. Background is a DOM gradient tinted by the cover colour; the waves
// are one canvas animated with requestAnimationFrame (additive blending, a
// handful of paths per frame — cheap); the lyrics are DOM so the theme's font
// stack and the user's lyric size apply without canvas text layout.
// ---------------------------------------------------------------------------

function mountWaveLight(folium, container, ctx) {
    container.style.cssText = 'position:absolute;inset:0;overflow:hidden;';

    const style = document.createElement('style');
    style.textContent = [
        '.wave-line-in { animation: wave-line-in 0.38s cubic-bezier(0.2, 0.8, 0.3, 1) both; }',
        '@keyframes wave-line-in {',
        '  from { opacity: 0; transform: translateY(0.4em); filter: blur(4px); }',
        '  to { opacity: 1; transform: none; filter: blur(0); }',
        '}',
    ].join('\n');
    container.appendChild(style);

    // ---- background --------------------------------------------------------
    // A deep radial wash in the artwork's colour; the canvas above it adds the
    // moving light. Both are re-tinted when the cover colour arrives.
    const bg = document.createElement('div');
    bg.style.cssText = 'position:absolute;inset:0;pointer-events:none;';
    container.appendChild(bg);

    const cv = document.createElement('canvas');
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;';
    container.appendChild(cv);
    const g = cv.getContext('2d');

    // ---- lyrics ------------------------------------------------------------
    const textWrap = document.createElement('div');
    textWrap.style.cssText = [
        'position:absolute;inset:0;display:flex;flex-direction:column;',
        'align-items:center;justify-content:center;text-align:center;',
        'box-sizing:border-box;padding:0 6%;pointer-events:none;',
    ].join('');
    container.appendChild(textWrap);

    const header = document.createElement('div');
    header.style.cssText = 'margin-bottom:1.5em;line-height:1.35;';

    const titleEl = document.createElement('div');
    const artistEl = document.createElement('div');
    header.append(titleEl, artistEl);

    const lineEl = document.createElement('div');
    lineEl.style.cssText = 'line-height:1.34;font-weight:700;text-wrap:balance;';

    const translationEl = document.createElement('div');
    translationEl.style.cssText = 'line-height:1.4;font-weight:400;margin-top:0.6em;';

    const nextEl = document.createElement('div');
    nextEl.style.cssText = 'line-height:1.4;font-weight:400;margin-top:1.6em;';

    textWrap.append(header, lineEl, translationEl, nextEl);

    // ---- state -------------------------------------------------------------
    let disposed = false;
    let paused = ctx.isPaused();
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
            density: Math.round(clampNum(v.density, 4, 14, 8)),
            textScale: clampNum(v.textScale, 0.6, 1.8, 1),
            showNext: v.showNext !== false,
        };
    };

    // ---- palette -----------------------------------------------------------
    // One base colour (cover or theme) is expanded into: the dark background
    // wash, the wave colour, and a bright low-saturation tint for the lyrics.
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
            li,
            wave: { r: wave[0], g: wave[1], b: wave[2] },
            tint: { r: tint[0], g: tint[1], b: tint[2] },
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
        lineEl.style.color = cssRgba(tint, 0.96);
        titleEl.style.color = cssRgba(tint, 0.88);
        artistEl.style.color = cssRgba(tint, 0.55);
        translationEl.style.color = cssRgba(tint, 0.66);
        nextEl.style.color = cssRgba(tint, 0.22);
        void wave;
    };

    // ---- canvas ------------------------------------------------------------
    const resizeCanvas = () => {
        dpr = Math.min(window.devicePixelRatio || 1, 1.75);
        const w = Math.max(1, Math.round(width * dpr));
        const h = Math.max(1, Math.round(height * dpr));
        if (cv.width !== w || cv.height !== h) {
            cv.width = w;
            cv.height = h;
        }
    };

    // Deterministic pseudo-random per band index, so the composition is
    // stable across frames instead of re-rolled every tick.
    const frac = (v) => v - Math.floor(v);
    const rand = (i, salt) => frac(Math.sin((i + 1) * 127.1 + salt * 311.7) * 43758.5453);

    const draw = (now) => {
        const w = cv.width;
        const h = cv.height;
        if (!w || !h || !palette) return;
        const s = settings();
        const t = (now / 1000) * s.speed;
        const { wave } = palette;

        g.clearRect(0, 0, w, h);
        g.globalCompositeOperation = 'lighter';

        // Slow drifting glow patches — the broad "light on water" fields.
        for (let i = 0; i < 3; i++) {
            const cx = w * (0.5 + 0.36 * Math.sin(t * (0.1 + i * 0.03) + i * 2.09));
            const cy = h * (0.46 + 0.28 * Math.cos(t * (0.08 + i * 0.025) + i * 1.73));
            const rad = h * (0.34 + 0.09 * Math.sin(t * 0.17 + i * 1.1));
            const a = Math.max(0, 0.11 * s.brightness * (0.7 + 0.3 * Math.sin(t * 0.23 + i * 2.4)));
            const rg = g.createRadialGradient(cx, cy, 0, cx, cy, Math.max(1, rad));
            rg.addColorStop(0, cssRgba(wave, a));
            rg.addColorStop(1, 'rgba(0,0,0,0)');
            g.fillStyle = rg;
            g.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
        }

        // The wave bands: stacked sine lines with a glow, brighter around the
        // vertical middle of the stage, each with its own hue whisper.
        const n = s.density;
        for (let i = 0; i < n; i++) {
            const p = n === 1 ? 0.5 : i / (n - 1);
            const r1 = rand(i, 1);
            const r2 = rand(i, 2);
            const r3 = rand(i, 3);

            const yBase = h * (0.26 + 0.5 * p) + Math.sin(t * 0.4 + i * 1.3) * h * 0.012;
            const amp = h * (0.012 + 0.03 * r1);
            const wl = w * (0.3 + 0.3 * r2);
            const ph = t * (0.35 + 0.55 * r3) * 1.8 + i * 1.93;

            const focus = Math.max(0, 1 - Math.abs(p - 0.5) * 1.15);
            const alpha = Math.max(0.012, (0.05 + 0.13 * focus) * s.brightness);
            const [br, bgc, bb] = hslToRgb(
                (palette.h + (r1 - 0.5) * 0.07 + 1) % 1,
                Math.min(0.95, palette.sat * 1.1 + 0.1),
                Math.min(0.72, 0.5 + 0.1 * r2),
            );

            const grad = g.createLinearGradient(0, 0, w, 0);
            grad.addColorStop(0, `rgba(${br},${bgc},${bb},0)`);
            grad.addColorStop(0.22, `rgba(${br},${bgc},${bb},${(alpha * 0.45).toFixed(3)})`);
            grad.addColorStop(0.5, `rgba(${br},${bgc},${bb},${alpha.toFixed(3)})`);
            grad.addColorStop(0.78, `rgba(${br},${bgc},${bb},${(alpha * 0.45).toFixed(3)})`);
            grad.addColorStop(1, `rgba(${br},${bgc},${bb},0)`);

            g.strokeStyle = grad;
            g.lineWidth = Math.max(0.7, h * (0.0012 + 0.0035 * r3));
            g.shadowColor = `rgba(${br},${bgc},${bb},${Math.min(0.75, alpha * 1.5).toFixed(3)})`;
            g.shadowBlur = h * 0.02;

            g.beginPath();
            const steps = 72;
            for (let k = 0; k <= steps; k++) {
                const x = (k / steps) * w;
                const y = yBase
                    + Math.sin((x / wl) * Math.PI * 2 + ph) * amp
                    + Math.sin((x / (wl * 0.41)) * Math.PI * 2 - t * 0.9 + i * 2.4) * amp * 0.45
                    + Math.sin((x / (wl * 2.6)) * Math.PI * 2 + t * 0.35 + i) * amp * 0.7;
                if (k === 0) g.moveTo(x, y);
                else g.lineTo(x, y);
            }
            g.stroke();
        }

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
        const base = Math.round(Math.min(Math.max(height * 0.058, 16), 68) * s.textScale * display.lyricsFontScale);

        textWrap.style.fontFamily = stack;
        titleEl.style.cssText = `font-size:${Math.round(base * 0.38)}px;`
            + `color:${titleEl.style.color || '#fff'};opacity:0.9;font-weight:600;`
            + 'letter-spacing:0.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;';
        artistEl.style.cssText = `font-size:${Math.round(base * 0.32)}px;`
            + `color:${artistEl.style.color || '#fff'};opacity:0.8;`
            + 'margin-top:0.35em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;';
        lineEl.style.fontSize = `${base}px`;
        lineEl.style.fontWeight = String(weight);
        translationEl.style.fontSize = `${Math.round(base * 0.58)}px`;
        translationEl.style.opacity = '0.85';
        nextEl.style.fontSize = `${Math.round(base * 0.56)}px`;
    };

    // ---- text --------------------------------------------------------------
    const renderText = (animate) => {
        const display = ctx.getDisplay();
        const s = settings();
        const showText = display.showText !== false;
        textWrap.style.display = showText ? '' : 'none';
        if (!showText) {
            // Keep the line index in sync so `onLyricTime` does not keep
            // re-entering here on every clock tick while the text is hidden.
            lastLineIndex = ctx.getLineIndex();
            return;
        }

        const song = ctx.song;
        titleEl.textContent = song?.title || '';
        artistEl.textContent = song?.artist || '';

        const index = ctx.staticMode && ctx.staticLineIndex !== null
            ? ctx.staticLineIndex
            : ctx.getLineIndex();
        const line = index >= 0 ? ctx.lines[index] : null;
        const nextLine = s.showNext && index + 1 < ctx.lines.length ? ctx.lines[index + 1] : null;

        const text = line?.fullText?.trim() || '';
        const translation = line?.translation?.trim() || '';
        const nextText = nextLine?.fullText?.trim() || '';

        // Re-animate only when the line really changed (the clock ticks far
        // more often than lines change).
        const key = `${index}|${text}|${translation}|${nextText}`;
        const changed = key !== lastTextKey;
        lastTextKey = key;

        lineEl.textContent = text || '♪';
        translationEl.textContent = translation;
        translationEl.style.display = translation ? '' : 'none';
        nextEl.textContent = nextText;
        nextEl.style.display = nextText ? '' : 'none';

        if (changed && animate && text && !ctx.staticMode) {
            for (const el of [lineEl, translationEl]) {
                el.classList.remove('wave-line-in');
                void el.offsetWidth;
                el.classList.add('wave-line-in');
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
                    applyTypography();
                });
            }
        } else {
            coverUrlForColor = null;
            coverColor = null;
        }
        applyPalette();
        applyTypography();
    };

    const refreshAll = (animate) => {
        resizeCanvas();
        applyCover();
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
        paused = ctx.isPaused();
        refreshAll(false);
    });

    // Line changes come with the lyric clock; only redraw the text when the
    // active line actually moved. The waves keep flowing regardless of pause —
    // the surface stays alive, as in the reference.
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
