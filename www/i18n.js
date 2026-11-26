/* Arabic interface. The app draws its screens in English; when Arabic is on, this file swaps the
   text for Arabic as it appears (screens, sheets, toasts, placeholders, notifications) and flips the
   layout right-to-left. Phrases come from ar.js; longest phrases are replaced first so that
   "Daily report" wins over "Daily". Numbers stay as Western digits, as most Jordanian apps show them. */
(function () {
  'use strict';
  var AR = window.AR_DICT || {};
  var lang = 'en', re = null, patterns = [], obs = null;

  function escRe(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
  function build() {
    var keys = Object.keys(AR).filter(function (k) { return k.indexOf('{d}') < 0; })
      .sort(function (a, b) { return b.length - a.length; });
    // A phrase only matches as whole words: "Rest" must not hit "Restore".
    re = new RegExp(keys.map(function (k) {
      return (/^[A-Za-z]/.test(k) ? '(?<![A-Za-z])' : '') + escRe(k) + (/[A-Za-z]$/.test(k) ? '(?![A-Za-z])' : '');
    }).join('|'), 'g');
    patterns = Object.keys(AR).filter(function (k) { return k.indexOf('{d}') >= 0; }).map(function (k) {
      return { re: new RegExp(escRe(k).replace('\\{d\\}', '([A-Za-z]+)'), 'g'), to: AR[k] };
    });
  }

  // Units and times that follow a number: "7:30 pm" → "7:30 م", "60 kg" → "60 كغ", "1h 30m" → "1س 30د".
  var UNITS = [
    [/(\d) ?am(?![A-Za-z])/g, '$1 ص'], [/(\d) ?pm(?![A-Za-z])/g, '$1 م'],
    [/(\d) ?kcal(?![A-Za-z])/g, '$1 سعرة'], [/(\d) ?kg(?![A-Za-z])/g, '$1 كغ'], [/(\d) ?cm(?![A-Za-z])/g, '$1 سم'],
    [/(\d) ?mins?(?![A-Za-z])/g, '$1 دقيقة'], [/(\d) ?minutes(?![A-Za-z])/g, '$1 دقيقة'],
    [/(\d) ?ml(?![A-Za-z])/g, '$1 مل'], [/(\d) ?g(?![A-Za-z])/g, '$1 غ'], [/(\d) ?L(?![A-Za-z])/g, '$1 لتر'],
    [/(\d)h(?![A-Za-z])/g, '$1س'], [/(\d)m(?![A-Za-z])/g, '$1د'], [/(\d) s(?![A-Za-z])/g, '$1 ث'],
    [/(\d) days?(?![A-Za-z])/g, '$1 يوم'], [/(\d) weeks?(?![A-Za-z])/g, '$1 أسبوع'], [/(\d) months?(?![A-Za-z])/g, '$1 شهر'],
    [/(\d) glass(es)?(?![A-Za-z])/g, '$1 كوب'], [/(\d) sets?(?![A-Za-z])/g, '$1 مجموعة'], [/(\d) pages?(?![A-Za-z])/g, '$1 صفحة'],
    [/(\d) tasks?(?![A-Za-z])/g, '$1 مهمة'], [/(\d) times(?![A-Za-z])/g, '$1 مرات'], [/(\d) pts(?![A-Za-z])/g, '$1 نقطة'],
    [/(\d) photos?(?![A-Za-z])/g, '$1 صورة'], [/(\d) workouts?(?![A-Za-z])/g, '$1 تمرين'], [/(\d) hours?(?![A-Za-z])/g, '$1 ساعة'],
    [/(\d) ?×(?= ?a week)/g, '$1 مرات']
  ];

  function str(s) {
    if (lang !== 'ar' || !s || !/[A-Za-z]/.test(s)) return s;
    var whole = s.trim();
    if (AR[whole]) return s.replace(whole, AR[whole]);       // a full sentence we know exactly
    var out = s;
    patterns.forEach(function (p) { out = out.replace(p.re, function (m, d) { return p.to.replace('{d}', AR[d] || d); }); });
    out = out.replace(re, function (m) { return AR[m]; });
    UNITS.forEach(function (u) { out = out.replace(u[0], u[1]); });
    out = out.replace(/([؀-ۿ]), /g, '$1، ');      // Arabic comma after Arabic words
    return out;
  }

  var SKIP = { SCRIPT: 1, STYLE: 1, TEXTAREA: 1, INPUT: 1, SELECT: 0, OPTION: 0 };
  function skipEl(el) {
    for (var e = el; e && e.nodeType === 1; e = e.parentNode) {
      if (SKIP[e.tagName] || (e.classList && e.classList.contains('notr'))) return true;
    }
    return false;
  }
  // Placeholders and labels of input boxes are translated; what the person typed is not.
  function noTr(el) { return !!(el.closest && el.closest('.notr')); }
  function doAttrs(el) {
    ['placeholder', 'aria-label', 'title'].forEach(function (a) {
      var v = el.getAttribute && el.getAttribute(a);
      if (v) { var t = str(v); if (t !== v) el.setAttribute(a, t); }
    });
  }
  function walk(root) {
    if (lang !== 'ar' || !root) return;
    if (root.nodeType === 3) {
      if (!skipEl(root.parentNode)) { var t0 = str(root.nodeValue); if (t0 !== root.nodeValue) root.nodeValue = t0; }
      return;
    }
    if (root.nodeType !== 1 && root.nodeType !== 9 && root.nodeType !== 11) return;
    if (root.nodeType === 1) { if (!noTr(root)) doAttrs(root); if (skipEl(root)) return; }
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, null), n;
    while ((n = w.nextNode())) {
      if (n.nodeType === 1) { if (!noTr(n)) doAttrs(n); continue; }
      if (skipEl(n.parentNode)) continue;
      var t = str(n.nodeValue);
      if (t !== n.nodeValue) n.nodeValue = t;
    }
  }

  function watch() {
    if (obs) return;
    obs = new MutationObserver(function (muts) {
      if (lang !== 'ar') return;
      muts.forEach(function (m) {
        if (m.type === 'characterData') walk(m.target);
        else if (m.type === 'attributes') { if (!noTr(m.target)) doAttrs(m.target); }
        else for (var i = 0; i < m.addedNodes.length; i++) walk(m.addedNodes[i]);
      });
    });
    obs.observe(document.documentElement, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ['placeholder', 'aria-label', 'title'] });
  }

  function apply(l) {
    lang = l === 'ar' ? 'ar' : 'en';
    document.documentElement.setAttribute('lang', lang);
    document.documentElement.setAttribute('dir', lang === 'ar' ? 'rtl' : 'ltr');
    if (lang === 'ar') { if (!re) build(); watch(); walk(document.body); document.title = 'زين لايف'; }
    else document.title = 'Zain Life';
  }

  window.I18N = { apply: apply, str: str, lang: function () { return lang; } };

  // Notifications are scheduled as English text; translate them on the way out.
  if (window.LP && LP.HOOKS) {
    LP.HOOKS.notifs.push(function (list) {
      if (lang !== 'ar') return;
      list.forEach(function (n) { n.title = str(n.title); n.body = str(n.body); });
    });
  }

  var saved = 'en';
  try { var s = JSON.parse(localStorage.getItem('lifeplanner.v1')); if (s && s.settings && s.settings.lang) saved = s.settings.lang; } catch (e) { /* default */ }
  apply(saved);
})();
