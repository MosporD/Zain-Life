/* Zain Life: page transitions and bars that get out of the way while you scroll.
   Only transform and opacity are animated, so the phone's graphics chip moves ready-made layers instead of
   redrawing the page. Everything is skipped when the phone asks for reduced motion. */
(function () {
  'use strict';
  var mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function reduced() { return !!(mq && mq.matches); }

  /* ---------------- page transitions ---------------- */
  // "Fade through": the new page rises a few pixels while it fades in. Vertical on purpose: sliding pages sideways
  // made the phone redraw three to four times as much of the page during the move, and it reads the same in
  // English and Arabic, so nothing needs mirroring.
  var running = null;
  var FRAMES = [{ opacity: 0, transform: 'translate3d(0,14px,0)' }, { opacity: 1, transform: 'none' }];
  function page(from, to) {
    showBars(0);   // setTab has just scrolled to the top; passing 0 avoids reading the scroll position, which would force a layout
    var view = document.getElementById('view');
    if (!view || reduced() || from === to || !view.animate) return;
    if (running) running.cancel();
    running = view.animate(FRAMES, { duration: 240, easing: 'cubic-bezier(.2,.8,.2,1)' });
    running.onfinish = running.oncancel = function () { running = null; };
  }

  /* ---------------- bars react to scrolling ---------------- */
  // Scrolling down hides the top bar and the bottom bar so the page gets the whole screen; any scroll up brings them
  // back. A small dead zone stops them flickering on tiny finger movements, and near the top they always show.
  var body = document.body, lastY = window.pageYOffset || 0, travel = 0, ticking = false, hidden = false;
  var DEAD = 14, TOP = 72;
  function setHidden(h) { if (h === hidden) return; hidden = h; body.classList.toggle('bars-away', h); }
  function showBars(y) { travel = 0; lastY = y == null ? window.pageYOffset || 0 : y; setHidden(false); body.classList.toggle('scrolled', lastY > 4); }
  function busy() { return body.classList.contains('ob') || body.classList.contains('drawer-open') || !!document.querySelector('#sheet-root .sheet'); }
  function onFrame() {
    ticking = false;
    var y = window.pageYOffset || 0, dy = y - lastY;
    lastY = y;
    body.classList.toggle('scrolled', y > 4);
    if (reduced() || busy() || y < TOP) { travel = 0; setHidden(false); return; }
    if ((dy > 0) !== (travel > 0)) travel = 0;   // direction changed: start counting again
    travel += dy;
    if (travel > DEAD) setHidden(true);
    else if (travel < -DEAD) setHidden(false);
  }
  window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onFrame); } }, { passive: true });

  window.ZMotion = { page: page, showBars: showBars };
})();
