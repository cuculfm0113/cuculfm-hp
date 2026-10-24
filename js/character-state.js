/* Runs synchronously in <head>, before either character can be painted.
   Keep this classic script independent of GSAP, modules and WebGL. */
(function () {
  'use strict';
  var root = document.documentElement;
  var presentation = { state: 'fallback' };

  function syncFallback() {
    if (presentation.state !== 'fallback') { return; }
    var seq = document.getElementById('seq');
    var rect = seq && seq.getBoundingClientRect();
    // home.js が失敗した場合、存在しない複製へ表示を移してヒーローを消さない。
    var clone = document.getElementById('seq-cucul-char');
    var inSequence = clone && rect && rect.top <= window.innerHeight * 0.5 && rect.bottom > 0;
    root.setAttribute('data-char-svg', inSequence ? 'seq' : 'hero');
  }
  presentation.setState = function (state) {
    if (state !== 'pending' && state !== 'ready' && state !== 'fallback') { return; }
    presentation.state = state;
    root.setAttribute('data-char-state', state);
    syncFallback();
  };
  presentation.fail = function () {
    presentation.setState('fallback');
    var event = document.createEvent('CustomEvent');
    event.initCustomEvent('char3d:done', false, false, { ok: false });
    window.dispatchEvent(event);
  };
  presentation.syncFallback = syncFallback;
  window.__characterPresentation = presentation;
  root.setAttribute('data-char-svg', 'hero');

  var capable = false;
  try {
    var script = document.createElement('script');
    capable = !/(?:^|[?&])nochar3d(?:[=&]|$)/.test(location.search) &&
      'noModule' in script && typeof HTMLScriptElement.supports === 'function' &&
      HTMLScriptElement.supports('importmap') && typeof window.Promise === 'function' &&
      typeof window.IntersectionObserver === 'function' &&
      typeof window.WebGL2RenderingContext === 'function';
  } catch (error) { capable = false; }
  presentation.setState(capable ? 'pending' : 'fallback');
  document.addEventListener('DOMContentLoaded', syncFallback);
  window.addEventListener('scroll', syncFallback, { passive: true });
  window.addEventListener('resize', syncFallback);
  window.addEventListener('pageshow', syncFallback);
})();
