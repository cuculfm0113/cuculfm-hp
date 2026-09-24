/* CUCUL FM — 解説記事テンプレート（blog/ai-guide/）の補助スクリプト
   JSがなくても本文・目次・表はすべて読める。ここでは次の3点だけを足す。
   1. 目次の現在地（読んでいる見出し）を aria-current で示す
   2. 狭い画面では目次を最初は閉じておく
   3. 横にはみ出す表に「横にスクロールできます」の案内を出す */
(function () {
  'use strict';

  var toc = document.querySelector('.g-toc');
  var mq = window.matchMedia('(max-width: 1023px)');
  if (toc && mq.matches) toc.removeAttribute('open');

  // 狭い画面で目次のリンクを押したら、目次を閉じて本文へ
  if (toc) {
    toc.addEventListener('click', function (e) {
      if (e.target.closest('a') && mq.matches) toc.removeAttribute('open');
    });
  }

  // 表の横スクロール案内
  var tables = document.querySelectorAll('.g-table');
  function markScrollable() {
    tables.forEach(function (t) {
      var hint = t.previousElementSibling;
      var over = t.scrollWidth > t.clientWidth + 1;
      if (over && !(hint && hint.classList.contains('g-table-hint'))) {
        hint = document.createElement('p');
        hint.className = 'g-table-hint';
        hint.textContent = '← 横にスクロールできます →';
        t.parentNode.insertBefore(hint, t);
      }
      if (hint && hint.classList.contains('g-table-hint')) {
        hint.classList.toggle('is-visible', over);
      }
    });
  }
  markScrollable();
  window.addEventListener('resize', markScrollable);

  // 目次の現在地（画面上部35%の線を通過した最後の見出し）
  var links = Array.prototype.slice.call(document.querySelectorAll('.g-toc__list a'));
  if (!links.length) return;
  var heads = links
    .map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); })
    .filter(Boolean);
  var ticking = false;
  var last = null;

  function update() {
    ticking = false;
    var line = window.innerHeight * 0.35;
    var current = heads[0];
    for (var i = 0; i < heads.length; i++) {
      if (heads[i].getBoundingClientRect().top <= line) current = heads[i];
    }
    if (current === last) return;
    last = current;
    links.forEach(function (a) {
      if (a.getAttribute('href') === '#' + current.id) a.setAttribute('aria-current', 'true');
      else a.removeAttribute('aria-current');
    });
  }

  window.addEventListener('scroll', function () {
    if (!ticking) { ticking = true; window.requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update);
  update();
})();
