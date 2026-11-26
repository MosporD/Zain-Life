/* Zain Life — the centre button. One tap opens a sheet with "New block" on top and the lists that
   matter right now: what's next in the plan, the next prayer, and whatever other modules add
   (Work adds the next meeting and open tasks) through LP.HOOKS.quick. */
(function () {
  'use strict';
  var L = window.LP;
  if (!L) return;
  var esc = L.esc, fmt12 = L.fmt12, toMin = L.toMin, A = L.ACTIONS;

  function upNext() {
    var now = L.nowMin(), d = L.today();
    var rec = L.dayRec(L.todayKey());
    var list = L.blocksForDate(d).filter(function (b) {
      return !b.prayer && b.cat !== 'sleep' && toMin(b.end) > now && !(rec.done && rec.done[b.id]);
    }).slice(0, 3);
    if (!list.length) return '<p class="muted small">Nothing else planned today.</p>';
    return '<ul class="qk-list">' + list.map(function (b) {
      var live = toMin(b.start) <= now;
      return '<li><span class="dot" style="background:' + L.catColor(b.cat) + '"></span><span class="ln"><b>' + esc(b.title) + '</b>' +
        '<span>' + (live ? 'Now · until ' + esc(fmt12(b.end)) : esc(fmt12(b.start) + ' – ' + fmt12(b.end))) + '</span></span></li>';
    }).join('') + '</ul>';
  }
  function nextPrayer() {
    var now = L.nowMin(), p = L.prayerBlocks(L.today()).filter(function (x) { return toMin(x.start) > now; })[0];
    var tomorrow = false;
    if (!p) { p = L.prayerBlocks(L.addDays(L.today(), 1))[0]; tomorrow = true; }
    if (!p) return '';
    return '<section class="qk-sec"><h3>Next prayer</h3><div class="qk-one"><b>' + esc(p.title) + '</b><span>' +
      (tomorrow ? 'Tomorrow · ' : '') + esc(fmt12(p.start)) + '</span></div></section>';
  }
  function sheet() {
    var extra = '';
    L.HOOKS.quick.forEach(function (f) { try { extra += f() || ''; } catch (e) { console.warn('quick', e); } });
    return '<div class="qk-top"><button class="btn qk-new" data-act="qk-new-block">' +
      '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>New block</button></div>' +
      '<section class="qk-sec"><h3>Up next</h3>' + upNext() + '</section>' + nextPrayer() + extra +
      '<div class="row-btns"><button class="btn ghost" data-act="close-sheet">Close</button></div>';
  }
  A['qk-open'] = function () { L.openSheet(sheet()); };
  // A new block goes into today's plan; the Plan tab's own button still edits weekday templates.
  // The sheet stays open and its content is swapped, so the back button history stays simple.
  A['qk-new-block'] = function () { A['edit-today'](); A['add-block'](); };

  function build() {
    if (document.getElementById('fab')) return;
    var b = document.createElement('button');
    b.id = 'fab'; b.className = 'fab'; b.setAttribute('data-act', 'qk-open'); b.setAttribute('aria-label', 'Quick lists and new block');
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>';
    document.body.appendChild(b);
  }
  if (document.body) build(); else document.addEventListener('DOMContentLoaded', build);
})();
