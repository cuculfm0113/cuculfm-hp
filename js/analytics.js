/* ==========================================================================
   CUCUL FM - 計測（dataLayer へのイベント送出）
   ==========================================================================

   ・GTM が入っていなくても安全に動く。このファイルは window.dataLayer に
     push するだけで、GTM コンテナの読み込みは行わない
     （GTM スニペットは content/site.config.json の analytics.gtmId が
       設定されたときだけ、build-content.mjs が各HTMLへ書き出す）
   ・計測が本文の機能を止めないよう、送出は必ず try/catch で囲む
   ・イベント名は docs/redesign/06-analytics.md の一覧と対応する

   送出するイベント:
     contact_form_view     お問い合わせセクションが画面に入った（1回）
     contact_form_start    フォームに最初のフォーカスが入った（1回）
     contact_form_submit   送信（バリデーション通過後） … form-handler.js から
     contact_form_success  送信成功                       … form-handler.js から
     contact_form_error    送信失敗                       … form-handler.js から
     click_phone           tel: リンクのクリック
     click_email           mailto: リンクのクリック
     click_consultation_cta / click_fde_service / click_roadmap
                           [data-ga-event] を持つリンク・ボタンのクリック
     scroll_depth_50 / scroll_depth_90  ページの読み進み（各1回）
   ========================================================================== */

(function () {
  'use strict';

  var dl = (window.dataLayer = window.dataLayer || []);
  /** 1回だけ送るイベントの記録 */
  var sent = Object.create(null);

  function track(name, params) {
    if (!name) { return; }
    try {
      var payload = { event: name };
      if (params) {
        for (var k in params) {
          if (Object.prototype.hasOwnProperty.call(params, k)) { payload[k] = params[k]; }
        }
      }
      dl.push(payload);
    } catch (e) { /* 計測の失敗で本文機能を止めない */ }
  }

  function once(name, params) {
    if (sent[name]) { return; }
    sent[name] = true;
    track(name, params);
  }

  /* form-handler.js から呼べるように公開する（読み込み順に依存しないよう、
     向こう側は未定義なら自前で dataLayer に push するフォールバックを持つ） */
  window.CUCULFM = window.CUCULFM || {};
  window.CUCULFM.track = track;

  /* ------------------------------------------------------------------
     クリック計測
     ・[data-ga-event] があればその名前で送る（リンク先を変えても計測が外れない）
     ・無ければ href から tel: / mailto: を判定する
     ・キャプチャ段階で拾う = 途中で stopPropagation されても取りこぼさない
     ------------------------------------------------------------------ */
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (!t || typeof t.closest !== 'function') { return; }
    var el = t.closest('a[href],button,[data-ga-event]');
    if (!el) { return; }

    var href = el.getAttribute ? (el.getAttribute('href') || '') : '';
    var name = el.getAttribute && el.getAttribute('data-ga-event');
    if (name) {
      track(name, { link_url: href, link_text: (el.textContent || '').trim().slice(0, 80) });
      return;
    }
    if (/^tel:/i.test(href)) { track('click_phone', { link_url: href }); }
    else if (/^mailto:/i.test(href)) { track('click_email', { link_url: href }); }
  }, true);

  /* ------------------------------------------------------------------
     お問い合わせフォームの表示・入力開始
     ------------------------------------------------------------------ */
  var form = document.getElementById('contactForm');
  if (form) {
    var section = document.getElementById('contact') || form;
    if (window.IntersectionObserver) {
      var io = new IntersectionObserver(function (entries) {
        for (var i = 0; i < entries.length; i += 1) {
          if (entries[i].isIntersecting) {
            once('contact_form_view');
            io.disconnect();
            return;
          }
        }
      }, { threshold: 0.2 });
      io.observe(section);
    } else {
      once('contact_form_view');
    }
    /* focusin はバブリングするので、フォーム1つに付ければ全項目を拾える */
    form.addEventListener('focusin', function () { once('contact_form_start'); });
  }

  /* ------------------------------------------------------------------
     スクロール深度（rAF スロットル。90% まで届いたら購読をやめる）
     ------------------------------------------------------------------ */
  var ticking = false;

  function measure() {
    ticking = false;
    var de = document.documentElement;
    var full = Math.max(de.scrollHeight, document.body ? document.body.scrollHeight : 0);
    var scrollable = full - window.innerHeight;
    if (scrollable <= 0) { return; }
    var ratio = (window.pageYOffset || de.scrollTop || 0) / scrollable;
    if (ratio >= 0.5) { once('scroll_depth_50'); }
    if (ratio >= 0.9) {
      once('scroll_depth_90');
      window.removeEventListener('scroll', onScroll);
    }
  }

  function onScroll() {
    if (ticking) { return; }
    ticking = true;
    if (window.requestAnimationFrame) { window.requestAnimationFrame(measure); }
    else { setTimeout(measure, 120); }
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  measure();   /* 読み込み時点で既に下方にいる場合（深リンク・復元）にも対応 */
}());
