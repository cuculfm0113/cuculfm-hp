import * as THREE from 'three';
import { GLTFLoader }      from 'three/addons/loaders/GLTFLoader.js';
import { RGBELoader }      from 'three/addons/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer }  from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass }      from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass }      from 'three/addons/postprocessing/OutputPass.js';

/* ---------------------------------------------------------------- 調整ノブ */
const CFG3D = {
  model: '/character-design/phantom-dj/model.glb',   // 絶対パス（トップ昇格でルート配信のため）
  modelBytes: 5379296,           // gzip 配信で lengthComputable が立たない場合の進捗分母
  height: 1.75,                  // 自動フィット後の全高(m)
  envIntensity: 0.5,
  hdri: 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r170/examples/textures/equirectangular/royal_esplanade_1k.hdr',
  bloom: { threshold: 0.75, strength: 0.50, radius: 0.50 },
  hero: { cam: [0.50, 1.15, 3.95], target: [0, 0.92, 0], fov: 32 },
  pointer: { yaw: 0.16, headYaw: 0.14, headPitch: 0.09 },   // カーソル追従の振れ幅(rad)
};

/* viewer.html と同一の発光・反射ノブ（emissive=baseColor 同一のため絞り必須） */
const GLOW = {
  emissiveIntensity: 0.35,
  specularIntensity: 0.45,
  specularColorMax:  1.0,
  rules: [
    { match: /x|paint|face/i,      color: 0xFFE9A0, intensity: 2.2 },
    { match: /neon|line|circuit/i, color: 0x00E5FF, intensity: 2.4 },
    { match: /headphone|ring/i,    color: 0x00E5FF, intensity: 2.0 },
  ],
};

/* 追加装飾（背中金三日月 / ブーツX）: viewer.html から移植 */
const DECALS = {
  emblem: {
    bone: /^Spine02$/i,
    size: 0.335, curve: 0.55,
    offset: [0, 0.17, -0.21], face: [0, 0, -1], tilt: -0.08,
    emissiveIntensity: 0.65,
  },
  bootX: {
    bones: [/^LeftFoot$/i, /^RightFoot$/i],
    size: 0.068,
    offset: [0.048, 0.03, 0.01], face: [1, 0, 0], tilt: 0,
    emissiveIntensity: 1.6,
  },
};

/* コート裏地の回路ネオン（ライナーメッシュ方式）: viewer.html から移植 */
const LINING = {
  enabled: true,
  intensity: 1.8,
  inset: 0.006,
  repeat: [3, 1.5],
  radialDotMin: 0.35,
  yRange: [0.22, 1.30],
  minRadius: h => 0.135 + Math.max(0, (0.9 - h)) * 0.10,
  maxRadiusAboveWaist: 0.27,
};

/* テーマ別ライトリグ。moon = viewer.html の承認済みリグ / red = 黄リム強化 */
const RIGS = {
  moon: {
    ambient: [0x33405e, 0.45],
    hemi:    [0x2c3d59, 0x080b12, 0.45],
    key:     [0xdae6ff, 1.6],
    fill:    [0x9fb4d4, 0.5],
    rimL:    [0xFFC53D, 8.4],      // 金リム(左・低め / PointLight)
    rimL2:   [0xFFB020, 1.2],
    rimR:    [0x3FE6FF, 7.2],      // シアンリム(右 / PointLight)
    rimR2:   [0x30D8FF, 1.0],
  },
  red: {
    ambient: [0x4a2330, 0.50],
    hemi:    [0x5a1f2a, 0x140409, 0.50],
    key:     [0xffd9c4, 1.45],
    fill:    [0xd4a29b, 0.45],
    rimL:    [0xFFE933, 12.5],     // 黄リム強化（ブランド #f5e100 系）
    rimL2:   [0xF5C400, 2.0],
    rimR:    [0xFF5A3C, 5.0],      // シアン→ウォームレッドへ
    rimR2:   [0xFF3A2E, 0.75],
  },
};

/* seq 区間のカメラキーフレーム（p=scrub 進捗 0..1）。ty = 注視点の高さ */
const SEQ_KEYS = [
  { p: 0.00, cam: [0.14, 1.62, 0.92], ty: 1.58 },   // 顔クローズアップ
  { p: 0.34, cam: [0.26, 1.40, 1.62], ty: 1.24 },   // 胸元へ引き始め
  { p: 0.62, cam: [0.58, 1.14, 3.60], ty: 0.94 },   // 全身
  { p: 1.00, cam: [0.10, 1.08, 4.05], ty: 0.92 },   // 正対
];
const SEQ_TURN = { from: 0.52, to: 1.0 };            // この区間で 360° ターン

/* ---------------------------------------------------------------- 共通 */
const PARAMS = new URLSearchParams(location.search);
const RMQ = window.matchMedia('(prefers-reduced-motion: reduce)');
const emit = (name, detail) => window.dispatchEvent(new CustomEvent(name, { detail }));
const done = ok => emit('char3d:done', { ok });
const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth01 = v => { v = clamp01(v); return v * v * (3 - 2 * v); };
const lerp = (a, b, k) => a + (b - a) * k;

/* 決定的乱数（スクショ再現性 / viewer.html と同一シード） */
function mulberry32(seed){
  return function(){
    seed |= 0; seed = seed + 0x6D2B79F5 | 0;
    let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
const rnd = mulberry32(0x43554355);
const rr  = (a, b) => a + (b - a) * rnd();

function cv(w, h){
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
let MAX_ANISO = 4;
function tex(canvas, { srgb = true, wrap = false } = {}){
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (wrap){ t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = MAX_ANISO;
  t.needsUpdate = true;
  return t;
}

/* ---- 装飾テクスチャ（viewer.html から移植） ---- */
function makeLiningTexture(){
  const S = 1024;
  const c = cv(S, S), g = c.getContext('2d');
  g.fillStyle = '#04060a'; g.fillRect(0, 0, S, S);
  const hr = 46, hh = Math.sqrt(3) / 2 * hr;
  g.strokeStyle = 'rgba(255,212,0,0.10)'; g.lineWidth = 1.4;
  for (let row = -1; row * hh * 1.5 < S + hr; row++){
    for (let col = -1; col * hr * 3 < S + hr * 3; col++){
      const cx0 = col * hr * 3 + (row % 2 ? hr * 1.5 : 0);
      const cy0 = row * hh;
      g.beginPath();
      for (let k = 0; k < 6; k++){
        const a = Math.PI / 180 * (60 * k);
        const px = cx0 + Math.cos(a) * hr, py = cy0 + Math.sin(a) * hr;
        k ? g.lineTo(px, py) : g.moveTo(px, py);
      }
      g.closePath(); g.stroke();
    }
  }
  const DIRS = [[1, 0], [0, 1], [0, -1], [0.7071, 0.7071], [0.7071, -0.7071], [-0.7071, 0.7071]];
  g.lineCap = 'square'; g.lineJoin = 'miter';
  for (let i = 0; i < 34; i++){
    const col = i % 2 === 0 ? '#00E5FF' : '#FFD400';
    let x = rnd() * S, y = rnd() * S;
    let d = DIRS[Math.floor(rnd() * DIRS.length)];
    g.beginPath(); g.moveTo(x, y);
    const segs = 2 + Math.floor(rnd() * 4);
    for (let s = 0; s < segs; s++){
      const len = rr(120, 380);
      x += d[0] * len; y += d[1] * len;
      g.lineTo(x, y);
      d = DIRS[Math.floor(rnd() * DIRS.length)];
    }
    g.strokeStyle = col; g.lineWidth = rr(6, 11);
    g.shadowColor = col; g.shadowBlur = rr(14, 30);
    g.globalAlpha = rr(0.6, 1);
    g.stroke();
    g.fillStyle = col;
    g.beginPath(); g.arc(x, y, rr(7, 13), 0, Math.PI * 2); g.fill();
    g.globalAlpha = 1; g.shadowBlur = 0;
  }
  for (let i = 0; i < 60; i++){
    g.fillStyle = rnd() < 0.5 ? 'rgba(0,229,255,0.8)' : 'rgba(255,212,0,0.75)';
    g.fillRect(rnd() * S, rnd() * S, rr(6, 14), rr(6, 14));
  }
  return c;
}
function makeCrescentTexture(){
  const S = 1024;
  const c = cv(S, S), g = c.getContext('2d');
  const cx = S * 0.385, cy = S * 0.47, R = S * 0.345;
  const grad = g.createLinearGradient(cx - R, cy - R, cx + R * 0.6, cy + R);
  grad.addColorStop(0.00, '#7d570d');
  grad.addColorStop(0.30, '#D4A017');
  grad.addColorStop(0.55, '#F7E39B');
  grad.addColorStop(0.78, '#C89312');
  grad.addColorStop(1.00, '#8a610e');
  g.fillStyle = grad;
  g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(cx + R * 0.36, cy, R * 0.855, 0, Math.PI * 2); g.fill();
  for (let i = 0; i < 22; i++){
    const rr0 = R * (0.87 + i * 0.006);
    g.lineWidth = R * 0.014;
    g.setLineDash([R * rr(0.03, 0.09), R * rr(0.03, 0.10)]);
    g.lineDashOffset = rnd() * 100;
    g.strokeStyle = '#000';
    g.beginPath(); g.arc(cx, cy, rr0, 0, Math.PI * 2); g.stroke();
  }
  g.setLineDash([]);
  for (let i = 0; i < 46; i++){
    const a = Math.PI * 0.42 + (i / 46) * Math.PI * 1.16;
    g.lineWidth = R * 0.012; g.strokeStyle = '#000';
    g.beginPath();
    g.moveTo(cx + Math.cos(a) * R * 0.86, cy + Math.sin(a) * R * 0.86);
    g.lineTo(cx + Math.cos(a) * R * 1.01, cy + Math.sin(a) * R * 1.01);
    g.stroke();
  }
  g.globalCompositeOperation = 'source-over';
  g.strokeStyle = 'rgba(247,227,155,0.85)'; g.lineWidth = R * 0.018;
  g.beginPath(); g.arc(cx, cy, R * 0.995, -Math.PI * 0.5, Math.PI * 0.5, true); g.stroke();
  const ox = cx + R * 0.62;
  g.strokeStyle = '#D4A017'; g.fillStyle = '#E8C24A'; g.lineWidth = R * 0.012;
  g.beginPath(); g.moveTo(ox, cy - R * 1.22); g.lineTo(ox, cy + R * 1.22); g.stroke();
  const marks = [-1.14, -0.74, -0.30, 0.30, 0.74, 1.14];
  marks.forEach((m, i) => {
    const y = cy + R * m, sz = R * (i % 2 ? 0.038 : 0.055);
    g.beginPath();
    g.moveTo(ox, y - sz); g.lineTo(ox + sz * 0.62, y); g.lineTo(ox, y + sz); g.lineTo(ox - sz * 0.62, y);
    g.closePath(); g.fill();
    g.beginPath(); g.arc(ox, y, sz * 1.55, 0, Math.PI * 2); g.stroke();
    g.beginPath();
    g.moveTo(ox - sz * 2.0, y); g.lineTo(ox + sz * 2.0, y); g.stroke();
  });
  [[-1.30, 0.05], [1.30, 0.05]].forEach(([m, s]) => {
    const y = cy + R * m, sz = R * s;
    g.fillStyle = '#F7E39B';
    g.beginPath();
    g.moveTo(ox, y - sz); g.quadraticCurveTo(ox, y, ox + sz, y);
    g.quadraticCurveTo(ox, y, ox, y + sz); g.quadraticCurveTo(ox, y, ox - sz, y);
    g.quadraticCurveTo(ox, y, ox, y - sz); g.fill();
  });
  [[0.30, -0.86], [0.30, 0.86]].forEach(([sx, sy]) => {
    const x = cx + R * sx * 1.5, y = cy + R * sy;
    g.fillStyle = 'rgba(247,227,155,0.9)';
    g.beginPath();
    g.moveTo(x, y - R * 0.07); g.quadraticCurveTo(x, y, x + R * 0.07, y);
    g.quadraticCurveTo(x, y, x, y + R * 0.07); g.quadraticCurveTo(x, y, x - R * 0.07, y);
    g.quadraticCurveTo(x, y, x, y - R * 0.07); g.fill();
  });
  return c;
}
function makeXTexture(hex, glow){
  const S = 256;
  const c = cv(S, S), g = c.getContext('2d');
  if (glow){ g.shadowColor = hex; g.shadowBlur = 26; }
  const m = S * 0.22;
  g.lineCap = 'round'; g.strokeStyle = hex; g.lineWidth = S * 0.085;
  g.beginPath(); g.moveTo(m, m); g.lineTo(S - m, S - m); g.stroke();
  g.beginPath(); g.moveTo(S - m, m); g.lineTo(m, S - m); g.stroke();
  if (glow){ g.shadowBlur = 40; g.stroke(); }
  return c;
}
/* 接地影（透明背景キャラの浮き対策。ページ背景の上に落ちる黒のラジアル） */
function makeShadowTexture(){
  const S = 256;
  const c = cv(S, S), g = c.getContext('2d');
  const p = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  p.addColorStop(0.00, 'rgba(0,0,0,0.62)');
  p.addColorStop(0.45, 'rgba(0,0,0,0.34)');
  p.addColorStop(1.00, 'rgba(0,0,0,0)');
  g.fillStyle = p; g.fillRect(0, 0, S, S);
  return c;
}

/* ================================================================ boot */
/* Promise チェックはメイン側 CHAR3D_ON と対称（three.js のローダー群が Promise 依存） */
if (PARAMS.get('nochar3d') === null && typeof window.Promise === 'function') {
  try { boot(); }
  catch (err) { console.warn('[char3d] init failed → SVG fallback', err); done(false); }
}

function boot(){
  const container = document.getElementById('char3d');
  const heroZoom  = document.querySelector('.char-zoom');
  const heroWrap  = document.querySelector('.hero-char-wrap');
  const seqWrap   = document.getElementById('seq-3d');
  if (!container || !heroZoom || !heroWrap || !seqWrap){ done(false); return; }

  /* ---- renderer（透明背景）---- */
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  MAX_ANISO = Math.min(8, renderer.capabilities.getMaxAnisotropy());

  const scene = new THREE.Scene();          // 背景・フォグなし = ページが世界観を描く
  scene.environmentIntensity = CFG3D.envIntensity;

  const camera = new THREE.PerspectiveCamera(CFG3D.hero.fov, 5 / 6, 0.1, 60);

  /* rig(ヨー回転専用) > wrapper(自動フィット) > model */
  const rig = new THREE.Group();
  const wrapper = new THREE.Group();
  rig.add(wrapper);
  scene.add(rig);

  /* ---- ライト（viewer.html のリグ + テーマ切替） ---- */
  const L = {
    ambient: new THREE.AmbientLight(),
    hemi:    new THREE.HemisphereLight(),
    key:     new THREE.DirectionalLight(),
    fill:    new THREE.DirectionalLight(),
    rimL:    new THREE.PointLight(0xffffff, 1, 9, 2.0),
    rimL2:   new THREE.DirectionalLight(),
    rimR:    new THREE.PointLight(0xffffff, 1, 9, 2.0),
    rimR2:   new THREE.DirectionalLight(),
  };
  L.key.position.set(2.0, 4.2, 3.0);
  L.fill.position.set(-1.4, 0.7, 2.6);
  L.rimL.position.set(-1.75, 0.60, 0.45);
  L.rimL2.position.set(-3.0, 1.2, -0.8);
  L.rimR.position.set(1.95, 1.50, -0.85);
  L.rimR2.position.set(2.6, 2.2, -1.8);
  Object.values(L).forEach(l => scene.add(l));

  function applyRig(rigDef){
    L.ambient.color.setHex(rigDef.ambient[0]); L.ambient.intensity = rigDef.ambient[1];
    L.hemi.color.setHex(rigDef.hemi[0]); L.hemi.groundColor.setHex(rigDef.hemi[1]); L.hemi.intensity = rigDef.hemi[2];
    ['key', 'fill', 'rimL', 'rimL2', 'rimR', 'rimR2'].forEach(k => {
      L[k].color.setHex(rigDef[k][0]); L[k].intensity = rigDef[k][1];
    });
  }
  applyRig(RIGS[document.documentElement.getAttribute('data-theme') === 'red' ? 'red' : 'moon']);

  /* テーマ遷移: 現在値→目標リグを 0.8s で lerp（CSS の .8s ease に同調） */
  let themeAnim = null;
  const _lerpColor = new THREE.Color();
  function setTheme(t){
    const to = RIGS[t === 'red' ? 'red' : 'moon'];
    if (RMQ.matches){ themeAnim = null; applyRig(to); renderOnce(); return; }
    const from = {};
    Object.keys(L).forEach(k => {
      from[k] = { c: L[k].color.clone(), i: L[k].intensity, g: L[k].groundColor ? L[k].groundColor.clone() : null };
    });
    themeAnim = { t0: performance.now(), dur: 800, from, to };
  }
  function stepTheme(now){
    if (!themeAnim) return;
    const k = smooth01((now - themeAnim.t0) / themeAnim.dur);
    const { from, to } = themeAnim;
    Object.keys(L).forEach(key => {
      const f = from[key], d = to[key];
      L[key].color.copy(f.c).lerp(_lerpColor.setHex(d[0]), k);
      L[key].intensity = lerp(f.i, key === 'hemi' ? d[2] : d[1], k);
      if (f.g && L[key].groundColor){ L[key].groundColor.copy(f.g).lerp(_lerpColor.setHex(d[1]), k); }
    });
    if (k >= 1) themeAnim = null;
  }

  /* ---- 環境光（HDRI → RoomEnvironment フォールバック） ----
     関数化してあるのは WebGL コンテキスト復帰時の再生成のため:
     scene.environment は PMREM のレンダーターゲット由来テクスチャなので、
     コンテキスト喪失→復帰でGPU側の中身が失われ、自動では復元されない */
  let pmrem = null;
  function useRoomEnvironment(){
    const room = new RoomEnvironment();
    scene.environment = pmrem.fromScene(room, 0.04).texture;
    room.dispose?.();
  }
  function setupEnvironment(){
    if (pmrem) pmrem.dispose();
    pmrem = new THREE.PMREMGenerator(renderer);
    pmrem.compileEquirectangularShader();
    new RGBELoader().load(
      CFG3D.hdri,
      hdr => {
        hdr.mapping = THREE.EquirectangularReflectionMapping;
        scene.environment = pmrem.fromEquirectangular(hdr).texture;
        hdr.dispose();
        renderOnce();
      },
      undefined,
      () => { try { useRoomEnvironment(); renderOnce(); } catch (e){ console.info('[char3d] env fallback skipped', e); } }
    );
  }
  setupEnvironment();

  /* ---- 接地影 ---- */
  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.85, 48),
    new THREE.MeshBasicMaterial({ map: tex(makeShadowTexture()), transparent: true, depthWrite: false })
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.x = 1.25;
  shadow.position.y = 0.001;
  shadow.renderOrder = -1;
  scene.add(shadow);

  /* ---- ポスト（Bloom はデスクトップのみ。モバイルは直接レンダ = 簡略化） ----
     UnrealBloomPass は素のままだと透明背景を殺す: ガウスブラーが
     `gl_FragColor = vec4(diffuseSum/weightSum, 1.0)` と全面 alpha=1 を書き、
     最終の加算合成で canvas 全体が不透明の黒になる。ブラーで alpha も
     同様に畳み込むようシェーダ文字列をパッチする（three r170 の文字列に依存。
     バージョン更新で置換が外れた場合は Bloom を諦めて直接レンダに落とす）。 */
  function patchBloomAlpha(pass){
    let ok = true;
    pass.separableBlurMaterials.forEach(m => {
      const out = m.fragmentShader
        .replace('vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;',
                 'vec4 diffuseSum = texture2D( colorTexture, vUv ) * weightSum;')
        .replace('vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;',
                 'vec4 sample1 = texture2D( colorTexture, vUv + uvOffset );')
        .replace('vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;',
                 'vec4 sample2 = texture2D( colorTexture, vUv - uvOffset );')
        .replace('gl_FragColor = vec4(diffuseSum/weightSum, 1.0);',
                 'gl_FragColor = diffuseSum / weightSum;');
      if (out.indexOf('vec4 diffuseSum') < 0 || out.indexOf('gl_FragColor = diffuseSum / weightSum;') < 0){
        ok = false;
        return;
      }
      m.fragmentShader = out;
      m.needsUpdate = true;
    });
    return ok;
  }
  const USE_BLOOM = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  let composer = null, bloom = null;
  if (USE_BLOOM){
    bloom = new UnrealBloomPass(new THREE.Vector2(128, 128),
      CFG3D.bloom.strength, CFG3D.bloom.radius, CFG3D.bloom.threshold);
    if (patchBloomAlpha(bloom)){
      composer = new EffectComposer(renderer);
      composer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      composer.addPass(new RenderPass(scene, camera));
      composer.addPass(bloom);
      composer.addPass(new OutputPass());
    } else {
      console.warn('[char3d] bloom alpha patch failed → direct render');
      bloom.dispose?.();
      bloom = null;
    }
  }

  /* ---- GLOW 適用 / 自動フィット / 装飾（viewer.html から移植） ---- */
  function applyGlow(mesh, mat){
    const key = `${mesh.name || ''} ${mat.name || ''}`;
    const rule = GLOW.rules.find(r => r.match.test(key));
    if (rule){
      if (mat.emissive && rule.color !== undefined) mat.emissive.setHex(rule.color);
      mat.emissiveIntensity = rule.intensity;
    } else {
      mat.emissiveIntensity = GLOW.emissiveIntensity;
    }
    if (mat.isMeshPhysicalMaterial){
      mat.specularIntensity = GLOW.specularIntensity;
      if (mat.specularColor){
        const m = Math.max(mat.specularColor.r, mat.specularColor.g, mat.specularColor.b);
        if (m > GLOW.specularColorMax) mat.specularColor.multiplyScalar(GLOW.specularColorMax / m);
      }
    }
    mat.needsUpdate = true;
  }

  function fitToStage(root){
    wrapper.scale.setScalar(1);
    wrapper.position.set(0, 0, 0);
    wrapper.updateMatrixWorld(true);
    const box0 = new THREE.Box3().setFromObject(root);
    const size0 = box0.getSize(new THREE.Vector3());
    const s = size0.y > 1e-6 ? CFG3D.height / size0.y : 1;
    wrapper.scale.setScalar(s);
    wrapper.updateMatrixWorld(true);
    const box1 = new THREE.Box3().setFromObject(root);
    const c = box1.getCenter(new THREE.Vector3());
    wrapper.position.set(-c.x, -box1.min.y, -c.z);
    wrapper.updateMatrixWorld(true);
    return s;
  }

  function curvedPlane(size, curve){
    if (curve <= 0.001) return new THREE.PlaneGeometry(size, size);
    const R = size / curve;
    const geo = new THREE.CylinderGeometry(R, R, size, 24, 1, true, -curve / 2, curve);
    geo.translate(0, 0, -R);
    return geo;
  }
  function attachToBone(bone, mesh, worldPos, faceDir, tilt){
    bone.updateWorldMatrix(true, false);
    const up = new THREE.Vector3(0, 1, 0);
    const m = new THREE.Matrix4().lookAt(new THREE.Vector3(0, 0, 0), new THREE.Vector3().fromArray(faceDir).negate(), up);
    const q = new THREE.Quaternion().setFromRotationMatrix(m);
    if (tilt) q.multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt));
    const world = new THREE.Matrix4().compose(worldPos, q, new THREE.Vector3(1, 1, 1));
    const local = new THREE.Matrix4().copy(bone.matrixWorld).invert().multiply(world);
    local.decompose(mesh.position, mesh.quaternion, mesh.scale);
    mesh.frustumCulled = false;
    mesh.renderOrder = 2;
    bone.add(mesh);
  }
  function attachDecals(model, bones){
    const findBone = re => bones.find(b => re.test(b.name));
    const bp = new THREE.Vector3();
    {
      const cfg = DECALS.emblem;
      const bone = findBone(cfg.bone);
      if (bone){
        const crescent = tex(makeCrescentTexture());
        const mat = new THREE.MeshPhysicalMaterial({
          map: crescent, transparent: true,
          metalness: 0.85, roughness: 0.38,
          emissive: 0xD4A017, emissiveMap: crescent,
          emissiveIntensity: cfg.emissiveIntensity,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
          depthWrite: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(curvedPlane(cfg.size, cfg.curve), mat);
        mesh.name = 'decal.emblem';
        bone.getWorldPosition(bp);
        attachToBone(bone, mesh, bp.clone().add(new THREE.Vector3().fromArray(cfg.offset)), cfg.face, cfg.tilt);
      }
    }
    {
      const cfg = DECALS.bootX;
      const xtex = tex(makeXTexture('#8CF4FF', true));
      cfg.bones.forEach((re, i) => {
        const bone = findBone(re);
        if (!bone) return;
        const s = i === 0 ? 1 : -1;
        const mat = new THREE.MeshStandardMaterial({
          map: xtex, transparent: true,
          emissive: 0x00E5FF, emissiveMap: xtex,
          emissiveIntensity: cfg.emissiveIntensity,
          roughness: 0.6, metalness: 0,
          polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
          depthWrite: false, side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(cfg.size, cfg.size), mat);
        mesh.name = 'decal.bootX.' + bone.name;
        bone.getWorldPosition(bp);
        const off = new THREE.Vector3(s * cfg.offset[0], cfg.offset[1], cfg.offset[2]);
        attachToBone(bone, mesh, bp.clone().add(off), [s * cfg.face[0], cfg.face[1], cfg.face[2]], cfg.tilt);
      });
    }
  }
  function buildLining(model){
    if (!LINING.enabled) return;
    let src = null;
    model.traverse(o => { if (!src && o.isSkinnedMesh) src = o; });
    if (!src) return;
    const geo = src.geometry;
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const si  = geo.attributes.skinIndex;
    const sw  = geo.attributes.skinWeight;
    const idx = geo.index ? geo.index.array : null;
    const triCount = (idx ? idx.length : pos.count) / 3;
    const keep = [];
    const A = new THREE.Vector3(), B = new THREE.Vector3(), C = new THREE.Vector3();
    const nrm = new THREE.Vector3(), cen = new THREE.Vector3(), rad = new THREE.Vector3();
    for (let t = 0; t < triCount; t++){
      const i0 = idx ? idx[t * 3] : t * 3;
      const i1 = idx ? idx[t * 3 + 1] : t * 3 + 1;
      const i2 = idx ? idx[t * 3 + 2] : t * 3 + 2;
      A.fromBufferAttribute(pos, i0);
      B.fromBufferAttribute(pos, i1);
      C.fromBufferAttribute(pos, i2);
      cen.copy(A).add(B).add(C).multiplyScalar(1 / 3);
      const h = cen.y;
      if (h < LINING.yRange[0] || h > LINING.yRange[1]) continue;
      const r = Math.hypot(cen.x, cen.z);
      if (r < LINING.minRadius(h)) continue;
      if (h > 0.7 && r > LINING.maxRadiusAboveWaist) continue;
      nrm.set(
        nor.getX(i0) + nor.getX(i1) + nor.getX(i2),
        nor.getY(i0) + nor.getY(i1) + nor.getY(i2),
        nor.getZ(i0) + nor.getZ(i1) + nor.getZ(i2)
      ).normalize();
      rad.set(cen.x, 0, cen.z).normalize();
      if (nrm.dot(rad) < LINING.radialDotMin) continue;
      keep.push(i0, i1, i2);
    }
    if (!keep.length) return;
    const n = keep.length;
    const p2 = new Float32Array(n * 3), n2 = new Float32Array(n * 3);
    const u2 = new Float32Array(n * 2);
    const s2 = new (si.array.constructor)(n * 4);
    const w2 = new Float32Array(n * 4);
    const thetaOf = i => Math.atan2(pos.getX(i), pos.getZ(i));
    for (let t = 0; t < n; t += 3){
      const th = [thetaOf(keep[t]), thetaOf(keep[t + 1]), thetaOf(keep[t + 2])];
      for (let k = 1; k < 3; k++){
        if (th[k] - th[0] >  Math.PI) th[k] -= Math.PI * 2;
        if (th[k] - th[0] < -Math.PI) th[k] += Math.PI * 2;
      }
      for (let k = 0; k < 3; k++){
        const i = keep[t + k], o3 = (t + k) * 3, o2 = (t + k) * 2, o4 = (t + k) * 4;
        p2[o3]     = pos.getX(i) - nor.getX(i) * LINING.inset;
        p2[o3 + 1] = pos.getY(i) - nor.getY(i) * LINING.inset;
        p2[o3 + 2] = pos.getZ(i) - nor.getZ(i) * LINING.inset;
        n2[o3] = -nor.getX(i); n2[o3 + 1] = -nor.getY(i); n2[o3 + 2] = -nor.getZ(i);
        u2[o2]     = (th[k] / (Math.PI * 2)) * LINING.repeat[0];
        u2[o2 + 1] = (pos.getY(i) / 1.7) * LINING.repeat[1];
        for (let j = 0; j < 4; j++){ s2[o4 + j] = si.array[i * 4 + j]; w2[o4 + j] = sw.array[i * 4 + j]; }
      }
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position',   new THREE.BufferAttribute(p2, 3));
    lg.setAttribute('normal',     new THREE.BufferAttribute(n2, 3));
    lg.setAttribute('uv',         new THREE.BufferAttribute(u2, 2));
    lg.setAttribute('skinIndex',  new THREE.BufferAttribute(s2, 4));
    lg.setAttribute('skinWeight', new THREE.BufferAttribute(w2, 4));
    const mat = new THREE.MeshStandardMaterial({
      color: 0x05070a, roughness: 0.8, metalness: 0,
      emissive: 0xffffff, emissiveMap: tex(makeLiningTexture(), { wrap: true }),
      emissiveIntensity: LINING.intensity,
      side: THREE.BackSide,
    });
    const liner = new THREE.SkinnedMesh(lg, mat);
    liner.name = 'coat.lining';
    liner.frustumCulled = false;
    src.parent.add(liner);
    liner.bind(src.skeleton, src.bindMatrix);
    liner.bindMode = src.bindMode;
  }

  /* ---- カメラ制御 ---- */
  let mode = 'hero';           // 'hero' | 'seq'
  let lastP = 0;
  function applyHeroCam(){
    camera.position.set(CFG3D.hero.cam[0], CFG3D.hero.cam[1], CFG3D.hero.cam[2]);
    camera.lookAt(CFG3D.hero.target[0], CFG3D.hero.target[1], CFG3D.hero.target[2]);
    rig.rotation.y = 0;
  }
  function applySeqCam(p){
    p = clamp01(p);
    let a = SEQ_KEYS[0], b = SEQ_KEYS[SEQ_KEYS.length - 1];
    for (let i = 0; i < SEQ_KEYS.length - 1; i++){
      if (p >= SEQ_KEYS[i].p && p <= SEQ_KEYS[i + 1].p){ a = SEQ_KEYS[i]; b = SEQ_KEYS[i + 1]; break; }
    }
    const k = smooth01((p - a.p) / Math.max(1e-6, b.p - a.p));
    camera.position.set(
      lerp(a.cam[0], b.cam[0], k),
      lerp(a.cam[1], b.cam[1], k),
      lerp(a.cam[2], b.cam[2], k)
    );
    camera.lookAt(0, lerp(a.ty, b.ty, k), 0);
    rig.rotation.y = smooth01((p - SEQ_TURN.from) / (SEQ_TURN.to - SEQ_TURN.from)) * Math.PI * 2;
  }
  applyHeroCam();

  /* ---- モデル ---- */
  let model = null, mixer = null, action = null, headBone = null;
  let ready = false, modelReady = false, contextLost = false, fadeRaf = 0;

  new GLTFLoader().load(
    CFG3D.model,
    gltf => {
      try {
        if (dead) return;
        model = gltf.scene;
        wrapper.add(model);
        const bones = [];
        model.traverse(o => {
          if (o.isBone) bones.push(o);
          if (o.isSkinnedMesh) o.frustumCulled = false;
          if (!o.isMesh && !o.isSkinnedMesh) return;
          const mats = Array.isArray(o.material) ? o.material : [o.material];
          mats.forEach(mt => {
            if (!mt) return;
            ['map', 'emissiveMap', 'normalMap', 'roughnessMap', 'metalnessMap'].forEach(k => {
              if (mt[k]) mt[k].anisotropy = MAX_ANISO;
            });
            applyGlow(o, mt);
          });
        });
        fitToStage(model);
        try { attachDecals(model, bones); } catch (e){ console.warn('[char3d] decals failed:', e); }
        try { buildLining(model); } catch (e){ console.warn('[char3d] lining failed:', e); }
        headBone = bones.find(b => /^head$/i.test(b.name)) || bones.find(b => /head/i.test(b.name)) || null;

        if (gltf.animations && gltf.animations.length){
          mixer = new THREE.AnimationMixer(model);
          action = mixer.clipAction(gltf.animations[0]);
          action.setLoop(THREE.LoopRepeat, Infinity);
          action.play();
          if (RMQ.matches){ mixer.update(0.42); action.paused = true; }   // 静止=中間ポーズ
        }

        /* ---- スワップ（SVG → canvas のクロスフェード） ----
           GLB ダウンロード中にテーマが切り替わっている可能性があるため、
           表示直前に data-theme を読み直してリグを再同期する（lerp 不要 = 即時） */
        themeAnim = null;
        applyRig(RIGS[document.documentElement.getAttribute('data-theme') === 'red' ? 'red' : 'moon']);
        modelReady = true;
        window.__char3d = api;
        if (contextLost) return; // 復帰イベントが読み込み済みモデルを有効化する
        ready = true;
        container.classList.add('is-on');
        resize();
        /* 先に通知して現在のスクロール進捗・canvas の親を同期してから描画する。 */
        done(true);
        render();
        if (mode === 'seq' || RMQ.matches) {
          container.style.opacity = '1';
          heroWrap.classList.add('is-3d');
        } else {
          fadeIn(container, 420, () => heroWrap.classList.add('is-3d'));
        }
        updateRunning();
        console.log('[char3d] ready — bloom:', USE_BLOOM, '| bones:', bones.length,
          '| head:', headBone ? headBone.name : '(none)');
      } catch (err){
        console.warn('[char3d] setup failed → SVG fallback', err);
        giveUpWebGL();
      }
    },
    ev => {
      const total = (ev && ev.lengthComputable && ev.total > 0) ? ev.total : CFG3D.modelBytes;
      emit('char3d:progress', { ratio: clamp01((ev ? ev.loaded : 0) / total) });
    },
    err => {
      console.warn('[char3d] model.glb load failed → SVG fallback',
        (err && (err.message || err.type)) || err);
      giveUpWebGL();
    }
  );

  function fadeIn(el, dur, onDone){
    cancelAnimationFrame(fadeRaf);
    el.style.opacity = '0';
    const t0 = performance.now();
    (function step(){
      if (!ready || contextLost || dead) return;
      const k = RMQ.matches ? 1 : clamp01((performance.now() - t0) / dur);
      el.style.opacity = String(k);
      if (k < 1){ fadeRaf = requestAnimationFrame(step); }
      else if (onDone){ onDone(); }
    })();
  }

  /* ---- resize ----
     寸法が前回と同じなら何もしない: RO と window resize の二重発火や
     attach/detach 時の同寸法呼び出しで、描画バッファ+HalfFloat RT+bloom ミップの
     再確保を走らせないため（hero⇔seq カット時の1回限りの再確保は許容） */
  let lastW = 0, lastH = 0, lastPr = 0;
  function resize(){
    const w = container.clientWidth, h = container.clientHeight;
    if (!w || !h) return;
    const pr = Math.min(window.devicePixelRatio || 1, 2);
    if (w === lastW && h === lastH && pr === lastPr) return;
    lastW = w; lastH = h; lastPr = pr;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(pr);
    renderer.setSize(w, h, false);          // style は CSS(width/height:100%) が担う
    if (composer){
      composer.setPixelRatio(pr);
      composer.setSize(w, h);
      /* bloom.setSize は呼ばない: composer.setSize が全 pass をデバイスピクセルで
         サイズ済み。ここで CSS ピクセルを渡すと pixelRatio を打ち消して
         bloom の解像度が 1/4 面積に落ちる */
    }
  }
  window.addEventListener('resize', () => { resize(); renderOnce(); });
  if (window.ResizeObserver) new ResizeObserver(() => { resize(); renderOnce(); }).observe(container);

  /* ---- カーソル追従（ヒーローのみ / hover+fine 環境） ---- */
  let px = 0, py = 0, yawS = 0, pxS = 0, pyS = 0;
  const _hq = new THREE.Quaternion(), _he = new THREE.Euler();
  if (USE_BLOOM){   // hover+fine と同条件
    window.addEventListener('pointermove', e => {
      px = (e.clientX / window.innerWidth - 0.5) * 2;
      py = (e.clientY / window.innerHeight - 0.5) * 2;
    }, { passive: true });
  }

  /* ---- ループ（非表示時は停止 / reduced-motion はオンデマンド描画のみ） ---- */
  const clock = new THREE.Clock();
  let running = false, inView = false, dead = false, rafId = 0;
  let frames = 0, fpsT0 = performance.now(), fps = 0, fpsLogged = false;

  function render(){
    if (dead || contextLost) return;
    if (composer){ composer.render(); } else { renderer.render(scene, camera); }
  }
  function renderOnce(){ if (ready && !running){ render(); } }

  function tick(){
    if (!running) return;
    /* rafId を保持して停止時に cancel する。タブ非表示中に凍結された予約済み
       コールバックを放置すると、再表示時の再開と合わせて rAF チェーンが
       多重化し、タブ往復のたびに描画負荷が累積する */
    rafId = requestAnimationFrame(tick);
    const dt = Math.min(clock.getDelta(), 0.1);
    const now = performance.now();
    if (mixer && !RMQ.matches) mixer.update(dt);
    stepTheme(now);
    if (mode === 'hero'){
      /* 全身ヨー + Head ボーンの微オフセット（mixer 適用後に上乗せ） */
      const damp = Math.min(1, dt * 4.5);
      yawS += (px * CFG3D.pointer.yaw - yawS) * damp;
      pxS += (px - pxS) * damp;
      pyS += (py - pyS) * damp;
      rig.rotation.y = yawS;
      /* mixer が毎フレーム quaternion を書き戻す前提の「上乗せ」。
         アニメ無し GLB では累積回転になるため mixer 必須ガード */
      if (headBone && mixer && !RMQ.matches){
        _he.set(pyS * CFG3D.pointer.headPitch, pxS * CFG3D.pointer.headYaw, 0);
        _hq.setFromEuler(_he);
        headBone.quaternion.multiply(_hq);
      }
    }
    render();
    frames++;
    if (now - fpsT0 >= 1000){
      fps = Math.round(frames * 1000 / (now - fpsT0));
      frames = 0; fpsT0 = now;
      if (!fpsLogged && ready){
        fpsLogged = true;
        console.log('[char3d] fps ≈ ' + fps + ' | drawcalls ' + renderer.info.render.calls +
          ' | tris ' + renderer.info.render.triangles);
      }
    }
  }
  function updateRunning(){
    const should = ready && !dead && !contextLost && inView && !document.hidden && !RMQ.matches;
    if (should && !running){ running = true; clock.getDelta(); tick(); }
    else if (!should && running){ running = false; cancelAnimationFrame(rafId); }
    if (ready && !running && !document.hidden){ render(); }   // 静止1フレーム
  }
  new IntersectionObserver(es => {
    inView = es[es.length - 1].isIntersecting;
    updateRunning();
  }, { threshold: 0 }).observe(container);
  document.addEventListener('visibilitychange', updateRunning);
  const onRM = () => {
    if (action){ action.paused = RMQ.matches; }
    if (RMQ.matches){ setTheme(document.documentElement.getAttribute('data-theme')); }
    updateRunning();
  };
  if (RMQ.addEventListener) RMQ.addEventListener('change', onRM);
  else if (RMQ.addListener) RMQ.addListener(onRM);

  /* ---- WebGL コンテキスト喪失 ----
     即座に SVG を同じスクロール進捗で表示。4s 以内の復帰は3Dへ再同期し、
     期限切れは SVG を継続する。ready は実際に描画できる状態のみを示す。 */
  let ctxTimer = 0;
  function showFallback(){
    ready = false;
    running = false;
    cancelAnimationFrame(rafId);
    cancelAnimationFrame(fadeRaf);
    seqDetach();
    heroWrap.classList.remove('is-3d');
    container.classList.remove('is-on');
    seqWrap.classList.remove('is-on');
    const stage = document.getElementById('seq-stage-wrap');
    if (stage) stage.style.display = '';
    done(false);
  }
  function giveUpWebGL(){
    if (dead) return;
    dead = true;
    clearTimeout(ctxTimer);
    showFallback();
    console.warn('[char3d] unavailable → SVG fallback');
  }
  renderer.domElement.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    if (dead) return;
    contextLost = true;
    showFallback();
    clearTimeout(ctxTimer);
    ctxTimer = setTimeout(giveUpWebGL, 4000);
    console.warn('[char3d] webgl context lost');
  });
  renderer.domElement.addEventListener('webglcontextrestored', () => {
    clearTimeout(ctxTimer);
    if (dead) return;
    contextLost = false;
    setupEnvironment();
    if (!modelReady) return;
    ready = true;
    container.style.opacity = '1';
    container.classList.add('is-on');
    heroWrap.classList.add('is-3d');
    done(true);
    resize();
    updateRunning();
  });

  /* ---- seq 連携 API（home.js の共有シーケンスから呼ばれる） ---- */
  function seqAttach(){
    if (!ready || dead || contextLost || mode === 'seq') return;
    mode = 'seq';
    cancelAnimationFrame(fadeRaf);
    container.style.opacity = '1';
    heroWrap.classList.add('is-3d');
    seqWrap.classList.add('is-on');
    seqWrap.appendChild(container);
    resize();
    applySeqCam(lastP);
    renderOnce();
  }
  function seqDetach(){
    if (mode === 'hero') return;
    mode = 'hero';
    heroZoom.appendChild(container);
    seqWrap.classList.remove('is-on');
    resize();
    applyHeroCam();
    renderOnce();
  }
  function seqProgress(p){
    lastP = p;
    if (mode === 'seq' && !dead){
      applySeqCam(p);
      renderOnce();          // ループ停止環境（保険）でも scrub に追従
    }
  }

  const api = {
    get ready(){ return ready; },
    get mode(){ return mode; },
    get fps(){ return fps; },
    get state(){
      return Object.freeze({ ready, mode, running, inView, contextLost, dead, progress: lastP,
        camera: Object.freeze(camera.position.toArray()), yaw: rig.rotation.y });
    },
    three: THREE, scene, camera, rig, wrapper, renderer,
    setTheme, seqAttach, seqDetach, seqProgress, resize,
    renderOnce: () => render(),
  };
}
