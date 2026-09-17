#!/usr/bin/env node
/** Node-only motion contracts. No browser, network, screenshots or file writes. */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import vm from 'node:vm';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = name => readFileSync(path.join(root, name), 'utf8');
const home = read('js/home.js');
const character = read('js/character.js');
const html = read('index.html');
// Approved appearance before the UI refresh. Do not compare against moving HEAD:
// committing a regression must not silently redefine what these tests preserve.
const BASELINE_COMMIT = 'da391902e0de9762de1807c255633377347927c8';
const baseline = execFileSync('git', ['show', `${BASELINE_COMMIT}:index.html`], { cwd: root, encoding: 'utf8' });

function between(source, start, end) {
  const a = source.indexOf(start);
  const b = source.indexOf(end, a + start.length);
  assert.ok(a >= 0 && b > a, `Source boundary missing: ${start}`);
  return source.slice(a, b);
}
function constant(source, name) {
  const match = source.match(new RegExp(`^const ${name} = [\\s\\S]*?^};|^const ${name} = \\[[\\s\\S]*?^\\];|^const ${name} = [^\\n]+;`, 'm'));
  assert.ok(match, `Missing ${name}`);
  return match[0];
}
function classes(...initial) {
  const values = new Set(initial);
  return { add: value => values.add(value), remove: value => values.delete(value), contains: value => values.has(value) };
}

test('Scene design and camera keyframes match the committed baseline exactly', () => {
  for (const name of ['CFG3D', 'GLOW', 'DECALS', 'LINING', 'RIGS', 'SEQ_KEYS', 'SEQ_TURN']) {
    assert.equal(constant(character, name), constant(baseline, name), name);
  }
  assert.equal(between(character, '  function applySeqCam(p)', '  applyHeroCam();'),
    between(baseline, '  function applySeqCam(p)', '  applyHeroCam();'));
});

function cameraAt(source, progress) {
  const context = vm.createContext({ progress, THREE: {}, camera: {
    position: { set(...values) { this.values = values; } },
    lookAt(...values) { this.target = values; },
  }, rig: { rotation: { y: 0 } } });
  vm.runInContext(`${constant(source, 'SEQ_KEYS')}\n${constant(source, 'SEQ_TURN')}
    const clamp01 = v => Math.min(1, Math.max(0, v));
    const smooth01 = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
    const lerp = (a, b, k) => a + (b - a) * k;
    ${between(source, '  function applySeqCam(p)', '  applyHeroCam();')}
    applySeqCam(progress);`, context);
  return JSON.parse(JSON.stringify({ camera: context.camera.position.values,
    target: context.camera.target, yaw: context.rig.rotation.y }));
}
test('Camera position, target and full turn retain their numerical path', () => {
  for (const progress of [-1, 0, .02, .34, .45, .52, .62, .85, 1, 2]) {
    assert.deepEqual(cameraAt(character, progress), cameraAt(baseline, progress));
  }
  assert.equal(cameraAt(character, 1).yaw, Math.PI * 2);
});

test('Classic UI boots before the version-pinned 3D module; no GLB loading gate hides HTML', () => {
  assert.ok(html.indexOf('src="/js/home.js"') < html.indexOf('type="importmap"'));
  assert.ok(html.indexOf('type="importmap"') < html.indexOf('src="/js/character.js"'));
  assert.ok(html.includes('three@0.170.0/build/three.module.js'));
  assert.ok(!home.includes('charGate'));
  assert.ok(home.includes('intro.play();'));
  assert.match(home, /seq:\s*\{\s*enabled: false/);
});

test('Internal scroll restoration is immediate; intentional anchor clicks keep smooth scrolling', () => {
  assert.match(read('css/home.css'), /html\{scroll-behavior:auto;/);
  assert.ok(!/html\s*\{[^}]*scroll-behavior:\s*smooth/.test(read('css/home.css')));
  assert.match(home, /scrollIntoView\(\{ behavior: RMQ\.matches \? 'auto' : 'smooth'/);
});

function sequenceHarness() {
  const events = new Map();
  const calls = [];
  const elements = {
    '#seq': { getBoundingClientRect: () => ({ top: 0, bottom: 900 }) },
    '#seq-stage-wrap': { style: {} }, '#seq-char-stage': {},
  };
  let driver, cleanup, timeline;
  const gsap = { set() {}, timeline(options) {
    timeline = { scrollTrigger: { start: 1000, end: 3700, isActive: true },
      to(target, vars) { if (typeof target === 'object' && 'p' in target) driver = { target, vars }; return this; },
      fromTo() { return this; }, options };
    return timeline;
  } };
  const c3 = { ready: false, seqProgress: p => calls.push(['progress', p]),
    seqAttach: () => calls.push(['attach']), seqDetach: () => calls.push(['detach']) };
  const window = { __char3d: c3, scrollY: 2000, innerHeight: 900,
    ScrollTrigger: { refresh() {} },
    addEventListener: (name, fn) => events.set(name, fn),
    removeEventListener: name => events.delete(name) };
  const context = vm.createContext({ window, CFG: { seq: { enabled: false } },
    SequencePlayer: function () { this.probe = () => { throw Error('Disabled frames were probed'); }; },
    $: selector => elements[selector] || null, location: { hash: '' },
    deepTarget: null, IntersectionObserver: class { observe() {} disconnect() {} },
    gsap, mm: { add(query, fn) { cleanup = fn(); } } });
  vm.runInContext(`${between(home, '  function initSequence(gsap, mm)', '\n  /* ---- 起動 ----')}
    initSequence(gsap, mm);`, context);
  return { c3, calls, events, elements, window, timeline, driver, cleanup };
}

test('Late GLB and context-loss fallback share one pin and the current scrub progress', () => {
  const h = sequenceHarness();
  assert.equal(h.elements['#seq-stage-wrap'].style.display, '');
  h.driver.target.p = .62;
  h.driver.vars.onUpdate();
  h.c3.ready = true;
  h.events.get('char3d:done')();
  assert.equal(h.elements['#seq-stage-wrap'].style.display, 'none');
  assert.deepEqual(h.calls.slice(-2), [['progress', .62], ['attach']]);
  h.c3.ready = false;
  h.events.get('char3d:done')();
  assert.equal(h.elements['#seq-stage-wrap'].style.display, '');
  assert.equal(h.driver.target.p, .62);
  h.c3.ready = true;
  h.events.get('char3d:done')();
  assert.deepEqual(h.calls.slice(-2), [['progress', .62], ['attach']]);
  assert.equal(h.timeline.options.scrollTrigger.end, '+=300%');
  assert.equal(h.timeline.options.scrollTrigger.scrub, .6);
});

test('Leaving sequence returns the single canvas to hero; motion cleanup removes listeners', () => {
  const h = sequenceHarness();
  h.c3.ready = true;
  h.timeline.scrollTrigger.isActive = false;
  h.window.scrollY = 0;
  h.events.get('char3d:done')();
  assert.deepEqual(h.calls.at(-1), ['detach']);
  h.cleanup();
  assert.equal(h.events.size, 0);
  assert.equal(h.elements['#seq-stage-wrap'].style.display, '');
});

function lifecycleHarness({ modelReady = true } = {}) {
  const events = new Map();
  const notifications = [];
  const timers = new Map();
  const context = vm.createContext({ ready: true, modelReady, dead: false, contextLost: false,
    running: true, rafId: 1, fadeRaf: 2,
    container: { classList: classes('is-on'), style: {} },
    heroWrap: { classList: classes('is-3d') }, seqWrap: { classList: classes('is-on') },
    document: { getElementById: () => ({ style: {} }) },
    renderer: { domElement: { addEventListener: (name, fn) => events.set(name, fn) } },
    cancelAnimationFrame() {}, seqDetach() {},
    done: value => notifications.push(value), setupEnvironment() {}, resize() {}, updateRunning() {},
    setTimeout: fn => { timers.set(1, fn); return 1; }, clearTimeout: id => timers.delete(id),
    console: { warn() {} },
  });
  vm.runInContext(between(character, '  /* ---- WebGL コンテキスト喪失 ----', '  /* ---- seq 連携 API'), context);
  return { context, events, notifications, timers };
}

test('Context loss immediately clears readiness, stops rendering and notifies fallback', () => {
  const h = lifecycleHarness();
  h.events.get('webglcontextlost')({ preventDefault() {} });
  assert.equal(h.context.ready, false);
  assert.equal(h.context.running, false);
  assert.equal(h.context.contextLost, true);
  assert.equal(h.context.heroWrap.classList.contains('is-3d'), false);
  assert.deepEqual(h.notifications, [false]);
  h.events.get('webglcontextrestored')();
  assert.equal(h.context.ready, true);
  assert.equal(h.context.contextLost, false);
  assert.deepEqual(h.notifications, [false, true]);
  assert.equal(h.timers.size, 0);
});

test('Expired WebGL recovery remains a usable SVG instead of reviving a dead renderer', () => {
  const h = lifecycleHarness();
  h.events.get('webglcontextlost')({ preventDefault() {} });
  h.timers.get(1)();
  h.events.get('webglcontextrestored')();
  assert.equal(h.context.dead, true);
  assert.equal(h.context.ready, false);
  assert.ok(h.notifications.every(value => value === false));
});

test('Restoring WebGL before the model finishes cannot report a ready character', () => {
  const h = lifecycleHarness({ modelReady: false });
  h.events.get('webglcontextlost')({ preventDefault() {} });
  h.events.get('webglcontextrestored')();
  assert.equal(h.context.ready, false);
  assert.deepEqual(h.notifications, [false]);
});

test('Render loop is gated by viewport, tab visibility, reduced motion and context health', () => {
  const source = between(character, '  function updateRunning(){', '  new IntersectionObserver');
  for (const patch of [{}, { inView: false }, { dead: true }, { contextLost: true },
    { ready: false }, { hidden: true }, { reduce: true }]) {
    let ticks = 0;
    const context = vm.createContext({ ready: true, dead: false, contextLost: false, inView: true,
      running: false, rafId: 0, ...patch, document: { hidden: !!patch.hidden },
      RMQ: { matches: !!patch.reduce }, clock: { getDelta() {} },
      tick() { ticks++; }, cancelAnimationFrame() {}, render() {} });
    vm.runInContext(`${source}\nupdateRunning();\nupdateRunning();`, context);
    assert.equal(ticks, Object.keys(patch).length ? 0 : 1, JSON.stringify(patch));
  }
});

test('Optional frame sequence rejects partial assets instead of displaying an empty canvas', async () => {
  const context = vm.createContext({ Promise, setTimeout, clearTimeout,
    Image: class { set src(value) { queueMicrotask(() => this.onerror()); } },
    SequencePlayer: function () { this.images = []; this.cfg = { count: 3, maxParallel: 1, totalTimeout: 100 }; },
  });
  vm.runInContext(`${between(home, '  SequencePlayer.prototype.preload =', '  SequencePlayer.prototype.resize =')}
    SequencePlayer.prototype.url = i => i;
    result = new SequencePlayer().preload();`, context);
  assert.equal(await context.result, false);
});

test('Reduced motion restores the SVG when optional frame mode is active', () => {
  const stage = { style: {} };
  const canvas = { classList: classes() };
  let activate;
  const context = vm.createContext({ $: () => stage, canvas,
    window: { addEventListener() {}, ScrollTrigger: { refresh() {} } },
    player: { resize() {}, render() {} }, gsap: { to() {} }, CFG: { seq: { count: 120 } },
    mm: { add(query, fn) { activate = fn; } }, reanchor() {},
  });
  vm.runInContext(`${between(home, '    function wireCanvas()', '    /* 3D と SVG')}
    wireCanvas();`, context);
  assert.equal(canvas.classList.contains('is-on'), false);
  assert.notEqual(stage.style.display, 'none');
  const cleanup = activate();
  assert.equal(canvas.classList.contains('is-on'), true);
  assert.equal(stage.style.display, 'none');
  cleanup();
  assert.equal(canvas.classList.contains('is-on'), false);
  assert.equal(stage.style.display, '');
});

test('Reduced-motion changes cannot resume stale lighting and override the chosen theme', () => {
  let currentRig;
  const context = vm.createContext({ RMQ: { matches: true }, action: { paused: false },
    themeAnim: { to: 'old-theme' }, RIGS: { red: 'red-rig', moon: 'moon-rig' },
    document: { documentElement: { getAttribute: () => 'red' } },
    applyRig: value => { currentRig = value; }, renderOnce() {}, updateRunning() {},
  });
  vm.runInContext(`${between(character, '  function setTheme(t)', '  function stepTheme(now)')}
    ${between(character, '  const onRM = () =>', "  if (RMQ.addEventListener)")}
    onRM();`, context);
  assert.equal(context.action.paused, true);
  assert.equal(currentRig, 'red-rig');
  assert.equal(context.themeAnim, null);
  vm.runInContext("setTheme('moon');", context);
  assert.equal(currentRig, 'moon-rig');
  assert.equal(context.themeAnim, null);
});
