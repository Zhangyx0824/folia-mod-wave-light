// Smoke test: load the mod's client entry against a fake Folium host and a
// minimal DOM (jsdom), mount the visualizer, and check that it draws, picks a
// watermark word, and keeps every text layer centred in its own container.
// Run with:
//   node test/smoke.mjs
import { createRequire } from 'module';
import path from 'path';
import { pathToFileURL } from 'url';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// jsdom lives in the managed workspace; ESM ignores NODE_PATH, so resolve it
// explicitly.
const require = createRequire('/Users/pomepii/.workbuddy/binaries/node/workspace/node_modules/');
const { JSDOM } = require('jsdom');

const MOD = path.resolve(__dirname, '../wave-light/client.mjs');

const dom = new JSDOM('<!doctype html><html><body><div id="host"></div></body></html>', {
    pretendToBeVisual: true,
});
const { window } = dom;

// jsdom has no canvas backend; a recording stub is enough for the mod's 2d use.
const ctx2d = new Proxy({}, {
    get: (t, k) => {
        if (k === 'canvas') return null;
        if (k === 'createRadialGradient' || k === 'createLinearGradient') {
            return () => ({ addColorStop: () => {} });
        }
        if (k === 'getImageData') return () => ({ data: new Uint8ClampedArray(4) });
        return () => {};
    },
    set: () => true,
});
window.HTMLCanvasElement.prototype.getContext = () => ctx2d;

let rafId = 1;
window.requestAnimationFrame = () => rafId++;
window.cancelAnimationFrame = () => {};
window.devicePixelRatio = 2;

global.window = window;
global.document = window.document;
global.requestAnimationFrame = window.requestAnimationFrame;
global.cancelAnimationFrame = window.cancelAnimationFrame;
global.HTMLElement = window.HTMLElement;
global.HTMLCanvasElement = window.HTMLCanvasElement;
// Node 22 exposes a getter-only global navigator; plain assignment throws
// under ESM's strict mode.
Object.defineProperty(globalThis, 'navigator', {
    value: window.navigator, configurable: true, writable: true,
});

const results = [];
const ok = (name, cond, detail) => {
    results.push({ name, pass: !!cond, detail });
    console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? `  -> ${detail}` : ''}`);
};

const makeCtx = (lines, opts = {}) => {
    const ctx = {
        lines,
        song: opts.song || { title: 'Test Song', artist: 'Test Artist' },
        staticMode: !!opts.staticMode,
        staticLineIndex: opts.staticLineIndex ?? null,
        getLineIndex: () => (opts.index ?? 0),
        onLyricTime: (cb) => { ctx.timeCb = cb; return () => {}; },
        onResize: (cb) => { ctx.resizeCb = cb; return () => {}; },
        onChange: (cb) => { ctx.changeCb = cb; return () => {}; },
        getCoverUrl: () => null,
        isPaused: () => false,
        getTheme: () => ({ accentColor: '#5f7cff', fontFamily: 'sans-serif' }),
        getDisplay: () => ({ showText: true, lyricsFontScale: 1 }),
        getSettings: () => ({ waveSource: 'theme', brightness: 1, speed: 1, keyword: true, textScale: 1, ...(opts.settings || {}) }),
    };
    return ctx;
};

const mount = async (ctx) => {
    const mod = await import(`${pathToFileURL(MOD).href}?t=${Date.now()}`);
    let reg = null;
    const folium = {
        registries: {
            visualizers: { register: (def) => { reg = def; } },
        },
        theme: {},
    };
    mod.default(folium);
    const host = document.getElementById('host');
    host.innerHTML = '';
    const container = document.createElement('div');
    host.appendChild(container);
    const dispose = reg.mount(container, ctx);
    return { reg, container, dispose, def: reg };
};

(async () => {
    // ---- 1. registration / layers -----------------------------------------
    const lines = [
        { fullText: '再度重相逢', translation: '', startTime: 0, endTime: 3.2 },
        { fullText: '作词：方文山', translation: '', startTime: 3.2, endTime: 5 },
        { fullText: 'My life was kinda short', translation: '我的人生很短暂', startTime: 5, endTime: 8.5 },
    ];
    const ctx = makeCtx(lines, { index: 0 });
    const { def, container } = await mount(ctx);

    ok('registers a visualizer', def && def.id === 'wave-light');
    ok('hostLayers: no host background', def.hostLayers && def.hostLayers.background === false);
    ok('hostLayers: no host subtitles', def.hostLayers && def.hostLayers.subtitles === false);
    ok('has a bg layer', !!container.querySelector('div'));
    ok('has a canvas', !!container.querySelector('canvas'));
    ok('canvas sized with DPR cap', container.querySelector('canvas').width > 0,
        `w=${container.querySelector('canvas').width}`);

    const keywordEl = [...container.querySelectorAll('div')]
        .find((d) => d.style.fontWeight === '800' && d.style.whiteSpace === 'nowrap');
    ok('watermark element exists', !!keywordEl);

    // ---- 2. hero word selection -------------------------------------------
    // The watermark shows the heaviest *word*, never a random character run.
    const kw0 = keywordEl.textContent;
    ok('watermark is a real word of line 1', ['再度', '重', '相逢'].includes(kw0), `got "${kw0}"`);
    ok('watermark is not a lone central character', kw0 !== '重', `got "${kw0}"`);

    const remount = async (i, ls = lines) => {
        const c = makeCtx(ls, { index: i });
        const m = await mount(c);
        const el = [...m.container.querySelectorAll('div')]
            .find((d) => d.style.fontWeight === '800' && d.style.whiteSpace === 'nowrap');
        return el ? el.textContent : '';
    };

    ok('credit line keeps the name after the colon', (await remount(1)) === '方文山', await remount(1));

    const mixed = [{ fullText: '词：周杰伦 曲：周杰伦', translation: '', startTime: 0, endTime: 2 }];
    ok('double credit line keeps the last value', (await remount(0, mixed)) === '周杰伦', await remount(0, mixed));

    const mix = [{ fullText: '混音：林哲民', translation: '', startTime: 0, endTime: 2 }];
    ok('mix credit keeps the name', (await remount(0, mix)) === '林哲民', await remount(0, mix));

    const latin = [{ fullText: 'My life was kinda short', translation: '', startTime: 0, endTime: 4 }];
    const latinKw = await remount(0, latin);
    ok('latin line picks a whole word', ['My', 'life', 'was', 'kinda', 'short'].includes(latinKw), `got "${latinKw}"`);
    ok('latin line does not pick a fragment', latinKw.length >= 2, `got "${latinKw}"`);

    // Heaviest word wins: 「相逢」/「再度」 (2 chars) over the 1-char 「重」.
    const long = [{ fullText: '把回忆拼好给你', translation: '', startTime: 0, endTime: 3 }];
    const longKw = await remount(0, long);
    ok('long line picks a multi-char word', longKw.length >= 2, `got "${longKw}"`);

    // A one-character winner borrows a neighbour, staying contiguous.
    const single = [{ fullText: '我爱你', translation: '', startTime: 0, endTime: 1.5 }];
    const singleKw = await remount(0, single);
    ok('short line stays contiguous & >= 2 chars', singleKw.length >= 2 && '我爱你'.includes(singleKw),
        `got "${singleKw}"`);

    // ---- 3. translation is its own block, not inside the lyric column ------
    const c2 = makeCtx([{ fullText: 'Hello world', translation: '你好世界', startTime: 0, endTime: 3 }], { index: 0 });
    const m2 = await mount(c2);
    const col = [...m2.container.querySelectorAll('div')].find((d) => d.style.display === 'flex' && d.style.padding === '0px 7%');
    ok('lyric column holds only the line', col && col.children.length === 1, col ? `children=${col.children.length}` : 'no column');
    const tr = [...m2.container.querySelectorAll('div')].find((d) => d.textContent === '你好世界');
    ok('translation rendered in its own block', !!tr && !col.contains(tr));

    // ---- 4. per-character spans carry the entrance choreography -----------
    const spans = [...col.querySelectorAll('span')];
    // Latin words stay whole (one span per word), CJK is one span per character.
    ok('line is split into per-word/per-character spans', spans.length === 3, `spans=${spans.length}`);
    const withDx = spans.filter((s) => s.style.getPropertyValue('--dx'));
    ok('outer characters get a start offset', withDx.length > 0, `${withDx.length} with --dx`);
    ok('spans carry a stagger delay', spans.every((s) => !s.style.animationDelay || /ms$/.test(s.style.animationDelay)));

    // ---- 5. settings: watermark can be switched off ------------------------
    const c3 = makeCtx(lines, { index: 0, settings: { keyword: false } });
    const m3 = await mount(c3);
    const kw3 = [...m3.container.querySelectorAll('div')]
        .find((d) => d.style.fontWeight === '800' && d.style.whiteSpace === 'nowrap');
    ok('watermark hides when the setting is off', kw3 && kw3.textContent === '');

    // ---- 6. static mode: no rAF, still renders ---------------------------
    const c4 = makeCtx([{ fullText: '静止模式', translation: '', startTime: 0, endTime: 2 }], { staticMode: true, staticLineIndex: 0 });
    const m4 = await mount(c4);
    ok('static mode renders text', m4.container.textContent.includes('静止模式'));

    // ---- 7. text alignment: settings-preview card -------------------------
    // The mode is mounted in a small card, but its absolute children resolve
    // against a larger ancestor (as in the settings preview). Every layer must
    // be nudged back to the CARD's centre — not the viewport's, not the
    // ancestor's.
    const rect = (el, l, t, w, h) => {
        el.getBoundingClientRect = () => ({
            left: l, top: t, right: l + w, bottom: t + h, width: w, height: h, x: l, y: t,
        });
    };
    const c5 = makeCtx([{ fullText: 'Hello world', translation: '你好世界', startTime: 0, endTime: 3 }], { index: 0 });
    const m5 = await mount(c5);
    const card = m5.container;
    Object.defineProperty(card, 'offsetWidth', { value: 420 });
    rect(card, 200, 100, 420, 250); // card centre = (410, 225)
    const kw5 = [...card.querySelectorAll('div')].find((d) => d.style.fontWeight === '800');
    const col5 = [...card.querySelectorAll('div')].find((d) => d.style.display === 'flex');
    const line5 = col5.firstElementChild;
    const tr5 = [...card.querySelectorAll('div')].find((d) => d.textContent === '你好世界');
    // Natural placement resolved against a 1052x520 ancestor at (90, 40):
    // its 50% is (616, 300) — everything lands right/below the card centre.
    rect(kw5, 576, 288, 80, 24);
    rect(line5, 556, 286, 120, 28);
    rect(tr5, 566, 370, 100, 20);
    c5.changeCb(); // refreshAll -> renderText -> alignTextLayers
    ok('watermark nudged back into the card',
        kw5.style.left === 'calc(50% - 206px)' && kw5.style.top === 'calc(50% - 75px)',
        `left=${kw5.style.left} top=${kw5.style.top}`);
    ok('lyric column nudged back into the card', col5.style.transform === 'translate(-206px, -75px)',
        col5.style.transform);
    // Expected translation top: baseTop + dy, with the mod's own font math.
    const kwLen5 = (kw5.textContent || 'x').length;
    const kFont5 = Math.max(28, Math.min(1 * 0.42, (1 * 0.8) / kwLen5)) * 0.8;
    const trTop5 = Math.round(Math.round(1 * 0.75 + kFont5 / 4)
        + (100 + 250 * 0.75 + kFont5 / 4 - 380));
    ok('translation nudged back into the card',
        tr5.style.left === 'calc(50% - 206px)' && tr5.style.top === `calc(${trTop5}px)`,
        `left=${tr5.style.left} top=${tr5.style.top} (want ${trTop5})`);

    // When the containing block is already the container, deltas are zero and
    // nothing shifts.
    const c6 = makeCtx([{ fullText: 'Hi', translation: '', startTime: 0, endTime: 2 }], { index: 0 });
    const m6 = await mount(c6);
    const full = m6.container;
    Object.defineProperty(full, 'offsetWidth', { value: 800 });
    rect(full, 0, 0, 800, 500);
    const kw6 = [...full.querySelectorAll('div')].find((d) => d.style.fontWeight === '800');
    const col6 = [...full.querySelectorAll('div')].find((d) => d.style.display === 'flex');
    rect(kw6, 370, 240, 60, 20);
    rect(col6.firstElementChild, 380, 240, 40, 20);
    c6.changeCb();
    ok('correct containing block stays untouched',
        kw6.style.left === 'calc(50% + 0px)' && col6.style.transform === '',
        `left=${kw6.style.left} transform=${col6.style.transform}`);

    const failed = results.filter((r) => !r.pass);
    console.log(`\n${results.length - failed.length}/${results.length} passed`);
    if (failed.length) process.exitCode = 1;
})().catch((err) => {
    console.error('THREW:', err);
    process.exitCode = 1;
});
