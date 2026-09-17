/* ==========================================================================
   CUCUL FM.LLC / TOP — UI / motion coordination
   ・GSAP CDN が落ちても素の HTML/CSS で全内容が読める設計
   ・CSS 初期状態は「可視」。JS 到達後に gsap.set で隠してからイントロを流す
   ========================================================================== */
(function () {
  'use strict';

  /* ---------------- CONFIG ---------------- */
  var CFG = {
    seq: {
      enabled: false,           // 連番アセットを配置したときだけ有効化
      path: '/assets/sequence/',
      prefix: 'frame_',
      pad: 4,
      ext: '.png',
      count: 120,
      probeTimeout: 3000,
      totalTimeout: 8000,
      maxParallel: 8
    },
    dustCount: 22,
    burstCount: 12
  };

  var $ = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  /* reduced-motion は起動時スナップショットにせず、MediaQueryList を保持して
     参照のたびに .matches を読む（OS 設定の途中変更に追従させるため） */
  var RMQ = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* hero 表示中だけ回す常時ループ tween の登録簿（#4d） */
  var heroLoops = [], heroInView = true;
  function setHeroLoopsPaused(paused) {
    for (var i = 0; i < heroLoops.length; i++) {
      var t = heroLoops[i];
      if (!t) { continue; }
      if (paused) { t.pause(); } else { t.play(); }
    }
  }

  document.addEventListener('visibilitychange', function () {
    setHeroLoopsPaused(!heroInView || document.hidden);
  });

  /* 深リンク／[data-scroll] の着地点。pin スペーサー挿入後の再アンカーに使う（#11） */
  var deepTarget = null, deepPrevTop = 0;
  function docTop(el) { return el.getBoundingClientRect().top + window.scrollY; }

  /* 3D は progressive enhancement。HTML/SVG とナビは読み込みを待たずに表示し、
     char3d:done により同じスクロール進捗で描画方式だけを切り替える。 */

  /* ======================================================================
     SequencePlayer : /assets/sequence/ に連番があれば canvas 再生に切替わる
     ====================================================================== */
  function SequencePlayer(canvas, cfg) {
    this.canvas = canvas;
    this.ctx = canvas ? canvas.getContext('2d') : null;
    this.cfg = cfg;
    this.images = [];
    this.last = -1;
  }
  SequencePlayer.prototype.url = function (i) {
    var n = String(i + 1);
    while (n.length < this.cfg.pad) { n = '0' + n; }
    return this.cfg.path + this.cfg.prefix + n + this.cfg.ext;
  };
  /* HEAD リクエストより確実な Image() プローブ + 3s タイムアウト */
  SequencePlayer.prototype.probe = function () {
    var self = this;
    return new Promise(function (resolve) {
      var settled = false;
      var img = new Image();
      var t = setTimeout(function () { if (!settled) { settled = true; resolve(false); } }, self.cfg.probeTimeout);
      img.onload = function () { if (!settled) { settled = true; clearTimeout(t); resolve(true); } };
      img.onerror = function () { if (!settled) { settled = true; clearTimeout(t); resolve(false); } };
      img.src = self.url(0);
    });
  };
  /* 8並列プリロード + 全体8sタイムアウト */
  SequencePlayer.prototype.preload = function (onProgress) {
    var self = this, cfg = this.cfg, total = cfg.count, loaded = 0, next = 0, settled = false;
    return new Promise(function (resolve) {
      var timer = setTimeout(function () { if (!settled) { settled = true; resolve(false); } }, cfg.totalTimeout);
      function startNext() {
        if (settled || next >= total) { return; }
        var i = next++;
        var img = new Image();
        img.onload = step;
      img.onerror = function () {
        if (!settled) { settled = true; clearTimeout(timer); resolve(false); }
      };
        img.src = self.url(i);
        self.images[i] = img;
      }
      function step() {
        if (settled) { return; }
        loaded++;
        if (onProgress) { onProgress(loaded / total); }
        if (loaded >= total) {
          if (!settled) { settled = true; clearTimeout(timer); resolve(true); }
        } else { startNext(); }
      }
      for (var k = 0; k < Math.min(cfg.maxParallel, total); k++) { startNext(); }
    });
  };
  SequencePlayer.prototype.resize = function () {
    if (!this.canvas) { return; }
    var dpr = Math.min(window.devicePixelRatio || 1, 2);   /* DPR 上限 2 */
    var r = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.round(r.width * dpr));
    this.canvas.height = Math.max(1, Math.round(r.height * dpr));
    this.last = -1;
  };
  SequencePlayer.prototype.render = function (i) {
    if (i === this.last || !this.ctx) { return; }          /* 同一フレームは再描画しない */
    var img = this.images[i];
    if (!img || !img.complete || !img.naturalWidth) { return; }
    this.last = i;
    var cw = this.canvas.width, ch = this.canvas.height;
    var s = Math.max(cw / img.naturalWidth, ch / img.naturalHeight);  /* cover fit */
    var w = img.naturalWidth * s, h = img.naturalHeight * s;
    this.ctx.clearRect(0, 0, cw, ch);
    this.ctx.drawImage(img, (cw - w) / 2, (ch - h) / 2, w, h);
  };

  /* ======================================================================
     BOOT
     ====================================================================== */
  /* 非GSAP初期化（即時実行 / DCL には登録しない）と initAnimations（DCL待ち）に分割。
     ファイル末尾の起動部を参照。 */

  /* ---------------- dust : span 22個 + CSS 1定義 ---------------- */
  function buildDust() {
    var host = $('#dust');
    /* childElementCount: reduce の ON/OFF を往復しても粒子を二重生成しない */
    if (!host || RMQ.matches || host.childElementCount) { return; }
    var frag = document.createDocumentFragment();
    for (var i = 0; i < CFG.dustCount; i++) {
      var s = document.createElement('span');
      s.style.setProperty('--dl', (Math.random() * 100).toFixed(2) + 'vw');
      s.style.setProperty('--ds', (1.1 + Math.random() * 2.4).toFixed(2) + 'px');
      s.style.setProperty('--dx', (Math.random() * 34 - 17).toFixed(1) + 'vw');
      s.style.setProperty('--dd', (17 + Math.random() * 22).toFixed(1) + 's');
      s.style.setProperty('--dy', (Math.random() * 34).toFixed(1));
      frag.appendChild(s);
    }
    host.appendChild(frag);
  }
  /* reduce を解除したら粒子を後から生成する（有効化方向は CSS の #dust{display:none} が隠す） */
  var onRMChange = function () { if (!RMQ.matches) { buildDust(); } };
  if (RMQ.addEventListener) { RMQ.addEventListener('change', onRMChange); }
  else if (RMQ.addListener) { RMQ.addListener(onRMChange); }

  /* ---------------- キャラSVGのクローン（全IDに seq- 接頭辞） ----------------
     ID が重複すると url(#grad) の参照が先勝ちで壊れるため、defs ごと複製して
     id / url(#..) / (xlink:)href="#.." をまとめて書き換える。 */
  function prefixIds(html) {
    return html
      .replace(/id="/g, 'id="seq-')
      .replace(/url\(#/g, 'url(#seq-')
      .replace(/href="#/g, 'href="#seq-');
  }
  function cloneCharacter() {
    var src = $('#cucul-char'), stage = $('#seq-char-stage');
    if (!src || !stage) { return; }
    /* 背後グローと三日月リングはキャラSVGの外に出したので、シーケンス側にも複製して
       見た目を一致させる（z-index: グロー0 / リング1 / キャラ2） */
    var glow = $('.backglow-anchor'), emb = $('.emblem-anchor');
    stage.innerHTML =
      (glow ? prefixIds(glow.outerHTML) : '') +
      (emb ? prefixIds(emb.outerHTML) : '') +
      prefixIds(src.outerHTML);
  }

  /* ---------------- テーマ（moon / red） ---------------- */
  var themeFx = null;   /* GSAP 側から差し込まれる（未ロードでも切替自体は動く） */
  function initTheme() {
    var root = document.documentElement;
    var btn = $('#theme-switch');
    var live = $('#theme-live');
    var hero = $('#hero');
    var heroVisible = true;

    function apply(t) {
      root.setAttribute('data-theme', t);
      if (btn) { btn.setAttribute('aria-pressed', t === 'red' ? 'true' : 'false'); }
      if (live) { live.textContent = (t === 'red' ? 'テーマをブラッドレッドに切り替えました' : 'テーマをミッドナイトムーンに切り替えました'); }
      if (typeof themeFx === 'function') { themeFx(t); }
      /* GLB キャラのライトリグも連動（moon / red）。module 未着ならスキップ
         （module 側が初期化時に data-theme を読むので取りこぼさない） */
      if (window.__char3d) { window.__char3d.setTheme(t); }
    }
    function toggle() { apply(root.getAttribute('data-theme') === 'red' ? 'moon' : 'red'); }
    if (btn) { btn.addEventListener('click', toggle); }

    /* hero が 50% 以上見えているときだけ Enter をテーマ切替に使う（[ENTERBAR]）。
       Space は一切奪わない = ページ送り（標準スクロール）はそのまま生きる。 */
    if (hero && 'IntersectionObserver' in window) {
      new IntersectionObserver(function (es) {
        var last = es[es.length - 1];          /* 最新のエントリ（es[0] は最古のスナップショット） */
        heroVisible = last.intersectionRatio >= 0.5;
        /* hero が完全に画面外の間は呼吸 / リング回転を止める */
        heroInView = last.isIntersecting;
        setHeroLoopsPaused(!heroInView || document.hidden);
      }, { threshold: [0, 0.25, 0.5, 0.75, 1] }).observe(hero);
    }
    window.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') { return; }
      if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) { return; }
      if (e.isComposing || e.keyCode === 229) { return; }  /* IME 変換確定の Enter は無視 */
      if (!heroVisible) { return; }                       /* hero 外では無反応 */
      if (idxIsOpen()) { return; }                        /* INDEX オーバーレイ表示中は発火させない */
      var a = document.activeElement;
      if (a && a !== document.body) {                     /* 対話要素にフォーカス中は二重発火を避ける */
        if (a.isContentEditable) { return; }
        if (/^(BUTTON|A|INPUT|TEXTAREA|SELECT|VIDEO|AUDIO|SUMMARY|DETAILS|DIALOG)$/.test(a.tagName)) { return; }
      }
      if (e.repeat) { return; }                           /* キーリピートでは再トグルしない */
      /* preventDefault はしない: Enter の既定動作を奪う理由が無い（Space も一切奪わない） */
      toggle();
    });
  }

  /* ---------------- INDEX オーバーレイ ----------------
     ・開閉は CSS transition（.is-open）で完結 = GSAP 未ロードでも動く
     ・GSAP があれば idxFx() で項目の stagger 入場を上乗せする
     ・body 直下の要素なので #seq の pin 区間には一切干渉しない */
  var idxIsOpen = function () { return false; };   /* initTheme の keydown から参照される */
  var idxFx = null;                                /* GSAP 側から差し込まれる */

  function initIndexOverlay() {
    var ov = $('#index-overlay');
    if (!ov) { return; }
    var openers = $$('[data-idx-open]');
    var closeBtn = $('#idx-close');
    var scroller = $('.idx-scroll', ov);
    var lastFocus = null;
    var SEL = 'a[href],button:not([disabled]),[tabindex]:not([tabindex="-1"])';

    idxIsOpen = function () { return ov.classList.contains('is-open'); };

    /* visibility:hidden の要素は焦点を持てないので、可視なものだけを巡回対象にする
       （GSAP の autoAlpha 入場中は一瞬 visibility:hidden になるため両方を見る） */
    function focusables() {
      return $$(SEL, ov).filter(function (el) {
        if (!(el.offsetWidth || el.offsetHeight || el.getClientRects().length)) { return false; }
        return window.getComputedStyle(el).visibility !== 'hidden';
      });
    }
    function setExpanded(v) {
      openers.forEach(function (b) { b.setAttribute('aria-expanded', v ? 'true' : 'false'); });
    }
    function unlock() {
      document.body.classList.remove('idx-locked');
      document.body.style.paddingRight = '';
    }
    function open(opener) {
      if (idxIsOpen()) { return; }
      /* 復帰先は「押した opener」を優先（Safari 等はボタンのクリックで focus が乗らない） */
      var a = document.activeElement;
      lastFocus = (opener && opener.nodeType === 1) ? opener
        : (a && a !== document.body ? a : (openers[0] || null));
      /* スクロールバー消失分を右パディングで相殺（背景の横ズレ防止。overlay scrollbar 環境では 0） */
      var sbw = window.innerWidth - document.documentElement.clientWidth;
      if (sbw > 0) { document.body.style.paddingRight = sbw + 'px'; }
      document.body.classList.add('idx-locked');
      ov.classList.add('is-open');
      ov.setAttribute('aria-hidden', 'false');
      setExpanded(true);
      if (scroller) { scroller.scrollTop = 0; }
      /* offsetHeight の読み出しでスタイル再計算を強制してから focus する。
         visibility:hidden のまま focus() を呼ぶとブラウザに黙って弾かれる。 */
      void ov.offsetHeight;
      if (closeBtn) {
        closeBtn.focus();
        /* 保険: それでも入らなかった場合は次フレームで再試行 */
        if (!ov.contains(document.activeElement)) {
          requestAnimationFrame(function () {
            if (idxIsOpen() && !ov.contains(document.activeElement)) { closeBtn.focus(); }
          });
        }
      }
      if (typeof idxFx === 'function') { idxFx(); }
    }
    function close() {
      if (!idxIsOpen()) { return; }
      ov.classList.remove('is-open');           /* 先に閉状態にする（focusin ガードを無効化するため） */
      ov.setAttribute('aria-hidden', 'true');
      setExpanded(false);
      unlock();
      if (lastFocus && typeof lastFocus.focus === 'function') { lastFocus.focus(); }
      lastFocus = null;
    }

    openers.forEach(function (b) {
      b.addEventListener('click', function () { open(b); });
    });
    /* 同一ページアンカー（#about / #contact）はオーバーレイを閉じてから遷移させる。
       フォーカスは遷移先セクションへ移る（initSmoothScroll が focus する）ため、
       lastFocus を消して opener への復帰スクロールを起こさない */
    $$('a[href^="#"]', ov).forEach(function (a) {
      a.addEventListener('click', function () {
        lastFocus = null;
        close();
      });
    });
    if (closeBtn) { closeBtn.addEventListener('click', close); }
    /* 余白（コンテンツ外）クリックでも閉じる */
    if (scroller) {
      scroller.addEventListener('click', function (e) { if (e.target === scroller) { close(); } });
    }
    /* Tab フォーカストラップ（オーバーレイ内で発生した Tab を巡回させる） */
    ov.addEventListener('keydown', function (e) {
      if (e.key !== 'Tab') { return; }
      var f = focusables();
      if (!f.length) { return; }
      var first = f[0], last = f[f.length - 1], a = document.activeElement;
      if (e.shiftKey) {
        if (a === first || !ov.contains(a)) { e.preventDefault(); last.focus(); }
      } else if (a === last || !ov.contains(a)) { e.preventDefault(); first.focus(); }
    });
    /* Esc は document 側で拾う（オーバーレイ外にフォーカスが逃げていても閉じられる） */
    document.addEventListener('keydown', function (e) {
      if (!idxIsOpen()) { return; }
      if (e.key === 'Escape' || e.key === 'Esc') { e.preventDefault(); close(); }
    });
    /* 保険: 何らかの理由で外へ抜けたフォーカスを引き戻す */
    document.addEventListener('focusin', function (e) {
      if (!idxIsOpen() || ov.contains(e.target)) { return; }
      var f = focusables();
      if (f.length) { f[0].focus(); }
    });
    /* 遷移・bfcache 復帰でスクロールロックを残さない */
    window.addEventListener('pagehide', unlock);
  }

  /* ---------------- SOUND : アンビエントBGM ----------------
     ・<audio> に autoplay は付けない。鳴るのは #btn-sound を押したときだけ
     ・prefers-reduced-motion は「動き」の設定。音の可否判定には使わない
       （音を止めたい人はボタンで止める / 初期状態がそもそも停止）
     ・play() の Promise 拒否（ユーザー操作不足・自動再生ポリシー）で
       表示が ON のまま取り残されないよう、必ず SOUND OFF へ戻す */
  function initSound() {
    var audio = $('#site-bgm'), btn = $('#btn-sound');
    if (!audio || !btn) { return; }

    var VOLUME = 0.32;
    var label = $('.snd-label', btn);
    var wantsSound = false;   /* 同一セッションでユーザーが「鳴らす」を選んだか */
    var dead = false;         /* 音源の読み込み失敗 = 復帰不能 */

    audio.volume = VOLUME;

    function paint(on) {
      if (dead) { return; }
      btn.classList.toggle('is-active', on);
      btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      btn.setAttribute('aria-label', on ? 'BGMを停止する' : 'BGMを再生する');
      if (label) { label.textContent = on ? 'SOUND ON' : 'SOUND OFF'; }
    }

    function fail() {
      if (dead) { return; }
      dead = true; wantsSound = false;
      btn.classList.remove('is-active');
      btn.disabled = true;
      btn.setAttribute('aria-pressed', 'false');
      btn.setAttribute('aria-label', 'BGMは利用できません');
      if (label) { label.textContent = 'SOUND UNAVAILABLE'; }
    }

    /* play() が Promise を返さない旧実装にも耐える */
    function tryPlay() {
      var p;
      try { p = audio.play(); } catch (e) { wantsSound = false; paint(false); return; }
      if (p && typeof p.then === 'function') {
        p.then(function () { paint(true); }, function () { wantsSound = false; paint(false); });
      }
    }

    paint(false);
    if (audio.error) { fail(); }                       /* JS 到達前に失敗していた場合 */

    btn.addEventListener('click', function () {
      if (dead) { return; }
      if (audio.paused) {
        wantsSound = true;
        paint(true);                                   /* 楽観更新 → 拒否されたら tryPlay が戻す */
        tryPlay();
      } else {
        wantsSound = false;
        audio.pause();                                 /* pause イベント経由で paint(false) */
      }
    });

    /* 実際のメディア状態を唯一の正とする（外部要因の停止も表示に反映される） */
    audio.addEventListener('play', function () { paint(true); });
    audio.addEventListener('pause', function () { paint(false); });
    audio.addEventListener('error', fail);
    var src = $('source', audio);
    if (src) { src.addEventListener('error', fail); }  /* 全ソース枯渇前の個別失敗も拾う */

    /* タブ非表示で停止。wantsSound は保持し、復帰時にその人だけ再開を試みる */
    document.addEventListener('visibilitychange', function () {
      if (dead) { return; }
      if (document.hidden) {
        if (!audio.paused) { audio.pause(); }
      } else if (wantsSound && audio.paused) {
        tryPlay();
      }
    });
  }

  /* ---------------- スムーススクロール ---------------- */
  function initSmoothScroll() {
    $$('[data-scroll]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var id = a.getAttribute('href');
        if (!id || id.charAt(0) !== '#') { return; }
        var target = document.querySelector(id);
        if (!target) { return; }
        e.preventDefault();
        /* probe 解決前にここを踏んだ場合も再アンカーの対象にする（#11） */
        deepTarget = target;
        deepPrevTop = docTop(target);
        target.scrollIntoView({ behavior: RMQ.matches ? 'auto' : 'smooth', block: 'start' });
        target.setAttribute('tabindex', '-1');
        target.focus({ preventScroll: true });
      });
    });
  }

  /* ---------------- BUSINESS 横スクロール時のプログレス（rAFスロットル） ---------------- */
  /* ---------------- グローバルナビ: ヒーローを通過したら出す ----------------
     GSAP/ScrollTrigger には依存しない。CDN が落ちても、reduced-motion でも
     ナビだけは確実に機能させるため、rAF スロットルの scroll 監視で完結させる。
     しきい値にヒステリシス（出す/引っ込めるで別の値）を持たせ、境界での明滅を防ぐ。 */
  function initGlobalNav() {
    var bar = $('#gnav'), hero = $('#hero');
    if (!bar) { return; }
    var ticking = false, on = false;
    function threshold() {
      /* ヒーロー下端。ヒーローが無い下層ページでは 1画面分を目安にする */
      return hero ? hero.offsetHeight - 80 : Math.round(window.innerHeight * 0.6);
    }
    function apply() {
      ticking = false;
      var t = threshold();
      var y = window.scrollY || window.pageYOffset || 0;
      var next = on ? y > t - 120 : y > t;   /* 出したら少し戻しても消さない */
      if (next === on) { return; }
      on = next;
      bar.classList.toggle('is-on', on);
      document.documentElement.classList.toggle('past-hero', on);
    }
    function onScroll() {
      if (ticking) { return; }
      ticking = true;
      window.requestAnimationFrame(apply);
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    apply();   /* 再読込時に途中位置から始まる場合に備えて初期評価 */
  }

  function initBizProgressMobile() {
    var sc = $('#biz-scroller'), line = $('#biz-line');
    if (!sc || !line) { return; }
    var ticking = false;
    function update() {
      ticking = false;
      var max = sc.scrollWidth - sc.clientWidth;
      if (max <= 2) { return; }        /* デスクトップ（非スクロール）では ScrollTrigger 側に任せる */
      var r = Math.min(1, Math.max(0, sc.scrollLeft / max));
      line.style.transform = 'scaleX(' + r.toFixed(4) + ')';
    }
    sc.addEventListener('scroll', function () {
      if (ticking) { return; }
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
  }

  /* ---------------- ロードマップ: 狭い画面でだけ畳む ----------------
     本文は常に HTML 内に存在させる方針なので、生成側（build-content.mjs）は
     <details> を必ず open で出す。JS が動く狭い画面でだけ2つ目以降を閉じて
     縦の長さを抑える。JS 無効・GSAP 断のどちらでも全文が読める状態は変わらない。
     一度畳んだら再適用しない（利用者が開いたものを resize で閉じ直さない）。 */
  function initRoadmapFold() {
    var items = $$('.rm-details');
    if (!items.length || !window.matchMedia) { return; }
    var mq = window.matchMedia('(max-width:900px)');
    var done = false;
    function apply() {
      if (done || !mq.matches) { return; }
      done = true;
      items.forEach(function (d, i) { if (i > 0) { d.open = false; } });
    }
    apply();
    if (mq.addEventListener) { mq.addEventListener('change', apply); }
  }

  /* ======================================================================
     GSAP（未ロードなら何もしない = 非表示の焼き付きも起きない）
     ====================================================================== */
  function initAnimations() {
    if (!window.gsap || !window.ScrollTrigger) { return; }
    var gsap = window.gsap, ScrollTrigger = window.ScrollTrigger;
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.config({ ignoreMobileResize: true });

    /* ---- T5 themeFx : 切替時に1回だけ走る演出 ---- */
    themeFx = function () {
      if (RMQ.matches) { return; }
      gsap.fromTo('.beam i',
        { yPercent: -22, scaleY: 1.3, opacity: 0.15 },
        { yPercent: 0, scaleY: 1, opacity: 1, duration: 1.15, ease: 'power2.out', stagger: 0.09, overwrite: true });
      var bg = $('#char-backglow');
      if (bg) {
        gsap.fromTo(bg, { scale: 1 },
          { scale: 1.26, duration: 0.42, yoyo: true, repeat: 1, ease: 'power2.out', transformOrigin: '50% 50%', overwrite: true });
      }
      var parts = $$('.burst i');
      parts.forEach(function (p, i) {
        var a = (i / (parts.length || 1)) * Math.PI * 2 + (Math.random() * 0.5 - 0.25);
        var d = 90 + Math.random() * 140;
        gsap.fromTo(p,
          { x: 0, y: 0, scale: 1, opacity: 1 },
          {
            x: Math.cos(a) * d, y: Math.sin(a) * d * 0.82,
            scale: 0.15, opacity: 0,
            duration: 1.0 + Math.random() * 0.6, ease: 'power2.out', overwrite: true
          });
      });
    };

    /* ---- INDEX オーバーレイ: 開くたびの stagger 入場（CSS transition の上乗せ） ----
       reduced-motion では何もしない（CSS のフェードだけで開く = 二重防御の JS 側） */
    idxFx = function () {
      if (RMQ.matches) { return; }
      gsap.fromTo(['.idx-group h3', '.idx-item'],
        { y: 16, autoAlpha: 0 },
        {
          y: 0, autoAlpha: 1, duration: 0.5, stagger: 0.026, ease: 'power2.out',
          overwrite: true, clearProps: 'transform,opacity,visibility'
        });
    };

    var mm = gsap.matchMedia();

    /* ---------------- reduced-motion : 全て即時可視・静止 ---------------- */
    mm.add('(prefers-reduced-motion: reduce)', function () {
      gsap.set(['.giant-type .w', '.char-zoom', '.hero-top .brand', '.hero-nav > *',
        '.corner', '.hero-bottom > *', '.biz-card', '.news-card',
        '#about .abt-head', '#about .abt-col', '#contact .ct-in > *',
        '.idx-group h3', '.idx-item', '.seq-cap', '#statement .stm-in > *',
        '#fde-cross .fde-in > *', '.step-card', '.btn-fde',
        '.pillar-card', '.svc-item', '.chal-card', '.chal-closing',
        '.rm-item', '.btn-roadmap', '.uc-item', '.faq-item'],
        { clearProps: 'all' });
      gsap.set('#biz-line', { scaleX: 1 });
    });

    /* ---------------- 通常モーション ---------------- */
    mm.add('(prefers-reduced-motion: no-preference)', function () {

      /* --- T1 : イントロ（計 2.2s）
         キャラは .char-zoom（SVG と GLB canvas 双方を包むラッパー）を対象にする。
         #cucul-char 直指定に戻さないこと: GSAP の inline style が 3D スワップの
         visibility 制御（.is-3d クラス）を上書きしてしまう。
         SVG を先に入場させ、GLB の読み込み時間に左右されない。 --- */
      gsap.set('.giant-type .w', { yPercent: 42, autoAlpha: 0 });
      gsap.set('.char-zoom', { scale: 0.94, autoAlpha: 0, transformOrigin: '50% 58%' });
      gsap.set(['.hero-top .brand', '.hero-nav > *', '.corner', '.hero-bottom > *'], { y: 18, autoAlpha: 0 });

      var intro = gsap.timeline({ paused: true, defaults: { ease: 'power3.out' } });
      intro
        .to('.giant-type .w', { yPercent: 0, autoAlpha: 1, duration: 1.1, stagger: 0.06 }, 0.15)
        .to('.char-zoom', { scale: 1, autoAlpha: 1, duration: 1.5, ease: 'power2.out' }, 0.1)
        /* clearProps: インライン transform（translate/rotate/scale:none を含む）を除去しないと
           :hover{transform:translateY(-2px)} が恒久的に効かなくなる */
        .to(['.hero-top .brand', '.hero-nav > *'], { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08, clearProps: 'transform' }, 0.5)
        .to(['.corner', '.hero-bottom > *'], { y: 0, autoAlpha: 1, duration: 0.8, stagger: 0.08 }, 0.72);
      intro.play();

      /* --- T2 : idle 群 ---
         呼吸は SVG 内部(#char-root)ではなく HTML ラッパー .char-breathe に、
         リング回転も SVG 外に出した span(#char-emblem) に対して行う。
         いずれもフィルター入りサブツリーの毎フレーム再ラスタライズを避けるため。 */
      heroLoops.length = 0;
      heroLoops.push(
        gsap.to('.char-breathe', {
          scaleY: 1.012, y: -4, duration: 3.2, ease: 'sine.inOut',
          repeat: -1, yoyo: true, transformOrigin: '50% 100%'
        }),
        gsap.to('#char-emblem', { rotation: 360, duration: 90, ease: 'none', repeat: -1, transformOrigin: '50% 50%' })
      );
      setHeroLoopsPaused(!heroInView || document.hidden);
      /* マウスホイールのドットは CSS @keyframes wheelDot が駆動（reduced-motion はCSS側で停止） */

      /* --- T3 : heroParallax（pin 無し scrub / 奥行き分離） --- */
      var hp = { trigger: '#hero', start: 'top top', end: 'bottom top', scrub: true };
      gsap.to('.giant-type', { yPercent: 15, ease: 'none', scrollTrigger: hp });
      gsap.to('.hero-char-wrap', { yPercent: 8, ease: 'none', scrollTrigger: hp });
      gsap.to('.hero-sky', { yPercent: 4, ease: 'none', scrollTrigger: hp });

      /* --- T5b : STATEMENT（ヒーロー直下の補強キャッチ） ---
         gsap.from を使うので、JS が動かない/GSAP が落ちた場合は
         最初から可視のまま残る（重要本文を JS 依存にしない）。
         clearProps は T6/T7 と同じ理由（インライン transform を残さない）で必須。 */
      gsap.from('#statement .stm-in > *', {
        y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.12, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#statement', start: 'top 82%', once: true }
      });

      /* --- T5d : FDE横断セクション（3事業を横串に通す帯） --- */
      gsap.from('#fde-cross .fde-in > *', {
        y: 26, autoAlpha: 0, duration: 0.9, stagger: 0.1, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#fde-cross', start: 'top 78%', once: true }
      });
      gsap.from(['.step-card', '.btn-fde'], {
        y: 34, autoAlpha: 0, duration: 0.85, stagger: 0.1, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '.fde-steps-in', start: 'top 82%', once: true }
      });

      /* --- T6 : BUSINESS ---
         トリガーは #business ではなく .biz-scroller。3本柱が上に入って
         セクションが長くなったため、#business 基準だと画面外で reveal が
         終わってしまい、カードに到達したときには動きが残らない */
      /* clearProps: インライン transform を残すと :hover の translate:0 -6px に勝ち続け、
         カードが +40px ずれたまま固着して hover リフトも死ぬ */
      gsap.from('.pillar-card', {
        y: 40, autoAlpha: 0, duration: 0.85, stagger: 0.12, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '.pillar-in', start: 'top 80%', once: true }
      });
      gsap.from('.biz-card', {
        y: 40, autoAlpha: 0, duration: 0.85, stagger: 0.12, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '.biz-scroller', start: 'top 85%', once: true }
      });
      gsap.from('.svc-item', {
        y: 28, autoAlpha: 0, duration: 0.75, stagger: 0.06, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '.svc-in', start: 'top 85%', once: true }
      });

      /* --- T6b : 課題提起 / ロードマップ / 活用テーマ（T6 と同じ reveal パターン） --- */
      gsap.from(['.chal-card', '.chal-closing'], {
        y: 34, autoAlpha: 0, duration: 0.8, stagger: 0.07, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#challenges', start: 'top 80%', once: true }
      });
      gsap.from(['.rm-item', '.btn-roadmap'], {
        y: 34, autoAlpha: 0, duration: 0.8, stagger: 0.1, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#roadmap', start: 'top 80%', once: true }
      });
      gsap.from('.uc-item', {
        y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.05, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#usecases', start: 'top 82%', once: true }
      });

      /* --- T7 : NEWS 帯（T6 と同じ reveal パターン。clearProps も同じ理由で必須） --- */
      gsap.from('.news-card', {
        y: 40, autoAlpha: 0, duration: 0.85, stagger: 0.1, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#news', start: 'top 82%', once: true }
      });

      /* --- T8 : ABOUT / CONTACT（昇格で移植。T6/T7 と同じ reveal パターン。
             深リンク #contact 着地時は start 通過済みのため refresh 時に即発火する） --- */
      gsap.from(['#about .abt-head', '#about .abt-col'], {
        y: 40, autoAlpha: 0, duration: 0.85, stagger: 0.12, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#about', start: 'top 78%', once: true }
      });
      gsap.from('.faq-item', {
        y: 24, autoAlpha: 0, duration: 0.7, stagger: 0.06, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#faq', start: 'top 82%', once: true }
      });
      gsap.from('#contact .ct-in > *', {
        y: 34, autoAlpha: 0, duration: 0.8, stagger: 0.08, ease: 'power2.out', clearProps: 'transform',
        scrollTrigger: { trigger: '#contact', start: 'top 80%', once: true }
      });

      /* mm コンテキスト破棄時に登録簿を空にする（破棄済み tween への play/pause を防ぐ） */
      return function () { heroLoops.length = 0; };
    });

    /* プログレスライン（デスクトップのみ scrub。モバイルは scrollLeft 比率）
       トリガーは7カードのスクローラー。#business は3本柱と提供サービスを含んで
       縦に長くなったので、それ基準だとラインが7カードの手前で振り切れる */
    mm.add('(prefers-reduced-motion: no-preference) and (min-width: 768px)', function () {
      gsap.fromTo('#biz-line', { scaleX: 0 }, {
        scaleX: 1, ease: 'none', transformOrigin: 'left center',
        scrollTrigger: { trigger: '.biz-scroller', start: 'top 88%', end: 'bottom 80%', scrub: 0.4 }
      });
    });

    /* --- ヘッドティルト（マウス環境のみ / quickTo は内部 rAF に合流するのでスロットル不要） --- */
    mm.add('(hover: hover) and (pointer: fine) and (prefers-reduced-motion: no-preference)', function () {
      var head = $('#char-head'), face = $('#char-face');
      if (!head || !face) { return; }
      gsap.set(head, { transformOrigin: '50% 92%' });
      gsap.set(face, { transformOrigin: '50% 50%' });
      var qRot = gsap.quickTo(head, 'rotation', { duration: 0.6, ease: 'power3' });
      var qHx = gsap.quickTo(head, 'x', { duration: 0.6, ease: 'power3' });
      var qFx = gsap.quickTo(face, 'x', { duration: 0.7, ease: 'power3' });   /* 視差: 頭の1.4倍 */
      var qFy = gsap.quickTo(face, 'y', { duration: 0.7, ease: 'power3' });
      function onMove(e) {
        var nx = (e.clientX / window.innerWidth - 0.5) * 2;
        var ny = (e.clientY / window.innerHeight - 0.5) * 2;
        qRot(nx * 7);
        qHx(nx * 12);
        qFx(nx * 17);
        qFy(ny * 7);
      }
      window.addEventListener('pointermove', onMove, { passive: true });
      return function () { window.removeEventListener('pointermove', onMove); };
    });

    /* ---------------- T4 : シーケンス区間 ---------------- */
    initSequence(gsap, mm);
  }

  /* ======================================================================
     T4 : canvas シーケンス / フォールバック
     ====================================================================== */
  function initSequence(gsap, mm) {
    var canvas = $('#seq-canvas');
    var loader = $('#loader');
    var fill = $('#ld-fill');
    var num = $('#ld-num');
    var player = new SequencePlayer(canvas, CFG.seq);

    /* 深リンク（/top-v2/#business 等）で開いた場合の着地点を控えておく。
       pin スペーサー（約300vh）は probe 解決後に挿入されるため、そのままでは
       ユーザーの視界がシーケンス途中へすり替わる。 */
    if (location.hash && location.hash.length > 1) {
      var h = null;
      try { h = document.querySelector(location.hash); } catch (err) { h = null; }
      if (h) { deepTarget = h; deepPrevTop = docTop(h); }
    }
    /* pin 生成 + refresh の後に呼ぶ。ずれていない場合と、probe 待ちの間に
       ユーザーが別の場所へスクロールしていた場合は何もしない。 */
    function reanchor() {
      if (!deepTarget) { return; }
      var moved = docTop(deepTarget) - deepPrevTop;
      if (Math.abs(moved) > 2 && Math.abs(window.scrollY - deepPrevTop) < window.innerHeight) {
        deepTarget.scrollIntoView({ behavior: 'auto' });
      }
      deepPrevTop = docTop(deepTarget);
    }

    /* 既定は3D/SVG。存在しない連番への404プローブを通常経路から除外する。 */
    if (!CFG.seq.enabled || typeof window.Promise !== 'function') {
      wireCharacter();
      return;
    }
    player.probe().then(function (hasFrames) {
      if (!hasFrames) { wireCharacter(); return; }
      player.preload(function (p) {
        var pct = Math.round(p * 100);
        if (fill) { fill.style.width = pct + '%'; }
        if (num) { num.textContent = 'LOADING ' + pct + '%'; }
      }).then(function (complete) {
        if (loader) { loader.classList.remove('is-on'); }
        if (complete) { wireCanvas(); }
        else { wireCharacter(); }
      });
    });

    function wireCanvas() {
      var stage = $('#seq-stage-wrap');
      var state = { frame: 0 };
      window.addEventListener('resize', function () {
        player.resize();
        player.render(state.frame);
      }, { passive: true });

      mm.add('(prefers-reduced-motion: no-preference)', function () {
        if (stage) { stage.style.display = 'none'; }
        if (canvas) { canvas.classList.add('is-on'); }
        player.resize();
        player.render(state.frame);
        gsap.to(state, {
          frame: CFG.seq.count - 1, snap: 'frame', ease: 'none',
          scrollTrigger: {
            trigger: '#seq', start: 'top top', end: '+=300%',
            pin: true, scrub: 0.5, anticipatePin: 1
          },
          onUpdate: function () { player.render(state.frame); }
        });
        return function () {
          if (stage) { stage.style.display = ''; }
          if (canvas) { canvas.classList.remove('is-on'); }
        };
      });
      window.ScrollTrigger.refresh();
      reanchor();
    }

    /* 3D と SVG はひとつの pin / timeline を共有する。読み込み・コンテキスト喪失で
       pin を作り直さず、SVG の変形も同じ進捗に保つため、途中切替でも位置が跳ばない。 */
    function wireCharacter() {
      mm.add('(prefers-reduced-motion: no-preference)', function () {
        var seqEl = $('#seq'), stageWrap = $('#seq-stage-wrap'), stage = $('#seq-char-stage');
        if (!seqEl || !stage) { return; }
        var state = { p: 0 };
        var tl;
        gsap.set(stage, { transformOrigin: '50% 32%' });

        function syncCharacter() {
          var c3 = window.__char3d;
          var available = !!(c3 && c3.ready);
          if (stageWrap) { stageWrap.style.display = available ? 'none' : ''; }
          if (!available || !tl || !tl.scrollTrigger) { return; }
          var st = tl.scrollTrigger;
          var rect = seqEl.getBoundingClientRect();
          /* ピン区間または下側の可視窓だけ canvas を seq に置く。逆走時も同じ判定。 */
          var inSequence = st.isActive || (window.scrollY >= st.start && rect.bottom > 0 && rect.top < window.innerHeight);
          c3.seqProgress(state.p);
          if (inSequence) { c3.seqAttach(); }
          else { c3.seqDetach(); }
        }

        tl = gsap.timeline({
          scrollTrigger: {
            trigger: '#seq', start: 'top top', end: '+=300%',
            pin: true, scrub: 0.6, anticipatePin: 1,
            onToggle: syncCharacter
          }
        });
        /* 元のSVG経路・3D進捗・星空・字幕の値をそのまま共有する。 */
        tl.to(state, { p: 1, ease: 'none', duration: 2.6, onUpdate: syncCharacter }, 0)
          .fromTo(stage, { scale: 2.85, yPercent: 24, xPercent: 3 },
            { scale: 2.15, yPercent: 6, xPercent: -2, ease: 'none', duration: 1 }, 0)
          .to(stage, { scale: 1, yPercent: 0, xPercent: 0, ease: 'power1.inOut', duration: 1.35 }, 1)
          .fromTo('#seq-char-head', { rotation: -6 }, { rotation: 4, ease: 'sine.inOut', duration: 2.6 }, 0)
          .fromTo('#seq-char-face', { x: -15 }, { x: 11, ease: 'sine.inOut', duration: 2.6 }, 0)
          .to('.seq-sky', { yPercent: 30, ease: 'none', duration: 2.6 }, 0)
          .fromTo('.seq-cap--1', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.45 }, 0.3)
          .to('.seq-cap--1', { autoAlpha: 0, y: -18, duration: 0.4 }, 1.15)
          .fromTo('.seq-cap--2', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: 0.45 }, 1.55);

        var io = new IntersectionObserver(syncCharacter, { threshold: 0 });
        io.observe(seqEl);
        window.addEventListener('char3d:done', syncCharacter);
        syncCharacter();
        return function () {
          io.disconnect();
          window.removeEventListener('char3d:done', syncCharacter);
          if (window.__char3d) { window.__char3d.seqDetach(); }
          if (stageWrap) { stageWrap.style.display = ''; }
        };
      });
      window.ScrollTrigger.refresh();
      reanchor();
    }
  }

  /* ---- 起動 ----
     非GSAP機能（モーダル/テーマ/スムーススクロール/ダスト/クローン）は deferred な
     GSAP CDN の完了を待たずに即時初期化する。classic script は body 末尾から呼ばれるので
     参照する要素はすべてパース済み。※ ここで初期化したものを DCL に再登録しないこと
     （二重登録するとテーマが2回トグルして打ち消される・ダストが44個になる等の退行が出る）。 */
  buildDust();
  cloneCharacter();
  initIndexOverlay();   /* initTheme より先: keydown ガードが参照する idxIsOpen を確定させる */
  initTheme();
  initSound();
  initSmoothScroll();
  initBizProgressMobile();
  initGlobalNav();
  initRoadmapFold();

  /* GSAP は defer なので DOMContentLoaded 前に必ず実行済み。失敗時は initAnimations 冒頭の
     ガードが無害に抜ける。 */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnimations);
  } else {
    initAnimations();
  }
})();
