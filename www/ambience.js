/* Zain Life — the soft haze that blooms where you tap a button or a choice.
   Pure decoration; it turns off when the phone asks for reduced motion. */
(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function build() {
    if (document.getElementById('haze-layer')) return;
    var hz = document.createElement('div');
    hz.id = 'haze-layer'; hz.setAttribute('aria-hidden', 'true');
    document.body.appendChild(hz);
  }

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

  if (!reduce) document.addEventListener('pointerdown', haze, { passive: true });
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
