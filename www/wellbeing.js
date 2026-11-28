/* Zain Life — wellbeing tips: a mind or body tip card on Today and the dashboard, gentle tip reminders
   through the day (tips.js picks the tip and the time), their settings under Settings > Health,
   and a "Tips done" tile in the daily report. Loaded after ar.js and before i18n.js. */
(function () {
  'use strict';
  var L = window.LP, T = window.ZLTips;
  if (!L || !T) return;
  var esc = L.esc, A = L.ACTIONS, H = L.HOOKS, toMin = L.toMin;
  if (window.AR_DICT) Object.keys(T.AR).forEach(function (k) { if (!window.AR_DICT[k]) window.AR_DICT[k] = T.AR[k]; });

  // Settings and today's card state. perDay: tip reminders a day (0 = off).
  function W() {
    var s = L.st(), w = s.wellbeing = s.wellbeing || {};
    if (w.card == null) w.card = true;
    if (w.mind == null) w.mind = true;
    if (w.body == null) w.body = true;
    if (w.perDay == null) w.perDay = 2;
    return w;
  }

  // Busy times to keep tips away from: block starts, prayers, meetings and a running focus session.
  function busyFor(d) {
    var out = [], k = L.dateKey(d);
    L.blocksForDate(d).forEach(function (b) {
      var s = toMin(b.start), e = toMin(b.end);
      if (b.cat === 'sleep') return;
      out.push(b.prayer ? [s, e > s ? e : s + 15] : [s, s]);
    });
    var day0 = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    var mins = function (ms) { return Math.round((ms - day0) / 60000); };
    if (window.ZLWork && ZLWork.upcoming) ZLWork.upcoming(30).forEach(function (m) {
      if (L.dateKey(new Date(m.b)) === k) out.push([mins(m.b), mins(m.e)]);
    });
    var tm = L.st().life && L.st().life.timer;
    if (tm && L.dateKey(new Date(tm.start)) === k) out.push([mins(tm.start), mins(tm.start + tm.min * 60000)]);
    return out;
  }
  // Ramadan fasting hours (Fajr to Maghrib), read from the Suhoor and Iftar blocks life.js adds.
  function fastFor(d) {
    var su = null, ift = null;
    L.blocksForDate(d).forEach(function (b) { if (b.id === 'r-suhoor') su = toMin(b.end) + 10; if (b.id === 'r-iftar') ift = toMin(b.start); });
    return su != null && ift != null ? [su, ift] : null;
  }

  /* ---------------- the card ---------------- */
  function currentTip() {
    var w = W(), d = L.today(), k = L.dateKey(d), m = L.nowMin();
    if (w.open && w.open.date === k && T.byId(w.open.tip) && !w.n) return T.byId(w.open.tip);
    var shape = T.dayShape(L.blocksForDate(d)), fast = fastFor(d);
    var atWork = !!(shape.work && m >= shape.work[0] && m < shape.work[1]);
    var cat = T.catFor(d, w, w.day === k ? w.n || 0 : 0);
    if (!cat) return null;
    return T.pick({ cat: cat, atWork: atWork, evening: m >= 18 * 60, fasting: !!(fast && m >= fast[0] && m < fast[1]) }, d, 0, w.day === k ? w.n || 0 : 0);
  }
  function tipCard() {
    var w = W();
    if (!w.card || !L.st().profile) return '';
    var t = currentTip();
    if (!t) return '';
    var rec = L.peekDay(L.todayKey()), did = (rec.tips || []).indexOf(t.id) >= 0;
    return '<div class="card wb-tip wb-' + t.cat + '">' +
      '<div class="wb-head"><span class="lbl">' + (t.cat === 'mind' ? 'Tip for your mind' : 'Tip for your body') + '</span>' +
      '<button class="wb-x" data-act="wb-hide" aria-label="Hide tips">×</button></div>' +
      '<div class="wb-t">' + esc(t.title) + '</div><p class="wb-p">' + esc(t.text) + '</p>' +
      (did ? '<p class="wb-did">✓ Nice one. Back to your day.</p>' : '') +
      '<div class="row-btns">' + (did ? '' : '<button class="btn" data-act="wb-done" data-id="' + t.id + '">Done it</button>') +
      '<button class="btn ghost" data-act="wb-next">Another tip</button></div></div>';
  }
  H.todayTip.push(tipCard);
  H.dashSteps.unshift(tipCard);      // on the dashboard, right under the Now card

  A['wb-next'] = function () {
    var w = W(), k = L.todayKey();
    if (w.day !== k) { w.day = k; w.n = 0; }
    w.n = (w.n || 0) + 1;
    w.open = null;
    L.save(); L.render();
  };
  A['wb-done'] = function (el) {
    var r = L.dayRec(L.todayKey()), id = el.getAttribute('data-id');
    r.tips = r.tips || [];
    if (r.tips.indexOf(id) < 0) r.tips.push(id);
    L.save(); L.render();
  };
  A['wb-hide'] = function () {
    W().card = false;
    L.save(); L.render(); L.toast('Tips hidden. Turn them back on in Settings > Health.');
  };
  H.reportTiles.push(function (k, rec) {
    var n = (rec && rec.tips || []).length;
    return n ? L.statTile('Tips done', String(n)) : '';
  });

  /* ---------------- reminders ---------------- */
  H.notifs.push(function (list, t, now) {
    var w = W();
    if (!L.st().profile || !w.perDay) return;
    T.build({ start: t, now: now, perDay: w.perDay, mind: w.mind, body: w.body, blocksFor: L.blocksForDate, busyFor: busyFor, fastFor: fastFor })
      .forEach(function (n) { list.push(n); });
  });
  H.tap.push(function (x) {
    if (x.type !== 'tip') return false;
    var w = W();
    w.open = { date: x.date, tip: x.tip };
    w.day = x.date; w.n = 0;
    L.save(); L.setTab('today');
    return true;
  });

  /* ---------------- settings (Health group) ---------------- */
  function sw(id, on, title, sub) {
    return '<label class="setrow"><span><span class="st">' + title + '</span><br><span class="sd">' + sub + '</span></span>' +
      '<span class="switch"><input type="checkbox" id="' + id + '"' + (on ? ' checked' : '') + '><span></span></span></label>';
  }
  H.settings.push(function (group) {
    if (group !== 'health') return '';
    var w = W(), native = !!L.LN();
    var chips = [[0, 'Off'], [1, '1 a day'], [2, '2 a day'], [3, '3 a day']].map(function (c) {
      return '<button class="chip' + (w.perDay === c[0] ? ' on' : '') + '" data-act="wb-per" data-v="' + c[0] + '">' + c[1] + '</button>';
    }).join('');
    return '<section><h2>Wellbeing tips</h2><div class="card">' +
      sw('wb-card', w.card, 'Tip card on Today', 'A short mind or body tip on the Today screen and the dashboard') +
      sw('wb-mind', w.mind, 'Mind tips', 'Breathing, breaks, gratitude, people') +
      sw('wb-body', w.body, 'Body tips', 'Posture, stretches, eyes, water, sleep') +
      '<div class="setrow wb-per"><span><span class="st">Tip reminders</span><br><span class="sd">' + (native ? 'Body tips come during work hours, mind tips in the evening. Never while you sleep, pray or focus.' : 'Works in the installed app') + '</span></span></div>' +
      '<div class="chips wb-chips">' + chips + '</div>' +
      '<p class="muted small" style="margin-top:10px">Food and water tips pause while you fast in Ramadan. General habits, not medical advice.</p>' +
      '</div></section>';
  });
  A['wb-per'] = function (el) {
    var v = +el.getAttribute('data-v'), w = W();
    (v > 0 && !w.perDay ? L.enableReminders() : Promise.resolve(true)).then(function () {
      w.perDay = v;
      L.save(); L.render(); L.reschedule();
      L.toast(v ? 'Tip reminders on' : 'Tip reminders off');
    });
  };
  document.addEventListener('change', function (e) {
    var t = e.target, key = { 'wb-card': 'card', 'wb-mind': 'mind', 'wb-body': 'body' }[t.id];
    if (!key) return;
    W()[key] = t.checked;
    L.save(); L.reschedule(); L.toast('Saved');
  });
})();
