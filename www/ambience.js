/* Zain Life — ambience: the moving swirl background and the soft haze that blooms where you tap.
   Pure decoration: nothing here touches the plan or saved data except the on/off setting.
   Battery: animations pause when the app is in the background, and stop entirely when
   "Moving background" is off or the phone asks for reduced motion. */
(function () {
  'use strict';
  var SWIRL = '<path d="M33.1075 15.7299C33.1075 12.2743 30.4499 9.66059 26.6571 9.95169C18.6087 10.5695 17.5699 19.7237 22.8099 20.3101C28.2886 20.9216 30.2488 15.1288 30.3535 14.8042C30.3535 14.8021 30.3577 14.8021 30.3577 14.8042C30.3703 15.1979 30.6614 23.1688 22.5334 23.1688C18.3092 23.1688 16.1353 19.7174 16.1353 16.7247C16.1353 12.291 20.4496 7.88043 26.5335 7.64587C29.9431 7.51393 32.1881 8.32024 33.9474 10.0794C37.5328 13.6649 36.5003 20.3876 33.5976 23.7071C28.9922 28.9763 22.5167 30.3146 16.4851 27.6108C10.4535 24.905 8.2901 17.0744 11.9467 10.5213C13.2913 8.11081 18.1752 2.74102 26.567 2.74102C37.2207 2.74102 42.624 10.2931 41.6481 19.1645C40.9004 25.9626 36.7705 30.8863 34.8563 32.966C26.4456 42.1055 14.0871 43.9275 6.30051 39.1756C2.01558 36.5598 -0.47664 31.8644 0.0762554 26.5511C0.551661 30.39 2.46376 33.7094 5.64709 35.8812C12.0117 40.2227 22.657 40.8196 30.3494 32.3586C22.6172 38.1347 13.5824 38.0467 7.41468 34.0278C1.75379 30.3397 0.197725 22.9782 2.96848 15.6964C1.57787 22.1887 3.81249 28.2056 8.72152 31.3429C16.3741 36.231 27.5241 33.4204 34.5505 25.5479C36.9443 22.8651 38.3182 19.2462 38.2742 15.9435C38.1988 10.4376 34.3641 5.49502 26.6173 5.49502C18.6653 5.49502 13.2033 11.6418 13.2033 16.7582C13.2033 22.4379 17.1008 25.6778 22.1858 25.6778C27.2142 25.6736 33.1075 22.5028 33.1075 15.7299Z"/>';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;

  function motionOn() {
    var L = window.LP;
    var s = L && L.st ? L.st().settings : null;
    return !(s && s.motion === false);
  }
  function applyMotion() { root.classList.toggle('bg-off', !motionOn() || reduce); }

  /* ---------------- background ---------------- */
  function build() {
    if (document.getElementById('bg')) return;
    var bg = document.createElement('div');
    bg.id = 'bg'; bg.setAttribute('aria-hidden', 'true');
    var svg = function (cls) { return '<svg class="bg-swirl ' + cls + '" viewBox="-1 2 44.5 42.5">' + SWIRL + '</svg>'; };
    bg.innerHTML = '<svg width="0" height="0" style="position:absolute"><defs><linearGradient id="bg-swg" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#a48bff"/><stop offset=".55" stop-color="#5b8cff"/><stop offset="1" stop-color="#d070e8"/></linearGradient></defs></svg>' +
      '<div class="bg-blob b1"></div><div class="bg-blob b2"></div><div class="bg-blob b3"></div>' + svg('s1') + svg('s2') + svg('s3');
    document.body.insertBefore(bg, document.body.firstChild);
    var hz = document.createElement('div');
    hz.id = 'haze-layer'; hz.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hz);
    applyMotion();
  }

  // The background leans gently towards your finger, and drifts back to centre when you let go.
  var raf = 0, tx = 0, ty = 0;
  function lean(x, y) {
    if (reduce || root.classList.contains('bg-off')) return;
    tx = (x / window.innerWidth - 0.5) * 2; ty = (y / window.innerHeight - 0.5) * 2;
    if (!raf) raf = requestAnimationFrame(function () {
      raf = 0;
      root.style.setProperty('--px', tx.toFixed(3));
      root.style.setProperty('--py', ty.toFixed(3));
    });
  }
  var settle = null;
  function release() { clearTimeout(settle); settle = setTimeout(function () { lean(window.innerWidth / 2, window.innerHeight / 2); }, 1800); }

  /* ---------------- tap haze ---------------- */
  var TAPPABLE = 'button, .btn, .chip, [data-act], [data-tab], summary, .switch, label.filebtn';
  function haze(e) {
    var layer = document.getElementById('haze-layer');
    var el = e.target && e.target.closest ? e.target.closest(TAPPABLE) : null;
    if (!layer || !el || el.disabled || el.classList.contains('backdrop')) return;
    var r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    var size = Math.max(90, Math.min(320, Math.max(r.width, r.height) * 1.5));
    var x = e.clientX || r.left + r.width / 2, y = e.clientY || r.top + r.height / 2;
    var h = document.createElement('span');
    h.className = 'haze';
    h.style.width = h.style.height = size + 'px';
    h.style.left = x + 'px'; h.style.top = y + 'px';
    layer.appendChild(h);
    setTimeout(function () { if (h.parentNode) h.parentNode.removeChild(h); }, 800);
    while (layer.childNodes.length > 6) layer.removeChild(layer.firstChild);
  }

  document.addEventListener('pointerdown', function (e) { haze(e); lean(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('pointermove', function (e) { if (e.pointerType !== 'mouse' || e.buttons) lean(e.clientX, e.clientY); }, { passive: true });
  document.addEventListener('pointerup', release, { passive: true });
  document.addEventListener('pointercancel', release, { passive: true });
  document.addEventListener('visibilitychange', function () { root.classList.toggle('bg-hidden', document.hidden); });

  /* ---------------- setting ---------------- */
  function hook() {
    var L = window.LP;
    if (!L || !L.ACTIONS) return;
    L.ACTIONS.motion = function (el) {
      L.st().settings.motion = el.getAttribute('data-v') === 'on';
      L.save(); applyMotion(); L.render();
    };
    L.HOOKS.saved.push(applyMotion);
  }
  hook();
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
